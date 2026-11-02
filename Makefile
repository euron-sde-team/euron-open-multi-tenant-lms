# Open multi-tenant LMS: developer entry points. `make` lists every target.
SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

COMPOSE_DIR := deploy/compose
FLOCI       := docker compose --env-file $(COMPOSE_DIR)/.env -f $(COMPOSE_DIR)/compose.yaml -f $(COMPOSE_DIR)/compose.floci.yaml
AWS_LOCAL   := docker compose --env-file $(COMPOSE_DIR)/.env --env-file $(COMPOSE_DIR)/.env.aws -f $(COMPOSE_DIR)/compose.yaml -f $(COMPOSE_DIR)/compose.aws.yaml
TF_IMAGE    := hashicorp/terraform:1.16.6
TFLINT      := docker run --rm -v $(CURDIR)/infra/terraform:/data -v open-mtlms-tflint:/plugins -e TFLINT_PLUGIN_DIR=/plugins -w /data ghcr.io/terraform-linters/tflint:v0.64.0
TF_ENVS     := local-floci aws-dev aws-prod
# Use a local terraform when installed, otherwise the pinned container.
TF          := $(shell command -v terraform >/dev/null 2>&1 && echo terraform || echo docker run --rm -v $(CURDIR)/infra/terraform:/infra -w /infra $(TF_IMAGE))
TF_ROOT     := $(shell command -v terraform >/dev/null 2>&1 && echo infra/terraform || echo /infra)
ENV         ?= aws-dev
TAG         ?= $(shell git rev-parse --short=12 HEAD 2>/dev/null || echo dev)
# Integration tests: a throwaway database next to the compose one (or whatever answers
# on MTLMS_PG_PORT), recreated, migrated and seeded with the catalog on every run. Redis
# is logical DB 5 with a private BullMQ prefix, so a run never touches (or steals jobs
# from) a dev stack on the same Redis. Another local Postgres: MTLMS_PG_USER/PASSWORD.
PG_PORT     := $${MTLMS_PG_PORT:-5542}
PG_USER     := $${MTLMS_PG_USER:-mtlms}
PG_PASSWORD := $${MTLMS_PG_PASSWORD:-mtlms}
TEST_DB     ?= open_mtlms_test
# Two runs at once (parallel worktrees, agents) need their own DB, Redis DB and prefix.
IT_REDIS_DB ?= 5
IT_PREFIX   ?= mtlms-it
TEST_PG     := PG_DATABASE_HOST=127.0.0.1 PG_DATABASE_PORT=$(PG_PORT) PG_DATABASE_USER=$(PG_USER) PG_DATABASE_PASSWORD=$(PG_PASSWORD) PG_DATABASE=$(TEST_DB) \
               REDIS_HOST=127.0.0.1 REDIS_PORT=$${MTLMS_REDIS_PORT:-6479} REDIS_URL= REDIS_DB=$(IT_REDIS_DB) BULLMQ_PREFIX=$(IT_PREFIX)

