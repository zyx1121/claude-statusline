"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

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

// ---------- ANSI SGR → cells (fg + bg) ----------

interface Cell {
  ch: string;
  fg: string | null;
  bg: string | null;
}

// eslint-disable-next-line no-control-regex
const SGR = /\x1b\[([0-9;]*)m/g;

function parseCells(input: string): Cell[][] {
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
    const ch = input[i];
    if (ch === "\n") { rows.push(row); row = []; }
    else { row.push({ ch, fg, bg }); }
    i++;
  }
  if (row.length) rows.push(row);
  return rows;
}

// ---------- mosaic (octant) → canvas ----------

const SX = 2, SY = 4;

let invCache: Map<string, number> | null = null;
function invTable(octants: string): Map<string, number> {
  if (invCache) return invCache;
  invCache = new Map();
  const chars = [...octants];
  for (let i = 0; i < chars.length; i++) if (!invCache.has(chars[i])) invCache.set(chars[i], i);
  return invCache;
}

function drawMosaic(cv: HTMLCanvasElement, frame: string, inv: Map<string, number>, px: number) {
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
  const list = frames.length ? frames : [""];
  useEffect(() => {
    if (list.length < 2) return;
    const id = setInterval(() => setIdx((n) => (n + 1) % list.length), intervalMs);
    return () => clearInterval(id);
  }, [list.length, intervalMs]);
  useEffect(() => {
    if (ref.current) drawMosaic(ref.current, list[idx % list.length], invTable(octants), px);
  }, [idx, list, octants, px]);
  return (
    <div className={"overflow-x-auto rounded-md border border-border/60 bg-[#0c0d12] p-2 " + className}>
      <canvas ref={ref} className="block h-auto w-full max-w-full [image-rendering:pixelated]" />
    </div>
  );
}

// ---------- text widgets / segments ----------

function cellSpans(cells: Cell[], keyBase: number): ReactNode[] {
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

const TEXT_BOX =
  "overflow-x-auto rounded-md border border-border/60 bg-[#0c0d12] px-3 py-2 font-mono text-[11px] leading-[1.4] text-neutral-300 ";

/** Static one-frame text preview (segments). */
export function Preview({ ansi, className = "" }: { ansi: string; className?: string }) {
  return (
    <div className={TEXT_BOX + className}>
      <TextFrame ansi={ansi} />
    </div>
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
  const list = frames && frames.length >= 2 ? frames : null;
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!list) return;
    const id = setInterval(() => setI((n) => (n + 1) % list.length), intervalMs);
    return () => clearInterval(id);
  }, [list, intervalMs]);
  return (
    <div className={TEXT_BOX + className}>
      <TextFrame ansi={list ? list[i % list.length] : fallback} />
    </div>
  );
}
