import { describe, expect, it } from "vitest";

import { parseBody, parseStripeForm } from "../src/form.ts";
import { completionContent, sampleFromSchema } from "../src/openai.ts";

describe("parseStripeForm", () => {
  it("rebuilds the nested objects and arrays the Stripe SDK flattens", () => {
    const body = new URLSearchParams({
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": "2500",
      "line_items[0][price_data][product_data][name]": "Course",
      "metadata[order_id]": "ord_1",
      "metadata[tenant_id]": "ten_1",
    }).toString();
    expect(parseStripeForm(body)).toEqual({
      mode: "payment",
      line_items: [{ quantity: "1", price_data: { currency: "usd", unit_amount: "2500", product_data: { name: "Course" } } }],
      metadata: { order_id: "ord_1", tenant_id: "ten_1" },
    });
  });

  it("keeps the literal {CHECKOUT_SESSION_ID} token in URLs", () => {
    const parsed = parseStripeForm("success_url=https%3A%2F%2Fshop.example.com%2Fdone%3Fsession_id%3D%7BCHECKOUT_SESSION_ID%7D");
    expect(parsed.success_url).toBe("https://shop.example.com/done?session_id={CHECKOUT_SESSION_ID}");
  });

  it("parseBody picks JSON or form by content type", () => {
    expect(parseBody('{"amount":100}', "application/json")).toEqual({ amount: 100 });
    expect(parseBody("amount=100", "application/x-www-form-urlencoded")).toEqual({ amount: "100" });
    expect(parseBody("", "application/json")).toEqual({});
  });
});

describe("OpenAI-compatible output", () => {
  const schema = {
    type: "object",
    properties: {
      title: { type: "string" },
      level: { type: "string", enum: ["beginner", "advanced"] },
      sections: { type: "array", items: { $ref: "#/$defs/section" } },
      published: { type: "boolean" },
    },
    $defs: { section: { type: "object", properties: { name: { type: "string" }, minutes: { type: "integer", minimum: 5 } } } },
  };

  it("fills a JSON schema deterministically", () => {
    const value = sampleFromSchema(schema) as Record<string, unknown>;
    expect(value).toEqual({
      title: "Sample title",
      level: "beginner",
      sections: [
        { name: "Sample name", minutes: 5 },
        { name: "Sample name", minutes: 5 },
      ],
      published: true,
    });
    expect(sampleFromSchema(schema)).toEqual(value);
  });

  it("answers json_schema, json_object and text requests", () => {
    const messages = [{ role: "user", content: "Outline a course on budgeting" }];
    const structured = completionContent({ messages, response_format: { type: "json_schema", json_schema: { schema } } });
    expect(JSON.parse(structured).level).toBe("beginner");
    expect(JSON.parse(completionContent({ messages, response_format: { type: "json_object" } })).summary).toContain("budgeting");
    expect(completionContent({ messages })).toContain("budgeting");
  });
});
