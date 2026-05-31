"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

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
    // Writing document.cookie is a deliberate DOM side effect in this click
    // handler; the react-compiler immutability rule misreads it as a mutation.
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center gap-0.5 rounded-md border border-border/60 p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => pick(o.value)}
          aria-pressed={o.value === current}
          title={o.label}
          className={cn(
            "rounded px-1.5 py-0.5 text-xs font-medium transition-colors",
            o.value === current
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.short}
        </button>
      ))}
    </div>
  );
}
