"use client";
import React from "react";
import type { AccountInterface } from "./Account.interface";
import OptionPicker from "../Transaction/OptionPicker";

interface AccountPickerProps {
  accounts: AccountInterface[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  required?: boolean;
}

export default function AccountPicker({
  accounts,
  value,
  onChange,
  disabled = false,
  required = false,
}: AccountPickerProps) {
  const options = accounts.map((acc) => ({
    value: String(acc.id),
    label: acc.type ? `${acc.name} (${acc.type})` : acc.name,
  }));

  return (
    <OptionPicker
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={required}
    />
  );
}
