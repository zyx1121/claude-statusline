"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { Library, Plus, Search, SlidersHorizontal, X } from "lucide-react";

import {
  AnimatedPreview,
  MosaicPreview,
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

export interface ConfigField {
  type?: string;
  enum?: unknown[];
  default?: unknown;
  desc?: string;
}

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
  configSchema?: Record<string, ConfigField>;
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
  stats,
}: {
  components: PlaygroundComponent[];
  profiles: PlaygroundProfile[];
  octants: string;
  stats: { components: number; authors: number };
}) {
  const byId = useMemo(() => new Map(components.map((c) => [c.id, c])), [components]);
  const defaultProfile = profiles.find((p) => p.name === "loki") ?? profiles[0];
  const [selectedProfile, setSelectedProfile] = useState(defaultProfile?.name ?? "custom");
  const [items, setItems] = useState<BuilderItem[]>(() =>
    profileToItems(defaultProfile, byId),
  );
  const [query, setQuery] = useState("");
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Mobile only: which panel is expanded (one at a time). Desktop shows both.
  const [mobilePanel, setMobilePanel] = useState<"library" | "config" | null>(null);

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
  }, [components, missingSlots, query, selectedIds]);

  const profile = useMemo(
    () => buildProfile(items, byId, selectedProfile),
    [byId, items, selectedProfile],
  );
  const installPrompt = useMemo(() => buildInstallPrompt(profile), [profile]);

  // The terminal box shrinks to its content, so it can't measure its own width to
  // fit the font (that would feed back on itself). Measure the stable centering
  // wrapper instead and hand the usable width down to the composer.
  const fitRef = useRef<HTMLDivElement>(null);
  const [availWidth, setAvailWidth] = useState(640);
  useEffect(() => {
    const el = fitRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setAvailWidth(Math.max(160, el.clientWidth - 32));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    setSelectedKey((current) => (current === key ? null : current));
  }

  // Drag-to-reorder: drop `key` into `slot` at `index` within its (slot, align)
  // group. Lines ignore align (the whole slot is one group); segments split into
  // left/right groups, so the same call re-aligns a dragged segment too. `index`
  // is counted within the destination group, after the dragged item is removed.
  function moveTo(key: string, slot: Slot, align: "left" | "right", index: number) {
    setSelectedProfile("custom");
    setItems((current) => {
      const at = current.findIndex((it) => it.key === key);
      if (at < 0) return current;
      const moved = { ...current[at], slot, align };
      const rest = current.filter((it) => it.key !== key);
      const isLine = LINE_FAMILY.includes(slot);
      const inGroup = (it: BuilderItem) =>
        it.slot === slot && (isLine || (it.align ?? "left") === align);
      const groupAt = rest.flatMap((it, i) => (inGroup(it) ? [i] : []));
      const insertAt =
        index >= groupAt.length
          ? groupAt.length
            ? groupAt[groupAt.length - 1] + 1
            : rest.length
          : groupAt[index];
      const next = rest.slice();
      next.splice(insertAt, 0, moved);
      return next;
    });
  }

  // Config edits land on the placed instance (a profile component carries its own
  // config). They flow into the copied install prompt via buildProfile — the live
  // preview is a captured snapshot and does not re-render.
  function updateConfig(itemKey: string, field: string, value: unknown) {
    setSelectedProfile("custom");
    setItems((current) =>
      current.map((item) => {
        if (item.key !== itemKey) return item;
        const config = { ...(item.config ?? {}) };
        if (value === undefined) delete config[field];
        else config[field] = value;
        return { ...item, config: Object.keys(config).length ? config : undefined };
      }),
    );
  }

  const selectedItem = items.find((item) => item.key === selectedKey) ?? null;
  const selectedComponent = selectedItem ? byId.get(selectedItem.id) ?? null : null;

  return (
    <main className="relative left-1/2 h-[calc(100dvh-3.5rem)] w-dvw -translate-x-1/2 overflow-hidden border-t border-foreground/10 bg-background">
      {/* Terminal canvas — the focus. On desktop it sits in the clear column between
          the two floating panels; on mobile it fills the area above the toggle bar. */}
      <div
        ref={fitRef}
        className="absolute inset-x-0 top-0 bottom-14 z-0 flex items-center justify-center overflow-hidden p-4 sm:p-6 lg:inset-y-0 lg:bottom-0 lg:left-[372px] lg:right-[372px] lg:p-0 lg:py-5"
      >
        <TerminalSurface className="flex max-h-full max-w-full flex-col overflow-hidden">
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
          <div className="min-h-0 overflow-auto px-3.5 pb-4 pt-6">
            <ComposedTerminal
              items={items}
              byId={byId}
              octants={octants}
              availWidth={availWidth}
              dragKey={dragKey}
              selectedKey={selectedKey}
              onSelect={(key) => {
                setSelectedKey(key);
                setMobilePanel("config");
              }}
              onDragStart={setDragKey}
              onDragEnd={() => setDragKey(null)}
              onMoveTo={moveTo}
            />
          </div>
        </TerminalSurface>
      </div>

      {/* Left panel — component library. Floating overlay on desktop; a collapsible
          bottom sheet on mobile (one panel open at a time via the toggle bar). */}
      <aside
        onDragOver={(e) => {
          if (dragKey) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!dragKey) return;
          e.preventDefault();
          removeItem(dragKey);
          setDragKey(null);
        }}
        className={cn(
          "absolute inset-x-0 top-0 bottom-14 z-30 min-h-0 flex-col border-t border-foreground/10 bg-background/95 backdrop-blur transition-colors",
          "lg:inset-x-auto lg:inset-y-4 lg:left-4 lg:z-10 lg:flex lg:w-[340px] lg:rounded-2xl lg:border lg:border-foreground/10 lg:bg-background/80 lg:shadow-xl lg:shadow-black/20",
          mobilePanel === "library" ? "flex" : "hidden",
          dragKey && "bg-red-500/[0.04]",
        )}
      >
        {dragKey ? (
          <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-red-500/40 bg-background/40 backdrop-blur-[1px]">
            <span className="flex items-center gap-1.5 font-mono text-sm text-red-400/90">
              <X className="size-4" />
              Drop here to remove
            </span>
          </div>
        ) : null}
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
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {library.map((component) => (
              <LibraryItem
                key={component.id}
                component={component}
                octants={octants}
                selected={selectedComponent?.id === component.id}
                recommended={recommendScore(component, selectedIds, missingSlots) >= 5}
                onAdd={() => addComponent(component.id)}
              />
            ))}
          </div>
        </div>
      </aside>

      {/* Right panel — config for the selected component */}
      <aside
        className={cn(
          "absolute inset-x-0 top-0 bottom-14 z-30 min-h-0 flex-col border-t border-foreground/10 bg-background/95 backdrop-blur",
          "lg:inset-x-auto lg:inset-y-4 lg:right-4 lg:z-10 lg:flex lg:w-[340px] lg:rounded-2xl lg:border lg:border-foreground/10 lg:bg-background/80 lg:shadow-xl lg:shadow-black/20",
          mobilePanel === "config" ? "flex" : "hidden",
        )}
      >
        <ConfigPanel
          item={selectedItem}
          component={selectedComponent}
          onChange={updateConfig}
          onClose={() => {
            setSelectedKey(null);
            setMobilePanel(null);
          }}
        />
      </aside>

      {/* Mobile-only toggle bar — open one panel at a time */}
      <div className="absolute inset-x-0 bottom-0 z-40 flex h-14 items-center justify-center gap-2 border-t border-foreground/10 bg-background/90 px-4 backdrop-blur lg:hidden">
        <Button
          variant={mobilePanel === "library" ? "default" : "outline"}
          size="sm"
          onClick={() => setMobilePanel((p) => (p === "library" ? null : "library"))}
        >
          <Library className="size-3.5" />
          Library
        </Button>
        <Button
          variant={mobilePanel === "config" ? "default" : "outline"}
          size="sm"
          onClick={() => setMobilePanel((p) => (p === "config" ? null : "config"))}
        >
          <SlidersHorizontal className="size-3.5" />
          Config
        </Button>
      </div>
    </main>
  );
}

