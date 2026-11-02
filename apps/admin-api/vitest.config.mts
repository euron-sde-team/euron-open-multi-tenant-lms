/**
 * Unit tests only (`pnpm test`, no database). The integration specs under
 * tests/integration run from the root: `make test-integration`.
 */
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "tests/integration/**"],
  },
});
