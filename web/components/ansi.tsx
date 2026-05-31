import type { CSSProperties, ReactNode } from "react";

/**
 * Minimal, safe ANSI-SGR → React renderer for component preview.txt samples.
 *
 * Handles reset/bold/dim, the 16 basic fg colors, xterm-256 (38;5;n) and
 * truecolor (38;2;r;g;b) — everything the statusline palette and the creatures /
 * news / ticker widgets emit. All text goes through React (auto-escaped), so a
 * third-party component's preview can never inject markup.
 */

const BASIC: Record<number, string> = {
  30: "#3b3b3b", 31: "#e06c75", 32: "#98c379", 33: "#e5c07b",
  34: "#61afef", 35: "#c678dd", 36: "#56b6c2", 37: "#c8c8c8",
  90: "#6b7280", 91: "#ef6b75", 92: "#a8d479", 93: "#f5d07b",
  94: "#71bfff", 95: "#d688ed", 96: "#66c6d2", 97: "#ffffff",
};

function xterm256(n: number): string {
  if (n < 16) return BASIC[n < 8 ? n + 30 : n + 82] ?? "#c8c8c8";
  if (n >= 232) {
    const v = 8 + (n - 232) * 10;
    return `rgb(${v},${v},${v})`;
  }
  const c = n - 16;
  const r = Math.floor(c / 36),
    g = Math.floor((c % 36) / 6),
    b = c % 6;
  const ch = (x: number) => (x === 0 ? 0 : 55 + x * 40);
  return `rgb(${ch(r)},${ch(g)},${ch(b)})`;
}

interface Style {
  color?: string;
  bold?: boolean;
  dim?: boolean;
}

function applySGR(style: Style, codes: number[]): Style {
  const s: Style = { ...style };
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i];
    if (c === 0) {
      s.color = undefined;
      s.bold = false;
      s.dim = false;
    } else if (c === 1) s.bold = true;
    else if (c === 2) s.dim = true;
    else if (c === 22) {
      s.bold = false;
      s.dim = false;
    } else if (c === 39) s.color = undefined;
    else if ((c >= 30 && c <= 37) || (c >= 90 && c <= 97)) s.color = BASIC[c];
    else if (c === 38) {
      if (codes[i + 1] === 5) {
        s.color = xterm256(codes[i + 2] ?? 7);
        i += 2;
      } else if (codes[i + 1] === 2) {
        const r = codes[i + 2] ?? 0,
          g = codes[i + 3] ?? 0,
          b = codes[i + 4] ?? 0;
        s.color = `rgb(${r},${g},${b})`;
        i += 4;
      }
    }
  }
  return s;
}

function toCss(s: Style): CSSProperties {
  const css: CSSProperties = {};
  if (s.color) css.color = s.color;
  if (s.bold) css.fontWeight = 700;
  if (s.dim) css.opacity = 0.6;
  return css;
}

// eslint-disable-next-line no-control-regex
const SGR = /\x1b\[([0-9;]*)m/g;

function ansiToSpans(input: string): ReactNode[] {
  const out: ReactNode[] = [];
  let style: Style = {};
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  SGR.lastIndex = 0;
  const push = (text: string, st: Style) => {
    if (!text) return;
    const css = toCss(st);
    out.push(
      Object.keys(css).length ? (
        <span key={key++} style={css}>
          {text}
        </span>
      ) : (
        <span key={key++}>{text}</span>
      ),
    );
  };
  while ((m = SGR.exec(input)) !== null) {
    push(input.slice(last, m.index), style);
    const codes = m[1] === "" ? [0] : m[1].split(";").map((n) => parseInt(n, 10) || 0);
    style = applySGR(style, codes);
    last = m.index + m[0].length;
  }
  push(input.slice(last), style);
  return out;
}

/** A terminal-styled box rendering a component's ANSI preview. */
export function Preview({ ansi, className = "" }: { ansi: string; className?: string }) {
  const lines = ansi.replace(/\n+$/, "").split("\n");
  return (
    <div
      className={
        "overflow-x-auto rounded-md border border-border/60 bg-[#0c0d12] px-3 py-2 font-mono text-[11px] leading-[1.35] text-neutral-300 " +
        className
      }
    >
      {lines.map((line, i) => (
        <div key={i} className="whitespace-pre">
          {line ? ansiToSpans(line) : " "}
        </div>
      ))}
    </div>
  );
}
