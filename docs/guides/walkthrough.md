# Walkthrough: operator, tenant admin, learner

One pass through all three tiers on the local stack: the operator sells a plan, a tenant
builds and publishes a course within its entitlements, and a learner buys it, watches a
lecture and takes a test. Start with `make up && make demo`
([quickstart-local.md](quickstart-local.md)). Every account uses `MTLMS_DEMO_PASSWORD` from
`deploy/compose/.env`. Paths are relative to the repository root.

## 1. Operator: catalog and plans

Sign in to the console at http://localhost:3600 as `root@example.com`.

1. **Catalog.** Open **Applications**, then **Features** and **Products**. The seed created
   application `lms` with features such as `self_paced_courses`, `books`, `testseries` and
   `ai_authoring`, and 15 products under them: switches like `books_enabled` (BOOLEAN),
   counts like `self_paced_courses_count` (COUNT), and `quiz_questions_per_quiz` (LIMIT).
2. **Plans.** Open **Plans**. `starter`, `growth` and `scale` each have one published version.
   Open `growth` and try to edit its live version: the API refuses, because published versions
   are immutable. Create a new version instead, change a limit (say
   `self_paced_courses_count` to 30), and publish it. The previous version is retired in the
   same step.
3. **Offer cycling.** Publish the retired version again to switch back; this is how a
   promotional version is turned on and off.
4. **Tenants.** Open **Tenants**, then Northwind Academy. **Subscriptions** shows the Scale
   plan with its snapshot (plan code, name, version, price). **Entitlements** lists one row
   per product, with source `PLAN` and current usage from the counters.
5. **An exception.** On Acme Robotics, override `self_paced_courses_count` with a reason of
   at least 10 characters. The override is recorded with the old and new value; the
   entitlement keeps it until the next plan change.
6. **Assigning a plan.** On a tenant's page, assigning a subscription picks a version, cycle and currency.
   Current usage that does not fit the new limits is reported as a conflict unless forced.

Behind this: [multi-tenancy-and-entitlements.md](../architecture/multi-tenancy-and-entitlements.md).

### Onboarding a new tenant

A tenant can arrive two ways:

- **Self-serve.** Someone signs up in the tenant admin (http://localhost:3610/start),
  creates an organisation, and lands in a dashboard with every gated module locked, because
  without a plan there are no entitlements. Under **Plans** they activate the free plan or
  buy a paid one through platform billing (the stubs locally); the webhook to admin-api
  snapshots the plan into entitlements.
- **By the operator.** The person signs up first (a tenant user must exist), then the
  operator creates the tenant in **Tenants**, choosing that user as owner, and assigns a
  plan.

## 2. Tenant admin: build and publish

Sign in to http://localhost:3610 as `maya@northwind.example.com` (Northwind, Scale).

1. **Navigation.** Everything is unlocked on Scale. Sign in as `arjun@acme.example.com`
   (Acme, Starter) in another browser: **Test series** and AI actions are drawn locked with a
   link to **Plans**, and a direct visit shows "Feature Locked". The server refuses those
   calls too.
2. **A course.** **Courses**, **Create**: title, slug, pricing. The API creates the course
   and its landing page (`courses/<slug>`) in one transaction. Open the curriculum editor
   (**LMS**): add a section, a lesson and a lecture. For the video, paste an EVS video id
   (any id works against the stub), an `https://` HLS or MP4 URL, or a YouTube link.
3. **Prices.** Set an INR and a USD price. Under **Settings**, **Currencies**, enable more
   currencies, see the coverage report, and use the FX suggestion to pre-fill prices.
4. **Publish.** Publishing checks `self_paced_courses_enabled` and the capacity of
   `self_paced_courses_count`, then consumes one slot. Unpublishing releases it. On Acme,
   with Starter's limit of 3, the fourth publish is refused with `ENTITLEMENT_LIMIT_REACHED`.
5. **Assessments.** Add a quiz and an assignment to a course; build a test in **Test series**
   with sections and a question bank.
6. **AI authoring.** On Northwind, **Courses**, generate a course with AI. With no key the
   offline engine answers, so the draft is deterministic placeholder content built from your
   topic. On Acme the same action is refused (`ai_authoring_enabled` is off on Starter).
7. **Storefront.** **Pages**: open the home page in the editor, apply a page template, change
   the theme's colours and fonts, add a section, and publish. The editor renders with the
   same components as the storefront.
8. **Payments.** **Payment** shows the Stripe and Razorpay connections the seed stored
   (credentials sealed; the page only says they are configured) and the webhook URLs a real
   gateway needs. **Coupons** lists `WELCOME20` and `FLAT500`.

Behind this: [templates-and-theming.md](../architecture/templates-and-theming.md),
[payments-and-currency.md](../architecture/payments-and-currency.md),
[ai-authoring.md](../architecture/ai-authoring.md).

## 3. Learner: buy, learn, test

Open http://northwind.lvh.me:3620. The theme you published is applied before first paint.

1. **Browse.** **Courses**, **Books**, **Bundles**, **Test series**, search. Prices show in the
   currency picked for you (your country through the tenant's currency rules, else the
   default).
2. **Preview.** On a course page, play a preview lecture without signing in. It plays through
   `/course-previews/:slug/playback`, which only accepts videos the published page offers.
3. **Buy.** Sign in as `lee@example.com` (or sign up), open a course you are not enrolled in,
   and check out. Try `WELCOME20` at checkout.
   - **Stripe:** you land on the stub's hosted page. **Pay** completes the session, the stub
     sends `checkout.session.completed` signed with the connection's secret to learner-api,
     and redirects you to `/payment-callback`, which calls verify-payment.
   - **Razorpay:** the stub's popup opens; **Pay** sends `payment.captured` and `order.paid`
     to learner-api and hands the page a Checkout signature for verify-payment.
   Either way the webhook marks the order paid and queues fulfillment; whichever of the
   webhook worker and verify-payment runs first grants the enrollment, and the other sees it
   is already done. http://localhost:5189/__stubs/webhooks shows the deliveries and their
   responses; Mailpit shows the purchase email.
4. **Learn.** **My learning**, open the course: the player asks
   `POST /courses/:courseId/lectures/:lectureId/playback`, which checks your enrollment and
   returns an EVS manifest (the stub's 6 second sample) or the stored URL. Progress and watch
   time are recorded as you go.
5. **Test.** Open a test from the test series and submit it; the result page shows score,
   percentile and the report card.
6. **Certificate.** Complete a course to request its certificate; anyone can check it at
   `/certificate/<certificate number>`.

Behind this: [video.md](../architecture/video.md),
[payments-and-currency.md](../architecture/payments-and-currency.md#2-checkout).

## 4. Back to the operator

In the console, Northwind's tenant page shows the order under sales and revenue, and its
entitlements show the usage the tenant consumed by publishing. Nothing the learner did
touched the plan: the runtime reads only entitlements and counters.
