import config from "../config";

/**
 * The platform operator's identity, in one place. Everything that names the
 * platform in emails, invoices or UI copy reads it from here. All values are
 * configurable; the defaults are placeholders for local development.
 */
export const BRAND = {
  name: config.PLATFORM_NAME,
  legalName: process.env.PLATFORM_LEGAL_NAME || config.PLATFORM_NAME,
  website: config.PLATFORM_URL,
  logoUrl: config.PLATFORM_LOGO_URL,
  email: config.CONTACT_EMAIL,
  billingEmail: process.env.BILLING_EMAIL || config.CONTACT_EMAIL,
  cin: process.env.PLATFORM_CIN || "",
  gstin: process.env.PLATFORM_GSTIN || "",
  pan: process.env.PLATFORM_PAN || "",
  hsnSac: process.env.PLATFORM_HSN_SAC || "",
  address: {
    line1: process.env.PLATFORM_ADDRESS_LINE1 || "",
    city: process.env.PLATFORM_ADDRESS_CITY || "",
    state: process.env.PLATFORM_ADDRESS_STATE || "",
    country: process.env.PLATFORM_ADDRESS_COUNTRY || "",
    postalCode: process.env.PLATFORM_ADDRESS_POSTAL_CODE || "",
  },
};
