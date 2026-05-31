import { Layers } from "lucide-react";

import {
  getProfiles,
  getComponents,
  localizedName,
  SITE_URL,
  type Component,
  type Profile,
  type ProfileInstance,
} from "@/lib/registry";
import { getDict, getLocale, type Dict, type Locale } from "@/lib/i18n";
import { claudePrompt } from "@/lib/install";
import { TemplateInstall } from "@/components/template-install";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const revalidate = 600;

// Slot display order, top to bottom (matches the loader's assembly order).
const SLOT_ORDER: Array<keyof Dict["templates"]["slots"]> = [
  "top",
  "middle",
  "row1",
  "row2",
  "bottom",
];

export default async function TemplatesPage() {
  const locale = await getLocale();
  const t = getDict(locale);
  const [profiles, components] = await Promise.all([getProfiles(), getComponents()]);

  // Feature the author's daily-driver ("loki") first, then the rest by name.
  const ordered = [...profiles].sort((a, b) => {
    if (a.name === "loki") return -1;
    if (b.name === "loki") return 1;
    return a.name.localeCompare(b.name, "en");
  });

  return (
    <main className="w-full py-12 lg:py-16">
      <header className="space-y-3">
        <Badge variant="outline" className="font-mono">
          {t.templates.title.toLowerCase()}
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.templates.title}
        </h1>
        <p className="max-w-2xl text-pretty text-muted-foreground">{t.templates.intro}</p>
      </header>

      <section className="mt-10 space-y-8">
        {ordered.map((profile) => (
          <TemplateCard
            key={profile.name}
            profile={profile}
            components={components}
            t={t}
            locale={locale}
          />
        ))}
      </section>
    </main>
  );
}

function TemplateCard({
  profile,
  components,
  t,
  locale,
}: {
  profile: Profile;
  components: Component[];
  t: Dict;
  locale: Locale;
}) {
  const byId = new Map(components.map((c) => [c.id, c]));
  const label = (inst: ProfileInstance) => {
    const c = byId.get(inst.id);
    const base = c ? localizedName(c, locale) : inst.id;
    const win = (inst.config as { window?: string } | undefined)?.window;
    return win ? `${base} (${win})` : base;
  };

  // Group instances by slot, preserving order within each slot.
  const bySlot = new Map<string, ProfileInstance[]>();
  for (const inst of profile.components) {
    const slot = inst.slot ?? byId.get(inst.id)?.placement?.slot ?? "row1";
    if (!bySlot.has(slot)) bySlot.set(slot, []);
    bySlot.get(slot)!.push(inst);
  }
  for (const list of bySlot.values()) {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  const shellOneLiner = `curl -fsSL ${SITE_URL}/install/${profile.name}.sh | bash`;
  const prompt = claudePrompt(profile);

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Layers className="size-4 text-muted-foreground" />
        <span className="font-mono text-base font-semibold">{profile.name}</span>
        <Badge variant="secondary" className="text-[10px]">
          {profile.components.length} {t.templates.components}
        </Badge>
      </div>

      {profile.description ? (
        <p className="text-sm text-muted-foreground">{profile.description}</p>
      ) : null}

      {/* Layout — one row per slot */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t.templates.layout}
        </h3>
        <div className="overflow-hidden rounded-lg border border-border/60 font-mono text-xs">
          {SLOT_ORDER.filter((s) => bySlot.has(s)).map((slot, i) => (
            <div
              key={slot}
              className={
                "flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3" +
                (i > 0 ? " border-t border-border/60" : "")
              }
            >
              <span className="w-16 shrink-0 text-muted-foreground/70">
                {t.templates.slots[slot]}
              </span>
              <span className="flex flex-wrap gap-x-2 gap-y-1 text-foreground/90">
                {bySlot
                  .get(slot)!
                  .map((inst) => label(inst))
                  .join("  ·  ")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Install */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t.templates.install}
        </h3>
        <TemplateInstall
          shell={shellOneLiner}
          claude={prompt}
          labels={{
            shell: t.templates.tabShell,
            claude: t.templates.tabClaude,
            shellHint: t.templates.shellHint,
            claudeHint: t.templates.claudeHint,
          }}
        />
      </div>
    </Card>
  );
}
