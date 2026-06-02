"use client";

import { useState } from "react";

import { CopyCommand } from "@/components/ui/copy-command";
import { SegmentedControl } from "@/components/ui/segmented-control";

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
    <div className="space-y-3">
      <SegmentedControl
        ariaLabel="Install method"
        value={tab}
        onValueChange={(value) => setTab(value as "shell" | "claude")}
        options={[
          { value: "shell", label: labels.shell },
          { value: "claude", label: labels.claude },
        ]}
        className="[&_button]:h-7 [&_button]:text-xs"
      />
      <p className="text-xs text-foreground/60">{active.hint}</p>
      <CopyCommand value={active.text} prompt="" multiline className="text-xs" />
    </div>
  );
}
