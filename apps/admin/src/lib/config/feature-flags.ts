/**
 * Build-time visibility flags.
 *
 * WHY THE EXPLICIT `: boolean`
 * Without it TypeScript infers the literal type, every `if (FLAG)` branch
 * narrows to unreachable and stops being type-checked. The annotation keeps
 * both branches honest.
 */

/**
 * Automatic AI IMAGE generation during onboarding auto-provisioning.
 *
 * Off by default: auto-provisioning runs on every tenant signup and would ask
 * the AI provider for an image on every AI-fillable section. Text generation
 * stays on. Set NEXT_PUBLIC_AI_AUTO_IMAGES_ENABLED=true to enable images.
 */
export const AI_AUTO_IMAGES_ENABLED: boolean =
  process.env.NEXT_PUBLIC_AI_AUTO_IMAGES_ENABLED === "true";
