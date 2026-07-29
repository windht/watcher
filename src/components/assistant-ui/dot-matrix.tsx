import type { ComponentProps, CSSProperties } from "react";
import { cn } from "../../lib/utils";

const GRID = 5;
const CENTER = (GRID - 1) / 2;
const DOT_INDEXES = Array.from({ length: GRID * GRID }, (_, index) => index);

const hash = (value: number, salt: number, range: number) => {
  let mixed = (Math.imul(value, 374761393) + Math.imul(salt, 668265263)) >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 13), 1274126177) >>> 0;
  return ((mixed ^ (mixed >>> 16)) % range) / 1000;
};

const glyph = (dots: [number, number][]) =>
  new Set(dots.map(([row, column]) => row * GRID + column));

const CHECK = glyph([
  [1, 4],
  [2, 3],
  [3, 0],
  [3, 2],
  [4, 1],
]);
const CROSS = glyph([
  [0, 0],
  [0, 4],
  [1, 1],
  [1, 3],
  [2, 2],
  [3, 1],
  [3, 3],
  [4, 0],
  [4, 4],
]);
const BANG = glyph([
  [0, 2],
  [1, 2],
  [2, 2],
  [4, 2],
]);
const INFO = glyph([
  [0, 2],
  [2, 2],
  [3, 2],
  [4, 2],
]);
const PAUSE = glyph([
  [1, 1],
  [2, 1],
  [3, 1],
  [1, 3],
  [2, 3],
  [3, 3],
]);
const STOP = glyph([
  [1, 1],
  [1, 2],
  [1, 3],
  [2, 1],
  [2, 2],
  [2, 3],
  [3, 1],
  [3, 2],
  [3, 3],
]);
const RECORD = glyph([
  [1, 2],
  [2, 1],
  [2, 2],
  [2, 3],
  [3, 2],
]);
const ELLIPSIS = glyph([
  [2, 0],
  [2, 2],
  [2, 4],
]);

type Blink = { duration: number; delay: number; lo: number };

type StateConfig = {
  color?: string;
  glyph?: Set<number>;
  base?: number;
  dim?: number;
  blink?: (index: number, row: number, column: number) => Blink;
};

const STATES = {
  idle: { color: "aui-dot-matrix-muted", base: 0.3 },
  loading: {
    blink: (index) => ({
      duration: 0.9 + hash(index, 2, 700),
      delay: -hash(index, 1, 1200),
      lo: 0.15,
    }),
  },
  thinking: {
    blink: (_index, row, column) => ({
      duration: 1.2,
      delay: -(row + column) * 0.09,
      lo: 0.2,
    }),
  },
  streaming: {
    blink: (_index, row, column) => ({
      duration: 0.9,
      delay: -(row * 0.12 + hash(column, 3, 900)),
      lo: 0.15,
    }),
  },
  searching: {
    blink: (_index, _row, column) => ({ duration: 1.1, delay: -column * 0.12, lo: 0.2 }),
  },
  syncing: {
    blink: (_index, row, column) => {
      const turn = (Math.atan2(row - CENTER, column - CENTER) + Math.PI) / (2 * Math.PI);
      return { duration: 1.3, delay: -turn * 1.3, lo: 0.2 };
    },
  },
  connecting: {
    blink: (_index, row, column) => ({
      duration: 1.4,
      delay: -Math.max(Math.abs(row - CENTER), Math.abs(column - CENTER)) * 0.18,
      lo: 0.15,
    }),
  },
  waiting: {
    glyph: ELLIPSIS,
    blink: (_index, _row, column) => ({ duration: 1.2, delay: -column * 0.09, lo: 0.2 }),
  },
  uploading: {
    blink: (_index, row) => ({ duration: 1, delay: -(GRID - 1 - row) * 0.12, lo: 0.2 }),
  },
  downloading: {
    blink: (_index, row) => ({ duration: 1, delay: -row * 0.12, lo: 0.2 }),
  },
  listening: {
    blink: (_index, _row, column) => ({
      duration: 0.7 + hash(column, 4, 500),
      delay: -hash(column, 5, 900),
      lo: 0.25,
    }),
  },
  speaking: {
    blink: (_index, _row, column) => ({
      duration: 0.4 + hash(column, 6, 350),
      delay: -hash(column, 7, 700),
      lo: 0.2,
    }),
  },
  recording: {
    color: "aui-dot-matrix-danger",
    glyph: RECORD,
    dim: 0.12,
    blink: () => ({ duration: 1.4, delay: 0, lo: 0.3 }),
  },
  success: { color: "aui-dot-matrix-success", glyph: CHECK },
  error: {
    color: "aui-dot-matrix-danger",
    glyph: CROSS,
    blink: () => ({ duration: 1.1, delay: 0, lo: 0.4 }),
  },
  warning: {
    color: "aui-dot-matrix-warning",
    glyph: BANG,
    blink: () => ({ duration: 1.6, delay: 0, lo: 0.45 }),
  },
  info: { color: "aui-dot-matrix-info", glyph: INFO },
  paused: { color: "aui-dot-matrix-muted", glyph: PAUSE },
  stopped: { color: "aui-dot-matrix-muted", glyph: STOP },
  offline: { color: "aui-dot-matrix-muted", base: 0.15 },
} satisfies Record<string, StateConfig>;

export type DotMatrixState = keyof typeof STATES;

const DOT_MATRIX_CSS =
  '@property --aui-dot-matrix-hi{syntax:"<number>";inherits:false;initial-value:1}@property --aui-dot-matrix-lo{syntax:"<number>";inherits:false;initial-value:0.15}@keyframes aui-dot-matrix-blink{0%,100%{opacity:var(--aui-dot-matrix-hi,1)}50%{opacity:var(--aui-dot-matrix-lo,0.15)}}';

export type DotMatrixProps = Omit<ComponentProps<"span">, "children"> & {
  state?: DotMatrixState;
  label?: string;
};

export function DotMatrix({
  className,
  state = "loading",
  label,
  ...props
}: DotMatrixProps) {
  const config: StateConfig = STATES[state];
  return (
    <span
      data-slot="dot-matrix"
      data-state={state}
      role="status"
      className={cn("aui-dot-matrix", config.color, className)}
      {...props}
    >
      <span className="sr-only">{label ?? state}</span>
      <style href="aui-dot-matrix" precedence="low">{DOT_MATRIX_CSS}</style>
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="aui-dot-matrix-svg">
        {DOT_INDEXES.map((index) => {
          const row = Math.floor(index / GRID);
          const column = index % GRID;
          const on = !config.glyph || config.glyph.has(index);
          const highOpacity = on ? (config.base ?? 1) : (config.dim ?? 0.15);
          const blink = on ? config.blink?.(index, row, column) : undefined;
          return (
            <circle
              key={index}
              data-slot="dot-matrix-dot"
              cx={2 + column * 4}
              cy={2 + row * 4}
              r={1.3}
              className="aui-dot-matrix-dot"
              style={{
                opacity: highOpacity,
                animationDuration: String(blink?.duration ?? 1) + "s",
                animationDelay: String(blink?.delay ?? 0) + "s",
                "--aui-dot-matrix-hi": highOpacity,
                "--aui-dot-matrix-lo": blink?.lo ?? highOpacity,
              } as CSSProperties}
            />
          );
        })}
      </svg>
    </span>
  );
}
