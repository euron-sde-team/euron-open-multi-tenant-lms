import { describe, it, expect } from "vitest";

import { buildDnsRecords } from "../../src/services/email-sending-domain.service";

/**
 * buildDnsRecords pure-function tests.
 *
 * Given a sending subdomain + DKIM tokens + AWS region, the function returns
 * the exact set of DNS records the tenant must publish for SES verification
 * + good deliverability:
 *
 *   - 3 DKIM CNAMEs (one per token from SES)
 *   - 1 MAIL FROM MX (bounce.{subdomain} -> feedback-smtp.{region}.amazonses.com)
 *   - 1 MAIL FROM SPF TXT on bounce subdomain
 *   - 1 SPF TXT on sending subdomain
 *   - 1 DMARC TXT on _dmarc.{subdomain}
 *
 * Tests verify count, types, names, and value contents, the things a
 * tenant pasting into their DNS provider can copy/paste wrong.
 */
describe("buildDnsRecords", () => {
  const subdomain = "hello.example.org";
  const tokens = ["abc123def456", "ghi789jkl012", "mno345pqr678"];
  const region = "ap-south-1";

  it("returns 7 total records (3 DKIM + MX + 2 SPF + DMARC)", () => {
    const records = buildDnsRecords(subdomain, tokens, region);
    expect(records).toHaveLength(7);
  });

  it("emits 3 DKIM CNAME records, one per token", () => {
    const records = buildDnsRecords(subdomain, tokens, region);
    const dkim = records.filter((r) => r.purpose === "DKIM");
    expect(dkim).toHaveLength(3);
    for (const r of dkim) {
      expect(r.type).toBe("CNAME");
    }
    // Each DKIM record's name follows {token}._domainkey.{subdomain}
    expect(dkim[0].name).toBe(`abc123def456._domainkey.${subdomain}`);
    expect(dkim[1].name).toBe(`ghi789jkl012._domainkey.${subdomain}`);
    expect(dkim[2].name).toBe(`mno345pqr678._domainkey.${subdomain}`);
    // Each value points at the SES DKIM endpoint.
    expect(dkim[0].value).toBe("abc123def456.dkim.amazonses.com");
    expect(dkim[1].value).toBe("ghi789jkl012.dkim.amazonses.com");
    expect(dkim[2].value).toBe("mno345pqr678.dkim.amazonses.com");
  });

  it("emits exactly one MAIL FROM MX record on bounce.{subdomain}", () => {
    const records = buildDnsRecords(subdomain, tokens, region);
    const mx = records.filter((r) => r.purpose === "MAIL_FROM_MX");
    expect(mx).toHaveLength(1);
    expect(mx[0].type).toBe("MX");
    expect(mx[0].name).toBe(`bounce.${subdomain}`);
    expect(mx[0].value).toBe(`feedback-smtp.${region}.amazonses.com`);
    expect(mx[0].priority).toBe(10);
  });

  it("emits MAIL FROM SPF TXT on the bounce subdomain", () => {
    const records = buildDnsRecords(subdomain, tokens, region);
    const spfBounce = records.filter((r) => r.purpose === "MAIL_FROM_SPF");
    expect(spfBounce).toHaveLength(1);
    expect(spfBounce[0].type).toBe("TXT");
    expect(spfBounce[0].name).toBe(`bounce.${subdomain}`);
    expect(spfBounce[0].value).toContain("v=spf1");
    expect(spfBounce[0].value).toContain("amazonses.com");
  });

  it("emits SPF TXT on the sending subdomain (not just bounce)", () => {
    const records = buildDnsRecords(subdomain, tokens, region);
    const spfSending = records.filter((r) => r.purpose === "SENDING_SPF");
    expect(spfSending).toHaveLength(1);
    expect(spfSending[0].type).toBe("TXT");
    expect(spfSending[0].name).toBe(subdomain);
    expect(spfSending[0].value).toContain("v=spf1");
  });

  it("emits DMARC TXT on _dmarc.{subdomain}", () => {
    const records = buildDnsRecords(subdomain, tokens, region);
    const dmarc = records.filter((r) => r.purpose === "DMARC");
    expect(dmarc).toHaveLength(1);
    expect(dmarc[0].type).toBe("TXT");
    expect(dmarc[0].name).toBe(`_dmarc.${subdomain}`);
    expect(dmarc[0].value).toContain("v=DMARC1");
    // Spec §Phase 3 mandates p=none initially so tenants can ratchet up
    // later without breaking sends mid-rollout.
    expect(dmarc[0].value).toContain("p=none");
    // RUA should be on the same subdomain so we don't spray reports to
    // some unrelated mailbox.
    expect(dmarc[0].value).toContain(`rua=mailto:dmarc-reports@${subdomain}`);
  });

  it("MX value uses the region the caller passed", () => {
    const records = buildDnsRecords(subdomain, tokens, "us-east-1");
    const mx = records.find((r) => r.purpose === "MAIL_FROM_MX");
    expect(mx?.value).toBe("feedback-smtp.us-east-1.amazonses.com");
  });

  it("handles a zero-token edge case without throwing", () => {
    const records = buildDnsRecords(subdomain, [], region);
    // 0 DKIM + 1 MX + 2 SPF + 1 DMARC = 4 records. Onboarding still
    // returns this; SES verification will fail until DKIM tokens arrive,
    // but the function itself must be total.
    expect(records).toHaveLength(4);
    expect(records.filter((r) => r.purpose === "DKIM")).toHaveLength(0);
  });
});

