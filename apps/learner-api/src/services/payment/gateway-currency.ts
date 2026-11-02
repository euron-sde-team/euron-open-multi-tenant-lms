import { BadRequestError } from "../../errors/bad-request.error";
import { gatewaySupportsCurrency } from "../../utils/currency-registry";

export interface GatewayCurrencyNotice {
  requested: string;
  charged: string;
  reason: string;
}

/**
 * Returns the currency that should actually be charged given the active gateway,
 * validated against the registry capability matrix. Razorpay and Stripe both
 * charge every registry currency, so this is "supported or 400": a currency the
 * gateway cannot charge fails loudly instead of charging the wrong amount.
 * The notice stays in the signature so callers can keep surfacing it as
 * `client_config.currency_notice` if a narrower gateway is added later.
 */
export function resolveGatewayCurrency(
  requested: string,
  providerName: string,
  _enabledCurrencies: string[],
): { currency: string; notice: GatewayCurrencyNotice | null } {
  if (gatewaySupportsCurrency(providerName, requested)) {
    return { currency: requested, notice: null };
  }
  throw new BadRequestError(
    `The payment gateway (${providerName}) does not support ${requested} payments`,
  );
}
