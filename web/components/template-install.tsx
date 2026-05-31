"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/copy-button";

/**
 * Two install paths per template, toggled client-side: a `curl … | bash`
 * one-liner (Shell) and a copy-paste Claude Code prompt. Both strings are
 * generated server-side and handed in as props.
 */
export function TemplateInstall({
  shell,
  claude,
  labels,
}: {
  shell: string;
  claude: string;
  labels: { shell: string; claude: string; shellHint: string; claudeHint: string };
}) {
  const [tab, setTab] = useState<"shell" | "claude">("shell");
  const active =
    tab === "shell"
      ? { text: shell, hint: labels.shellHint }
      : { text: claude, hint: labels.claudeHint };

  return (
    <div className="rounded-lg border">
      <div className="flex border-b border-border/60" role="tablist">
        {(["shell", "claude"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors",
              tab === k
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k === "shell" ? labels.shell : labels.claude}
          </button>
        ))}
      </div>
      <div className="space-y-2 p-3">
        <p className="text-xs text-muted-foreground">{active.hint}</p>
        <div className="flex items-start gap-2 rounded-md border bg-muted/40 pl-3 pr-1.5">
          <pre className="flex-1 overflow-x-auto whitespace-pre-wrap break-words py-2 font-mono text-xs leading-relaxed text-foreground/90">
            {active.text}
          </pre>
          <CopyButton value={active.text} className="mt-1.5" />
        </div>
      </div>
    </div>
  );
}
