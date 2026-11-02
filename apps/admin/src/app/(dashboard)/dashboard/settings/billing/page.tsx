"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  useToast,
} from "@open-mtlms/core";
import { FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

import {
  useBillingDetails,
  useUpdateBillingDetails,
} from "@/lib/hooks/use-tenant-org";

export default function BillingDetailsPage() {
  const { data: billing, isLoading } = useBillingDetails();
  const updateBilling = useUpdateBillingDetails();
  const { toast } = useToast();
  const router = useRouter();

  const [legalEntityName, setLegalEntityName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [gstin, setGstin] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [hsnSacCode, setHsnSacCode] = useState("");
  const [taxId, setTaxId] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingPhone, setBillingPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [taxMode, setTaxMode] = useState<"INCLUSIVE" | "EXCLUSIVE">("INCLUSIVE");
  const [taxPercentage, setTaxPercentage] = useState("18");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (billing) {
      setLegalEntityName(billing.legalEntityName ?? "");
      setRegistrationNumber(billing.registrationNumber ?? "");
      setGstin(billing.gstin ?? "");
      setPanNumber(billing.panNumber ?? "");
      setHsnSacCode(billing.hsnSacCode ?? "");
      setTaxId(billing.taxId ?? "");
      setBillingEmail(billing.billingEmail ?? "");
      setBillingPhone(billing.billingPhone ?? "");
      setTaxMode((billing.taxMode === "EXCLUSIVE" ? "EXCLUSIVE" : "INCLUSIVE") as "INCLUSIVE" | "EXCLUSIVE");
      setTaxPercentage(String(billing.taxPercentage ?? 18));
      const addr = billing.billingAddress;
      if (addr) {
        setAddressLine1((addr as Record<string, string>).line1 ?? "");
        setAddressLine2((addr as Record<string, string>).line2 ?? "");
        setCity((addr as Record<string, string>).city ?? "");
        setState((addr as Record<string, string>).state ?? "");
        setCountry((addr as Record<string, string>).country ?? "");
        setPostalCode((addr as Record<string, string>).postalCode ?? "");
      }
      setDirty(false);
    }
  }, [billing]);

  const markDirty = useCallback(() => setDirty(true), []);

  const handleSave = useCallback(() => {
    const hasAddress = addressLine1 || city || state || country || postalCode;
    updateBilling.mutate(
      {
        legal_entity_name: legalEntityName || null,
        registration_number: registrationNumber || null,
        gstin: gstin || null,
        pan_number: panNumber || null,
        hsn_sac_code: hsnSacCode || null,
        tax_id: taxId || null,
        tax_mode: taxMode,
        tax_percentage: parseFloat(taxPercentage) || 0,
        billing_email: billingEmail || null,
        billing_phone: billingPhone || null,
        billing_address: hasAddress
          ? {
              line1: addressLine1 || undefined,
              line2: addressLine2 || undefined,
              city: city || undefined,
              state: state || undefined,
              country: country || undefined,
              postalCode: postalCode || undefined,
            }
          : null,
      },
      {
        onSuccess: () => {
          toast({ title: "Billing details updated" });
          setDirty(false);
        },
        onError: () => {
          toast({
            title: "Failed to update billing details",
            variant: "destructive",
          });
        },
      }
    );
  }, [
    legalEntityName,
    registrationNumber,
    gstin,
    panNumber,
    hsnSacCode,
    taxId,
    billingEmail,
    billingPhone,
    addressLine1,
    addressLine2,
    city,
    state,
    country,
    postalCode,
    taxMode,
    taxPercentage,
    updateBilling,
    toast,
  ]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing Details</h1>
          <p className="text-sm text-muted-foreground">
            These details appear on invoices generated for your customers. All
            fields are optional.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/dashboard/billing/invoices")}
        >
          <FileText className="mr-2 h-4 w-4" />
          Invoices
        </Button>
      </div>

      {/* Tax Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Tax Configuration</CardTitle>
          <CardDescription>
            Configure how tax is applied to purchases on your platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Tax Mode</Label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="taxMode"
                  value="INCLUSIVE"
                  checked={taxMode === "INCLUSIVE"}
                  onChange={() => { setTaxMode("INCLUSIVE"); markDirty(); }}
                  className="mt-1"
                />
                <div>
                  <span className="text-sm font-medium">Inclusive</span>
                  <p className="text-xs text-muted-foreground">
                    Prices already include tax. Tax is shown as an informational
                    breakdown on invoices. Customers pay the listed price.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="taxMode"
                  value="EXCLUSIVE"
                  checked={taxMode === "EXCLUSIVE"}
                  onChange={() => { setTaxMode("EXCLUSIVE"); markDirty(); }}
                  className="mt-1"
                />
                <div>
                  <span className="text-sm font-medium">Exclusive</span>
                  <p className="text-xs text-muted-foreground">
                    Tax is added on top of the listed price at checkout.
                    Customers pay the listed price plus tax.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="max-w-xs space-y-2">
            <Label htmlFor="taxPercentage">Tax Percentage (%)</Label>
            <Input
              id="taxPercentage"
              type="number"
              min={0}
              max={100}
              step={0.01}
              placeholder="18"
              value={taxPercentage}
              onChange={(e) => {
                setTaxPercentage(e.target.value);
                markDirty();
              }}
            />
            <p className="text-xs text-muted-foreground">
              Set to 0 to disable tax. Default is 18% (Indian GST).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Company / Tax Info */}
      <Card>
        <CardHeader>
          <CardTitle>Tax & Registration</CardTitle>
          <CardDescription>
            Company registration and tax identification details for invoices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legalEntityName">Legal Entity Name</Label>
              <Input
                id="legalEntityName"
                placeholder="e.g. Acme Pvt. Ltd."
                value={legalEntityName}
                onChange={(e) => {
                  setLegalEntityName(e.target.value);
                  markDirty();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registrationNumber">CIN / Registration No.</Label>
              <Input
                id="registrationNumber"
                placeholder="e.g. U85499KA2024PTC187383"
                value={registrationNumber}
                onChange={(e) => {
                  setRegistrationNumber(e.target.value);
                  markDirty();
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN / Tax Number</Label>
              <Input
                id="gstin"
                placeholder="e.g. 29AAICE1347B1ZW"
                value={gstin}
                onChange={(e) => {
                  setGstin(e.target.value);
                  markDirty();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="panNumber">PAN</Label>
              <Input
                id="panNumber"
                placeholder="e.g. AAICE1347B"
                value={panNumber}
                onChange={(e) => {
                  setPanNumber(e.target.value);
                  markDirty();
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hsnSacCode">HSN / SAC Code</Label>
              <Input
                id="hsnSacCode"
                placeholder="e.g. 998431"
                value={hsnSacCode}
                onChange={(e) => {
                  setHsnSacCode(e.target.value);
                  markDirty();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxId">International Tax ID</Label>
              <Input
                id="taxId"
                placeholder="VAT / EIN / Other"
                value={taxId}
                onChange={(e) => {
                  setTaxId(e.target.value);
                  markDirty();
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Contact</CardTitle>
          <CardDescription>
            Contact details shown on invoices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="billingEmail">Billing Email</Label>
              <Input
                id="billingEmail"
                type="email"
                placeholder="billing@example.com"
                value={billingEmail}
                onChange={(e) => {
                  setBillingEmail(e.target.value);
                  markDirty();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingPhone">Billing Phone</Label>
              <Input
                id="billingPhone"
                type="tel"
                placeholder="+91 98765 43210"
                value={billingPhone}
                onChange={(e) => {
                  setBillingPhone(e.target.value);
                  markDirty();
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing Address */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Address</CardTitle>
          <CardDescription>
            Registered address for invoices and compliance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="addressLine1">Address Line 1</Label>
            <Input
              id="addressLine1"
              placeholder="Street address"
              value={addressLine1}
              onChange={(e) => {
                setAddressLine1(e.target.value);
                markDirty();
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressLine2">Address Line 2</Label>
            <Input
              id="addressLine2"
              placeholder="Apartment, suite, etc."
              value={addressLine2}
              onChange={(e) => {
                setAddressLine2(e.target.value);
                markDirty();
              }}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="City"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  markDirty();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State / Province</Label>
              <Input
                id="state"
                placeholder="State"
                value={state}
                onChange={(e) => {
                  setState(e.target.value);
                  markDirty();
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                placeholder="Country"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  markDirty();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal / ZIP Code</Label>
              <Input
                id="postalCode"
                placeholder="Postal code"
                value={postalCode}
                onChange={(e) => {
                  setPostalCode(e.target.value);
                  markDirty();
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!dirty || updateBilling.isPending}
        >
          {updateBilling.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Save Billing Details
        </Button>
      </div>
    </div>
  );
}
