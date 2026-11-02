import { db } from "../db/connection";
import { BadRequestError } from "../errors/bad-request.error";
import contentPricesRepository from "../repositories/content-prices.repository";
import tenantCurrenciesRepository, {
  type TenantCurrencyInput,
} from "../repositories/tenant-currencies.repository";
import tenantGatewayConnectionsRepository from "../repositories/tenant-gateway-connections.repository";
import {
  CURRENCY_LIST,
  REST_OF_WORLD,
  VIRTUAL_TENANT_CURRENCIES,
  gatewaySupportsCurrency,
  getCurrencyDef,
} from "../utils/currency-registry";
import exchangeRateService from "./exchange-rate.service";

export interface CurrencySettingDto {
  currency: string;
  is_default: boolean;
  countries: string[];
  sort_order: number;
}

export interface CurrencySettingsResponse {
  currencies: CurrencySettingDto[];
  is_virtual: boolean;
  registry: typeof CURRENCY_LIST;
  gateway_warnings: string[];
}

export interface UpdateCurrencySettingsInput {
  currencies: Array<{
    currency: string;
    is_default?: boolean;
    countries?: string[];
  }>;
  /** Required true when removing currencies that still have price rows. */
  confirm_removal?: boolean;
}

class CurrencySettingsService {
  async getSettings(tenantId: string): Promise<CurrencySettingsResponse> {
    const { currencies, isVirtual } = await this.getEffectiveConfig(tenantId);
    const gatewayWarnings = await this.buildGatewayWarnings(
      tenantId,
      currencies.map((c) => c.currency),
    );
    return {
      currencies,
      is_virtual: isVirtual,
      registry: CURRENCY_LIST,
      gateway_warnings: gatewayWarnings,
    };
  }

  /**
   * Effective config = stored rows, or the virtual INR+USD default when the
   * tenant has never saved settings. Shared rule with the learner-api resolver.
   */
  async getEffectiveConfig(
    tenantId: string,
  ): Promise<{ currencies: CurrencySettingDto[]; isVirtual: boolean }> {
    const rows = await tenantCurrenciesRepository.listByTenant(tenantId);
    if (rows.length === 0) {
      return {
        currencies: VIRTUAL_TENANT_CURRENCIES.map((v) => ({
          currency: v.currency,
          is_default: v.is_default,
          countries: [...v.countries],
          sort_order: v.sort_order,
        })),
        isVirtual: true,
      };
    }
    return {
      currencies: rows.map((r) => ({
        currency: r.currency,
        is_default: r.is_default,
        countries: r.countries,
        sort_order: r.sort_order,
      })),
      isVirtual: false,
    };
  }

  async updateSettings(tenantId: string, input: UpdateCurrencySettingsInput): Promise<unknown> {
    const normalized = this.validateAndNormalize(input);

    const { currencies: current } = await this.getEffectiveConfig(tenantId);
    const currentCodes = new Set(current.map((c) => c.currency));
    const nextCodes = new Set(normalized.map((c) => c.currency));
    const removedCodes = [...currentCodes].filter((c) => !nextCodes.has(c));

    // Dry-run gate: removing a currency deletes its price rows, so surface the
    // impact and require explicit confirmation before applying.
    if (removedCodes.length > 0 && input.confirm_removal !== true) {
      const impact = await contentPricesRepository.countByCurrencies(tenantId, removedCodes);
      const totalRows = Object.values(impact).reduce((a, b) => a + b, 0);
      if (totalRows > 0) {
        return {
          applied: false,
          requires_confirmation: true,
          removal_impact: impact,
          message:
            "Removing these currencies will delete their saved prices. Re-submit with confirm_removal=true to proceed.",
        };
      }
    }

    let deletedPriceRows = 0;
    await db.transaction().execute(async (trx) => {
      await tenantCurrenciesRepository.replaceAll(tenantId, normalized, trx);
      if (removedCodes.length > 0) {
        deletedPriceRows = await contentPricesRepository.deleteByCurrencies(
          tenantId,
          removedCodes,
          trx,
        );
      }
    });

    const settings = await this.getSettings(tenantId);
    const coverage = await this.getCoverage(tenantId);
    return {
      applied: true,
      deleted_price_rows: deletedPriceRows,
      settings,
      coverage,
    };
  }

