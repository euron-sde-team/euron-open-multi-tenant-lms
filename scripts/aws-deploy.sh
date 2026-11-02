#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# One-shot deployment to AWS:  scripts/aws-deploy.sh <aws-dev|aws-prod> <image-tag>
#
#   1. terraform apply the image registries (and the KMS key that encrypts them)
#   2. build the six images for $PLATFORM (linux/amd64 or linux/arm64), tag them with
#      the commit, push: the three APIs (infra/docker/api.Dockerfile, APP=...) and the
#      three Next.js servers (infra/docker/next.Dockerfile, NEXT_PUBLIC_* for this
#      deployment's hosts)
#   3. terraform apply what the migrate task needs (network, database, task definition)
#   4. run the migrate task and wait for it (it must exit 0)
#   5. terraform apply everything else: cache, mail, assets bucket and media CDN, the
#      load balancer with its WAF, the six services
#   6. wait for every service to become stable
#
# Needs: terraform, docker (buildx), the AWS CLI, python3, credentials for the target
# account, and infra/terraform/envs/<env>/terraform.tfvars (copy the .example).
#
# PLATFORM (the image platform) defaults from cpu_architecture in terraform.tfvars and
# must agree with it, because a mismatch builds fine but the tasks die at start with
# "exec format error":
#   cpu_architecture = "X86_64" (default)  PLATFORM=linux/amd64
#   cpu_architecture = "ARM64" (Graviton)  PLATFORM=linux/arm64
# Building linux/arm64 on an x86 machine (or the reverse) needs QEMU binfmt for buildx.
# NEXT_PUBLIC_POSTHOG_KEY (optional) is passed to the three web builds from your shell.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
ENV="${1:?usage: aws-deploy.sh <aws-dev|aws-prod> <image-tag>}"
TAG="${2:?usage: aws-deploy.sh <aws-dev|aws-prod> <image-tag>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/infra/terraform/envs/$ENV"
# Image platform: follows cpu_architecture in terraform.tfvars unless PLATFORM is set,
# and must agree with it.
arch=$(sed -nE 's/^cpu_architecture *= *"([^"]+)".*/\1/p' "$DIR/terraform.tfvars" 2>/dev/null || true)
want=$([[ "${arch:-X86_64}" == ARM64 ]] && echo linux/arm64 || echo linux/amd64)
PLATFORM="${PLATFORM:-$want}"
if [[ "$PLATFORM" != "$want" ]]; then
  echo "PLATFORM=$PLATFORM does not match cpu_architecture=${arch:-X86_64} in terraform.tfvars (needs $want)"
  exit 2
fi

for bin in terraform docker aws python3; do command -v "$bin" >/dev/null || { echo "missing: $bin"; exit 1; }; done
[[ -f "$DIR/terraform.tfvars" ]] || { echo "create $DIR/terraform.tfvars from terraform.tfvars.example first"; exit 1; }
if [[ -n "$(git -C "$ROOT" status --porcelain 2>/dev/null)" ]]; then
  echo "note: the working tree has uncommitted changes; the images are built from it as-is"
fi

tf() { terraform -chdir="$DIR" "$@"; }
json() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)"; }

