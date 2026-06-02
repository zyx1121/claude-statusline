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
import { TemplateCard } from "@/components/templates/template-card";
import { Badge } from "@/components/ui/badge";

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
        <p className="max-w-2xl text-pretty text-foreground/60">
          {t.templates.intro}
        </p>
      </header>

      <section className="mt-10 space-y-8">
        {ordered.map((profile) => (
          <TemplateCard
            key={profile.name}
            view={toTemplateCardView(profile, components, t, locale)}
            labels={{
              components: t.templates.components,
              layout: t.templates.layout,
              install: t.templates.install,
              tabShell: t.templates.tabShell,
              tabClaude: t.templates.tabClaude,
              shellHint: t.templates.shellHint,
              claudeHint: t.templates.claudeHint,
            }}
          />
        ))}
      </section>
    </main>
  );
}

function toTemplateCardView(
  profile: Profile,
  components: Component[],
  t: Dict,
  locale: Locale,
) {
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

  return {
    name: profile.name,
    description: profile.description,
    componentCount: profile.components.length,
    layoutRows: SLOT_ORDER.filter((s) => bySlot.has(s)).map((slot) => ({
      slot: t.templates.slots[slot],
      components: bySlot
        .get(slot)!
        .map((inst) => label(inst))
        .join("  ·  "),
    })),
    install: {
      shell: shellOneLiner,
      claude: prompt,
    },
  };
}
