# AI authoring

Tenant staff can draft courses, books, batches, test series, questions, quizzes,
assignments and storefront pages with a language model, then edit the result like anything
they wrote by hand. All of it lives in admin-api. Without a key, a deterministic offline
engine answers instead, so every flow works in a demo and in tests. Paths are relative to
the repository root.

## 1. Provider

One module talks to models: [`apps/admin-api/src/lib/ai/provider.ts`](../../apps/admin-api/src/lib/ai/provider.ts),
built on the AI SDK (`@ai-sdk/openai`, `createOpenAI`).

| Setting | Default | Meaning |
| --- | --- | --- |
| `AI_PROVIDER` | `openai` when `AI_API_KEY` is set, else `offline` | `openai` means any OpenAI-compatible chat completions API: OpenAI, Azure OpenAI, OpenRouter, Ollama, vLLM, LM Studio, Gemini's OpenAI endpoint |
| `AI_BASE_URL` | `https://api.openai.com/v1` | Base URL of that API |
| `AI_API_KEY` | empty | Bearer key. The live provider is used only when `AI_PROVIDER=openai` **and** a key is set; otherwise the offline engine answers |
| `AI_TEXT_MODEL` | `gpt-4o-mini` | Model for text and structured output |
| `AI_MODEL_<PURPOSE>` | `AI_TEXT_MODEL` | Per-purpose override, for example `AI_MODEL_PAGE`, `AI_MODEL_TEST` |
| `AI_IMAGE_MODEL` | empty | Image model for thumbnails, covers and page images. Images are generated only in `openai` mode with this set |
| `AI_AUTO_GENERATION_ENABLED` | `false` | Only gates automatic question bank descriptions |

Callers ask for `getTextModel(purpose)` and use `generateText` or `generateObject` as usual.
Purposes: `course`, `course_title`, `book`, `batch`, `page`, `onboarding`, `quiz`,
`assignment`, `test`, `test_series`, `question_import`, `site_health`. Image sizes follow the
aspect ratio asked for (1024x1024, 1536x1024, 1024x1536); a failed image returns nothing and
the caller carries on without it.

An empty `AI_TEXT_MODEL` (which compose and Terraform pass when the variable is unset)
falls back to `gpt-4o-mini`, and an empty `AI_MODEL_<PURPOSE>` to `AI_TEXT_MODEL`. Set it to
a model your endpoint serves whenever `AI_PROVIDER=openai` and the endpoint is not OpenAI.

## 2. Offline engine

[`apps/admin-api/src/lib/ai/offline.ts`](../../apps/admin-api/src/lib/ai/offline.ts) is a
local model (the AI SDK's `MockLanguageModelV3`) with no network:

- A structured request (JSON schema) gets data shaped by the schema, with text derived from
  the topic it finds in the prompt.
- A plain request gets prose built from that topic.
- The same prompt always gives the same output.
- It never generates images.

It is the default locally (`AI_PROVIDER=offline` in compose) and in CI. The stubs also serve
an OpenAI-compatible API (`/v1/chat/completions`, `/v1/models`) with deterministic output, to
exercise the real client: set `AI_PROVIDER=openai`, `AI_BASE_URL=http://stubs:5189/v1` and any
non-empty `AI_API_KEY`.

## 3. Gate

`requireAiAuthoring` ([`middlewares/ai-authoring.middleware.ts`](../../apps/admin-api/src/middlewares/ai-authoring.middleware.ts))
calls `ensureAiAuthoringEnabled`: the tenant needs an active `ai_authoring_enabled`
entitlement (Growth and Scale in the seed catalog), or the request is refused with
`ENTITLEMENT_FEATURE_DISABLED`. The route's permission is checked too.

## 4. What can be generated

| What | Endpoint (under `/api/v1/tenant`) | Permission | Runs as |
| --- | --- | --- | --- |
| A course (outline, sections, lessons, descriptions, thumbnails 16:9 and 9:16) | `POST /courses/ai/generate`, `GET /courses/ai/status/:jobId` | `courses.create` | Job on `course-ai-generation` |
| A book (structure, description, 3:4 cover) | `POST /books/ai/generate`, status | `books.*` | `book-ai-generation` |
| A batch's content | `POST /batches/:batchId/ai/generate`, status | `batches.update` | `batch-ai-generation` |
| A test series | `POST /test-series/ai/generate`, status | `tests.ai_generate` | `test-series-ai-generation` |
| Questions from an uploaded PDF | `GET /test-questions/banks/:bankId/ai-generate/upload-url`, `POST /test-questions/banks/:bankId/ai-generate`, status | `tests.ai_generate` | `test-ai-generation` |
| Quiz questions from a lecture transcript, or for an existing quiz | `POST /quizzes/generate-from-transcript`, `POST /quizzes/:id/generate-questions` | `quizzes.*` | Request |
| An assignment from a transcript | `POST /assignments/generate-from-transcript` | `assignments.*` | Request |
| A page plan, one section, a page image | `POST /pages/ai/plan-page`, `POST /pages/ai/generate-section`, `POST /pages/ai/generate-image`, statuses | `ai.content_gen.use` | `page-plan-ai-generation`, `page-image-ai-generation` |

Long generations are BullMQ jobs with one job id per tenant (for example
`course-ai-<tenantId>`), so a tenant runs one course generation at a time. The admin app
polls the status endpoint and applies the result to its editor; a partially failed course
draft is applied section by section (tested in
`apps/admin-api/tests/services/course-ai-partial-apply.test.ts`).

Section-level AI contracts used by the page editor are in
`apps/admin/src/lib/section-ai-configs.ts`.

## 5. Usage

`recordUsage()` is the metering hook. Today it writes a debug log line and nothing else: no
token counts are stored and no per-tenant cap exists beyond the entitlement switch. It is
called from course, book, batch, test series and page generation and for images, not from
quiz, assignment, test question, import or site-health calls.

## 6. Data leaving the deployment

In `openai` mode, prompts include what staff typed and the content being drafted (titles,
descriptions, transcripts, PDF text). That content goes to whatever `AI_BASE_URL` points at.
Use a provider whose data terms fit your tenants, or a self-hosted OpenAI-compatible server.
Nothing is sent in offline mode.

## 7. Gaps

- Some AI calls are not behind `requireAiAuthoring`: the AI question imports
  (`POST /test-questions/banks/:bankId/import-docx-ai`, `/import-ai`, which need only
  `tests.import`), question description and formatting helpers, site health, and the
  template, theme and course title picks during onboarding.
- `AI_REQUEST_TIMEOUT_MS` is read into config but not applied to requests.
- No metering or budget per tenant (see section 5).