.PHONY: help env up urls up-aws down logs ps demo lint typecheck test test-integration e2e build \
        sanitize tf-fmt tf-validate tf-lint tf-security aws-plan aws-deploy aws-migrate aws-operator clean

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage: make \033[36m<target>\033[0m\n\n"} /^[a-zA-Z0-9_-]+:.*##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ─── Local ───────────────────────────────────────────────────────────────────

env: ## Generate deploy/compose/.env with random local-only secrets
	@scripts/gen-local-env.sh

up: env ## Start all three tiers on emulated AWS (Floci), provisioned by the same Terraform as production
	$(FLOCI) up -d --build --wait
	@$(MAKE) --no-print-directory urls
	@echo "  Stripe, Razorpay, the video system and the AI endpoint are the local stubs; AI"
	@echo "  authoring runs offline. Next: make demo   (plans, an operator and demo tenants)"

urls: ## Print the local URLs of every tier
	@echo ""
	@echo "  Tier 1  console      http://localhost:$${MTLMS_CONSOLE_PORT:-3600}   (operator console)"
	@echo "          console-api  http://localhost:$${MTLMS_CONSOLE_API_PORT:-5076}/api/v1/health"
	@echo "  Tier 2  admin        http://localhost:$${MTLMS_ADMIN_PORT:-3610}   (tenant admin)"
	@echo "          admin-api    http://localhost:$${MTLMS_ADMIN_API_PORT:-5086}/api/v1/health"
	@echo "  Tier 3  web          http://northwind.$${MTLMS_ROOT_DOMAIN:-lvh.me}:$${MTLMS_WEB_PORT:-3620}   (a tenant storefront: <tenant>.lvh.me)"
	@echo "          learner-api  http://localhost:$${MTLMS_LEARNER_API_PORT:-5096}/api/v1/health"
	@echo "  stubs    http://localhost:$${MTLMS_STUBS_PORT:-5189}   (Stripe, Razorpay, EVS, AI; webhook log at /__stubs/webhooks)"
	@echo "  mail     http://localhost:$${MTLMS_MAILPIT_PORT:-8096}   (everything SES sends)"
	@echo "  aws      http://localhost:$${MTLMS_FLOCI_PORT:-4647}   (Floci: S3, SES, SQS, SNS, KMS)"
	@echo ""

up-aws: env ## Start the stack against real AWS resources (needs deploy/compose/.env.aws)
	@test -f $(COMPOSE_DIR)/.env.aws || { echo "copy $(COMPOSE_DIR)/.env.aws.example to .env.aws first"; exit 1; }
	$(AWS_LOCAL) up -d --build --wait
	@$(MAKE) --no-print-directory urls

down: ## Stop the stack and delete its volumes
	-$(FLOCI) --profile tools down -v --remove-orphans
	-test -f $(COMPOSE_DIR)/.env.aws && $(AWS_LOCAL) --profile tools down -v --remove-orphans

logs: ## Tail logs (SERVICE=console-api|admin-api|learner-api|console|admin|web|stubs|migrate|floci|terraform|...)
	$(FLOCI) logs -f --tail 100 $(SERVICE)

ps: ## Show stack status
	$(FLOCI) ps -a

demo: ## Seed the demo: plans, an operator and demo tenants with courses and learners (FORCE=1 wipes first)
	$(FLOCI) --profile tools run --rm --build tools sh -c "pnpm --filter @open-mtlms/console-api seed && pnpm --filter @open-mtlms/console-api demo:seed $(if $(FORCE),--force,)"
	@$(MAKE) --no-print-directory urls
	@echo "  Every demo account signs in with MTLMS_DEMO_PASSWORD from $(COMPOSE_DIR)/.env."

# ─── Quality ─────────────────────────────────────────────────────────────────

lint: ## Lint every package
	pnpm lint

typecheck: ## Typecheck every package
	pnpm typecheck

test: ## Unit tests (every package; no database needed)
	pnpm test

test-integration: ## API integration tests: recreate, migrate and seed $(TEST_DB) (catalog only), then run them
	@scripts/test-db.sh $(TEST_DB)
	DATABASE_URL= $(TEST_PG) pnpm db:migrate
	DATABASE_URL= $(TEST_PG) pnpm --filter @open-mtlms/console-api seed
	DATABASE_URL= $(TEST_PG) pnpm test:integration

e2e: up demo ## Browser end-to-end tests (Playwright) against the Floci stack (skipped while e2e/tests is absent)
	@if [ -d e2e/tests ]; then pnpm e2e; else echo "no browser tests yet (e2e/tests is absent)"; fi

build: ## Build every package
	pnpm build

sanitize: ## Scan committable files for credentials, account ids, internal names, real emails and IPs
	@scripts/check-sanitization.sh

# ─── Terraform ───────────────────────────────────────────────────────────────

tf-fmt: ## Format all Terraform (CHECK=1: only check)
	$(TF) fmt -recursive $(if $(CHECK),-check -diff,) $(TF_ROOT)

tf-validate: ## terraform fmt -check, then validate every environment (no backend, no credentials)
	$(TF) fmt -recursive -check $(TF_ROOT)
	@for env in $(TF_ENVS); do \
	  echo "== $$env"; \
	  $(TF) -chdir=$(TF_ROOT)/envs/$$env init -backend=false -input=false -no-color >/dev/null && \
	  $(TF) -chdir=$(TF_ROOT)/envs/$$env validate -no-color || exit 1; \
	done

tf-lint: ## tflint every module and environment (plugins cached in a docker volume)
	$(TFLINT) --init
	$(TFLINT) --recursive --format compact

tf-security: ## checkov policy scan of the Terraform (any unskipped finding fails)
	docker run --rm -v $(CURDIR)/infra/terraform:/tf bridgecrew/checkov:3.3.30 -d /tf --config-file /tf/.checkov.yaml --framework terraform --quiet --compact

# ─── AWS ─────────────────────────────────────────────────────────────────────

aws-plan: ## terraform plan for ENV (aws-dev | aws-prod); needs terraform.tfvars and AWS credentials
	terraform -chdir=infra/terraform/envs/$(ENV) init -input=false
	terraform -chdir=infra/terraform/envs/$(ENV) plan -var image_tag=$(TAG)

aws-deploy: ## One shot: registries, six images, infrastructure, migrations, rollout (ENV=aws-dev|aws-prod)
	@scripts/aws-deploy.sh $(ENV) $(TAG)

aws-migrate: ## Run database migrations as a one-off ECS task (ENV=...)
	@scripts/aws-run-task.sh $(ENV) migrate

aws-operator: ## Create the first operator on AWS (ENV=... EMAIL=you@example.com); prints a one-time password
	@test -n "$(EMAIL)" || { echo "usage: make aws-operator ENV=aws-prod EMAIL=you@example.com"; exit 1; }
	@scripts/aws-run-task.sh $(ENV) operator "$(EMAIL)"

clean: ## Remove build output
	rm -rf apps/*/dist apps/*/dist-scripts apps/*/.next packages/*/dist .turbo e2e/.report e2e/.results