// ---------- composed terminal (faithful render) ----------

// Line widgets occupy top/middle/bottom, segments occupy row1/row2. Only the line
// family is needed now — to tell a line slot from a segment slot during a drag.
const LINE_FAMILY: Slot[] = ["top", "middle", "bottom"];

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

// Cell width of a mosaic line: one octant/sextant/block glyph is exactly one
// terminal cell whatever Unicode East-Asian width says — the legacy-computing
// blocks sit in a "wide" code-point range, but the terminal (and our canvas
// decoder, one Cell per code point) draw them one cell wide, so visibleWidth
// would double-count them.
function mosaicCols(line: string): number {
  return [...line.replace(/\x1b\[[0-9;]*m/g, "")].length;
}

// A "rule" line (e.g. the divider) is one row of a single repeated horizontal
// box-drawing glyph. The real status line draws it across the whole terminal, so in
// the composer it must fill the content width too — not sit at its captured length.
const RULE_GLYPHS = new Set([..."─━═┄┅┈┉╌╍▔▁"]);
function ruleGlyphOf(text: string): string | null {
  const chars = [...text.replace(/\x1b\[[0-9;]*m/g, "").replace(/\n+$/, "").trim()];
  if (!chars.length) return null;
  const ch = chars[0];
  return RULE_GLYPHS.has(ch) && chars.every((c) => c === ch) ? ch : null;
}

function ComposedTerminal({
  items,
  byId,
  octants,
  availWidth,
  dragKey,
  selectedKey,
  onSelect,
  onDragStart,
  onDragEnd,
  onMoveTo,
}: {
  items: BuilderItem[];
  byId: Map<string, PlaygroundComponent>;
  octants: string;
  availWidth: number;
  dragKey: string | null;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onDragStart: (key: string) => void;
  onDragEnd: () => void;
  onMoveTo: (key: string, slot: Slot, align: "left" | "right", index: number) => void;
}) {
  const [drop, setDrop] = useState<{
    slot: Slot;
    align: "left" | "right";
    index: number;
  } | null>(null);

  // Content scales to fit the available width: widest line drives the font size.
  // Mosaic widgets count too — they render onto a char grid (cols×rows cells) and
  // must scale with it, so their widest row participates. A segment row's width is
  // the sum of its segments + separators.
  const maxCols = useMemo(() => {
    let m = 24;
    const widthOf = (c: PlaygroundComponent) => {
      const measure = c.mosaic ? mosaicCols : visibleWidth;
      return ((c.frames?.length ? c.frames[0] : c.preview) || "")
        .split("\n")
        .reduce((mx, ln) => Math.max(mx, measure(ln)), 0);
    };
    for (const it of items) {
      const c = byId.get(it.id);
      if (!c || it.slot === "row1" || it.slot === "row2") continue;
      // Rule lines follow the content width, so they don't get to drive it.
      if (ruleGlyphOf((c.frames?.length ? c.frames[0] : c.preview) || "")) continue;
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

  // Width comes from the centered wrapper (passed in), not the box itself — the box
  // shrinks to content, so measuring it would feed the font size back on itself.
  const fontSize = Math.max(8, Math.min(18, availWidth / (maxCols * 0.6)));

  if (!items.length) {
    return (
      <div className="flex h-full min-h-[12rem] items-center justify-center px-6 text-center font-mono text-xs text-neutral-600">
        Add components from the library — they compose here exactly as the status
        line renders them. Click a piece to configure it, drag to reorder, or drag
        it back to the library to remove it.
      </div>
    );
  }

  const draggingItem = dragKey ? items.find((it) => it.key === dragKey) : null;
  const draggingType = draggingItem ? byId.get(draggingItem.id)?.type ?? null : null;
  const slotItems = (slot: Slot) => items.filter((item) => item.slot === slot);

  const endDrag = () => {
    setDrop(null);
    onDragEnd();
  };
  const commit = () => {
    if (dragKey && drop) onMoveTo(dragKey, drop.slot, drop.align, drop.index);
    endDrag();
  };

  // Line slot (top/middle/bottom): a vertical stack. Each line splits at its
  // vertical midpoint into before/after; an empty slot only materialises a drop
  // strip while a line is in flight, so the resting layout stays untouched.
  const lineZone = (slot: Slot) => {
    const list = slotItems(slot);
    const accepts = draggingType === "line";
    if (!list.length && !accepts) return null;
    const lineDrop = accepts && drop && drop.slot === slot ? drop.index : -1;
    return (
      <div
        key={slot}
        onDragOver={accepts ? (e) => e.preventDefault() : undefined}
        onDrop={accepts ? (e) => { e.preventDefault(); commit(); } : undefined}
      >
        {list.map((item, i) => {
          const component = byId.get(item.id);
          if (!component) return null;
          return (
            <Fragment key={item.key}>
              {lineDrop === i ? <DropBarH /> : null}
              <EditableLine
                component={component}
                octants={octants}
                maxCols={maxCols}
                dragging={dragKey === item.key}
                selected={selectedKey === item.key}
                onSelect={() => onSelect(item.key)}
                onDragStart={() => onDragStart(item.key)}
                onDragEnd={endDrag}
                onDragOver={
                  accepts
                    ? (e) => {
                        e.preventDefault();
                        const r = e.currentTarget.getBoundingClientRect();
                        const after = e.clientY > r.top + r.height / 2;
                        setDrop({ slot, align: "left", index: after ? i + 1 : i });
                      }
                    : undefined
                }
              />
            </Fragment>
          );
        })}
        {list.length > 0 && lineDrop >= list.length ? <DropBarH /> : null}
        {accepts && !list.length ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrop({ slot, align: "left", index: 0 });
            }}
            className={cn(
              "flex min-h-[1.5em] items-center justify-center rounded border border-dashed text-[0.7em] transition-colors",
              drop?.slot === slot
                ? "border-sky-400/60 bg-sky-400/5 text-sky-300/80"
                : "border-white/10 text-neutral-600",
            )}
          >
            {slot}
          </div>
        ) : null}
      </div>
    );
  };

  // Segment row (row1/row2): left + right aligned groups on one line. Drop align
  // follows which half of the row the cursor is over; drop index follows the
  // cursor's x within that group — so dragging a segment also re-aligns it.
  const segRow = (slot: Slot) => {
    const list = slotItems(slot);
    const accepts = draggingType === "segment";
    if (!list.length && !accepts) return null;
    const left = list.filter((it) => (it.align ?? "left") !== "right");
    const right = list.filter((it) => (it.align ?? "left") === "right");

    const onOver = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const host = e.currentTarget;
      const r = host.getBoundingClientRect();
      const align: "left" | "right" =
        e.clientX < r.left + r.width / 2 ? "left" : "right";
      const segs = Array.from(
        host.querySelectorAll<HTMLElement>("[data-seg]"),
      ).filter((el) => el.dataset.align === align);
      let index = segs.length;
      for (let k = 0; k < segs.length; k++) {
        const sr = segs[k].getBoundingClientRect();
        if (e.clientX < sr.left + sr.width / 2) {
          index = k;
          break;
        }
      }
      setDrop({ slot, align, index });
    };

    const group = (members: BuilderItem[], align: "left" | "right") => {
      const isTarget = accepts && drop?.slot === slot && drop.align === align;
      const dropIndex = drop && isTarget ? drop.index : -1;
      const nodes: ReactNode[] = [];
      members.forEach((item, i) => {
        const component = byId.get(item.id);
        if (!component) return;
        if (dropIndex === i) nodes.push(<DropBarV key={`d-${i}`} />);
        nodes.push(
          <span key={item.key} className="inline-flex items-center">
            {i > 0 ? (
              <span className="select-none px-1 text-[rgb(128,140,158)]">·</span>
            ) : null}
            <EditableSegment
              component={component}
              dataAlign={align}
              dragging={dragKey === item.key}
              selected={selectedKey === item.key}
              onSelect={() => onSelect(item.key)}
              onDragStart={() => onDragStart(item.key)}
              onDragEnd={endDrag}
            />
          </span>,
        );
      });
      if (dropIndex >= members.length) nodes.push(<DropBarV key="d-end" />);
      return nodes;
    };

    return (
      <div
        key={slot}
        onDragOver={accepts ? onOver : undefined}
        onDrop={accepts ? (e) => { e.preventDefault(); commit(); } : undefined}
        className={cn(
          "flex w-full items-center whitespace-pre",
          accepts &&
            !list.length &&
            "min-h-[1.5em] rounded border border-dashed border-white/10",
        )}
      >
        <span className="inline-flex items-center">{group(left, "left")}</span>
        <span
          className={cn(
            "inline-flex items-center",
            right.length || accepts ? "ml-auto" : "",
          )}
        >
          {group(right, "right")}
        </span>
      </div>
    );
  };

  return (
    <div
      className="font-mono text-neutral-300"
      style={{ fontSize: `${fontSize}px`, lineHeight: 1.3 }}
    >
      {lineZone("top")}
      {lineZone("middle")}
      {segRow("row1")}
      {segRow("row2")}
      {lineZone("bottom")}
    </div>
  );
}

function DropBarH() {
  return (
    <div className="pointer-events-none -my-px h-0.5 rounded-full bg-sky-400/80" />
  );
}

function DropBarV() {
  return (
    <span className="pointer-events-none mx-0.5 inline-block h-[1.05em] w-0.5 self-center rounded-full bg-sky-400/80 align-middle" />
  );
}

function EditableLine({
  component,
  octants,
  maxCols,
  dragging,
  selected,
  onSelect,
  onDragStart,
  onDragEnd,
  onDragOver,
}: {
  component: PlaygroundComponent;
  octants: string;
  maxCols: number;
  dragging: boolean;
  selected: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void;
}) {
  const isMosaic = Boolean(component.mosaic && component.frames?.length);
  const frames = component.frames ?? [];
  const idx = useFrameCycle(isMosaic ? 0 : frames.length);
  const text = !isMosaic && frames.length ? frames[idx % frames.length] : component.preview;
  const rows = isMosaic ? [] : parseCells((text ?? "").replace(/\n+$/, ""));
  const rule = isMosaic ? null : ruleGlyphOf(text ?? "");
  const ruleColor = rule ? rows[0]?.find((c) => c.ch === rule)?.fg ?? undefined : undefined;

  return (
    <div
      draggable
      onClick={onSelect}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      className={cn(
        "w-full cursor-grab rounded px-1 ring-1 ring-inset transition-colors active:cursor-grabbing",
        selected
          ? "bg-sky-400/10 ring-sky-400/60"
          : "ring-transparent hover:bg-white/[0.04]",
        dragging && "opacity-40",
      )}
    >
      {isMosaic ? (
        <MosaicCanvas frames={component.frames ?? []} octants={octants} />
      ) : rule ? (
        <div
          className="overflow-hidden whitespace-pre"
          style={ruleColor ? { color: ruleColor } : undefined}
        >
          {rule.repeat(Math.max(1, maxCols))}
        </div>
      ) : rows.length ? (
        rows.map((cells, i) => (
          <div key={i} className="whitespace-pre">
            {cells.length ? cellSpans(cells, i * 4096) : " "}
          </div>
        ))
      ) : (
        <span className="text-neutral-600">{component.id}</span>
      )}
    </div>
  );
}

function EditableSegment({
  component,
  dataAlign,
  dragging,
  selected,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  component: PlaygroundComponent;
  dataAlign: "left" | "right";
  dragging: boolean;
  selected: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const frames = component.frames ?? [];
  const idx = useFrameCycle(frames.length);
  const text = (frames.length ? frames[idx % frames.length] : component.preview) || "";
  const cells = parseCells(text.replace(/\n+$/, ""))[0] ?? [];

  return (
    <span
      data-seg
      data-align={dataAlign}
      draggable
      onClick={onSelect}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "inline-flex cursor-grab items-center whitespace-pre rounded px-1.5 ring-1 ring-inset transition-colors active:cursor-grabbing",
        selected
          ? "bg-sky-400/10 ring-sky-400/60"
          : "ring-transparent hover:bg-white/[0.06]",
        dragging && "opacity-40",
      )}
    >
      {cells.length ? (
        cellSpans(cells, 0)
      ) : (
        <span className="text-neutral-600">{component.id}</span>
      )}
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
  // Sprite cell grid drives the on-screen size: the canvas occupies cols×rows of the
  // char grid (advance 0.6em, line 1.3em) just as the terminal would, so it scales
  // with the font fit and stays pixel-faithful and aligned with text rows above/below.
  const { cols, rows } = useMemo(() => {
    const lines = (frames[0] ?? "").replace(/\n+$/, "").split("\n");
    return {
      cols: lines.reduce((m, l) => Math.max(m, mosaicCols(l)), 0),
      rows: lines.length,
    };
  }, [frames]);
  useEffect(() => {
    if (ref.current && frames.length) {
      drawMosaic(ref.current, frames[idx % frames.length], invTable(octants), px);
    }
  }, [idx, frames, octants, px]);
  return (
    <canvas
      ref={ref}
      className="block [image-rendering:pixelated]"
      style={{ width: `${cols * 0.6}em`, height: `${rows * 1.3}em` }}
    />
  );
}

// ---------- library ----------

function LibraryItem({
  component,
  octants,
  selected,
  recommended,
  onAdd,
}: {
  component: PlaygroundComponent;
  octants: string;
  selected: boolean;
  recommended: boolean;
  onAdd: () => void;
}) {
  const mosaic = Boolean(component.mosaic && component.frames?.length);
  const hasText =
    !mosaic && Boolean(component.frames?.length || component.preview.trim());
  return (
    <div
      className={cn(
        "corner-token rounded-xl bg-background p-3 ring-1 transition",
        selected
          ? "ring-sky-400/60"
          : "ring-foreground/10 hover:ring-foreground/20",
      )}
    >
      {mosaic ? (
        <MosaicPreview
          frames={component.frames ?? []}
          octants={octants}
          px={2}
          className="mb-3 !overflow-x-hidden"
        />
      ) : hasText ? (
        <AnimatedPreview
          frames={component.frames}
          fallback={component.preview}
          className="mb-3 !overflow-x-hidden"
        />
      ) : null}
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

// ---------- config panel ----------

function ConfigPanel({
  item,
  component,
  onChange,
  onClose,
}: {
  item: BuilderItem | null;
  component: PlaygroundComponent | null;
  onChange: (itemKey: string, field: string, value: unknown) => void;
  onClose: () => void;
}) {
  const entries = Object.entries(component?.configSchema ?? {});

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-foreground/10 p-4">
        <div className="flex min-w-0 items-center gap-2">
          <SlidersHorizontal className="size-4 shrink-0 text-foreground/60" />
          <h2 className="truncate font-mono text-sm font-semibold">
            {component ? component.name : "Configure"}
          </h2>
        </div>
        {item ? (
          <Button
            variant="ghost"
            size="sm"
            className="size-7 px-0 text-foreground/60"
            aria-label="Deselect component"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!item || !component ? (
          <p className="text-sm leading-6 text-foreground/50">
            Click a component in the terminal to adjust its parameters. Values are
            written into the copied install prompt — the preview is a captured
            snapshot and won&apos;t re-render.
          </p>
        ) : entries.length === 0 ? (
          <p className="text-sm leading-6 text-foreground/50">
            <span className="font-mono text-foreground/70">{component.id}</span> has no
            configurable parameters.
          </p>
        ) : (
          <div className="space-y-5">
            <p className="text-[11px] leading-5 text-foreground/40">
              Edits flow into the install prompt, not the live preview.
            </p>
            {entries.map(([key, field]) => (
              <ConfigFieldRow
                key={key}
                name={key}
                field={field}
                value={item.config?.[key]}
                onChange={(value) => onChange(item.key, key, value)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const INPUT_CLS =
  "corner-token h-9 w-full rounded-lg bg-background px-3 text-sm outline-none ring-1 ring-foreground/10 transition focus:ring-foreground/30";

function ConfigFieldRow({
  name,
  field,
  value,
  onChange,
}: {
  name: string;
  field: ConfigField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const control = (() => {
    if (Array.isArray(field.enum) && field.enum.length) {
      return (
        <select
          value={String(value ?? field.default ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_CLS}
        >
          {field.enum.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
      );
    }
    if (field.type === "boolean") {
      const on = typeof value === "boolean" ? value : Boolean(field.default);
      return (
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => onChange(!on)}
          className={cn(
            "relative h-6 w-10 rounded-full ring-1 transition-colors",
            on ? "bg-sky-400/80 ring-sky-400/30" : "bg-foreground/10 ring-foreground/15",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-background transition-transform",
              on ? "translate-x-[18px]" : "translate-x-0.5",
            )}
          />
        </button>
      );
    }
    const numeric = field.type === "number" || field.type === "integer";
    // Show the effective value (override, else the component's default) so a field
    // never looks empty/unset — edits replace it; clearing falls back to the default.
    const shown = value !== undefined ? value : field.default;
    return (
      <input
        type={numeric ? "number" : "text"}
        value={shown === undefined || shown === null ? "" : String(shown)}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") onChange(undefined);
          else onChange(numeric ? Number(raw) : raw);
        }}
        className={INPUT_CLS}
      />
    );
  })();

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 font-mono text-xs font-medium">
        {name}
        {field.type ? (
          <span className="text-[10px] font-normal text-foreground/40">
            {field.type}
          </span>
        ) : null}
      </label>
      {control}
      {field.desc ? (
        <p className="text-[11px] leading-4 text-foreground/50">{field.desc}</p>
      ) : null}
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