/**
 * Apex-domain test cases.
 *
 * `buildDnsRecords` was originally written for subdomain inputs only
 * (e.g. `mail.example.com`), but Phase 3 was extended to allow apex inputs
 * (e.g. `example.com`) for tenants who explicitly want their root domain
 * to be the sending FROM. The record shapes are identical, just with
 * one fewer label of nesting; these tests pin the exact strings the UI
 * will paste in front of the tenant so a future refactor can't silently
 * regress apex handling.
 */
describe("buildDnsRecords on an apex sending domain", () => {
  const apex = "example.com";
  const tokens = ["aaa111", "bbb222", "ccc333"];
  const region = "ap-south-1";

  it("returns the same 7-record layout as the subdomain case", () => {
    const records = buildDnsRecords(apex, tokens, region);
    expect(records).toHaveLength(7);
    expect(records.filter((r) => r.purpose === "DKIM")).toHaveLength(3);
    expect(records.filter((r) => r.purpose === "MAIL_FROM_MX")).toHaveLength(1);
    expect(records.filter((r) => r.purpose === "MAIL_FROM_SPF")).toHaveLength(1);
    expect(records.filter((r) => r.purpose === "SENDING_SPF")).toHaveLength(1);
    expect(records.filter((r) => r.purpose === "DMARC")).toHaveLength(1);
  });

  it("DKIM CNAMEs land on `{token}._domainkey.{apex}` without an extra label", () => {
    const records = buildDnsRecords(apex, tokens, region);
    const dkim = records.filter((r) => r.purpose === "DKIM");
    expect(dkim[0].name).toBe("aaa111._domainkey.example.com");
    expect(dkim[1].name).toBe("bbb222._domainkey.example.com");
    expect(dkim[2].name).toBe("ccc333._domainkey.example.com");
  });

  it("MAIL FROM uses `bounce.{apex}` (single label prefix on the apex)", () => {
    const records = buildDnsRecords(apex, tokens, region);
    const mx = records.find((r) => r.purpose === "MAIL_FROM_MX");
    const spf = records.find((r) => r.purpose === "MAIL_FROM_SPF");
    expect(mx?.name).toBe("bounce.example.com");
    expect(spf?.name).toBe("bounce.example.com");
  });

  it("SPF + DMARC TXT records sit at the apex itself", () => {
    const records = buildDnsRecords(apex, tokens, region);
    const sendingSpf = records.find((r) => r.purpose === "SENDING_SPF");
    const dmarc = records.find((r) => r.purpose === "DMARC");
    // SENDING_SPF goes on the sending domain. On apex, that's the apex.
    // Many DNS providers display this as `@` instead of the bare apex;
    // either is fine.
    expect(sendingSpf?.name).toBe("example.com");
    // DMARC always sits at `_dmarc.{sendingDomain}` regardless of apex.
    expect(dmarc?.name).toBe("_dmarc.example.com");
    expect(dmarc?.value).toContain("v=DMARC1");
    expect(dmarc?.value).toContain("p=none");
  });
});
