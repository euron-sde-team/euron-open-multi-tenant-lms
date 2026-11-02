/**
 * The renewal arithmetic, on the cases that prompted it (Oct 2026: five paying
 * tenants on admin-assigned plans, nothing renewing them, one ~3 months
 * lapsed). Money and dates here go straight onto a customer's card, so every
 * rule the owner decided is pinned:
 *   - not expired → autopay set up now, first charge ON the expiry date
 *   - expired → every cycle started since expiry collected now, autopay resumes
 *     on the same billing day; locked once more than 7 days past expiry
 *   - price = own plan version price + 18% GST
 */
import { describe, expect, it } from "vitest";

import {
  addCycles,
  buildRenewalQuote,
  withGst,
  type RenewalSubscriptionInput,
} from "../../src/services/billing/renewal-quote";

/** 18 Oct 2026, 11:30 IST, when this was built. */
const NOW = new Date("2026-10-18T06:00:00Z");
/** A Starter-like price, ex-GST. */
const BASE = 999;
const CYCLE = withGst(BASE); // 1178.82

function manual(end: string, over: Partial<RenewalSubscriptionInput> = {}): RenewalSubscriptionInput {
  return {
    status: "ACTIVE",
    billing_provider_name: null,
    external_subscription_id: null,
    current_period_end: new Date(end),
    cancelled_at: null,
    billing_cycle: "MONTHLY",
    ...over,
  };
}

describe("GST", () => {
  it("adds 18% and rounds to paise, exactly like the checkout", () => {
    expect(withGst(999)).toBe(1178.82);
    expect(withGst(4999)).toBe(5898.82);
    expect(withGst(0)).toBe(0);
  });
});

describe("addCycles", () => {
  it("never skips a short month", () => {
    expect(addCycles(new Date("2026-01-31T00:00:00Z"), "MONTHLY", 1).toISOString()).toBe(
      "2026-02-28T00:00:00.000Z"
    );
    expect(addCycles(new Date("2026-01-31T00:00:00Z"), "MONTHLY", 2).toISOString()).toBe(
      "2026-03-31T00:00:00.000Z"
    );
  });
});

describe("expired (ucapacity: expired 18 Jul, ~3 months unpaid)", () => {
  const q = buildRenewalQuote(manual("2026-07-18T18:30:00Z"), BASE, NOW)!;

  it("is locked", () => expect(q.state).toBe("LOCKED"));

  it("owes the 3 cycles started since expiry: Jul, Aug, Sep", () => {
    expect(q.back_due_cycles).toBe(3);
    expect(q.back_due_total).toBe(3 * CYCLE);
    expect(q.back_due_to?.toISOString()).toBe("2026-10-18T18:30:00.000Z");
  });

  it("billing day is tonight (<24h), so this month is charged now too", () => {
    expect(q.start_at).toBeNull();
    expect(q.first_charge_total).toBe(Math.round(4 * CYCLE * 100) / 100);
  });
});

describe("expired 5 days ago", () => {
  const q = buildRenewalQuote(manual("2026-10-12T18:30:00Z"), BASE, NOW)!;

  it("is overdue but still open", () => expect(q.state).toBe("OVERDUE"));

  it("pays the one missed cycle now; autopay resumes on the usual date", () => {
    expect(q.back_due_cycles).toBe(1);
    expect(q.first_charge_total).toBe(CYCLE);
    expect(q.charge_on.toISOString()).toBe("2026-11-12T18:30:00.000Z");
    expect(q.start_at).toBe(Math.floor(Date.parse("2026-11-12T18:30:00Z") / 1000));
  });

  it("locks only after 7 full days past expiry", () => {
    const at = (iso: string) => buildRenewalQuote(manual(iso), BASE, NOW)!.state;
    expect(at("2026-10-11T00:00:00Z")).toBe("OVERDUE"); // 7 days 6h
    expect(at("2026-10-10T00:00:00Z")).toBe("LOCKED"); // 8 days
  });
});

