"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { SegmentedControl } from "@/components/ui/segmented-control";

const LOCALE_COOKIE = "NEXT_LOCALE";

interface LocaleOption {
  value: string;
  short: string;
  label: string;
}

/**
 * Compact language switcher: writes the NEXT_LOCALE cookie and refreshes the
 * server-rendered tree. Locale metadata is passed in from the (server) layout
 * so this client component doesn't import the server-only i18n module.
 */
export function LanguageSwitcher({
  current,
  options,
  label,
}: {
  current: string;
  options: LocaleOption[];
  label: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const pick = (value: string) => {
    if (value === current) return;
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <SegmentedControl
      aria-label={label}
      value={current}
      onValueChange={pick}
      options={options.map((o) => ({
        value: o.value,
        label: <span title={o.label}>{o.short}</span>,
      }))}
      className="p-0.5 [&_button]:h-7 [&_button]:px-2 [&_button]:text-xs"
    />
  );
}
