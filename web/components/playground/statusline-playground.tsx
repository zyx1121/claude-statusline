"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlignLeft,
  AlignRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Library,
  Plus,
  Search,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";

import {
  cellSpans,
  drawMosaic,
  invTable,
  parseCells,
  useFrameCycle,
} from "@/components/ansi";
import { TerminalSurface } from "@/components/blocks/terminal-surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
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
  components: Array<{
    id: string;
    slot?: string;
    order?: number;
    align?: "left" | "right";
    config?: Record<string, unknown>;
  }>;
}

interface BuilderItem {
  key: string;
  id: string;
  slot: Slot;
  align?: "left" | "right";
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

  const selectedIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
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
      .sort(
        (a, b) =>
          recommendScore(b, selectedIds, missingSlots) -
            recommendScore(a, selectedIds, missingSlots) ||
          a.name.localeCompare(b.name),
      );
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
      { key: `${id}-${current.length}-${current.reduce((n, i) => n + i.key.length, 0)}`, id, slot: target },
    ]);
  }

  function removeItem(key: string) {
    setSelectedProfile("custom");
    setItems((current) => current.filter((item) => item.key !== key));
  }

  // ← → reorder within the slot; ↑ ↓ move to the adjacent same-family slot
  // (line widgets: top↔middle↔bottom; segments: row1↔row2).
  function moveItem(key: string, dir: "up" | "down" | "left" | "right") {
    setSelectedProfile("custom");
    setItems((current) => {
      const idx = current.findIndex((it) => it.key === key);
      if (idx < 0) return current;
      const item = current[idx];
      if (dir === "left" || dir === "right") {
        const a = item.align ?? "left";
        const siblings = current.flatMap((it, i) =>
          it.slot === item.slot && (it.align ?? "left") === a ? [i] : [],
        );
        const pos = siblings.indexOf(idx);
        const swap = dir === "left" ? pos - 1 : pos + 1;
        if (swap < 0 || swap >= siblings.length) return current;
        const j = siblings[swap];
        const next = current.slice();
        [next[idx], next[j]] = [next[j], next[idx]];
        return next;
      }
      const family = slotFamily(item.slot);
      const fi = family.indexOf(item.slot);
      const nfi = dir === "up" ? fi - 1 : fi + 1;
      if (nfi < 0 || nfi >= family.length) return current;
      const next = current.slice();
      next[idx] = { ...item, slot: family[nfi] };
      return next;
    });
  }

  function setAlign(key: string, align: "left" | "right") {
    setSelectedProfile("custom");
    setItems((current) =>
      current.map((it) => (it.key === key ? { ...it, align } : it)),
    );
  }

  function clearItems() {
    setSelectedProfile("custom");
    setItems([]);
  }

  return (
    <main className="relative left-1/2 flex h-[calc(100dvh-3.5rem)] w-dvw -translate-x-1/2 flex-col overflow-hidden border-t border-foreground/10 bg-background lg:flex-row">
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
            {profiles.slice(0, 4).map((p) => (
              <Button
                key={p.name}
                variant={selectedProfile === p.name ? "default" : "outline"}
                size="sm"
                onClick={() => applyProfile(p.name)}
              >
                {p.name}
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
            <CopyButton
              value={installPrompt}
              label="Copy install prompt"
              copiedLabel="Prompt copied"
              className="ml-auto size-7 text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-3.5 pb-4 pt-6">
            <ComposedTerminal
              items={items}
              byId={byId}
              octants={octants}
              onRemove={removeItem}
              onMove={moveItem}
              onSetAlign={setAlign}
            />
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
              Recommended first · click + to add
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
    </main>
  );
}

// ---------- composed terminal (faithful render) ----------

// Slot families for ↑↓ movement: line widgets cycle top/middle/bottom, segments row1/row2.
const LINE_FAMILY: Slot[] = ["top", "middle", "bottom"];
const SEGMENT_FAMILY: Slot[] = ["row1", "row2"];
function slotFamily(slot: Slot): Slot[] {
  return SEGMENT_FAMILY.includes(slot) ? SEGMENT_FAMILY : LINE_FAMILY;
}

// Visible width of an ANSI line (strip SGR, count CJK/wide glyphs as 2) — drives font fit.
function visibleWidth(s: string): number {
  let w = 0;
  for (const ch of s.replace(/\x1b\[[0-9;]*m/g, "")) {
    const cp = ch.codePointAt(0) ?? 0;
    const wide =
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      cp >= 0x1f300;
    w += wide ? 2 : 1;
  }
  return w;
}

function ComposedTerminal({
  items,
  byId,
  octants,
  onRemove,
  onMove,
  onSetAlign,
}: {
  items: BuilderItem[];
  byId: Map<string, PlaygroundComponent>;
  octants: string;
  onRemove: (key: string) => void;
  onMove: (key: string, dir: "up" | "down" | "left" | "right") => void;
  onSetAlign: (key: string, align: "left" | "right") => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(13);

  // Fixed terminal box, content scales to fit: widest text line drives the font size
  // (mosaic widgets render to canvas and self-fit, so they're skipped; a segment row's
  // width is the sum of its segments + separators).
  const maxCols = useMemo(() => {
    let m = 24;
    const widthOf = (c: PlaygroundComponent) =>
      visibleWidth(((c.frames?.length ? c.frames[0] : c.preview) || "").split("\n")[0] || "");
    for (const it of items) {
      const c = byId.get(it.id);
      if (!c || c.mosaic || it.slot === "row1" || it.slot === "row2") continue;
      m = Math.max(m, widthOf(c));
    }
    for (const slot of ["row1", "row2"] as Slot[]) {
      let w = 0;
      items
        .filter((i) => i.slot === slot)
        .forEach((it, idx) => {
          const c = byId.get(it.id);
          if (c) w += widthOf(c) + (idx ? 3 : 0);
        });
      m = Math.max(m, w);
    }
    return m;
  }, [items, byId]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const fit = () => {
      const w = el.clientWidth - 8;
      setFontSize(Math.max(8, Math.min(18, w / (maxCols * 0.6))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxCols]);

  if (!items.length) {
    return (
      <div className="flex h-full min-h-[12rem] items-center justify-center px-6 text-center font-mono text-xs text-neutral-600">
        Pick a profile above, or add components from the library — they compose
        here exactly as the status line renders them.
      </div>
    );
  }

  const slotItems = (slot: Slot) => items.filter((item) => item.slot === slot);

  const lineSlot = (slot: Slot) => {
    const list = slotItems(slot);
    const fi = LINE_FAMILY.indexOf(slot);
    return list.map((item, i) => {
      const component = byId.get(item.id);
      if (!component) return null;
      return (
        <EditableLine
          key={item.key}
          component={component}
          octants={octants}
          canLeft={i > 0}
          canRight={i < list.length - 1}
          canUp={fi > 0}
          canDown={fi < LINE_FAMILY.length - 1}
          onLeft={() => onMove(item.key, "left")}
          onRight={() => onMove(item.key, "right")}
          onUp={() => onMove(item.key, "up")}
          onDown={() => onMove(item.key, "down")}
          onRemove={() => onRemove(item.key)}
        />
      );
    });
  };

  const segmentRow = (slot: Slot) => {
    const list = slotItems(slot);
    if (!list.length) return null;
    const fi = SEGMENT_FAMILY.indexOf(slot);
    const left = list.filter((it) => (it.align ?? "left") !== "right");
    const right = list.filter((it) => (it.align ?? "left") === "right");
    const seg = (item: BuilderItem, i: number, count: number) => {
      const component = byId.get(item.id);
      if (!component) return null;
      return (
        <span key={item.key} className="inline-flex items-center">
          {i > 0 ? (
            <span className="select-none px-1 text-[rgb(128,140,158)]">·</span>
          ) : null}
          <EditableSegment
            component={component}
            align={item.align ?? "left"}
            canLeft={i > 0}
            canRight={i < count - 1}
            canUp={fi > 0}
            canDown={fi < SEGMENT_FAMILY.length - 1}
            onLeft={() => onMove(item.key, "left")}
            onRight={() => onMove(item.key, "right")}
            onUp={() => onMove(item.key, "up")}
            onDown={() => onMove(item.key, "down")}
            onRemove={() => onRemove(item.key)}
            onToggleAlign={() =>
              onSetAlign(item.key, (item.align ?? "left") === "right" ? "left" : "right")
            }
          />
        </span>
      );
    };
    return (
      <div className="flex w-full items-center whitespace-pre">
        <span className="inline-flex items-center">
          {left.map((it, i) => seg(it, i, left.length))}
        </span>
        {right.length ? (
          <span className="ml-auto inline-flex items-center">
            {right.map((it, i) => seg(it, i, right.length))}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div
      ref={bodyRef}
      className="font-mono text-neutral-300"
      style={{ fontSize: `${fontSize}px`, lineHeight: 1.3 }}
    >
      {lineSlot("top")}
      {lineSlot("middle")}
      {segmentRow("row1")}
      {segmentRow("row2")}
      {lineSlot("bottom")}
    </div>
  );
}

interface UnitProps {
  canUp: boolean;
  canDown: boolean;
  canLeft: boolean;
  canRight: boolean;
  onUp: () => void;
  onDown: () => void;
  onLeft: () => void;
  onRight: () => void;
  onRemove: () => void;
  align?: "left" | "right";
  onToggleAlign?: () => void;
}

function EditableLine({
  component,
  octants,
  ...edit
}: { component: PlaygroundComponent; octants: string } & UnitProps) {
  const isMosaic = Boolean(component.mosaic && component.frames?.length);
  const frames = component.frames ?? [];
  const idx = useFrameCycle(isMosaic ? 0 : frames.length);
  const text = !isMosaic && frames.length ? frames[idx % frames.length] : component.preview;
  const rows = isMosaic ? [] : parseCells((text ?? "").replace(/\n+$/, ""));

  return (
    <div className="group relative w-full rounded px-1 transition-colors hover:bg-white/[0.04]">
      {isMosaic ? (
        <MosaicCanvas frames={component.frames ?? []} octants={octants} />
      ) : rows.length ? (
        rows.map((cells, i) => (
          <div key={i} className="whitespace-pre">
            {cells.length ? cellSpans(cells, i * 4096) : " "}
          </div>
        ))
      ) : (
        <span className="text-neutral-600">{component.id}</span>
      )}
      <UnitToolbar className="right-1 bottom-full mb-0.5" {...edit} />
    </div>
  );
}

function EditableSegment({
  component,
  ...edit
}: { component: PlaygroundComponent } & UnitProps) {
  const frames = component.frames ?? [];
  const idx = useFrameCycle(frames.length);
  const text = (frames.length ? frames[idx % frames.length] : component.preview) || "";
  const cells = parseCells(text.replace(/\n+$/, ""))[0] ?? [];

  return (
    <span className="group relative inline-flex items-center whitespace-pre rounded px-1.5 transition-colors hover:bg-white/[0.06]">
      {cells.length ? cellSpans(cells, 0) : <span className="text-neutral-600">{component.id}</span>}
      <UnitToolbar className="left-0 bottom-full mb-0.5" {...edit} />
    </span>
  );
}

function MosaicCanvas({
  frames,
  octants,
  px = 2,
}: {
  frames: string[];
  octants: string;
  px?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const idx = useFrameCycle(frames.length);
  useEffect(() => {
    if (ref.current && frames.length) {
      drawMosaic(ref.current, frames[idx % frames.length], invTable(octants), px);
    }
  }, [idx, frames, octants, px]);
  return <canvas ref={ref} className="block max-w-full [image-rendering:pixelated]" />;
}

function UnitToolbar({
  className,
  canUp,
  canDown,
  canLeft,
  canRight,
  onUp,
  onDown,
  onLeft,
  onRight,
  onRemove,
  align,
  onToggleAlign,
}: { className?: string } & UnitProps) {
  return (
    <span
      className={cn(
        "absolute z-20 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100",
        className,
      )}
    >
      <ToolButton label="Move left" disabled={!canLeft} onClick={onLeft}>
        <ChevronLeft className="size-3" />
      </ToolButton>
      <ToolButton label="Move right" disabled={!canRight} onClick={onRight}>
        <ChevronRight className="size-3" />
      </ToolButton>
      <ToolButton label="Move to slot above" disabled={!canUp} onClick={onUp}>
        <ChevronUp className="size-3" />
      </ToolButton>
      <ToolButton label="Move to slot below" disabled={!canDown} onClick={onDown}>
        <ChevronDown className="size-3" />
      </ToolButton>
      {onToggleAlign ? (
        <ToolButton
          label={align === "right" ? "Align left" : "Align right"}
          onClick={onToggleAlign}
        >
          {align === "right" ? (
            <AlignLeft className="size-3" />
          ) : (
            <AlignRight className="size-3" />
          )}
        </ToolButton>
      ) : null}
      <ToolButton label="Remove" onClick={onRemove}>
        <X className="size-3" />
      </ToolButton>
    </span>
  );
}

function ToolButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-5 items-center justify-center rounded bg-neutral-900/90 text-neutral-400 ring-1 ring-white/10 backdrop-blur transition hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-30 disabled:hover:bg-neutral-900/90"
    >
      {children}
    </button>
  );
}

// ---------- library ----------

function LibraryItem({
  component,
  recommended,
  onAdd,
}: {
  component: PlaygroundComponent;
  recommended: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="corner-token rounded-xl bg-background p-3 ring-1 ring-foreground/10 transition hover:ring-foreground/20">
      <div className="flex items-start gap-2">
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
        <Button
          variant="ghost"
          size="sm"
          className="size-8 px-0"
          aria-label={`Add ${component.name}`}
          onClick={onAdd}
        >
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

// ---------- profile <-> items ----------

function profileToItems(
  profile: PlaygroundProfile | undefined,
  byId: Map<string, PlaygroundComponent>,
): BuilderItem[] {
  if (!profile) return [];
  return profile.components
    .filter((component) => byId.has(component.id))
    .sort(
      (a, b) =>
        (a.slot ?? "").localeCompare(b.slot ?? "") || (a.order ?? 0) - (b.order ?? 0),
    )
    .map((component, index) => {
      const def = byId.get(component.id);
      return {
        key: `${profile.name}-${component.id}-${index}`,
        id: component.id,
        slot: normalizeSlot(component.slot) ?? (def ? defaultSlot(def) : "row1"),
        align: component.align === "right" ? "right" : "left",
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
    components: SLOTS.flatMap((slot) =>
      (grouped.get(slot.id) ?? []).map((item, index) => ({
        id: item.id,
        slot: item.slot,
        order: (index + 1) * 10,
        ...(item.align === "right" ? { align: "right" as const } : {}),
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
