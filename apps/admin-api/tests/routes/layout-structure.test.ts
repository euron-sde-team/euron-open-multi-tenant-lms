/**
 * A header that is not header-shaped must be refused before it is stored.
 *
 * THE FAILURE THIS PREVENTS
 * -------------------------
 * A live tenant site was found with no navigation and no way to sign in.
 * `layout.header` held a copy of the WHOLE layout, header, footer, sidebar and
 * colours, nested inside the header key. Nothing can draw a header out of that,
 * so the renderer drew none, and the storefront had been shipping without a
 * menu or a login button.
 *
 * The write was accepted because the endpoint stored whatever it was handed.
 */
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getLayout = vi.fn();
const updateLayout = vi.fn();

vi.mock("../../src/repositories/tenant.repository", () => ({
  default: { getLayout, updateLayout },
}));

const VALID_HEADER = {
  enabled: true,
  variant: "minimal",
  logo: "",
  logoAlt: "Academy",
  showDarkModeToggle: true,
  navItems: [{ id: "1", label: "All Courses", href: "/all-courses" }],
  cta: { text: "Sign up", href: "/signup", variant: "primary" },
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { updateMyLayout } = await import("../../src/controllers/layout.controller");
  const app = express();
  app.use(express.json());
  app.put(
    "/layout",
    (req, _res, next) => {
      (req as unknown as { tenantId: string }).tenantId = "01TENANT";
      next();
    },
    async (req, res, next) => {
      try {
        await updateMyLayout(req as never, res as never);
      } catch (e) {
        next(e);
      }
    }
  );
  app.use(
    (
      err: { statusCode?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      res.status(err.statusCode ?? 500).json({ success: false, error: { message: err.message } });
    }
  );

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function put(body: unknown) {
  const res = await fetch(`${baseUrl}/layout`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as { error?: { message?: string } } };
}

describe("PUT /layout structural checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLayout.mockResolvedValue({ header: VALID_HEADER, footer: { enabled: true } });
    updateLayout.mockImplementation(async (_t: string, l: unknown) => l);
  });

  it("refuses a whole layout nested inside header", async () => {
    const res = await put({ header: { header: VALID_HEADER, footer: {}, sidebar: {}, topBar: {} } });
    expect(res.status).toBe(400);
    expect(res.body.error?.message).toMatch(/whole layout was passed/i);
    expect(updateLayout, "nothing may be stored").not.toHaveBeenCalled();
  });

  it("refuses a footer sent under the header key", async () => {
    const res = await put({
      header: { enabled: true, columns: [{ id: "c", links: [] }], copyright: "(c) 2026" },
    });
    expect(res.status).toBe(400);
    expect(res.body.error?.message).toMatch(/looks like a footer/i);
    expect(updateLayout).not.toHaveBeenCalled();
  });

  it("refuses an enabled header with no navItems", async () => {
    const res = await put({ header: { enabled: true, logo: "" } });
    expect(res.status).toBe(400);
    expect(res.body.error?.message).toMatch(/no navItems/i);
    expect(updateLayout).not.toHaveBeenCalled();
  });

  it("refuses a string, array or number where an object belongs", async () => {
    // "$s1" is the literal that a broken plan writes when a step reference
    // never resolved, it reached this table once already.
    for (const bad of ["$s1", ["a"], 42]) {
      const res = await put({ header: bad });
      expect(res.status, `rejected ${JSON.stringify(bad)}`).toBe(400);
    }
    expect(updateLayout).not.toHaveBeenCalled();
  });

  it("accepts a real header", async () => {
    const res = await put({ header: VALID_HEADER });
    expect(res.status).toBe(200);
    expect(updateLayout).toHaveBeenCalledTimes(1);
    const stored = updateLayout.mock.calls[0]![1] as { header: { navItems: unknown[] } };
    expect(stored.header.navItems).toHaveLength(1);
  });

  it("lets a header be disabled without demanding navItems", async () => {
    const res = await put({ header: { enabled: false } });
    expect(res.status).toBe(200);
  });

  it("still refuses a nested layout under footer, sidebar or topBar", async () => {
    for (const key of ["footer", "sidebar", "topBar"]) {
      const res = await put({ [key]: { header: {}, footer: {} } });
      expect(res.status, `${key} nested`).toBe(400);
    }
    expect(updateLayout).not.toHaveBeenCalled();
  });
});

describe("navigation items must actually be links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLayout.mockResolvedValue({ header: VALID_HEADER, footer: { enabled: true } });
    updateLayout.mockImplementation(async (_t: string, l: unknown) => l);
  });

  it("refuses the existing menu nested inside the new one", async () => {
    // A caller adding one item wrote `[<the existing array>, <the new link>]`.
    // Seven links collapsed into one unusable entry, and the array check above
    // was satisfied while the navigation was destroyed.
    const res = await put({
      header: {
        enabled: true,
        navItems: [
          [{ id: "1", label: "All Courses", href: "/all-courses" }],
          { label: "Roadmaps", href: "/roadmaps" },
        ],
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error?.message).toMatch(/navItems\[0\] is an array/i);
    expect(updateLayout).not.toHaveBeenCalled();
  });

  it("refuses an entry with no label or href", async () => {
    const res = await put({ header: { enabled: true, navItems: [{ label: "Only a label" }] } });
    expect(res.status).toBe(400);
    expect(res.body.error?.message).toMatch(/label and href/i);
  });
});

describe("a partial section update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLayout.mockResolvedValue({ header: VALID_HEADER, footer: { enabled: true } });
    updateLayout.mockImplementation(async (_t: string, l: unknown) => l);
  });

  it("keeps the fields the caller did not mention", async () => {
    // Asked to add one link, the assistant sent only navItems, and the header
    // came back with no `enabled`, no `cta` and no login button.
    const res = await put({
      header: {
        navItems: [
          { id: "1", label: "All Courses", href: "/all-courses" },
          { id: "2", label: "Roadmaps", href: "/roadmaps" },
        ],
      },
    });

    expect(res.status).toBe(200);
    const stored = updateLayout.mock.calls[0]![1] as {
      header: { enabled: boolean; cta?: { text: string }; navItems: unknown[] };
    };
    expect(stored.header.navItems, "the new menu applied").toHaveLength(2);
    expect(stored.header.enabled, "header stays enabled").toBe(true);
    expect(stored.header.cta?.text, "the sign-up button survives").toBe("Sign up");
  });

  it("still lets an explicitly sent array replace the old one entirely", async () => {
    const res = await put({
      header: { navItems: [{ id: "only", label: "Home", href: "/" }] },
    });
    expect(res.status).toBe(200);
    const stored = updateLayout.mock.calls[0]![1] as { header: { navItems: unknown[] } };
    expect(stored.header.navItems, "removing items still works").toHaveLength(1);
  });
});
