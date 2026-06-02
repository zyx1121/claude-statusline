"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Library,
  Plus,
  Search,
  Sparkles,
  Terminal,
  Trash2,
  X,
} from "lucide-react";

import { AnimatedPreview, MosaicPreview } from "@/components/ansi";
import { TerminalSurface } from "@/components/blocks/terminal-surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyCommand } from "@/components/ui/copy-command";
import { cn } from "@/lib/utils";

type Slot = "top" | "middle" | "row1" | "row2" | "bottom";

const SLOTS: Array<{ id: Slot; label: string }> = [
  { id: "top", label: "Top" },
  { id: "middle", label: "Middle" },
  { id: "row1", label: "Row 1" },
  { id: "row2", label: "Row 2" },
  { id: "bottom", label: "Bottom" },
];

export interface PlaygroundComponent {
  id: string;
  name: string;
  description: string;
  type: "segment" | "line";
  runtime: string;
  author: string;
  official: boolean;
  preview: string;
  frames?: string[];
  mosaic?: boolean;
  network: string[];
  needsSecrets: boolean;
  hasFetch: boolean;
  placement?: { slot?: string; order?: number };
}

export interface PlaygroundProfile {
  name: string;
  description?: string;
  rule?: boolean;
  components: Array<{
    id: string;
    slot?: string;
    order?: number;
    config?: Record<string, unknown>;
  }>;
}

interface BuilderItem {
  key: string;
  id: string;
  slot: Slot;
  config?: Record<string, unknown>;
}

