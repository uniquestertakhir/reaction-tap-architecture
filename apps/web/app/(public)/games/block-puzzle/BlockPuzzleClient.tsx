// ===== FILE START: apps/web/app/(public)/games/block-puzzle/page.tsx =====
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  readAudioSettings,
  onAudioSettingsChanged,
  type AudioSettings,
} from "@/lib/platform/audioSettings";
import { useRouter } from "next/navigation";

type Cell = string | null; // store color per cell

type Piece = {
  id: string;
  color: string;
  blocks: Array<{ x: number; y: number }>;
};

const GRID = 8;

const COLORS = [
  "#7C3AED", // violet
  "#22C55E", // green
  "#3B82F6", // blue
  "#F59E0B", // amber
  "#EF4444", // red
  "#06B6D4", // cyan
  "#A855F7", // purple
];

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function uid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `p_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  }
}

function makeEmptyBoard(): Cell[][] {
  return Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => null));
}

// Generic block puzzle shapes (not copied from any specific title)
const SHAPES: Array<Array<{ x: number; y: number }>> = [
  // single
  [{ x: 0, y: 0 }],

  // lines
  [{ x: 0, y: 0 }, { x: 1, y: 0 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
  [{ x: 0, y: 0 }, { x: 0, y: 1 }],
  [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }],
  [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }],

  // squares
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],

  // L / J
  [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
  [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 2 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }],

  // T
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }],
  [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }],

  // S/Z-ish
  [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],

  // chunky 5
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
];

function normalizeBlocks(blocks: Array<{ x: number; y: number }>) {
  let minX = Infinity;
  let minY = Infinity;
  for (const b of blocks) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
  }
  return blocks.map((b) => ({ x: b.x - minX, y: b.y - minY }));
}

function pieceBounds(blocks: Array<{ x: number; y: number }>) {
  let maxX = 0;
  let maxY = 0;
  for (const b of blocks) {
    maxX = Math.max(maxX, b.x);
    maxY = Math.max(maxY, b.y);
  }
  return { w: maxX + 1, h: maxY + 1 };
}

function pieceCenterInCells(blocks: Array<{ x: number; y: number }>) {
  // center of bounding box (in cell coords)
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const b of blocks) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x);
    maxY = Math.max(maxY, b.y);
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  return { cx: minX + w / 2, cy: minY + h / 2 };
}

function boardFillRatio(board: Cell[][]) {
  let filled = 0;
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (board[y][x]) filled++;
  return filled / (GRID * GRID);
}

function pickShapeWeighted(board: Cell[][]) {
  const fill = boardFillRatio(board);
  const smallIdx = [0, 1, 4, 2, 5]; // single + small lines
  const otherIdx = Array.from({ length: SHAPES.length }, (_, i) => i).filter((i) => !smallIdx.includes(i));

  const wantSmall = fill > 0.58 ? 0.75 : fill > 0.42 ? 0.5 : 0.25;
  const useSmall = Math.random() < wantSmall;
  const pool = useSmall ? smallIdx : otherIdx;
  return SHAPES[pool[Math.floor(Math.random() * pool.length)]];
}

function randomPiece(boardForWeight: Cell[][]): Piece {
  const shape = pickShapeWeighted(boardForWeight);
  const blocks = normalizeBlocks(shape);
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  return { id: uid(), color, blocks };
}

function canPlace(board: Cell[][], piece: Piece, atX: number, atY: number) {
  for (const b of piece.blocks) {
    const x = atX + b.x;
    const y = atY + b.y;
    if (x < 0 || x >= GRID || y < 0 || y >= GRID) return false;
    if (board[y][x] !== null) return false;
  }
  return true;
}
function overlapCells(board: Cell[][], piece: Piece, atX: number, atY: number) {
  const keys = new Set<string>();
  for (const b of piece.blocks) {
    const x = atX + b.x;
    const y = atY + b.y;
    if (x < 0 || x >= GRID || y < 0 || y >= GRID) continue;
    if (board[y][x] !== null) keys.add(`${x},${y}`);
  }
  return keys;
}

function applyPiece(board: Cell[][], piece: Piece, atX: number, atY: number) {
  const next = board.map((row) => row.slice()) as Cell[][];
  for (const b of piece.blocks) {
    const x = atX + b.x;
    const y = atY + b.y;
    next[y][x] = piece.color;
  }
  return next;
}

function clearLines(board: Cell[][]) {
  const fullRows: number[] = [];
  const fullCols: number[] = [];

  for (let y = 0; y < GRID; y++) {
    let ok = true;
    for (let x = 0; x < GRID; x++) if (!board[y][x]) ok = false;
    if (ok) fullRows.push(y);
  }

  for (let x = 0; x < GRID; x++) {
    let ok = true;
    for (let y = 0; y < GRID; y++) if (!board[y][x]) ok = false;
    if (ok) fullCols.push(x);
  }

  if (fullRows.length === 0 && fullCols.length === 0) {
    return { board, cleared: 0, rows: fullRows, cols: fullCols };
  }

  const next = board.map((row) => row.slice()) as Cell[][];
  for (const y of fullRows) for (let x = 0; x < GRID; x++) next[y][x] = null;
  for (const x of fullCols) for (let y = 0; y < GRID; y++) next[y][x] = null;

  return { board: next, cleared: fullRows.length + fullCols.length, rows: fullRows, cols: fullCols };
}

function anyMoveExists(board: Cell[][], pieces: Piece[]) {
  for (const p of pieces) {
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (canPlace(board, p, x, y)) return true;
      }
    }
  }
  return false;
}

function generateNext3(board: Cell[][]) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const ps = [randomPiece(board), randomPiece(board), randomPiece(board)];
    if (anyMoveExists(board, ps)) return ps;
  }
  return [randomPiece(board), randomPiece(board), randomPiece(board)];
}

function FancyPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 backdrop-blur">
      {children}
    </div>
  );
}

// Fused “solid” tile style (no circles)
function tileStyle(color: string) {
  return {
    background: `linear-gradient(180deg, rgba(255,255,255,0.22), rgba(0,0,0,0.15)), linear-gradient(135deg, ${color}, rgba(0,0,0,0.28))`,
    boxShadow:
      "inset 0 2px 0 rgba(255,255,255,0.20), inset 0 -2px 0 rgba(0,0,0,0.25), 0 10px 18px rgba(0,0,0,0.22)",
  } as React.CSSProperties;
}
// ✅ Tray look: “single slab” (no internal seams), shadow is applied to the whole piece wrapper
function tileStyleTray(color: string) {
  return {
    background: `linear-gradient(180deg, rgba(255,255,255,0.18), rgba(0,0,0,0.20)), linear-gradient(135deg, ${color}, rgba(0,0,0,0.22))`,
  } as React.CSSProperties;
}

function cellRadiusForBlock(blocks: Array<{ x: number; y: number }>, x: number, y: number) {
  const has = (dx: number, dy: number) => blocks.some((b) => b.x === x + dx && b.y === y + dy);
  const up = has(0, -1);
  const dn = has(0, 1);
  const lf = has(-1, 0);
  const rt = has(1, 0);
  // round only outer corners (gives “solid” piece feel)
  const r = 8;
  return {
    borderTopLeftRadius: !up && !lf ? r : 2,
    borderTopRightRadius: !up && !rt ? r : 2,
    borderBottomLeftRadius: !dn && !lf ? r : 2,
    borderBottomRightRadius: !dn && !rt ? r : 2,
  } as React.CSSProperties;
}

type DragState =
  | {
      active: true;
      pieceId: string;
      pointerId: number;
      clientX: number;
      clientY: number;
      // snapped placement (top-left in grid coords) if over board, else null
      snap: { x: number; y: number; ok: boolean } | null;
      invalidPulse: number;
    }
  | { active: false };

function getSnap(drag: DragState) {
  return drag.active ? drag.snap : null;
}

export default function BlockPuzzleClient() {
  const [board, setBoard] = useState<Cell[][]>(() => makeEmptyBoard());
  const [pieces, setPieces] = useState<Piece[]>(() => generateNext3(makeEmptyBoard()));
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState<number>(() => {
    try {
      const v = localStorage.getItem("rt_block_puzzle_best_v1");
      const n = v ? Number(v) : 0;
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  });
  // ✅ simple level system (Blitz style)
const level = Math.floor(score / 800) + 1;
const levelProgress = score % 800;
const levelPercent = Math.min(100, Math.floor((levelProgress / 800) * 100));
// ✅ global audio settings
const [audioSettings, setAudioSettings] = useState<AudioSettings>(() =>
  readAudioSettings()
);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [boardW, setBoardW] = useState<number>(0);

  const [drag, setDrag] = useState<DragState>({ active: false });
  // ✅ smooth ghost to avoid "teleport" when switching free -> snapped
const [ghostRender, setGhostRender] = useState<{ left: number; top: number } | null>(null);
const ghostTargetRef = useRef<{ left: number; top: number } | null>(null);
const ghostRafRef = useRef<number | null>(null);


// FX (line clear)
const [fxId, setFxId] = useState(0);
const [fxCells, setFxCells] = useState<Array<{ x: number; y: number }>>([]);
const fxTimer = useRef<number | null>(null);

// ✅ Impact FX (shake + bloom) on clear
const [impactId, setImpactId] = useState(0);
const [impactOn, setImpactOn] = useState(false);
const impactT = useRef<number | null>(null);

// ✅ premium prismatic sweep (rows/cols beams)
const [fxLines, setFxLines] = useState<{ id: number; rows: number[]; cols: number[] } | null>(null);
const fxLinesT = useRef<number | null>(null);

// ✅ Magnet “bounce + shine” FX when snap becomes valid / changes cell
const [magnetFx, setMagnetFx] = useState<{
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
} | null>(null);
const magnetFxT = useRef<number | null>(null);
const magnetFxId = useRef(0);
const lastMagnetCellRef = useRef<{ pieceId: string; x: number; y: number } | null>(null);

// ✅ Haptics + tiny WebAudio SFX (no assets)
const audioCtxRef = useRef<AudioContext | null>(null);

function ensureAudio() {
  if (audioCtxRef.current) return;
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
  if (!Ctx) return;
  audioCtxRef.current = new Ctx();
}

function haptic(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as any).vibrate(pattern);
    }
  } catch {}
}

function playTick() {
  const ctx = audioCtxRef.current;
  if (!ctx) return;

  const t0 = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();

  o.type = "square";
  o.frequency.setValueAtTime(520, t0);
  o.frequency.exponentialRampToValueAtTime(760, t0 + 0.03);

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);

  o.connect(g);
  g.connect(ctx.destination);

  o.start(t0);
  o.stop(t0 + 0.06);
}

function playWhoosh() {
  const ctx = audioCtxRef.current;
  if (!ctx) return;

  const t0 = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();

  o.type = "triangle";
  o.frequency.setValueAtTime(420, t0);
  o.frequency.exponentialRampToValueAtTime(140, t0 + 0.12);

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);

  o.connect(g);
  g.connect(ctx.destination);

  o.start(t0);
  o.stop(t0 + 0.17);
}

function triggerMagnetFx(piece: Piece, x: number, y: number) {
  const b = pieceBounds(piece.blocks);
  magnetFxId.current += 1;
  setMagnetFx({ id: magnetFxId.current, x, y, w: b.w, h: b.h });

  if (magnetFxT.current) window.clearTimeout(magnetFxT.current);
  magnetFxT.current = window.setTimeout(() => setMagnetFx(null), 180);

  // ✅ global settings
  if (audioSettings.inGameSounds) playTick();
  if (audioSettings.haptics) haptic(8);
}

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<number | null>(null);

  const draggingPiece = useMemo(() => {
    if (!drag.active) return null;
    return pieces.find((p) => p.id === drag.pieceId) || null;
  }, [drag, pieces]);

  const gameOver = useMemo(() => !anyMoveExists(board, pieces), [board, pieces]);

  useEffect(() => {
    if (score > best) {
      setBest(score);
      try {
        localStorage.setItem("rt_block_puzzle_best_v1", String(score));
      } catch {}
    }
  }, [score, best]);
    // ✅ Immersive fullscreen feel on mobile: no page scroll, no rubber-band
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = (document.body.style as any).overscrollBehaviorY;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    (document.body.style as any).overscrollBehaviorY = "none";

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      (document.body.style as any).overscrollBehaviorY = prevBodyOverscroll;
    };
  }, []);


  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setBoardW(Math.floor(r.width));
    });

    ro.observe(el);
    const r0 = el.getBoundingClientRect();
    setBoardW(Math.floor(r0.width));

    return () => ro.disconnect();
  }, []);

  // ✅ react to global audio settings changes
useEffect(() => {
  const off = onAudioSettingsChanged(() => {
    setAudioSettings(readAudioSettings());
  });
  return off;
}, []);

  function showToast(msg: string) {
    setToast(msg);
    if (toastT.current) window.clearTimeout(toastT.current);
    toastT.current = window.setTimeout(() => setToast(null), 1050);
  }

  function restart() {
    const empty = makeEmptyBoard();
    setBoard(empty);
    setPieces(generateNext3(empty));
    setScore(0);
    setCombo(0);
    setDrag({ active: false });
    showToast("New game");
  }

  // ========= SNAP / POINTER =========

  function boardMetrics() {
    const el = boardRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return { left: r.left, top: r.top, width: r.width, height: r.height, cellW: r.width / GRID, cellH: r.height / GRID };
  }

  function computeSnap(clientX: number, clientY: number, piece: Piece) {
  const m = boardMetrics();
  if (!m) return null;

  // ✅ IMPORTANT:
  // Ghost is visually lifted above the finger (DRAG_LIFT_PX),
  // so snap must be computed from the "ghost center", not the finger.
  const liftPx = m.cellH * 2.6; // matches DRAG_LIFT_PX factor
  const aimX = clientX;
  const aimY = clientY - liftPx;

  // ✅ smaller pad: less “teleport” from far away
  const pad = Math.min(m.width, m.height) * 0.06;

  const insideOrNear =
    aimX >= m.left - pad &&
    aimX <= m.left + m.width + pad &&
    aimY >= m.top - pad &&
    aimY <= m.top + m.height + pad;

  if (!insideOrNear) return null;

  const clampedX = clamp(aimX, m.left, m.left + m.width);
  const clampedY = clamp(aimY, m.top, m.top + m.height);

  const px = clampedX - m.left;
  const py = clampedY - m.top;

  const { cx, cy } = pieceCenterInCells(piece.blocks);

  const targetCellX = Math.round(px / m.cellW - 0.5);
  const targetCellY = Math.round(py / m.cellH - 0.5);

  const pb = pieceBounds(piece.blocks);

  // ✅ clamp with piece size (so near-edge snaps can still be valid)
  const idealX = clamp(Math.round(targetCellX - cx), 0, GRID - pb.w);
  const idealY = clamp(Math.round(targetCellY - cy), 0, GRID - pb.h);

  // ✅ smaller radius
  const R = 1;

  // ✅ hard limit: if pointer is too far from the best candidate, don't “magnet”
  const MAX_MAGNET_PX = m.cellW * 0.72;
  const MAX_D2 = MAX_MAGNET_PX * MAX_MAGNET_PX;

  let best: { x: number; y: number; d2: number } | null = null;

  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = idealX + dx;
      const y = idealY + dy;

      if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
      if (!canPlace(board, piece, x, y)) continue;

      const ax = (x + cx) * m.cellW;
      const ay = (y + cy) * m.cellH;

      const ddx = ax - px;
      const ddy = ay - py;
      const d2 = ddx * ddx + ddy * ddy;

      if (!best || d2 < best.d2) best = { x, y, d2 };
    }
  }

  if (best && best.d2 <= MAX_D2) return { x: best.x, y: best.y, ok: true };

  return { x: idealX, y: idealY, ok: false };
}

  // ========= DRAG HANDLERS (robust, global) =========

  const dragRef = useRef<DragState>({ active: false });
  const piecesRef = useRef<Piece[]>(pieces);
  const boardRefState = useRef<Cell[][]>(board);
  // ✅ smooth drag: batch pointermove to 1 update per animation frame
const rafId = useRef<number | null>(null);
const pendingMove = useRef<{
  pointerId: number;
  clientX: number;
  clientY: number;
  snap: { x: number; y: number; ok: boolean } | null;
} | null>(null);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);
  useEffect(() => {
    piecesRef.current = pieces;
  }, [pieces]);
  useEffect(() => {
    boardRefState.current = board;
  }, [board]);

  function beginDrag(pieceId: string, e: React.PointerEvent) {
  if (gameOver) return;

  // ✅ stop browser from doing “native” gestures/dragging
  e.preventDefault();
  e.stopPropagation();

  // ✅ hard capture pointer so we always keep receiving moves/up
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {}

  // ✅ unlock audio only if global in-game sounds are enabled
  if (audioSettings.inGameSounds) ensureAudio();

  // ✅ ensure board cell size is known BEFORE ghost renders
  const m = boardMetrics();
  if (m) setBoardW(Math.floor(m.width));

  const pointerId = e.pointerId;
  const p = piecesRef.current.find((x) => x.id === pieceId);
  if (!p) return;

  // reset magnet memory for this drag
  lastMagnetCellRef.current = null;

  setDrag({
    active: true,
    pieceId,
    pointerId,
    clientX: e.clientX,
    clientY: e.clientY,
    snap: computeSnap(e.clientX, e.clientY, p),
    invalidPulse: 0,
  });

  // ✅ initialize ghost position instantly on drag start
  setGhostRender({ left: e.clientX, top: e.clientY });
}

  // Global listeners while dragging
  useEffect(() => {
    if (!drag.active) return;

    const onMove = (ev: PointerEvent) => {
  const st = dragRef.current;
  if (!st.active) return;
  if (ev.pointerId !== st.pointerId) return;

  const p = piecesRef.current.find((x) => x.id === st.pieceId);
  if (!p) return;

  const nextSnap = computeSnap(ev.clientX, ev.clientY, p);

  // ✅ bounce + shine when magnet “catches” (stable, no stale prevSnap)
if (nextSnap && nextSnap.ok) {
  const last = lastMagnetCellRef.current;
  const changed = !last || last.pieceId !== p.id || last.x !== nextSnap.x || last.y !== nextSnap.y;

  if (changed) {
    lastMagnetCellRef.current = { pieceId: p.id, x: nextSnap.x, y: nextSnap.y };
    triggerMagnetFx(p, nextSnap.x, nextSnap.y);
  }
} else {
  // if we move away from valid snap, reset
  lastMagnetCellRef.current = null;
}

  // ✅ store latest move and commit once per frame
  pendingMove.current = {
    pointerId: ev.pointerId,
    clientX: ev.clientX,
    clientY: ev.clientY,
    snap: nextSnap,
  };

  if (rafId.current != null) return;

  rafId.current = window.requestAnimationFrame(() => {
    rafId.current = null;

    const pm = pendingMove.current;
    pendingMove.current = null;
    if (!pm) return;

    setDrag((prevState) => {
      if (!prevState.active) return prevState;
      if (prevState.pointerId !== pm.pointerId) return prevState;

      const pulse = pm.snap && !pm.snap.ok ? prevState.invalidPulse + 1 : prevState.invalidPulse;

      return {
        ...prevState,
        clientX: pm.clientX,
        clientY: pm.clientY,
        snap: pm.snap,
        invalidPulse: pulse,
      };
    });
  });
};

    const onUp = (ev: PointerEvent) => {
      const st = dragRef.current;
      if (!st.active) return;
      if (ev.pointerId !== st.pointerId) return;

      const p = piecesRef.current.find((x) => x.id === st.pieceId);
      if (!p) {
        setDrag({ active: false });
        return;
      }

      const snap = st.snap;
      if (snap && snap.ok) {
        commitPlace(st.pieceId, snap.x, snap.y);
      }

      // ALWAYS end drag cleanly (even outside board)
if (rafId.current != null) {
  cancelAnimationFrame(rafId.current);
  rafId.current = null;
}
pendingMove.current = null;
setDrag({ active: false });
    };

    const onCancel = (ev: PointerEvent) => {
      const st = dragRef.current;
      if (!st.active) return;
      if (ev.pointerId !== st.pointerId) return;
      if (rafId.current != null) {
  cancelAnimationFrame(rafId.current);
  rafId.current = null;
}
pendingMove.current = null;
setDrag({ active: false });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onCancel, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMove as any);
      window.removeEventListener("pointerup", onUp as any);
      window.removeEventListener("pointercancel", onCancel as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag.active]);

  // ========= PLACE / SCORE / FX =========

  function commitPlace(pieceId: string, atX: number, atY: number) {
    const piece = piecesRef.current.find((x) => x.id === pieceId);
    if (!piece) return;

    const currentBoard = boardRefState.current;

    if (!canPlace(currentBoard, piece, atX, atY)) {
      // safety
      return;
    }

    const placed = applyPiece(currentBoard, piece, atX, atY);
    const cleared = clearLines(placed);

    const placedPoints = piece.blocks.length * 10;
    const clearPoints = cleared.cleared > 0 ? 100 * cleared.cleared : 0;

    let nextCombo = combo;
    if (cleared.cleared > 0) nextCombo = combo + 1;
    else nextCombo = 0;

    const comboBonus = cleared.cleared > 0 ? Math.min(900, nextCombo * 45) : 0;

    if (cleared.cleared > 0) {
      const cells: Array<{ x: number; y: number }> = [];
      for (const ry of cleared.rows) for (let x = 0; x < GRID; x++) cells.push({ x, y: ry });
      for (const cx of cleared.cols) for (let y = 0; y < GRID; y++) cells.push({ x: cx, y });

            setFxId((v) => v + 1);
      setFxCells(cells);

      // ✅ beams (rows/cols)
      setFxLines({ id: Date.now(), rows: cleared.rows, cols: cleared.cols });
      if (fxLinesT.current) window.clearTimeout(fxLinesT.current);
      fxLinesT.current = window.setTimeout(() => setFxLines(null), 260);

      if (fxTimer.current) window.clearTimeout(fxTimer.current);
      fxTimer.current = window.setTimeout(() => setFxCells([]), 360);

      if (audioSettings.inGameSounds) playWhoosh();
      if (audioSettings.haptics) haptic([10, 30, 18]);
            // ✅ premium impact (very short)
      setImpactId((v) => v + 1);
      setImpactOn(true);
      if (impactT.current) window.clearTimeout(impactT.current);
      impactT.current = window.setTimeout(() => setImpactOn(false), 180);
    }

    setBoard(cleared.board);
    setScore((s) => s + placedPoints + clearPoints + comboBonus);
    setCombo(nextCombo);

    if (cleared.cleared > 0) showToast(`+${placedPoints + clearPoints + comboBonus} • CLEAR x${cleared.cleared}`);
    else showToast(`+${placedPoints}`);

    const remaining = piecesRef.current.filter((pp) => pp.id !== pieceId);
    const nextPieces = remaining.length === 0 ? generateNext3(cleared.board) : remaining;
    setPieces(nextPieces);
  }

  // ========= RENDER HELPERS =========

  const cellPx = boardW ? boardW / GRID : 36;
    // ✅ lift dragged piece above finger (2–3 cells)
  const DRAG_LIFT_PX = cellPx * 2.6;

// ✅ tray cells even smaller to prevent overlap between slots
const trayCell = clamp(Math.floor(cellPx * 0.58), 16, 30);

  const displayBoard = useMemo(() => {
  // ✅ never “pre-place” on board while dragging
  // the ghost piece is the only visual during drag
  return board;
}, [board]);

// cells where dragging piece overlaps already-filled cells (invalid placement feedback)
const overlaps = useMemo(() => {
  const snap = getSnap(drag);
  if (!drag.active) return null;
  if (!draggingPiece) return null;
  if (!snap) return null;
  if (snap.ok) return null; // only when invalid
  return overlapCells(board, draggingPiece, snap.x, snap.y);
}, [board, drag, draggingPiece]);

// ✅ preview: which rows/cols would clear if user drops NOW (when snap is valid)
const clearHint = useMemo(() => {
  const snap = getSnap(drag);
  if (!drag.active) return null;
  if (!draggingPiece) return null;
  if (!snap || !snap.ok) return null;

  const projected = applyPiece(board, draggingPiece, snap.x, snap.y);

  const rows: number[] = [];
  const cols: number[] = [];

  for (let y = 0; y < GRID; y++) {
    let ok = true;
    for (let x = 0; x < GRID; x++) if (!projected[y][x]) ok = false;
    if (ok) rows.push(y);
  }

  for (let x = 0; x < GRID; x++) {
    let ok = true;
    for (let y = 0; y < GRID; y++) if (!projected[y][x]) ok = false;
    if (ok) cols.push(x);
  }

  if (rows.length === 0 && cols.length === 0) return null;

  const cells = new Set<string>();
  for (const y of rows) for (let x = 0; x < GRID; x++) cells.add(`${x},${y}`);
  for (const x of cols) for (let y = 0; y < GRID; y++) cells.add(`${x},${y}`);

  return { rows, cols, cells };
}, [board, drag, draggingPiece]);

    // Ghost piece follows finger (ALWAYS lifted above finger; no snapped jump under finger)
  const ghost = useMemo(() => {
    if (!drag.active) return null;
    if (!draggingPiece) return null;

    const b = pieceBounds(draggingPiece.blocks);
    const w = b.w * cellPx;
    const h = b.h * cellPx;

    const liftedTop = drag.clientY - h * 0.5 - DRAG_LIFT_PX;

    return {
      mode: "free" as const,
      left: drag.clientX - w * 0.5,
      top: Math.max(8, liftedTop),
      ok: true,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, draggingPiece, cellPx]);
useEffect(() => {
  // stop if not dragging
  if (!drag.active || !ghost) {
  ghostTargetRef.current = null;
    if (ghostRafRef.current != null) {
      cancelAnimationFrame(ghostRafRef.current);
      ghostRafRef.current = null;
    }
    return;
  }

  // update target
  ghostTargetRef.current = { left: ghost.left, top: ghost.top };

  // initialize render position instantly on first frame (no fade/teleport)
  setGhostRender((cur) => cur ?? { left: ghost.left, top: ghost.top });

  if (ghostRafRef.current != null) return;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const tick = () => {
    ghostRafRef.current = null;
    const target = ghostTargetRef.current;
    if (!target) return;

    setGhostRender((cur) => {
      if (!cur) return target;

      const t = 0.28;

      const next = {
        left: lerp(cur.left, target.left, t),
        top: lerp(cur.top, target.top, t),
      };

      // snap to target when close (and STOP the loop)
      const dx = Math.abs(next.left - target.left);
      const dy = Math.abs(next.top - target.top);
      if (dx < 0.35 && dy < 0.35) return target;

      // continue only while we still need smoothing
      ghostRafRef.current = requestAnimationFrame(tick);
      return next;
    });
  };

  ghostRafRef.current = requestAnimationFrame(tick);

  return () => {
    if (ghostRafRef.current != null) {
      cancelAnimationFrame(ghostRafRef.current);
      ghostRafRef.current = null;
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [drag.active, ghost?.left, ghost?.top]);

  // ✅ Mode select (same idea as Reaction Tap variants)
  const sp = useSearchParams();
  const router = useRouter();
  const mode = (sp.get("mode") || "").trim(); // "cash" | "gems" | "practice"
  const entry = (sp.get("entry") || "").trim();
  const prize = (sp.get("prize") || "").trim();
  const isInGame = Boolean(mode); // mode exists => the game is running

  if (!mode) {
    return (
  <main className="min-h-[100dvh] overflow-hidden text-white">
        <div className="h-full bg-[radial-gradient(1200px_700px_at_50%_-120px,rgba(255,255,255,0.22),transparent_55%),radial-gradient(900px_550px_at_20%_10%,rgba(59,130,246,0.18),transparent_60%),radial-gradient(900px_600px_at_80%_20%,rgba(34,197,94,0.14),transparent_60%),linear-gradient(180deg,#2563eb_0%,#1e3a8a_55%,#0b1026_100%)]">
          <div className="mx-auto flex h-full w-full max-w-[520px] flex-col px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
            {/* header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold tracking-widest text-white/80">BLOCK PUZZLE</div>
                <div className="mt-1 text-3xl font-extrabold leading-tight">Choose mode.</div>
                <div className="text-base font-semibold leading-tight text-white/70">Then the game starts instantly.</div>
              </div>

              <Link
                href="/games"
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/95"
              >
                Back
              </Link>
            </div>

            {/* cards */}
            <div className="mt-5 flex flex-col gap-4">
              {/* CASH */}
              <Link
                href="/games/block-puzzle?mode=cash&entry=0.30&prize=1.70"
                className="block rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur shadow-[0_40px_140px_-95px_rgba(0,0,0,0.95)]"
              >
                <div className="flex items-stretch gap-4">
                  <div className="w-[42%] rounded-2xl bg-[linear-gradient(135deg,rgba(34,197,94,0.45),rgba(59,130,246,0.35))] p-4">
                    <div className="text-[10px] font-semibold tracking-widest text-white/80">LIMITED</div>
                    <div className="mt-2 text-5xl font-extrabold leading-none">${prize || "1.70"}</div>
                  </div>

                  <div className="flex-1">
                    <div className="text-2xl font-extrabold leading-tight">Starter Brawl</div>
                    <div className="mt-1 text-sm text-white/70">Limited time only! • 5 players</div>

                    <div className="mt-4 text-[11px] font-semibold tracking-widest text-white/60">ENTRY</div>
                    <div className="mt-1 text-lg font-extrabold">${entry || "0.30"}</div>

                    <div className="mt-2 text-sm text-white/70">
                      Cash mode → auto-match → starts instantly.
                    </div>
                  </div>

                  <div className="flex items-center">
                    <div className="rounded-2xl bg-emerald-400 px-6 py-3 text-sm font-extrabold text-black">
                      Play
                    </div>
                  </div>
                </div>
              </Link>

              {/* GEMS */}
              <Link
                href="/games/block-puzzle?mode=gems&entry=50&prize=120"
                className="block rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur shadow-[0_40px_140px_-95px_rgba(0,0,0,0.95)]"
              >
                <div className="flex items-stretch gap-4">
                  <div className="w-[42%] rounded-2xl bg-[linear-gradient(135deg,rgba(59,130,246,0.40),rgba(168,85,247,0.30))] p-4">
                    <div className="text-[10px] font-semibold tracking-widest text-white/80">PRIZE</div>
                    <div className="mt-2 text-5xl font-extrabold leading-none">💎 {prize || "120"}</div>
                  </div>

                  <div className="flex-1">
                    <div className="text-2xl font-extrabold leading-tight">Warm up</div>
                    <div className="mt-1 text-sm text-white/70">Practice-style</div>

                    <div className="mt-4 text-[11px] font-semibold tracking-widest text-white/60">ENTRY</div>
                    <div className="mt-1 text-lg font-extrabold">💎 {entry || "50"}</div>

                    <div className="mt-2 text-sm text-white/70">
                      Gems mode → instant practice run.
                    </div>
                  </div>

                  <div className="flex items-center">
                    <div className="rounded-2xl bg-emerald-400 px-6 py-3 text-sm font-extrabold text-black">
                      Play
                    </div>
                  </div>
                </div>
              </Link>

              {/* BIG GEMS */}
              <Link
                href="/games/block-puzzle?mode=gems&entry=1000&prize=2000"
                className="block rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur shadow-[0_40px_140px_-95px_rgba(0,0,0,0.95)]"
              >
                <div className="flex items-stretch gap-4">
                  <div className="w-[42%] rounded-2xl bg-[linear-gradient(135deg,rgba(34,197,94,0.28),rgba(6,182,212,0.26))] p-4">
                    <div className="text-[10px] font-semibold tracking-widest text-white/80">PRIZE</div>
                    <div className="mt-2 text-5xl font-extrabold leading-none">💎 2000</div>
                  </div>

                  <div className="flex-1">
                    <div className="text-2xl font-extrabold leading-tight">Cash Factory</div>
                    <div className="mt-1 text-sm text-white/70">Practice-style</div>

                    <div className="mt-4 text-[11px] font-semibold tracking-widest text-white/60">ENTRY</div>
                    <div className="mt-1 text-lg font-extrabold">💎 1000</div>

                    <div className="mt-2 text-sm text-white/70">
                      Gems mode → instant practice run.
                    </div>
                  </div>

                  <div className="flex items-center">
                    <div className="rounded-2xl bg-emerald-400 px-6 py-3 text-sm font-extrabold text-black">
                      Play
                    </div>
                  </div>
                </div>
              </Link>

              <div className="pt-2 text-center text-xs text-white/60">
                Cash modes → auto-match. Gems modes → instant practice. If not enough → /shop.
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

    return (
  <div className="fixed inset-0 z-[5000] overflow-hidden text-white">
    <style jsx global>{`
      @keyframes bp-pop {
        0% { transform: scale(0.98); opacity: 0.0; }
        15% { opacity: 1; }
        100% { transform: scale(1.26); opacity: 0; }
      }

      @keyframes bp-shine {
        0% { opacity: 0; transform: translateX(-35%); }
        30% { opacity: 0.55; }
        100% { opacity: 0; transform: translateX(35%); }
      }

      @keyframes bp-drop {
        0% { transform: scale(0.98); }
        60% { transform: scale(1.02); }
        100% { transform: scale(1); }
      }

      @keyframes bp-shake {
        0% { transform: translateX(0); }
        25% { transform: translateX(-4px); }
        50% { transform: translateX(4px); }
        75% { transform: translateX(-3px); }
        100% { transform: translateX(0); }
      }

      @keyframes bp-warn {
        0% { transform: scale(1); filter: brightness(1); opacity: 0.85; }
        45% { transform: scale(1.06); filter: brightness(1.25); opacity: 1; }
        100% { transform: scale(1); filter: brightness(1.05); opacity: 0.9; }
      }

      @keyframes bp-clear {
        0% { opacity: 0.55; filter: brightness(1); transform: scale(1); }
        45% { opacity: 0.95; filter: brightness(1.35); transform: scale(1.03); }
        100% { opacity: 0.7; filter: brightness(1.1); transform: scale(1); }
      }

            @keyframes bp-lineGlow {
        0% { opacity: 0.0; filter: blur(2px); transform: scaleX(0.92); }
        35% { opacity: 0.55; filter: blur(1px); transform: scaleX(1); }
        100% { opacity: 0.15; filter: blur(2px); transform: scaleX(1); }
      }

            @keyframes bp-prismCell {
        0% { transform: scale(0.72); opacity: 0.0; filter: blur(1px) saturate(1.35); }
        22% { transform: scale(1.12); opacity: 1; filter: blur(0px) saturate(1.8); }
        100% { transform: scale(1.35); opacity: 0; filter: blur(1.5px) saturate(1.2); }
      }

      @keyframes bp-prismSpark {
        0% { transform: scale(0.9) rotate(0deg); opacity: 0.0; }
        25% { opacity: 0.85; }
        100% { transform: scale(1.35) rotate(38deg); opacity: 0; }
      }

      @keyframes bp-prismSweep {
        0% { opacity: 0; transform: translateX(-22%); filter: blur(1px) saturate(1.6); }
        18% { opacity: 0.85; }
        100% { opacity: 0; transform: translateX(22%); filter: blur(1.5px) saturate(1.25); }
      }
              @keyframes bp-charge {
        0%   { opacity: 0; transform: scale(0.985); filter: blur(2px) saturate(1.6); }
        35%  { opacity: 0.95; transform: scale(1.01); filter: blur(0.6px) saturate(2.0); }
        100% { opacity: 0; transform: scale(1.03); filter: blur(2px) saturate(1.2); }
      }

      @keyframes bp-chargeSweep {
        0%   { opacity: 0; transform: translateX(-30%); }
        20%  { opacity: 0.85; }
        100% { opacity: 0; transform: translateX(30%); }
      }
              @keyframes bp-shakeSoft {
        0%   { transform: translate3d(0,0,0); }
        20%  { transform: translate3d(-1px, 0, 0) rotate(-0.12deg); }
        45%  { transform: translate3d(1px, 0, 0) rotate(0.12deg); }
        70%  { transform: translate3d(-0.6px, 0.4px, 0) rotate(-0.08deg); }
        100% { transform: translate3d(0,0,0); }
      }

      @keyframes bp-bloom {
        0%   { opacity: 0; transform: scale(0.985); filter: blur(10px) saturate(1.8); }
        25%  { opacity: 0.85; transform: scale(1.01); filter: blur(14px) saturate(2.2); }
        100% { opacity: 0; transform: scale(1.03); filter: blur(18px) saturate(1.4); }
      }
    `}</style>

    <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_50%_-120px,rgba(255,255,255,0.22),transparent_55%),radial-gradient(900px_550px_at_20%_10%,rgba(59,130,246,0.18),transparent_60%),radial-gradient(900px_600px_at_80%_20%,rgba(34,197,94,0.14),transparent_60%),linear-gradient(180deg,#2563eb_0%,#1e3a8a_55%,#0b1026_100%)]" />

    {/* FULLSCREEN GAME ONLY: board + pieces */}
            <div
      key={`impact-${impactId}`}
      className="relative mx-auto flex h-[100dvh] w-full max-w-[520px] flex-col px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-[calc(env(safe-area-inset-bottom)+10px)]"
      style={impactOn ? { animation: "bp-shakeSoft 180ms ease-out" } : undefined}
    >
            {impactOn ? (
        <div className="pointer-events-none absolute inset-0 z-[2]">
          <div
            className="absolute inset-[-10%]"
            style={{
              background:
                "radial-gradient(600px_360px_at_50%_25%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(520px_320px_at_30%_40%, rgba(120,190,255,0.22), transparent 62%), radial-gradient(520px_320px_at_70%_45%, rgba(255,120,220,0.18), transparent 62%)",
              mixBlendMode: "screen",
              animation: "bp-bloom 180ms ease-out",
            }}
          />
        </div>
      ) : null}
            {/* compact in-game HUD */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          {/* LEFT: level + combo (combo moved next to level) */}
          <div className="flex items-end gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-white/60 tracking-widest">LEVEL</span>
              <span className="text-xl font-extrabold leading-none">{level}</span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-white/60 tracking-widest">COMBO</span>
              <span className="text-xl font-extrabold leading-none">
                {combo > 0 ? `x${combo}` : "—"}
              </span>
            </div>
          </div>

          {/* CENTER: score */}
          <div className="text-center">
            <div className="text-[10px] text-white/60 tracking-widest">SCORE</div>
            <div className="text-2xl font-extrabold leading-none">{score}</div>
          </div>

          {/* RIGHT: back */}
          <button
            type="button"
            onClick={() => router.push("/games/block-puzzle")}
            className="shrink-0 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-extrabold text-white/95 hover:bg-white/15"
          >
            Back
          </button>
        </div>

        <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-white/70">
          <span>Progress to next level:</span>
          <span className="font-semibold">{levelPercent}%</span>
          <span className="rounded-2xl border border-white/10 bg-black/15 px-2 py-1 text-[11px] text-white/80">
            BEST: <span className="font-extrabold text-white">{best}</span>
          </span>
        </div>
      </div>

            {/* board card (no stretching -> removes empty vertical space) */}
            <div className="mt-1 rounded-[28px] border border-white/10 bg-black/20 p-3 shadow-[0_40px_140px_-95px_rgba(0,0,0,0.95)] backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-white/80">8×8 Board</div>
        </div>

        <div className="mt-3">
          <div
            ref={boardRef}
            className="relative aspect-square w-full overflow-hidden rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.40))]"
            style={{ touchAction: "none" }}
          >
            {/* grid */}
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))` }}>
              {displayBoard.map((row, y) =>
                row.map((v, x) => {
                  const isOverlap = overlaps ? overlaps.has(`${x},${y}`) : false;
                  const isClearHint = clearHint ? clearHint.cells.has(`${x},${y}`) : false;

                  return (
                    <div
                      key={`${x}-${y}`}
                      className="relative border border-white/[0.06]"
                      style={{ background: v ? undefined : "rgba(0,0,0,0.10)" }}
                    >
                      {v ? <div className="absolute inset-[2px]" style={{ ...tileStyle(v), borderRadius: 7 }} /> : null}

                      {isOverlap ? (
                        <div
                          className="pointer-events-none absolute inset-[2px]"
                          style={{
                            borderRadius: 7,
                            background:
                              "radial-gradient(circle at 35% 35%, rgba(255,200,120,0.95), rgba(255,120,40,0.55) 45%, rgba(255,120,40,0.10) 70%, transparent 78%)",
                            boxShadow:
                              "0 0 0 2px rgba(255,140,60,0.55) inset, 0 0 18px rgba(255,140,60,0.35)",
                            mixBlendMode: "screen",
                            animation: "bp-warn 180ms ease-out",
                          }}
                        />
                      ) : null}

                      {isClearHint ? (
                        <div
                          className="pointer-events-none absolute inset-[2px]"
                          style={{
                            borderRadius: 7,
                            background:
                              "radial-gradient(circle at 50% 45%, rgba(255,90,90,0.90), rgba(255,40,40,0.35) 55%, rgba(255,40,40,0.08) 75%, transparent 82%)",
                            boxShadow: "0 0 0 2px rgba(255,80,80,0.35) inset, 0 0 20px rgba(255,60,60,0.30)",
                            mixBlendMode: "screen",
                            animation: "bp-clear 190ms ease-out",
                          }}
                        />
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

                       {clearHint ? (
              <div className="pointer-events-none absolute inset-0">
                {clearHint.rows.map((y) => (
                  <div
                    key={`r-${y}`}
                    className="absolute left-0 right-0"
                    style={{
                      top: `${(y / GRID) * 100}%`,
                      height: `${(1 / GRID) * 100}%`,
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,80,80,0.18), rgba(255,130,130,0.35), rgba(255,80,80,0.18), transparent)",
                      boxShadow: "0 0 22px rgba(255,70,70,0.25)",
                      animation: "bp-lineGlow 220ms ease-out",
                    }}
                  />
                ))}

                {clearHint.cols.map((x) => (
                  <div
                    key={`c-${x}`}
                    className="absolute top-0 bottom-0"
                    style={{
                      left: `${(x / GRID) * 100}%`,
                      width: `${(1 / GRID) * 100}%`,
                      background:
                        "linear-gradient(180deg, transparent, rgba(255,80,80,0.18), rgba(255,130,130,0.35), rgba(255,80,80,0.18), transparent)",
                      boxShadow: "0 0 22px rgba(255,70,70,0.25)",
                      animation: "bp-lineGlow 220ms ease-out",
                    }}
                  />
                ))}
              </div>
            ) : null}

            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: "radial-gradient(900px_520px_at_20%_0%,rgba(255,255,255,0.10),transparent_60%)",
              }}
            />

            {drag.active && magnetFx ? (
              <div
                key={magnetFx.id}
                className="pointer-events-none absolute"
                style={{
                  left: `${(magnetFx.x / GRID) * 100}%`,
                  top: `${(magnetFx.y / GRID) * 100}%`,
                  width: `${(magnetFx.w / GRID) * 100}%`,
                  height: `${(magnetFx.h / GRID) * 100}%`,
                  animation: "bp-drop 140ms ease-out",
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    borderRadius: 14,
                    background: "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.22), transparent 60%)",
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    borderRadius: 14,
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)",
                    animation: "bp-shine 180ms ease-out",
                  }}
                />
              </div>
            ) : null}

                        {/* ✅ premium clear FX: prismatic beams + per-cell prisms */}
                        {fxLines ? (
              <div key={`lines-${fxLines.id}`} className="pointer-events-none absolute inset-0">
                {/* ✅ CHARGE (quick outline + sweep) */}
                {fxLines.rows.map((y) => (
                  <div
                    key={`ch-r-${y}`}
                    className="absolute left-0 right-0"
                    style={{
                      top: `${(y / GRID) * 100}%`,
                      height: `${(1 / GRID) * 100}%`,
                      borderRadius: 10,
                      boxShadow:
                        "0 0 0 2px rgba(255,255,255,0.10) inset, 0 0 18px rgba(120,190,255,0.18), 0 0 14px rgba(255,120,220,0.12)",
                      background:
                        "linear-gradient(90deg, rgba(255,80,220,0.06), rgba(80,200,255,0.08), rgba(255,220,80,0.06))",
                      animation: "bp-charge 170ms ease-out",
                      mixBlendMode: "screen",
                    }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        borderRadius: 10,
                        background:
                          "linear-gradient(90deg, transparent, rgba(255,255,255,0.40), transparent)",
                        animation: "bp-chargeSweep 170ms ease-out",
                        mixBlendMode: "screen",
                      }}
                    />
                  </div>
                ))}

                {fxLines.cols.map((x) => (
                  <div
                    key={`ch-c-${x}`}
                    className="absolute top-0 bottom-0"
                    style={{
                      left: `${(x / GRID) * 100}%`,
                      width: `${(1 / GRID) * 100}%`,
                      borderRadius: 10,
                      boxShadow:
                        "0 0 0 2px rgba(255,255,255,0.10) inset, 0 0 18px rgba(120,190,255,0.16), 0 0 14px rgba(255,120,220,0.10)",
                      background:
                        "linear-gradient(180deg, rgba(255,80,220,0.06), rgba(80,200,255,0.08), rgba(255,220,80,0.06))",
                      animation: "bp-charge 170ms ease-out",
                      mixBlendMode: "screen",
                    }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        borderRadius: 10,
                        background:
                          "linear-gradient(90deg, transparent, rgba(255,255,255,0.38), transparent)",
                        animation: "bp-chargeSweep 170ms ease-out",
                        mixBlendMode: "screen",
                      }}
                    />
                  </div>
                ))}

                {/* ✅ PRISM BEAMS */}
                {fxLines.rows.map((y) => (
                  <div
                    key={`pr-r-${y}`}
                    className="absolute left-0 right-0"
                    style={{
                      top: `${(y / GRID) * 100}%`,
                      height: `${(1 / GRID) * 100}%`,
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,80,220,0.20), rgba(80,200,255,0.28), rgba(255,220,80,0.22), transparent)",
                      boxShadow: "0 0 26px rgba(120,190,255,0.18), 0 0 22px rgba(255,120,220,0.12)",
                      animation: "bp-prismSweep 260ms ease-out",
                      mixBlendMode: "screen",
                    }}
                  />
                ))}

                {fxLines.cols.map((x) => (
                  <div
                    key={`pr-c-${x}`}
                    className="absolute top-0 bottom-0"
                    style={{
                      left: `${(x / GRID) * 100}%`,
                      width: `${(1 / GRID) * 100}%`,
                      background:
                        "linear-gradient(180deg, transparent, rgba(255,80,220,0.18), rgba(80,200,255,0.26), rgba(255,220,80,0.20), transparent)",
                      boxShadow: "0 0 26px rgba(120,190,255,0.16), 0 0 22px rgba(255,120,220,0.10)",
                      animation: "bp-prismSweep 260ms ease-out",
                      mixBlendMode: "screen",
                    }}
                  />
                ))}
              </div>
            ) : null}

            {fxCells.length > 0 ? (
              <div key={`cells-${fxId}`} className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))` }}>
                  {Array.from({ length: GRID * GRID }).map((_, idx) => {
                    const x = idx % GRID;
                    const y = Math.floor(idx / GRID);
                    const hit = fxCells.some((c) => c.x === x && c.y === y);
                    if (!hit) return <div key={idx} className="relative" />;

                    return (
                      <div key={idx} className="relative">
                        {/* prism burst */}
                        <div
                          className="absolute inset-[3px]"
                          style={{
                            borderRadius: 9,
                            background:
                              "conic-gradient(from 40deg, rgba(255,80,220,0.0), rgba(255,80,220,0.55), rgba(80,200,255,0.55), rgba(255,220,80,0.52), rgba(180,255,120,0.40), rgba(255,80,220,0.0))",
                            boxShadow:
                              "0 0 18px rgba(120,190,255,0.18), 0 0 14px rgba(255,120,220,0.12)",
                            animation: "bp-prismCell 360ms ease-out",
                            mixBlendMode: "screen",
                          }}
                        />
                        {/* spark cross */}
                        <div
                          className="absolute inset-[6px]"
                          style={{
                            borderRadius: 9,
                            background:
                              "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent), linear-gradient(180deg, transparent, rgba(255,255,255,0.40), transparent)",
                            animation: "bp-prismSpark 320ms ease-out",
                            mixBlendMode: "screen",
                            opacity: 0.9,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {gameOver ? (
              <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-sm">
                <div className="w-[86%] max-w-[360px] rounded-[24px] border border-white/10 bg-black/60 p-6 text-center shadow-[0_40px_140px_-90px_rgba(0,0,0,0.95)]">
                  <div className="text-xs font-semibold tracking-widest text-white/70">GAME OVER</div>
                  <div className="mt-2 text-4xl font-extrabold">{score}</div>
                  <div className="mt-1 text-sm text-white/70">No more moves.</div>
                                    <button
                    type="button"
                    onClick={() => router.push("/games/block-puzzle")}
                    className="mt-5 w-full rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black"
                  >
                    Back to Games
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

            {/* pieces tray pinned visually at the bottom */}
            <div className="mt-1 rounded-[24px] border border-white/10 bg-white/5 px-3 py-3 shadow-[0_40px_140px_-95px_rgba(0,0,0,0.9)] backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-white/80">Pieces</div>
          <div className="text-[11px] text-white/60">Drag & drop</div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {pieces.map((p) => {
            const { w, h } = pieceBounds(p.blocks);
            const maxW = 4;
            const maxH = 4;

            const slotW = maxW * trayCell;
            const slotH = maxH * trayCell;

            const pad = clamp(Math.round(trayCell * 0.28), 4, 8);

            const offsetX = Math.floor((slotW - w * trayCell) / 2);
            const offsetY = Math.floor((slotH - h * trayCell) / 2);

            const isActive = drag.active && drag.pieceId === p.id;

            return (
              <div key={p.id} className="flex flex-col items-center">
                <div
                  onPointerDown={(e) => {
  e.preventDefault();
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {}
  beginDrag(p.id, e);
}}
                  className={
                    "relative select-none overflow-hidden rounded-2xl border border-white/10 bg-black/15 " +
                    (isActive ? "ring-2 ring-white/40" : "")
                  }
                  style={{
                    touchAction: "none",
                    height: slotH + pad * 2,
                    width: slotW + pad * 2,
                    boxShadow: "0 18px 60px -55px rgba(0,0,0,0.95)",
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(220px_140px_at_50%_28%, rgba(255,255,255,0.10), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.10))",
                      boxShadow:
                        "inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 -18px 30px rgba(0,0,0,0.22)",
                    }}
                  />

                  <div className="relative" style={{ height: slotH, width: slotW, margin: pad }}>
                    {isActive ? null : (
                      <div
                        className="absolute"
                        style={{
                          left: offsetX,
                          top: offsetY,
                          width: w * trayCell,
                          height: h * trayCell,
                          filter: "drop-shadow(0 12px 14px rgba(0,0,0,0.38))",
                        }}
                      >
                        {p.blocks.map((b, idx) => (
                          <div
                            key={idx}
                            className="absolute"
                            style={{
                              left: b.x * trayCell,
                              top: b.y * trayCell,
                              width: trayCell,
                              height: trayCell,
                              ...tileStyleTray(p.color),
                              ...cellRadiusForBlock(p.blocks, b.x, b.y),
                            }}
                          />
                        ))}
                      </div>
                    )}

                    <div
                      className="pointer-events-none absolute"
                      style={{
                        left: offsetX,
                        top: offsetY + h * trayCell - Math.max(6, Math.round(trayCell * 0.22)),
                        width: w * trayCell,
                        height: Math.max(8, Math.round(trayCell * 0.28)),
                        background: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.28), transparent 68%)",
                        filter: "blur(2px)",
                        opacity: 0.75,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-1 text-center text-[11px] text-white/55">+{p.blocks.length * 10}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ghost piece */}
      {(() => {
        const snap = getSnap(drag);

        return drag.active && draggingPiece && ghost ? (
          <div
            className="pointer-events-none fixed left-0 top-0 z-[9999]"
            style={{
  transform: `translate(${ghost.left}px, ${ghost.top}px)`,
  opacity: snap && snap.ok ? 0.95 : 0.88,
}}
          >
            <div
              className="relative"
              style={{
                width: pieceBounds(draggingPiece.blocks).w * cellPx,
                height: pieceBounds(draggingPiece.blocks).h * cellPx,
                filter:
                  snap && snap.ok
                    ? "drop-shadow(0 14px 20px rgba(0,0,0,0.35))"
                    : "drop-shadow(0 10px 16px rgba(0,0,0,0.25))",
                animation:
                  snap && snap.ok
                    ? "bp-drop 120ms ease-out"
                    : snap && !snap.ok
                    ? "bp-shake 160ms ease-out"
                    : undefined,
              }}
            >
              {draggingPiece.blocks.map((b, idx) => {
                const absX = snap ? snap.x + b.x : null;
                const absY = snap ? snap.y + b.y : null;

                const collides =
                  overlaps && absX !== null && absY !== null ? overlaps.has(`${absX},${absY}`) : false;

                return (
                  <div
                    key={idx}
                    className="absolute"
                    style={{
                      left: b.x * cellPx,
                      top: b.y * cellPx,
                      width: cellPx,
                      height: cellPx,
                      ...(collides
                        ? {
                            background:
                              "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(0,0,0,0.18)), linear-gradient(135deg, #FFB020, rgba(0,0,0,0.22))",
                            boxShadow:
                              "inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -2px 0 rgba(0,0,0,0.25), 0 12px 24px rgba(255,140,60,0.30), 0 0 22px rgba(255,140,60,0.35)",
                            animation: "bp-warn 180ms ease-out",
                          }
                        : {
                            ...tileStyle(draggingPiece.color),
                          }),
                      ...cellRadiusForBlock(draggingPiece.blocks, b.x, b.y),
                      opacity: snap && snap.ok ? 0.98 : 0.88,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ) : null;
      })()}

      {/* toast */}
      {toast ? (
        <div className="fixed left-0 right-0 top-4 z-[9999] flex justify-center">
          <div className="rounded-2xl border border-white/15 bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
            {toast}
          </div>
        </div>
      ) : null}
    </div>
  </div>
);
}
// ===== FILE END: apps/web/app/(public)/games/block-puzzle/page.tsx =====