describe("not expired yet (Skilldunia: expires 31 Oct)", () => {
  const q = buildRenewalQuote(manual("2026-10-31T18:30:00Z"), BASE, NOW)!;

  it("is due soon, with nothing owed back", () => {
    expect(q.state).toBe("DUE_SOON");
    expect(q.back_due_cycles).toBe(0);
    expect(q.days_left).toBe(14);
  });

  it("charges nothing today and the first cycle ON the expiry date", () => {
    expect(q.first_charge_total).toBe(0);
    expect(q.cycle_total).toBe(CYCLE);
    expect(q.charge_on.toISOString()).toBe("2026-10-31T18:30:00.000Z");
    expect(q.start_at).toBe(Math.floor(Date.parse("2026-10-31T18:30:00Z") / 1000));
  });

  it("charges now when expiry is under a day away (Razorpay can't schedule it)", () => {
    const soon = buildRenewalQuote(manual("2026-10-18T18:00:00Z"), BASE, NOW)!;
    expect(soon.start_at).toBeNull();
    expect(soon.first_charge_total).toBe(CYCLE);
  });
});

describe("who is never asked to pay", () => {
  it("expiry more than 30 days away", () => {
    expect(buildRenewalQuote(manual("2026-11-30T18:30:00Z"), BASE, NOW)).toBeNull();
  });
  it("free plans", () => {
    for (const p of ["FREE"]) {
      expect(
        buildRenewalQuote(manual("2026-07-18T18:30:00Z", { billing_provider_name: p }), BASE, NOW)
      ).toBeNull();
    }
  });
  it("a plan that costs nothing", () => {
    expect(buildRenewalQuote(manual("2026-07-18T18:30:00Z"), 0, NOW)).toBeNull();
  });
  it("a healthy autopay, even on its renewal day", () => {
    const autopay = { billing_provider_name: "RAZORPAY", external_subscription_id: "sub_x" };
    expect(buildRenewalQuote(manual("2026-10-25T18:30:00Z", autopay), BASE, NOW)).toBeNull();
    expect(buildRenewalQuote(manual("2026-10-17T18:30:00Z", autopay), BASE, NOW)).toBeNull();
    // Still inside Razorpay's retry window: hands off, or a retry could double-charge.
    expect(buildRenewalQuote(manual("2026-10-14T18:30:00Z", autopay), BASE, NOW)).toBeNull();
  });
  it("PAST_DUE (own autopay-failure banner), cancelled, or scheduled to cancel", () => {
    for (const status of ["PAST_DUE", "CANCELLED", "EXPIRED"]) {
      expect(buildRenewalQuote(manual("2026-07-18T18:30:00Z", { status }), BASE, NOW)).toBeNull();
    }
    expect(
      buildRenewalQuote(manual("2026-10-25T18:30:00Z", { cancelled_at: new Date() }), BASE, NOW)
    ).toBeNull();
  });
});

describe("edge cases", () => {
  it("an autopay with no charge 6 days after its end has lapsed and needs the tenant", () => {
    const q = buildRenewalQuote(
      manual("2026-10-12T00:00:00Z", { billing_provider_name: "RAZORPAY", external_subscription_id: "sub_x" }),
      BASE,
      NOW
    )!;
    expect(q.state).toBe("OVERDUE");
  });

  it("an expired TRIAL owes nothing back, it just starts paying", () => {
    const q = buildRenewalQuote(manual("2026-07-18T18:30:00Z", { status: "TRIALING" }), BASE, NOW)!;
    expect(q.state).toBe("LOCKED");
    expect(q.back_due_cycles).toBe(0);
    expect(q.first_charge_total).toBe(CYCLE);
  });

  it("yearly plan expired 2 months ago owes one year; autopay resumes on the anniversary", () => {
    const q = buildRenewalQuote(
      manual("2026-08-18T18:30:00Z", { billing_cycle: "YEARLY" }),
      BASE,
      NOW
    )!;
    expect(q.back_due_cycles).toBe(1);
    expect(q.first_charge_total).toBe(CYCLE);
    expect(q.charge_on.toISOString()).toBe("2027-08-18T18:30:00.000Z");
  });
});