export function StatuslinePlayground({
  components,
  profiles,
  octants,
  live,
  stats,
}: {
  components: PlaygroundComponent[];
  profiles: PlaygroundProfile[];
  octants: string;
  live: boolean;
  stats: { components: number; authors: number };
}) {
  const byId = useMemo(() => new Map(components.map((c) => [c.id, c])), [components]);
  const defaultProfile = profiles.find((p) => p.name === "loki") ?? profiles[0];
  const [selectedProfile, setSelectedProfile] = useState(defaultProfile?.name ?? "custom");
  const [items, setItems] = useState<BuilderItem[]>(() =>
    profileToItems(defaultProfile, byId),
  );
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | "segment" | "line">("all");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selectedIds = useMemo(
    () => new Set(items.map((item) => item.id)),
    [items],
  );
  const missingSlots = useMemo(
    () =>
      SLOTS.filter((slot) => !items.some((item) => item.slot === slot.id)).map(
        (slot) => slot.id,
      ),
    [items],
  );

  const library = useMemo(() => {
    const q = query.trim().toLowerCase();
    return components
      .filter((component) => {
        if (type !== "all" && component.type !== type) return false;
        if (!q) return true;
        return [
          component.id,
          component.name,
          component.description,
          component.author,
          component.runtime,
          component.type,
          component.network.join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => recommendScore(b, selectedIds, missingSlots) - recommendScore(a, selectedIds, missingSlots) || a.name.localeCompare(b.name));
  }, [components, missingSlots, query, selectedIds, type]);

  const profile = useMemo(
    () => buildProfile(items, byId, selectedProfile),
    [byId, items, selectedProfile],
  );
  const installPrompt = useMemo(() => buildInstallPrompt(profile), [profile]);

  function applyProfile(profileName: string) {
    const next = profiles.find((p) => p.name === profileName);
    setSelectedProfile(profileName);
    setItems(profileToItems(next, byId));
  }

  function addComponent(id: string, slot?: Slot) {
    const component = byId.get(id);
    if (!component) return;
    const target = slot ?? defaultSlot(component);
    setSelectedProfile("custom");
    setItems((current) => [
      ...current,
      { key: `${id}-${Date.now()}-${current.length}`, id, slot: target },
    ]);
  }

  function removeItem(key: string) {
    setSelectedProfile("custom");
    setItems((current) => current.filter((item) => item.key !== key));
  }

  function clearItems() {
    setSelectedProfile("custom");
    setItems([]);
  }

  function handleDragEnd(event: DragEndEvent) {
    const active = event.active;
    const over = event.over;
    if (!over) return;
    const activeData = active.data.current as DragMeta | undefined;
    const overData = over.data.current as DragMeta | undefined;
    if (!activeData || !overData) return;

    if (activeData.kind === "library") {
      const slot =
        overData.kind === "slot"
          ? overData.slot
          : overData.kind === "builder"
            ? overData.slot
            : undefined;
      addComponent(activeData.id, slot);
      return;
    }

    if (activeData.kind !== "builder") return;
    setSelectedProfile("custom");
    setItems((current) => {
      const moving = current.find((item) => item.key === activeData.key);
      if (!moving) return current;
      const without = current.filter((item) => item.key !== activeData.key);
      const targetSlot =
        overData.kind === "slot"
          ? overData.slot
          : overData.kind === "builder"
            ? overData.slot
            : moving.slot;
      const moved = { ...moving, slot: targetSlot };
      if (overData.kind !== "builder") return [...without, moved];
      const targetIndex = without.findIndex((item) => item.key === overData.key);
      if (targetIndex < 0) return [...without, moved];
      return [
        ...without.slice(0, targetIndex),
        moved,
        ...without.slice(targetIndex),
      ];
    });
  }

  return (
    <main className="relative left-1/2 flex h-[calc(100dvh-3.5rem)] w-dvw -translate-x-1/2 flex-col overflow-hidden border-t border-foreground/10 bg-background lg:flex-row">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge variant="outline" className="mb-3 gap-1.5 font-mono text-xs">
                <Terminal className="size-3.5" />
                playground
              </Badge>
              <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
                claude-statusline
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-foreground/60">
                {stats.components} components · {stats.authors} authors ·{" "}
                {live ? "live registry" : "snapshot registry"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {profiles.slice(0, 4).map((profile) => (
                <Button
                  key={profile.name}
                  variant={selectedProfile === profile.name ? "default" : "outline"}
                  size="sm"
                  onClick={() => applyProfile(profile.name)}
                >
                  {profile.name}
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={clearItems}>
                <X className="size-3.5" />
                Clear
              </Button>
            </div>
          </div>

          <TerminalSurface className="flex min-h-[520px] flex-1 flex-col overflow-hidden">
            <div className="flex items-center gap-1.5 border-b border-white/5 px-3.5 py-2.5">
              <span className="size-3 rounded-full bg-[#ff5f57]" />
              <span className="size-3 rounded-full bg-[#febc2e]" />
              <span className="size-3 rounded-full bg-[#28c840]" />
              <span className="ml-2 font-mono text-[11px] text-neutral-500">
                {profile.name}.json
              </span>
              <span className="ml-auto font-mono text-[11px] text-neutral-600">
                {items.length} components
              </span>
            </div>
            <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[1fr_360px]">
              <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
                {SLOTS.map((slot) => (
                  <TerminalSlot
                    key={slot.id}
                    slot={slot.id}
                    label={slot.label}
                    items={items.filter((item) => item.slot === slot.id)}
                    byId={byId}
                    octants={octants}
                    onRemove={removeItem}
                  />
                ))}
              </div>
              <div className="corner-token flex min-h-[220px] flex-col overflow-hidden rounded-xl bg-white/[0.03] ring-1 ring-white/10 lg:min-h-0">
                <div className="border-b border-white/5 px-4 py-3">
                  <p className="font-mono text-xs text-neutral-500">install prompt</p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <CopyCommand
                    value={installPrompt}
                    prompt=""
                    multiline
                    className="bg-white/[0.04] text-xs text-neutral-300"
                  />
                </div>
              </div>
            </div>
          </TerminalSurface>
        </section>

        <aside className="flex h-[42dvh] min-h-0 shrink-0 border-t border-foreground/10 bg-block/70 lg:h-auto lg:w-[440px] lg:flex-col lg:border-l lg:border-t-0">
          <div className="flex min-h-0 w-full flex-col">
            <div className="space-y-3 border-b border-foreground/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Library className="size-4 text-foreground/60" />
                  <h2 className="font-mono text-sm font-semibold">Component library</h2>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {stats.components} items
                </Badge>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search components"
                  className="corner-token h-10 w-full rounded-xl bg-background pl-9 pr-3 text-sm outline-none ring-1 ring-foreground/10 transition focus:ring-foreground/30"
                />
              </div>
              <div className="flex gap-1">
                {(["all", "segment", "line"] as const).map((next) => (
                  <Button
                    key={next}
                    variant={type === next ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setType(next)}
                  >
                    {next}
                  </Button>
                ))}
              </div>
              <p className="flex items-center gap-1.5 text-xs text-foreground/60">
                <Sparkles className="size-3.5" />
                Recommended
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {library.map((component) => (
                  <LibraryItem
                    key={component.id}
                    component={component}
                    recommended={recommendScore(component, selectedIds, missingSlots) >= 5}
                    onAdd={() => addComponent(component.id)}
                  />
                ))}
              </div>
            </div>
            <div className="border-t border-foreground/10 p-3 text-xs text-foreground/60">
              {live ? "Live registry" : "Snapshot registry"} · {stats.authors} authors
            </div>
          </div>
        </aside>
      </DndContext>
    </main>
  );
}

type DragMeta =
  | { kind: "library"; id: string }
  | { kind: "slot"; slot: Slot }
  | { kind: "builder"; key: string; slot: Slot };

function TerminalSlot({
  slot,
  label,
  items,
  byId,
  octants,
  onRemove,
}: {
  slot: Slot;
  label: string;
  items: BuilderItem[];
  byId: Map<string, PlaygroundComponent>;
  octants: string;
  onRemove: (key: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${slot}`,
    data: { kind: "slot", slot } satisfies DragMeta,
  });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "corner-token rounded-xl bg-black/20 p-2 ring-1 ring-white/5 transition",
        isOver && "bg-white/[0.06] ring-white/20",
      )}
    >
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="font-mono text-[11px] uppercase text-neutral-500">{label}</span>
        <span className="h-px flex-1 bg-white/5" />
        <span className="font-mono text-[10px] text-neutral-600">{items.length}</span>
      </div>
      <SortableContext
        items={items.map((item) => `builder:${item.key}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {items.length ? (
            items.map((item) => {
              const component = byId.get(item.id);
              return component ? (
                <BuilderComponent
                  key={item.key}
                  item={item}
                  component={component}
                  octants={octants}
                  onRemove={() => onRemove(item.key)}
                />
              ) : null;
            })
          ) : (
            <div className="corner-token rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-neutral-600">
              Empty slot
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function BuilderComponent({
  item,
  component,
  octants,
  onRemove,
}: {
  item: BuilderItem;
  component: PlaygroundComponent;
  octants: string;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `builder:${item.key}`,
    data: { kind: "builder", key: item.key, slot: item.slot } satisfies DragMeta,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "corner-token rounded-lg bg-white/[0.04] p-2 ring-1 ring-white/10",
        isDragging && "opacity-60",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          className="cursor-grab rounded-md p-1 text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
          aria-label={`Move ${component.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs text-neutral-200">{component.name}</p>
          <p className="truncate text-[11px] text-neutral-600">{component.type}</p>
        </div>
        <button
          className="rounded-md p-1 text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
          aria-label={`Remove ${component.name}`}
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <PreviewBlock component={component} octants={octants} />
    </div>
  );
}

function LibraryItem({
  component,
  recommended,
  onAdd,
}: {
  component: PlaygroundComponent;
  recommended: boolean;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library:${component.id}`,
    data: { kind: "library", id: component.id } satisfies DragMeta,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "corner-token rounded-xl bg-background p-3 ring-1 ring-foreground/10 transition hover:ring-foreground/20",
        isDragging && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-0.5 cursor-grab rounded-md p-1 text-foreground/40 hover:bg-foreground/5 hover:text-foreground"
          aria-label={`Drag ${component.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-mono text-sm font-medium">{component.name}</p>
            {recommended ? (
              <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">
                recommended
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-foreground/60">
            {component.description}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="size-8 px-0" onClick={onAdd}>
          <Plus className="size-4" />
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="outline" className="px-2 py-0.5 font-mono text-[10px]">
          {component.type}
        </Badge>
        <Badge variant="outline" className="px-2 py-0.5 font-mono text-[10px]">
          {component.runtime}
        </Badge>
        {component.network.length ? (
          <Badge variant="outline" className="px-2 py-0.5 text-[10px]">
            network
          </Badge>
        ) : null}
        {component.needsSecrets ? (
          <Badge variant="outline" className="px-2 py-0.5 text-[10px]">
            secrets
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

function PreviewBlock({
  component,
  octants,
}: {
  component: PlaygroundComponent;
  octants: string;
}) {
  if (component.mosaic && component.frames?.length) {
    return <MosaicPreview frames={component.frames} octants={octants} px={2} />;
  }
  if (component.preview.trim()) {
    return (
      <AnimatedPreview
        frames={component.frames}
        fallback={component.preview}
        className="text-[10px]"
      />
    );
  }
  return (
    <div className="corner-token rounded-lg bg-black/20 px-3 py-2 text-center text-[11px] text-neutral-600">
      No preview
    </div>
  );
}

function profileToItems(
  profile: PlaygroundProfile | undefined,
  byId: Map<string, PlaygroundComponent>,
): BuilderItem[] {
  if (!profile) return [];
  return profile.components
    .filter((component) => byId.has(component.id))
    .sort((a, b) => (a.slot ?? "").localeCompare(b.slot ?? "") || (a.order ?? 0) - (b.order ?? 0))
    .map((component, index) => {
      const def = byId.get(component.id);
      return {
        key: `${profile.name}-${component.id}-${index}`,
        id: component.id,
        slot: normalizeSlot(component.slot) ?? (def ? defaultSlot(def) : "row1"),
        config: component.config,
      };
    });
}

function buildProfile(
  items: BuilderItem[],
  byId: Map<string, PlaygroundComponent>,
  selectedProfile: string,
): PlaygroundProfile {
  const grouped = new Map<Slot, BuilderItem[]>();
  for (const item of items) {
    const list = grouped.get(item.slot) ?? [];
    list.push(item);
    grouped.set(item.slot, list);
  }
  return {
    name: selectedProfile === "custom" ? "playground" : selectedProfile,
    description: "Composed in the claude-statusline playground.",
    rule: true,
    components: SLOTS.flatMap((slot) =>
      (grouped.get(slot.id) ?? []).map((item, index) => ({
        id: item.id,
        slot: item.slot,
        order: (index + 1) * 10,
        ...(item.config ? { config: item.config } : {}),
      })),
    ).filter((item) => byId.has(item.id)),
  };
}

function buildInstallPrompt(profile: PlaygroundProfile): string {
  return `Set up this custom claude-statusline profile for me.

1. Add the marketplace:  /plugin marketplace add zyx1121/claude-statusline
2. Install the plugin:   /plugin install statusline@claude-statusline
3. Wire it up:           /statusline:setup
4. Write this profile to ~/.claude/statusline/profiles/${profile.name}.json and make it active by copying it to ~/.claude/statusline/profiles/default.json:

${JSON.stringify(profile, null, 2)}

Every referenced component ships with the claude-statusline plugin. Preview it after activation and tell me if any component needs configuration.`;
}

function defaultSlot(component: PlaygroundComponent): Slot {
  const placement = normalizeSlot(component.placement?.slot);
  if (placement) return placement;
  return component.type === "line" ? "middle" : "row1";
}

function normalizeSlot(slot: string | undefined): Slot | null {
  return SLOTS.some((item) => item.id === slot) ? (slot as Slot) : null;
}

function recommendScore(
  component: PlaygroundComponent,
  selectedIds: Set<string>,
  missingSlots: Slot[],
): number {
  let score = 0;
  if (!selectedIds.has(component.id)) score += 2;
  if (component.official) score += 2;
  if (!component.network.length) score += 2;
  if (!component.needsSecrets) score += 1;
  if (component.preview.trim() || component.frames?.length) score += 1;
  const slot = defaultSlot(component);
  if (missingSlots.includes(slot)) score += 3;
  if (component.type === "segment" && missingSlots.includes("row1")) score += 1;
  if (component.type === "line" && missingSlots.includes("middle")) score += 1;
  return score;
}
