import { Globe, KeyRound, ShieldCheck } from "lucide-react";

import { Surface } from "@/components/blocks/surface";

export interface SafetyNoticeLabels {
  noneTitle: string;
  noneBody: string;
  networkTitle: string;
  networkTo: string;
  networkBody: string;
  secretsTitle: string;
  secretsBodyPre: string;
}

export function SafetyNotice({
  needsNetwork,
  needsSecrets,
  hosts,
  labels,
}: {
  needsNetwork: boolean;
  needsSecrets: boolean;
  hosts: string[];
  labels: SafetyNoticeLabels;
}) {
  if (!needsNetwork && !needsSecrets) {
    return (
      <Surface size="sm" className="flex items-start gap-2.5 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-foreground/60" />
        <span>
          <span className="font-medium text-foreground">{labels.noneTitle}</span>{" "}
          <span className="text-foreground/60">{labels.noneBody}</span>
        </span>
      </Surface>
    );
  }

  return (
    <Surface size="sm" className="flex flex-col gap-2 text-sm">
      {needsNetwork ? (
        <span className="flex items-start gap-2.5">
          <Globe className="mt-0.5 size-4 shrink-0 text-foreground/60" />
          <span className="text-foreground/60">
            <span className="font-medium text-foreground">
              {labels.networkTitle}
            </span>{" "}
            {hosts.length > 0 ? (
              <>
                {labels.networkTo}{" "}
                <code className="font-mono text-foreground">
                  {hosts.join(", ")}
                </code>
              </>
            ) : null}
            . {labels.networkBody}
          </span>
        </span>
      ) : null}
      {needsSecrets ? (
        <span className="flex items-start gap-2.5">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-foreground/60" />
          <span className="text-foreground/60">
            <span className="font-medium text-foreground">
              {labels.secretsTitle}
            </span>{" "}
            {labels.secretsBodyPre}{" "}
            <code className="font-mono">/statusline:configure</code>.
          </span>
        </span>
      ) : null}
    </Surface>
  );
}
