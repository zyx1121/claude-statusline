import Link from "next/link";
import { KeyRound, Radio, ShieldCheck, Wifi } from "lucide-react";

import type { ComponentType } from "@/lib/registry";
import { AnimatedPreview, MosaicPreview } from "@/components/ansi";
import { Surface } from "@/components/blocks/surface";
import { Badge } from "@/components/ui/badge";
import { TypeBadge } from "@/components/registry/type-badge";

export interface ComponentCardView {
  href: string;
  name: string;
  description: string;
  type: ComponentType;
  typeLabels: Record<ComponentType, string>;
  runtime: string;
  preview: string;
  frames?: string[];
  mosaic?: boolean;
  octants: string;
  badges: {
    network: string;
    offline: string;
    secrets: string;
    fetch: string;
  };
  hasNetwork: boolean;
  needsSecrets: boolean;
  hasFetch: boolean;
  noPreviewLabel: string;
}

export function ComponentCard({ view }: { view: ComponentCardView }) {
  return (
    <Link href={view.href} className="group block h-full">
      <Surface
        size="sm"
        className="flex h-full flex-col gap-3 transition-colors group-hover:bg-foreground/5"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-medium">{view.name}</span>
          <TypeBadge
            type={view.type}
            labels={view.typeLabels}
            className="text-[10px]"
          />
        </div>

        {view.mosaic && view.frames?.length ? (
          <MosaicPreview frames={view.frames} octants={view.octants} />
        ) : view.preview.trim() ? (
          <AnimatedPreview frames={view.frames} fallback={view.preview} />
        ) : (
          <div className="rounded-md bg-background px-3 py-4 text-center text-xs text-foreground/60">
            {view.noPreviewLabel}
          </div>
        )}

        <p className="line-clamp-2 text-sm text-foreground/60">
          {view.description}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <Badge variant="outline" className="font-mono text-[10px] font-normal">
            {view.runtime}
          </Badge>
          {view.hasNetwork ? (
            <Badge variant="outline" className="gap-1 text-[10px] font-normal">
              <Wifi className="size-3" /> {view.badges.network}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-[10px] font-normal">
              <ShieldCheck className="size-3" /> {view.badges.offline}
            </Badge>
          )}
          {view.needsSecrets ? (
            <Badge variant="outline" className="gap-1 text-[10px] font-normal">
              <KeyRound className="size-3" /> {view.badges.secrets}
            </Badge>
          ) : null}
          {view.hasFetch ? (
            <Badge variant="outline" className="gap-1 text-[10px] font-normal">
              <Radio className="size-3" /> {view.badges.fetch}
            </Badge>
          ) : null}
        </div>
      </Surface>
    </Link>
  );
}