  /**
   * Pricing-coverage report against the tenant default currency: PAID items
   * that have no resolvable price in it (would render "not available").
   */
  async getCoverage(tenantId: string): Promise<unknown> {
    const { currencies } = await this.getEffectiveConfig(tenantId);
    const defaultCurrency = currencies.find((c) => c.is_default)?.currency ?? "USD";
    const targets = await contentPricesRepository.coverageForCurrency(tenantId, defaultCurrency);
    return {
      default_currency: defaultCurrency,
      total_missing: targets.reduce((sum, t) => sum + t.missing_count, 0),
      targets,
    };
  }

  /** Display-only FX suggestions for the admin price editor autofill. */
  async fxSuggest(tenantId: string, from: string, to: string[], amount: number): Promise<unknown> {
    void tenantId;
    const fromDef = getCurrencyDef(from);
    if (!fromDef) throw new BadRequestError(`Unsupported source currency: ${from}`);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestError("Amount must be a positive number");
    }
    const targets = [...new Set(to.map((t) => t.toUpperCase()))].filter(
      (t) => t !== fromDef.code,
    );
    const suggestions: Array<{
      currency: string;
      rate: number;
      amount: number;
      source: string;
    }> = [];
    for (const code of targets) {
      const def = getCurrencyDef(code);
      if (!def) throw new BadRequestError(`Unsupported target currency: ${code}`);
      const result = await exchangeRateService.getRate(fromDef.code, def.code);
      const factor = Math.pow(10, def.decimals);
      suggestions.push({
        currency: def.code,
        rate: result.rate,
        amount: Math.round(amount * result.rate * factor) / factor,
        source: result.source,
      });
    }
    return { from: fromDef.code, amount, suggestions };
  }

  private validateAndNormalize(input: UpdateCurrencySettingsInput): TenantCurrencyInput[] {
    if (!Array.isArray(input.currencies) || input.currencies.length === 0) {
      throw new BadRequestError("At least one currency must be enabled");
    }

    const seenCodes = new Set<string>();
    const seenCountries = new Map<string, string>();
    let defaultCount = 0;
    let catchAllCount = 0;

    const normalized: TenantCurrencyInput[] = input.currencies.map((entry, index) => {
      const code = String(entry.currency ?? "").toUpperCase();
      if (!getCurrencyDef(code)) {
        throw new BadRequestError(`Unsupported currency: ${entry.currency}`);
      }
      if (seenCodes.has(code)) {
        throw new BadRequestError(`Duplicate currency: ${code}`);
      }
      seenCodes.add(code);

      const isDefault = entry.is_default === true;
      if (isDefault) defaultCount += 1;

      const rawCountries = Array.isArray(entry.countries) ? entry.countries : [];
      const countries: string[] = [];
      for (const raw of rawCountries) {
        const country = String(raw).toUpperCase();
        if (country === REST_OF_WORLD) {
          catchAllCount += 1;
          if (catchAllCount > 1) {
            throw new BadRequestError("Only one currency may use the rest-of-world marker \"*\"");
          }
        } else if (!/^[A-Z]{2}$/.test(country)) {
          throw new BadRequestError(`Invalid country code "${raw}" on ${code}`);
        }
        const owner = seenCountries.get(country);
        if (owner) {
          throw new BadRequestError(
            `Country ${country} is mapped to both ${owner} and ${code}; a country can serve only one currency`,
          );
        }
        seenCountries.set(country, code);
        if (!countries.includes(country)) countries.push(country);
      }

      return { currency: code, is_default: isDefault, countries, sort_order: index };
    });

    if (defaultCount !== 1) {
      throw new BadRequestError("Exactly one currency must be marked as default");
    }
    return normalized;
  }

  private async buildGatewayWarnings(
    tenantId: string,
    enabledCodes: string[],
  ): Promise<string[]> {
    const warnings: string[] = [];
    const providerName = await tenantGatewayConnectionsRepository.findActiveProviderName(tenantId);
    if (!providerName) {
      warnings.push(
        "No active payment gateway is connected. Buyers cannot check out until one is configured.",
      );
      return warnings;
    }
    const unsupported = enabledCodes.filter(
      (code) => !gatewaySupportsCurrency(providerName, code),
    );
    if (unsupported.length > 0) {
      warnings.push(
        `Your active gateway (${providerName}) does not support: ${unsupported.join(", ")}. ` +
          "Checkout in these currencies will fail or fall back until you connect a gateway that supports them.",
      );
    }
    return warnings;
  }
}

export default new CurrencySettingsService();
