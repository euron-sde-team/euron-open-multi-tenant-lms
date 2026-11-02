"use client";

import PhoneInputLib from "react-phone-number-input";
import type { Value as PhoneValue } from "react-phone-number-input";

import { cn } from "@/lib/utils";

import { CountrySelect } from "./country-select";

interface PhoneInputProps {
  value: string;
  onChange: (value: PhoneValue | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function PhoneInput({
  value,
  onChange,
  placeholder = "+91 9876543210",
  disabled,
  className,
}: PhoneInputProps) {
  return (
    <PhoneInputLib
      international
      defaultCountry="IN"
      value={value as PhoneValue}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      countrySelectComponent={CountrySelect}
      className={cn(
        "flex h-10 w-full overflow-hidden rounded-md border border-input bg-background text-sm focus-within:outline-none focus-within:ring-1 focus-within:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&_.PhoneInputInput]:flex-1 [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:px-3 [&_.PhoneInputInput]:text-sm [&_.PhoneInputInput]:outline-none [&_.PhoneInputInput]:shadow-none",
        className
      )}
    />
  );
}
