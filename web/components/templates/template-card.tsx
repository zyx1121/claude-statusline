import { Layers } from "lucide-react";

import { Surface } from "@/components/blocks/surface";
import { TemplateInstall } from "@/components/template-install";
import { Badge } from "@/components/ui/badge";

export interface TemplateCardView {
  name: string;
  description?: string;
  componentCount: number;
  layoutRows: Array<{
    slot: string;
    components: string;
  }>;
  install: {
    shell: string;
    claude: string;
  };
}

export function TemplateCard({
  view,
  labels,
}: {
  view: TemplateCardView;
  labels: {
    components: string;
    layout: string;
    install: string;
    tabShell: string;
    tabClaude: string;
    shellHint: string;
    claudeHint: string;
  };
}) {
  return (
    <Surface className="space-y-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Layers className="size-4 text-foreground/60" />
        <span className="font-mono text-base font-semibold">{view.name}</span>
        <Badge variant="secondary" className="text-[10px]">
          {view.componentCount} {labels.components}
        </Badge>
      </div>

      {view.description ? (
        <p className="text-sm text-foreground/60">{view.description}</p>
      ) : null}

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/60">
          {labels.layout}
        </h3>
        <div className="corner-token overflow-hidden rounded-xl bg-background font-mono text-xs">
          {view.layoutRows.map((row) => (
            <div
              key={row.slot}
              className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3 [&+&]:border-t [&+&]:border-foreground/10"
            >
              <span className="w-16 shrink-0 text-foreground/50">{row.slot}</span>
              <span className="flex flex-wrap gap-x-2 gap-y-1 text-foreground/90">
                {row.components}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/60">
          {labels.install}
        </h3>
        <TemplateInstall
          shell={view.install.shell}
          claude={view.install.claude}
          labels={{
            shell: labels.tabShell,
            claude: labels.tabClaude,
            shellHint: labels.shellHint,
            claudeHint: labels.claudeHint,
          }}
        />
      </div>
    </Surface>
  );
}
