"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { TerminalSurface } from "@/components/blocks/terminal-surface";
import { cn } from "@/lib/utils";

/**
 * Renders component preview/animation frames two ways:
 *
 *  - Text widgets (news/stock ticker) + segments: ANSI → coloured <span> runs.
 *  - Mosaic widgets (creatures): the sprites are octant glyphs — each cell is a
 *    2×4 sub-pixel grid with a FG and a BG colour. A font can't show two colours
 *    per cell, so we DECODE each cell into real coloured pixels on a <canvas>,
 *    exactly like the terminal custom-draws them — font-independent and
 *    pixel-faithful. The 256-entry octant table (index = 8-bit pattern → glyph) is
 *    inverted to map a glyph back to its pattern; bit i ↔ sub-pixel (row i>>1, col i&1).
 *
 * Both cycle captured frames ~1/s (one terminal tick per second).
 */

const BASIC: Record<number, string> = {
  30: "#1a1a1a", 31: "#e06c75", 32: "#98c379", 33: "#e5c07b",
  34: "#61afef", 35: "#c678dd", 36: "#56b6c2", 37: "#c8c8c8",
  90: "#6b7280", 91: "#ef6b75", 92: "#a8d479", 93: "#f5d07b",
  94: "#71bfff", 95: "#d688ed", 96: "#66c6d2", 97: "#ffffff",
};

/** Cycle 0..count-1 once per intervalMs (≈ one terminal tick). Static when count<2. */
export function useFrameCycle(count: number, intervalMs = 1000): number {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % count), intervalMs);
    return () => clearInterval(id);
  }, [count, intervalMs]);
  return count > 0 ? i % count : 0;
}

// ---------- ANSI SGR → cells (fg + bg) ----------

export interface Cell {
  ch: string;
  fg: string | null;
  bg: string | null;
}

const SGR = /\x1b\[([0-9;]*)m/g;

export function parseCells(input: string): Cell[][] {
  const rows: Cell[][] = [];
  let fg: string | null = null;
  let bg: string | null = null;
  let row: Cell[] = [];
  let i = 0;
  const apply = (codes: number[]) => {
    for (let k = 0; k < codes.length; k++) {
      const c = codes[k];
      if (c === 0) { fg = null; bg = null; }
      else if (c === 39) fg = null;
      else if (c === 49) bg = null;
      else if (c === 38 && codes[k + 1] === 2) { fg = `rgb(${codes[k+2]||0},${codes[k+3]||0},${codes[k+4]||0})`; k += 4; }
      else if (c === 48 && codes[k + 1] === 2) { bg = `rgb(${codes[k+2]||0},${codes[k+3]||0},${codes[k+4]||0})`; k += 4; }
      else if (c === 38 && codes[k + 1] === 5) { k += 2; }
      else if (c === 48 && codes[k + 1] === 5) { k += 2; }
      else if ((c >= 30 && c <= 37) || (c >= 90 && c <= 97)) fg = BASIC[c];
      else if (c >= 40 && c <= 47) bg = BASIC[c - 10];
      else if (c >= 100 && c <= 107) bg = BASIC[c - 10];
    }
  };
  while (i < input.length) {
    SGR.lastIndex = i;
    const m = SGR.exec(input);
    if (m && m.index === i) {
      apply(m[1] === "" ? [0] : m[1].split(";").map((n) => parseInt(n, 10) || 0));
      i = m.index + m[0].length;
      continue;
    }
    // Octant/legacy-computing glyphs are astral-plane (surrogate pairs); read a
    // whole code point so a Cell holds the full glyph, matching the inversion
    // table (keyed by code points). Indexing by UTF-16 unit would split each
    // octant into two lone surrogates that miss the table and drop the cell.
    const cp = input.codePointAt(i);
    if (cp === undefined) break;
    const ch = String.fromCodePoint(cp);
    if (ch === "\n") { rows.push(row); row = []; }
    else { row.push({ ch, fg, bg }); }
    i += ch.length;
  }
  if (row.length) rows.push(row);
  return rows;
}

// ---------- mosaic (octant) → canvas ----------

const SX = 2, SY = 4;

let invCache: Map<string, number> | null = null;
export function invTable(octants: string): Map<string, number> {
  if (invCache) return invCache;
  invCache = new Map();
  const chars = [...octants];
  for (let i = 0; i < chars.length; i++) if (!invCache.has(chars[i])) invCache.set(chars[i], i);
  return invCache;
}

export function drawMosaic(cv: HTMLCanvasElement, frame: string, inv: Map<string, number>, px: number) {
  const rows = parseCells(frame.replace(/\n+$/, ""));
  const h = rows.length;
  const w = rows.reduce((mx, r) => Math.max(mx, r.length), 0);
  cv.width = w * SX * px;
  cv.height = h * SY * px;
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cv.width, cv.height);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const { ch, fg, bg } = rows[r][c];
      const pat = inv.get(ch);
      if (pat === undefined) continue;
      for (let i = 0; i < 8; i++) {
        const color = (pat >> i) & 1 ? fg : bg;
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect((c * SX + (i & 1)) * px, (r * SY + (i >> 1)) * px, px, px);
      }
    }
  }
}