region="${AWS_REGION:-$(sed -nE 's/^region *= *"([^"]+)".*/\1/p' "$DIR/terraform.tfvars")}"
[[ -n "$region" ]] || { echo "set region in terraform.tfvars (or AWS_REGION)"; exit 1; }
export AWS_REGION="$region"

echo "==> terraform init"
tf init -input=false >/dev/null

echo "==> 1/6 registries"
tf apply -input=false -auto-approve -var "image_tag=$TAG" -target=module.app.module.ecr

repos=$(tf output -json ecr_repositories)
registry=$(json "list(d.values())[0].split('/')[0]" <<<"$repos")
aws ecr get-login-password --region "$region" | docker login --username AWS --password-stdin "$registry" >/dev/null

# The hosts every image is built for, from the domain in terraform.tfvars (the same
# names modules/deployment derives).
domain=$(sed -nE 's/^domain *= *"([^"]+)".*/\1/p' "$DIR/terraform.tfvars")
[[ -n "$domain" ]] || { echo "set domain in terraform.tfvars"; exit 1; }

echo "==> 2/6 images ($TAG, $PLATFORM)"
for app in console-api admin-api learner-api; do
  repo=$(json "d['$app']" <<<"$repos")
  echo "--> $app"
  docker buildx build --platform "$PLATFORM" -f "$ROOT/infra/docker/api.Dockerfile" --target runtime \
    --build-arg "APP=$app" -t "$repo:$TAG" --push "$ROOT"
done
build_web() { # app, port, api base, extra build args...
  local app="$1" port="$2" api="$3"; shift 3
  local repo; repo=$(json "d['$app']" <<<"$repos")
  echo "--> $app (NEXT_PUBLIC_API_BASE_URL=$api)"
  docker buildx build --platform "$PLATFORM" -f "$ROOT/infra/docker/next.Dockerfile" \
    --build-arg "APP=$app" --build-arg "PORT=$port" \
    --build-arg "NEXT_PUBLIC_API_BASE_URL=$api" \
    --build-arg "NEXT_PUBLIC_ROOT_DOMAIN=$domain" \
    --build-arg "NEXT_PUBLIC_POSTHOG_KEY=${NEXT_PUBLIC_POSTHOG_KEY:-}" \
    "$@" -t "$repo:$TAG" --push "$ROOT"
}
build_web console 3600 "https://api-console.$domain/api/v1" \
  --build-arg "NEXT_PUBLIC_ADMIN_URL=https://admin.$domain" --build-arg "NEXT_PUBLIC_WEB_BASE_URL=https://$domain"
build_web admin 3610 "https://api-admin.$domain/api/v1" \
  --build-arg "NEXT_PUBLIC_LEARNER_API_BASE_URL=https://api.$domain/api/v1" --build-arg "NEXT_PUBLIC_WEB_BASE_URL=https://$domain"
build_web web 3620 "https://api.$domain/api/v1"

echo "==> 3/6 database and the migrate task"
tf apply -input=false -auto-approve -var "image_tag=$TAG" -target=module.app.module.migrate

echo "==> 4/6 migrations"
"$ROOT/scripts/aws-run-task.sh" "$ENV" migrate

echo "==> 5/6 everything else"
tf apply -input=false -auto-approve -var "image_tag=$TAG"

echo "==> 6/6 waiting for the services"
cluster=$(tf output -raw cluster_name)
read -r -a services <<<"$(tf output -json services | json "' '.join(d.values())")"
aws ecs wait services-stable --region "$region" --cluster "$cluster" --services "${services[@]}"

urls=$(tf output -json urls)
cat <<NEXT

Deployed $TAG to $ENV
  console      $(json "d['console']" <<<"$urls")
  admin        $(json "d['admin']" <<<"$urls")
  storefronts  $(json "d['web']" <<<"$urls")  and https://<tenant>.$domain
  APIs         $(json "d['console_api']" <<<"$urls"), $(json "d['admin_api']" <<<"$urls"), $(json "d['learner_api']" <<<"$urls")
  media        $(json "d['assets']" <<<"$urls")

1. Create the first operator, then sign in to the console and create plans:
     make aws-operator ENV=$ENV EMAIL=you@example.com
   (the demo seed, make demo, is for local stacks only).
2. Provider keys (AI_API_KEY, EVS_API_KEY, PLATFORM_* billing keys): put them in
   provider_secrets (terraform.tfvars) or by hand into the secret named by
     terraform -chdir=infra/terraform/envs/$ENV output providers_secret_name
   then roll the services: re-run make aws-deploy, or
     aws ecs update-service --cluster $cluster --service <name> --force-new-deployment
3. Gateway webhooks: tenants point Stripe at $(json "d['learner_api']" <<<"$urls")/api/v1/webhooks/stripe
   and Razorpay at .../api/v1/webhooks/razorpay; platform billing webhooks go to
   $(json "d['admin_api']" <<<"$urls")/api/v1/webhook/{stripe,razorpay}/subscription.
NEXT