export function MosaicPreview({
  frames,
  octants,
  px = 3,
  intervalMs = 1000,
  className = "",
}: {
  frames: string[];
  octants: string;
  px?: number;
  intervalMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [idx, setIdx] = useState(0);
  const list = useMemo(() => (frames.length ? frames : [""]), [frames]);
  useEffect(() => {
    if (list.length < 2) return;
    const id = setInterval(() => setIdx((n) => (n + 1) % list.length), intervalMs);
    return () => clearInterval(id);
  }, [list.length, intervalMs]);
  useEffect(() => {
    if (ref.current) drawMosaic(ref.current, list[idx % list.length], invTable(octants), px);
  }, [idx, list, octants, px]);
  return (
    <TerminalSurface className={cn("overflow-x-auto p-2", className)}>
      <canvas ref={ref} className="block h-auto w-full max-w-full [image-rendering:pixelated]" />
    </TerminalSurface>
  );
}

// ---------- big terminal demo (a whole profile composed) ----------

// A line belongs to the mosaic (creatures) block if it carries block-element or
// legacy-computing octant/sextant glyphs. The rule divider (U+2500 box-drawing) and
// all the ANSI text rows do NOT match, so they render as crisp selectable text.
const MOSAIC_LINE = /[▀-▟\u{1CD00}-\u{1CEBF}\u{1FB00}-\u{1FBFF}]/u;

/**
 * Renders a full status-line profile (captured through the real loader) as a big
 * animated terminal: the contiguous creatures block is pixel-decoded onto a canvas,
 * every other line is an ANSI text row, stacked on one character grid so they align.
 * Font size tracks the container width so `cols` characters fill it.
 */
export function TerminalDemo({
  frames,
  octants,
  cols,
  label = "claude — statusline",
  className = "",
}: {
  frames: string[];
  octants: string;
  cols: number;
  label?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [fs, setFs] = useState(13);

  const list = frames.length ? frames : [""];
  useEffect(() => {
    if (list.length < 2) return;
    const id = setInterval(() => setIdx((n) => (n + 1) % list.length), 1000);
    return () => clearInterval(id);
  }, [list.length]);

  // Size the monospace grid so `cols` chars fill the available width (mono advance ≈ 0.6em).
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const fit = () => {
      const w = el.clientWidth - 28; // minus horizontal padding
      setFs(Math.max(7, Math.min(18, w / (cols * 0.6))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols]);

  const frame = list[idx % list.length].replace(/\n+$/, "");
  const lines = frame.split("\n");
  const start = lines.findIndex((l) => MOSAIC_LINE.test(l));
  let end = -1;
  if (start >= 0) {
    end = start;
    while (end + 1 < lines.length && MOSAIC_LINE.test(lines[end + 1])) end++;
  }
  const pre = start >= 0 ? lines.slice(0, start) : lines;
  const mosaic = start >= 0 ? lines.slice(start, end + 1) : [];
  const post = start >= 0 ? lines.slice(end + 1) : [];

  useEffect(() => {
    if (canvasRef.current && mosaic.length) {
      drawMosaic(canvasRef.current, mosaic.join("\n"), invTable(octants), 3);
    }
  }, [idx, octants, mosaic.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const Row = (line: string, key: string) => {
    const cells = parseCells(line)[0] ?? [];
    return (
      <div key={key} className="whitespace-pre" style={{ minHeight: "1.35em" }}>
        {cells.length ? cellSpans(cells, 0) : " "}
      </div>
    );
  };

  return (
    <TerminalSurface size="lg" className={cn("overflow-hidden", className)}>
      <div className="flex items-center gap-1.5 border-b border-white/5 px-3.5 py-2.5">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
        <span className="ml-2 font-mono text-[11px] text-neutral-500">{label}</span>
      </div>
      <div ref={bodyRef} className="overflow-x-auto px-3.5 py-3">
        <div
          className="font-mono leading-[1.35] text-neutral-200"
          style={{ width: "max-content", minWidth: "100%", fontSize: `${fs}px` }}
        >
          {pre.map((l, i) => Row(l, `pre-${i}`))}
          {mosaic.length ? (
            <canvas
              ref={canvasRef}
              className="block w-full [image-rendering:pixelated]"
              style={{ height: `${mosaic.length * 1.35}em` }}
            />
          ) : null}
          {post.map((l, i) => Row(l, `post-${i}`))}
        </div>
      </div>
    </TerminalSurface>
  );
}

// ---------- text widgets / segments ----------

export function cellSpans(cells: Cell[], keyBase: number): ReactNode[] {
  const out: ReactNode[] = [];
  let run = "";
  let cur: { fg: string | null; bg: string | null } = { fg: null, bg: null };
  let key = keyBase;
  const flush = () => {
    if (!run) return;
    const style: CSSProperties = {};
    if (cur.fg) style.color = cur.fg;
    if (cur.bg) style.backgroundColor = cur.bg;
    out.push(Object.keys(style).length ? <span key={key++} style={style}>{run}</span> : <span key={key++}>{run}</span>);
    run = "";
  };
  for (const c of cells) {
    if (c.fg !== cur.fg || c.bg !== cur.bg) { flush(); cur = { fg: c.fg, bg: c.bg }; }
    run += c.ch;
  }
  flush();
  return out;
}

function TextFrame({ ansi }: { ansi: string }) {
  const rows = parseCells(ansi.replace(/\n+$/, ""));
  return (
    <>
      {rows.map((cells, i) => (
        <div key={i} className="whitespace-pre">
          {cells.length ? cellSpans(cells, i * 4096) : " "}
        </div>
      ))}
    </>
  );
}

/** Static one-frame text preview (segments). */
export function Preview({ ansi, className = "" }: { ansi: string; className?: string }) {
  return (
    <TerminalSurface
      className={cn(
        "overflow-x-auto px-3 py-2 font-mono text-[11px] leading-[1.4]",
        className,
      )}
    >
      <TextFrame ansi={ansi} />
    </TerminalSurface>
  );
}

/** Text widget that cycles frames ~1/s; static fallback when <2 frames. */
export function AnimatedPreview({
  frames,
  fallback,
  className = "",
  intervalMs = 1000,
}: {
  frames?: string[];
  fallback: string;
  className?: string;
  intervalMs?: number;
}) {
  const list = useMemo(
    () => (frames && frames.length >= 2 ? frames : null),
    [frames],
  );
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!list) return;
    const id = setInterval(() => setI((n) => (n + 1) % list.length), intervalMs);
    return () => clearInterval(id);
  }, [list, intervalMs]);
  return (
    <TerminalSurface
      className={cn(
        "overflow-x-auto px-3 py-2 font-mono text-[11px] leading-[1.4]",
        className,
      )}
    >
      <TextFrame ansi={list ? list[i % list.length] : fallback} />
    </TerminalSurface>
  );
}
