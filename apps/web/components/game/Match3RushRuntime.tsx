// ===== FILE START: apps/web/components/game/Match3RushRuntime.tsx =====
"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { commitRun } from "@/lib/core/commitRun";
import { getGameMeta } from "@/lib/games/registry";
import { getGameConfig } from "@/lib/games/catalog";

type Gem = "ruby" | "emerald" | "sapphire" | "topaz" | "amethyst" | "coin";
type Power = "bomb" | "nuke";

type Cell = {
  id: string;
  gem: Gem;
  power?: Power;
};

type Pos = { row: number; col: number };

type MatchRun = {
  cells: Pos[];
  orientation: "row" | "col";
};

type AnalyzeResult = {
  matched: Set<string>;
  runs: MatchRun[];
  spawnPowers: Array<{
    row: number;
    col: number;
    power: Power;
  }>;
};

type BombFxState = {
  active: boolean;
  row: number;
  col: number;
  phase: "ignite" | "blast";
  power: Power;
};

type SuperComboFxState = {
  active: boolean;
  from: Pos;
  to: Pos;
  phase: "pull" | "merge" | "detonate";
};

type OmegaBurst = {
  row: number;
  col: number;
  size: "sm" | "md" | "lg";
  delayMs: number;
  palette: "omega" | "mega";
};

type PowerSpawnFxState = {
  active: boolean;
  row: number;
  col: number;
  power: Power;
};

const SIZE = 8;
const START_MOVES = 18;
const GOAL_SCORE = 3600;

const GEMS: Gem[] = [
  "ruby",
  "emerald",
  "sapphire",
  "topaz",
  "amethyst",
  "coin",
];

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function uid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `m3_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  }
}

function keyOf(row: number, col: number) {
  return `${row}:${col}`;
}

function parseKey(key: string): Pos {
  const [row, col] = key.split(":").map(Number);
  return { row, col };
}

function randomGem(exclude: Gem[] = []): Gem {
  const available = GEMS.filter((g) => !exclude.includes(g));
  const pool = available.length ? available : GEMS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function makeCell(gem?: Gem, power?: Power): Cell {
  return {
    id: uid(),
    gem: gem || randomGem(),
    power,
  };
}

function areAdjacent(a: Pos, b: Pos) {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return dr + dc === 1;
}

function getBombNukeComboPair(
  board: Cell[][],
  a: Pos,
  b: Pos
): { bomb: Pos; nuke: Pos } | null {
  const cellA = board[a.row]?.[a.col];
  const cellB = board[b.row]?.[b.col];

  if (!cellA?.power || !cellB?.power) return null;

  const aIsBomb = cellA.power === "bomb";
  const aIsNuke = cellA.power === "nuke";
  const bIsBomb = cellB.power === "bomb";
  const bIsNuke = cellB.power === "nuke";

  if (aIsBomb && bIsNuke) {
    return { bomb: a, nuke: b };
  }

  if (aIsNuke && bIsBomb) {
    return { bomb: b, nuke: a };
  }

  return null;
}

function getBombBombComboPair(
  board: Cell[][],
  a: Pos,
  b: Pos
): { first: Pos; second: Pos } | null {
  const cellA = board[a.row]?.[a.col];
  const cellB = board[b.row]?.[b.col];

  if (cellA?.power === "bomb" && cellB?.power === "bomb") {
    return { first: a, second: b };
  }

  return null;
}

function getAllBoardKeys() {
  const all = new Set<string>();

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      all.add(keyOf(row, col));
    }
  }

  return all;
}

function buildOmegaBursts(): OmegaBurst[] {
  const bursts: OmegaBurst[] = [];
  const center = (SIZE - 1) / 2;

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const dx = row - center;
      const dy = col - center;
      const dist = Math.abs(dx) + Math.abs(dy);
      const ringNoise = (row * 19 + col * 23) % 34;

      const size: OmegaBurst["size"] =
        dist <= 1.2
          ? "lg"
          : dist <= 2.8
          ? ringNoise % 3 === 0
            ? "lg"
            : "md"
          : ringNoise % 4 === 0
          ? "md"
          : "sm";

      const delayMs = Math.max(0, Math.round(dist * 20 + ringNoise));

      bursts.push({
        row,
        col,
        size,
        delayMs,
        palette: "omega",
      });
    }
  }

  return bursts.sort((a, b) => a.delayMs - b.delayMs);
}

function buildMegaBombBursts(centers: Pos[]): OmegaBurst[] {
  const bursts: OmegaBurst[] = [];
  const seen = new Set<string>();

  centers.forEach((center, centerIndex) => {
    for (
      let row = Math.max(0, center.row - 2);
      row <= Math.min(SIZE - 1, center.row + 2);
      row += 1
    ) {
      for (
        let col = Math.max(0, center.col - 2);
        col <= Math.min(SIZE - 1, center.col + 2);
        col += 1
      ) {
        const k = keyOf(row, col);
        if (seen.has(k)) continue;
        seen.add(k);

        const dist =
          Math.abs(row - center.row) + Math.abs(col - center.col);

        const localNoise = (row * 13 + col * 17 + centerIndex * 7) % 24;

        const size: OmegaBurst["size"] =
          dist <= 1
            ? "lg"
            : dist <= 2
            ? localNoise % 3 === 0
              ? "lg"
              : "md"
            : "sm";

        const delayMs = Math.max(
          0,
          Math.round(dist * 24 + localNoise + centerIndex * 28)
        );

        bursts.push({
          row,
          col,
          size,
          delayMs,
          palette: "mega",
        });
      }
    }
  });

  return bursts.sort((a, b) => a.delayMs - b.delayMs);
}

async function playPowerSpawnSequence(
  fx: { row: number; col: number; power: Power }[],
  setPowerSpawnFx: (v: PowerSpawnFxState | null) => void
) {
  for (const item of fx) {
    setPowerSpawnFx({
      active: true,
      row: item.row,
      col: item.col,
      power: item.power,
    });

    await wait(item.power === "nuke" ? 210 : 165);
    setPowerSpawnFx(null);
    await wait(18);
  }

  setPowerSpawnFx(null);
}

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function swapCells(board: Cell[][], a: Pos, b: Pos): Cell[][] {
  const next = cloneBoard(board);
  const tmp = next[a.row][a.col];
  next[a.row][a.col] = next[b.row][b.col];
  next[b.row][b.col] = tmp;
  return next;
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function chooseSpawnPosForRunGroup(groupRuns: MatchRun[], preferred?: Pos | null) {
  const allCells = new Map<string, Pos>();
  const counts = new Map<string, number>();

  for (const run of groupRuns) {
    for (const cell of run.cells) {
      const k = keyOf(cell.row, cell.col);
      allCells.set(k, cell);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }

  if (preferred) {
    const pk = keyOf(preferred.row, preferred.col);
    if (allCells.has(pk)) return preferred;
  }

  for (const [k, count] of counts.entries()) {
    if (count >= 2) {
      return allCells.get(k) || null;
    }
  }

  const all = Array.from(allCells.values()).sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });

  if (all.length === 0) return null;
  return all[Math.floor(all.length / 2)];
}

function analyzeBoard(
  board: Cell[][],
  preferredSpawnPos?: Pos | null
): AnalyzeResult {
  const matched = new Set<string>();
  const runs: MatchRun[] = [];

  for (let row = 0; row < SIZE; row += 1) {
    let start = 0;

    while (start < SIZE) {
      const gem = board[row][start].gem;
      let end = start + 1;

      while (end < SIZE && board[row][end].gem === gem) end += 1;

      if (end - start >= 3) {
        const cells: Pos[] = [];
        for (let col = start; col < end; col += 1) {
          const k = keyOf(row, col);
          matched.add(k);
          cells.push({ row, col });
        }
        runs.push({ cells, orientation: "row" });
      }

      start = end;
    }
  }

  for (let col = 0; col < SIZE; col += 1) {
    let start = 0;

    while (start < SIZE) {
      const gem = board[start][col].gem;
      let end = start + 1;

      while (end < SIZE && board[end][col].gem === gem) end += 1;

      if (end - start >= 3) {
        const cells: Pos[] = [];
        for (let row = start; row < end; row += 1) {
          const k = keyOf(row, col);
          matched.add(k);
          cells.push({ row, col });
        }
        runs.push({ cells, orientation: "col" });
      }

      start = end;
    }
  }

  const spawnMap = new Map<string, Power>();

  if (matched.size === 0) {
    return {
      matched,
      runs,
      spawnPowers: [],
    };
  }

  // Собираем connected-components только из matched-клеток,
  // причём по одной и той же масти.
  const visited = new Set<string>();
  const components: Array<{
    gem: Gem;
    cells: Pos[];
    keys: Set<string>;
    rowCounts: Map<number, number>;
    colCounts: Map<number, number>;
  }> = [];

  for (const k of matched) {
    if (visited.has(k)) continue;

    const start = parseKey(k);
    const startCell = board[start.row]?.[start.col];
    if (!startCell) continue;

    const gem = startCell.gem;
    const queue: Pos[] = [start];
    const cells: Pos[] = [];
    const keys = new Set<string>();
    const rowCounts = new Map<number, number>();
    const colCounts = new Map<number, number>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      const ck = keyOf(current.row, current.col);

      if (visited.has(ck)) continue;
      if (!matched.has(ck)) continue;

      const cell = board[current.row]?.[current.col];
      if (!cell || cell.gem !== gem) continue;

      visited.add(ck);
      keys.add(ck);
      cells.push(current);

      rowCounts.set(current.row, (rowCounts.get(current.row) || 0) + 1);
      colCounts.set(current.col, (colCounts.get(current.col) || 0) + 1);

      const neighbors: Pos[] = [
        { row: current.row - 1, col: current.col },
        { row: current.row + 1, col: current.col },
        { row: current.row, col: current.col - 1 },
        { row: current.row, col: current.col + 1 },
      ];

      for (const n of neighbors) {
        if (n.row < 0 || n.row >= SIZE || n.col < 0 || n.col >= SIZE) continue;
        queue.push(n);
      }
    }

    if (cells.length > 0) {
      components.push({
        gem,
        cells,
        keys,
        rowCounts,
        colCounts,
      });
    }
  }

  function getComponentPower(component: {
    cells: Pos[];
    rowCounts: Map<number, number>;
    colCounts: Map<number, number>;
  }): Power | null {
    let maxRow = 0;
    let maxCol = 0;

    for (const count of component.rowCounts.values()) {
      maxRow = Math.max(maxRow, count);
    }

    for (const count of component.colCounts.values()) {
      maxCol = Math.max(maxCol, count);
    }

    const size = component.cells.length;
    const hasRow3 = maxRow >= 3;
    const hasCol3 = maxCol >= 3;

    // Линия 5
    if (maxRow >= 5 || maxCol >= 5) {
      return "nuke";
    }

    // Угол / Т / крест / любая реальная фигура из 5+,
    // образованная пересечением row/col частей
    if (size >= 5 && hasRow3 && hasCol3) {
      return "nuke";
    }

    // На практике connected-компонента из 5 одной масти в matched-зоне
    // — это как раз нужная крупная фигура.
    if (size >= 5) {
      return "nuke";
    }

    // Линия 4
    if (maxRow === 4 || maxCol === 4) {
      return "bomb";
    }

    return null;
  }

  function chooseAutoSpawnCell(component: {
    cells: Pos[];
    keys: Set<string>;
    rowCounts: Map<number, number>;
    colCounts: Map<number, number>;
  }, power: Power): Pos | null {
    if (component.cells.length === 0) return null;

    // Для bomb стараемся ставить в центр линии 4
    if (power === "bomb") {
      let bestRun: Pos[] | null = null;

      for (const run of runs) {
        const everyCellInside = run.cells.every((cell) =>
          component.keys.has(keyOf(cell.row, cell.col))
        );

        if (!everyCellInside) continue;
        if (run.cells.length !== 4) continue;

        if (!bestRun || run.cells.length > bestRun.length) {
          bestRun = run.cells;
        }
      }

      if (bestRun) {
        return bestRun[Math.floor(bestRun.length / 2)] || null;
      }
    }

    // Для nuke стараемся ставить в самый "узловой" центр фигуры:
    // максимум связей по row/col + соседям.
    let bestCell: Pos | null = null;
    let bestScore = -1;

    for (const cell of component.cells) {
      const rowCount = component.rowCounts.get(cell.row) || 0;
      const colCount = component.colCounts.get(cell.col) || 0;

      const neighbors: Pos[] = [
        { row: cell.row - 1, col: cell.col },
        { row: cell.row + 1, col: cell.col },
        { row: cell.row, col: cell.col - 1 },
        { row: cell.row, col: cell.col + 1 },
      ];

      let linkedSides = 0;

      for (const n of neighbors) {
        if (component.keys.has(keyOf(n.row, n.col))) {
          linkedSides += 1;
        }
      }

      const score = rowCount * 10 + colCount * 10 + linkedSides;

      if (score > bestScore) {
        bestScore = score;
        bestCell = cell;
      }
    }

    return bestCell || component.cells[Math.floor(component.cells.length / 2)] || null;
  }

  if (preferredSpawnPos) {
    const preferredKey = keyOf(preferredSpawnPos.row, preferredSpawnPos.col);

    for (const component of components) {
      if (!component.keys.has(preferredKey)) continue;

      const power = getComponentPower(component);
      if (!power) continue;

      // При ручном ходе power ВСЕГДА ставим туда,
      // куда пришла последняя фишка.
      spawnMap.set(preferredKey, power);
      break;
    }
  } else {
    for (const component of components) {
      const power = getComponentPower(component);
      if (!power) continue;

      const spawnCell = chooseAutoSpawnCell(component, power);
      if (!spawnCell) continue;

      const spawnKey = keyOf(spawnCell.row, spawnCell.col);
      const existing = spawnMap.get(spawnKey);

      if (existing === "nuke") continue;
      if (existing === "bomb" && power === "bomb") continue;

      spawnMap.set(spawnKey, power);
    }
  }

  return {
    matched,
    runs,
    spawnPowers: Array.from(spawnMap.entries()).map(([k, power]) => {
      const { row, col } = parseKey(k);
      return { row, col, power };
    }),
  };
}

function findMatches(board: Cell[][]) {
  return analyzeBoard(board).matched;
}

function hasAnyMoves(board: Cell[][]) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const a = { row, col };
      const candidates: Pos[] = [
        { row, col: col + 1 },
        { row: row + 1, col },
      ];

      for (const b of candidates) {
        if (b.row >= SIZE || b.col >= SIZE) continue;
        const swapped = swapCells(board, a, b);
        if (findMatches(swapped).size > 0) return true;
      }
    }
  }

  return false;
}

function buildBoard(): Cell[][] {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const board: Cell[][] = [];

    for (let row = 0; row < SIZE; row += 1) {
      const line: Cell[] = [];

      for (let col = 0; col < SIZE; col += 1) {
        let cell = makeCell();

        while (
          (col >= 2 &&
            line[col - 1].gem === cell.gem &&
            line[col - 2].gem === cell.gem) ||
          (row >= 2 &&
            board[row - 1][col].gem === cell.gem &&
            board[row - 2][col].gem === cell.gem)
        ) {
          const exclude = [
            ...(col >= 2 ? [line[col - 1].gem] : []),
            ...(row >= 2 ? [board[row - 1][col].gem] : []),
          ];
          cell = makeCell(randomGem(exclude));
        }

        line.push(cell);
      }

      board.push(line);
    }

    if (findMatches(board).size === 0 && hasAnyMoves(board)) {
      return board;
    }
  }

  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => makeCell())
  );
}

function reshuffleBoard(board: Cell[][]): Cell[][] {
  const flat = shuffleArray(
    board.flat().map((cell) => ({
      gem: cell.gem,
      power: cell.power,
    }))
  );

  for (let attempt = 0; attempt < 80; attempt += 1) {
    let i = 0;
    const next: Cell[][] = [];

    for (let row = 0; row < SIZE; row += 1) {
      const line: Cell[] = [];
      for (let col = 0; col < SIZE; col += 1) {
        const src = flat[i] || {
          gem: randomGem(),
          power: undefined as Power | undefined,
        };
        i += 1;
        line.push(makeCell(src.gem, src.power));
      }
      next.push(line);
    }

    if (findMatches(next).size === 0 && hasAnyMoves(next)) {
      return next;
    }

    shuffleArray(flat);
  }

  return buildBoard();
}

function collapseBoard(board: Cell[][], cleared: Set<string>) {
  const next: Cell[][] = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => makeCell())
  );

  for (let col = 0; col < SIZE; col += 1) {
    const survivors: Cell[] = [];

    for (let row = SIZE - 1; row >= 0; row -= 1) {
      if (!cleared.has(keyOf(row, col))) {
        survivors.push({ ...board[row][col] });
      }
    }

    let writeRow = SIZE - 1;
    for (const cell of survivors) {
      next[writeRow][col] = cell;
      writeRow -= 1;
    }

    while (writeRow >= 0) {
      next[writeRow][col] = makeCell();
      writeRow -= 1;
    }
  }

  return next;
}

function buildFallMotion(
  prevBoard: Cell[][],
  nextBoard: Cell[][]
): {
  fallingIds: Set<string>;
  offsetRowsById: Map<string, number>;
  maxOffset: number;
} {
  const prevPosById = new Map<string, Pos>();

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const cell = prevBoard[row]?.[col];
      if (!cell) continue;
      prevPosById.set(cell.id, { row, col });
    }
  }

  const fallingIds = new Set<string>();
  const offsetRowsById = new Map<string, number>();
  let maxOffset = 0;

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const nextCell = nextBoard[row]?.[col];
      if (!nextCell) continue;

      const prevPos = prevPosById.get(nextCell.id);

      if (!prevPos) {
        const offset = row + 1;
        fallingIds.add(nextCell.id);
        offsetRowsById.set(nextCell.id, offset);
        maxOffset = Math.max(maxOffset, offset);
        continue;
      }

      if (prevPos.row !== row || prevPos.col !== col) {
        const offset = Math.max(0, row - prevPos.row);
        fallingIds.add(nextCell.id);
        offsetRowsById.set(nextCell.id, offset);
        maxOffset = Math.max(maxOffset, offset);
      }
    }
  }

  return {
    fallingIds,
    offsetRowsById,
    maxOffset,
  };
}

function expandClearWithBombs(
  board: Cell[][],
  base: Set<string>,
  allowChain = true
) {
  const expanded = new Set<string>(base);
  const queue = [...base];
  const triggeredBombs: Array<{
    row: number;
    col: number;
    power: Power;
  }> = [];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const k = queue.shift()!;
    const { row, col } = parseKey(k);
    const cell = board[row]?.[col];

    if (!cell?.power) continue;

    const isDirectlyTriggered = base.has(k);
    if (!allowChain && !isDirectlyTriggered) {
      continue;
    }

    const powerKey = `${row}:${col}:${cell.power}`;
    if (seen.has(powerKey)) continue;
    seen.add(powerKey);

    triggeredBombs.push({
      row,
      col,
      power: cell.power,
    });

    const radius = cell.power === "nuke" ? 2 : 1;

    for (
      let rr = Math.max(0, row - radius);
      rr <= Math.min(SIZE - 1, row + radius);
      rr += 1
    ) {
      for (
        let cc = Math.max(0, col - radius);
        cc <= Math.min(SIZE - 1, col + radius);
        cc += 1
      ) {
        const kk = keyOf(rr, cc);
        if (!expanded.has(kk)) {
          expanded.add(kk);
          if (allowChain) {
            queue.push(kk);
          }
        }
      }
    }
  }

  return {
    expanded,
    triggeredBombs,
  };
}

function getTriggeredPowerScore(
  triggeredBombs: Array<{
    row: number;
    col: number;
    power: Power;
  }>
) {
  return triggeredBombs.reduce((acc, bomb) => {
    return acc + (bomb.power === "nuke" ? 360 : 180);
  }, 0);
}

function getMoveScore(params: {
  cleared: number;
  cascade: number;
  streak: number;
  powerScore: number;
}) {
  const clearBonus = params.cleared * 120;

  const cascadeBonus =
    params.cascade <= 1 ? 0 : 160 + (params.cascade - 2) * 220;

  const streakBonus =
    params.streak <= 1 ? 0 : 70 + (params.streak - 2) * 45;

  return clearBonus + cascadeBonus + streakBonus + params.powerScore;
}

function getPracticePrize(score: number, phase: "won" | "lost") {
  if (phase === "won") {
    return Math.max(160, Math.floor(score / 8));
  }

  return Math.max(4, Math.floor(score / 60));
}

async function playBombSequence(
  triggeredBombs: Array<{
    row: number;
    col: number;
    power: Power;
  }>,
  setBombFx: (v: BombFxState | null) => void
) {
  for (const bomb of triggeredBombs) {
    setBombFx({
      active: true,
      row: bomb.row,
      col: bomb.col,
      phase: "ignite",
      power: bomb.power,
    });

    await wait(bomb.power === "nuke" ? 120 : 95);

    setBombFx({
      active: true,
      row: bomb.row,
      col: bomb.col,
      phase: "blast",
      power: bomb.power,
    });

    await wait(bomb.power === "nuke" ? 175 : 135);
    setBombFx(null);
    await wait(14);
  }

  setBombFx(null);
}

function findBestHint(board: Cell[][]): { from: Pos; to: Pos } | null {
  let best:
    | {
        from: Pos;
        to: Pos;
        weight: number;
      }
    | null = null;

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const a = { row, col };
      const candidates: Pos[] = [
        { row, col: col + 1 },
        { row: row + 1, col },
      ];

      for (const b of candidates) {
        if (b.row >= SIZE || b.col >= SIZE) continue;

        const swapped = swapCells(board, a, b);
        const analyzed = analyzeBoard(swapped, b);
        if (analyzed.matched.size === 0) continue;

        const weight =
          analyzed.matched.size * 10 +
          analyzed.spawnPowers.length * 120 +
          analyzed.runs.reduce((acc, r) => acc + r.cells.length, 0);

        if (!best || weight > best.weight) {
          best = { from: a, to: b, weight };
        }
      }
    }
  }

  return best ? { from: best.from, to: best.to } : null;
}

function getCellFragmentPalette(cell: Cell) {
  if (cell.power === "nuke") {
    return ["#ffffff", "#fff1a6", "#ffd24a", "#ff9f1c", "#ff5a1f"];
  }

  if (cell.power === "bomb") {
    return ["#f3fff7", "#b7ffd1", "#6df0a7", "#22c55e", "#0f8a46"];
  }

  switch (cell.gem) {
    case "ruby":
      return ["#fff2f7", "#ffcfe0", "#ff7cab", "#e11d68", "#7a1238"];
    case "emerald":
      return ["#f2fff8", "#d4ffe7", "#7cf0b2", "#18c56a", "#0d5c35"];
    case "sapphire":
      return ["#eef8ff", "#b9ddff", "#73bbff", "#2563eb", "#153a8a"];
    case "topaz":
      return ["#fff8d6", "#ffd96a", "#ffca14", "#d28a08", "#8c5a00"];
    case "amethyst":
      return ["#fdf6ff", "#efd9ff", "#d18eff", "#a63cff", "#5b1697"];
    case "coin":
      return ["#fffde2", "#ffefab", "#ffd957", "#f0b700", "#9a6800"];
    default:
      return ["#ffffff", "#e5e7eb", "#9ca3af"];
  }
}

function gemTileGlowClass(cell: Cell) {
  if (cell.power === "nuke") {
    return "drop-shadow-[0_0_16px_rgba(255,216,120,0.30)] drop-shadow-[0_16px_40px_rgba(255,136,0,0.34)]";
  }

  if (cell.power === "bomb") {
    return "drop-shadow-[0_0_14px_rgba(170,255,210,0.26)] drop-shadow-[0_14px_34px_rgba(34,197,94,0.28)]";
  }

  switch (cell.gem) {
    case "ruby":
      return "drop-shadow-[0_0_12px_rgba(255,170,210,0.26)] drop-shadow-[0_14px_34px_rgba(255,52,120,0.28)]";
    case "emerald":
      return "drop-shadow-[0_0_12px_rgba(150,255,205,0.22)] drop-shadow-[0_14px_34px_rgba(20,212,122,0.28)]";
    case "sapphire":
      return "drop-shadow-[0_0_12px_rgba(170,220,255,0.22)] drop-shadow-[0_14px_34px_rgba(51,141,255,0.28)]";
    case "topaz":
      return "drop-shadow-[0_0_12px_rgba(255,240,150,0.22)] drop-shadow-[0_14px_34px_rgba(255,194,20,0.28)]";
    case "amethyst":
      return "drop-shadow-[0_0_12px_rgba(235,180,255,0.22)] drop-shadow-[0_14px_34px_rgba(180,76,255,0.28)]";
    case "coin":
      return "drop-shadow-[0_0_12px_rgba(255,240,160,0.22)] drop-shadow-[0_14px_34px_rgba(255,200,30,0.30)]";
    default:
      return "drop-shadow-[0_12px_28px_rgba(255,255,255,0.16)]";
  }
}

function renderGemFace(cell: Cell) {
  const sid = String(cell.id || "x").replace(/[^a-zA-Z0-9_-]/g, "");

  if (cell.power === "bomb") {
    const bodyGrad = `m3bomb_body_${sid}`;
    const rimGrad = `m3bomb_rim_${sid}`;
    const fuseGrad = `m3bomb_fuse_${sid}`;
    const sparkGlow = `m3bomb_spark_glow_${sid}`;
    const greenInner = `m3bomb_green_inner_${sid}`;

    return (
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <defs>
          <radialGradient id={bodyGrad} cx="30%" cy="22%" r="76%">
            <stop offset="0%" stopColor="#5d6673" />
            <stop offset="18%" stopColor="#232a35" />
            <stop offset="58%" stopColor="#090d12" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>

          <linearGradient id={rimGrad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.26)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0.10)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
          </linearGradient>

          <linearGradient id={fuseGrad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d6c39d" />
            <stop offset="100%" stopColor="#6e4d2b" />
          </linearGradient>

          <radialGradient id={sparkGlow} cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#f3fff7" />
            <stop offset="28%" stopColor="#b7ffd1" />
            <stop offset="58%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="rgba(34,197,94,0)" />
          </radialGradient>

          <radialGradient id={greenInner} cx="50%" cy="52%" r="58%">
            <stop offset="0%" stopColor="rgba(170,255,210,0.16)" />
            <stop offset="100%" stopColor="rgba(34,197,94,0)" />
          </radialGradient>
        </defs>

        <ellipse cx="50" cy="84" rx="22" ry="6" fill="rgba(0,0,0,0.32)" />

        <circle
          cx="48"
          cy="54"
          r="26"
          fill={`url(#${bodyGrad})`}
          stroke={`url(#${rimGrad})`}
          strokeWidth="2.6"
        />

        <circle cx="48" cy="54" r="18" fill={`url(#${greenInner})`} />

        <ellipse
          cx="38"
          cy="39"
          rx="9"
          ry="5.6"
          transform="rotate(-18 38 39)"
          fill="rgba(255,255,255,0.18)"
        />

        <rect
          x="53"
          y="22"
          width="10"
          height="12"
          rx="3"
          fill="#111827"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1.3"
        />

        <path
          d="M58 22C59 16 63 12 69 10"
          fill="none"
          stroke={`url(#${fuseGrad})`}
          strokeWidth="4"
          strokeLinecap="round"
        />

        <circle cx="73" cy="9" r="9" fill={`url(#${sparkGlow})`} />
        <path
          d="M73 0L75 5L80 7L75 9L73 14L71 9L66 7L71 5Z"
          fill="#d9ffe6"
        />
        <path
          d="M80 7L82 10L86 11L82 12L80 16L78 12L74 11L78 10Z"
          fill="#22c55e"
        />
      </svg>
    );
  }

  if (cell.power === "nuke") {
    const bodyGrad = `m3nuke_body_${sid}`;
    const finGrad = `m3nuke_fin_${sid}`;
    const capGrad = `m3nuke_cap_${sid}`;
    const ringGrad = `m3nuke_ring_${sid}`;

    return (
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <defs>
          <linearGradient id={bodyGrad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6b7f71" />
            <stop offset="42%" stopColor="#445649" />
            <stop offset="100%" stopColor="#2c362e" />
          </linearGradient>

          <linearGradient id={finGrad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4e6254" />
            <stop offset="100%" stopColor="#2a332c" />
          </linearGradient>

          <linearGradient id={capGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7b907f" />
            <stop offset="100%" stopColor="#3b493f" />
          </linearGradient>

          <radialGradient id={ringGrad} cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#ffe55c" />
            <stop offset="100%" stopColor="#e0a700" />
          </radialGradient>
        </defs>

        <g transform="translate(6 10) rotate(-20 44 40)">
          <path
            d="M16 48C16 28 28 15 52 15H64C69 15 73 19 73 24V56C73 61 69 65 64 65H52C28 65 16 52 16 48Z"
            fill={`url(#${bodyGrad})`}
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="2"
          />

          <path
            d="M16 48C16 28 28 15 52 15H56V65H52C28 65 16 52 16 48Z"
            fill={`url(#${capGrad})`}
            opacity="0.88"
          />

          <path d="M72 23L88 14V30L72 34Z" fill={`url(#${finGrad})`} />
          <path d="M72 56L88 66V50L72 46Z" fill={`url(#${finGrad})`} />
          <path d="M58 14L73 4V18L61 22Z" fill={`url(#${finGrad})`} />
          <path d="M58 66L73 76V62L61 58Z" fill={`url(#${finGrad})`} />

          <circle
            cx="41"
            cy="40"
            r="11.5"
            fill={`url(#${ringGrad})`}
            stroke="#1f2937"
            strokeWidth="2.2"
          />
          <circle cx="41" cy="40" r="8.5" fill="#facc15" />

          <path d="M41 32L44.5 38H37.5L41 32Z" fill="#111827" />
          <path d="M34 44L37.5 38H44.5L48 44H41Z" fill="#111827" />
          <path d="M41 48L37.5 42H44.5L41 48Z" fill="#111827" />

          <path
            d="M22 31C29 22 40 19 56 19"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </g>
      </svg>
    );
  }

  switch (cell.gem) {
    case "ruby": {
      const body = `m3sphere_body_${sid}`;
      const edge = `m3sphere_edge_${sid}`;
      const shine = `m3sphere_shine_${sid}`;
      const glow = `m3sphere_glow_${sid}`;

      return (
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <defs>
            <radialGradient id={body} cx="34%" cy="24%" r="74%">
              <stop offset="0%" stopColor="#fff2f7" />
              <stop offset="18%" stopColor="#ffcfe0" />
              <stop offset="44%" stopColor="#ff7cab" />
              <stop offset="74%" stopColor="#e11d68" />
              <stop offset="100%" stopColor="#7a1238" />
            </radialGradient>

            <linearGradient id={edge} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff5f8" />
              <stop offset="100%" stopColor="#881337" />
            </linearGradient>

            <radialGradient id={shine} cx="30%" cy="20%" r="66%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
              <stop offset="32%" stopColor="rgba(255,255,255,0.28)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>

            <radialGradient id={glow} cx="50%" cy="78%" r="48%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>

          <circle
            cx="50"
            cy="52"
            r="25"
            fill={`url(#${body})`}
            stroke={`url(#${edge})`}
            strokeWidth="3.8"
          />

          <ellipse
            cx="38"
            cy="34"
            rx="13"
            ry="7.5"
            transform="rotate(-18 38 34)"
            fill={`url(#${shine})`}
          />

          <ellipse cx="57" cy="66" rx="15" ry="9" fill={`url(#${glow})`} />
        </svg>
      );
    }

    case "emerald": {
      const leaf = `m3leaf_main_${sid}`;
      const edge = `m3leaf_edge_${sid}`;
      const vein = `m3leaf_vein_${sid}`;
      const shine = `m3leaf_shine_${sid}`;
      const dot = `m3leaf_dot_${sid}`;

      return (
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <defs>
            <radialGradient id={leaf} cx="30%" cy="22%" r="76%">
              <stop offset="0%" stopColor="#f2fff8" />
              <stop offset="18%" stopColor="#d4ffe7" />
              <stop offset="42%" stopColor="#7cf0b2" />
              <stop offset="72%" stopColor="#18c56a" />
              <stop offset="100%" stopColor="#0d5c35" />
            </radialGradient>

            <linearGradient id={edge} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f5fff9" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>

            <linearGradient id={vein} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.40)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
            </linearGradient>

            <radialGradient id={shine} cx="28%" cy="18%" r="66%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
              <stop offset="34%" stopColor="rgba(255,255,255,0.24)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>

            <radialGradient id={dot} cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="#fff7d6" />
              <stop offset="100%" stopColor="#f59e0b" />
            </radialGradient>
          </defs>

          <path
            d="M50 88C71 78 84 60 84 38C84 22 72 10 56 10C42 10 29 18 22 31C17 40 14 52 18 62C22 74 32 82 50 88Z"
            fill={`url(#${leaf})`}
            stroke={`url(#${edge})`}
            strokeWidth="3.4"
            strokeLinejoin="round"
          />

          <path
            d="M28 67C43 57 58 42 69 23"
            fill="none"
            stroke={`url(#${vein})`}
            strokeWidth="3.4"
            strokeLinecap="round"
          />

          <ellipse
            cx="38"
            cy="30"
            rx="14"
            ry="7.5"
            transform="rotate(-26 38 30)"
            fill={`url(#${shine})`}
          />

          <circle cx="57" cy="56" r="3.8" fill={`url(#${dot})`} />
          <circle cx="67" cy="39" r="3.2" fill={`url(#${dot})`} />

          <path
            d="M20 63C17 68 15 73 15 79"
            fill="none"
            stroke="#7c3f12"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
      );
    }

    case "sapphire": {
      const body = `m3cube_body_${sid}`;
      const edge = `m3cube_edge_${sid}`;
      const top = `m3cube_top_${sid}`;
      const side = `m3cube_side_${sid}`;
      const shine = `m3cube_shine_${sid}`;

      return (
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <defs>
            <linearGradient id={top} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e8f5ff" />
              <stop offset="100%" stopColor="#8ecaff" />
            </linearGradient>

            <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#79bcff" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>

            <linearGradient id={side} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3d8dff" />
              <stop offset="100%" stopColor="#153a8a" />
            </linearGradient>

            <linearGradient id={edge} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f3faff" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>

            <radialGradient id={shine} cx="28%" cy="18%" r="64%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
              <stop offset="34%" stopColor="rgba(255,255,255,0.24)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>

          <path
            d="M50 16L73 29V55L50 68L27 55V29L50 16Z"
            fill={`url(#${body})`}
            stroke={`url(#${edge})`}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path
            d="M50 16L73 29L50 42L27 29L50 16Z"
            fill={`url(#${top})`}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M50 42V68L73 55V29L50 42Z"
            fill={`url(#${side})`}
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          <ellipse
            cx="40"
            cy="28"
            rx="12"
            ry="6.5"
            transform="rotate(-18 40 28)"
            fill={`url(#${shine})`}
          />
        </svg>
      );
    }

    case "topaz": {
      const body = `m3pyramid_body_${sid}`;
      const left = `m3pyramid_left_${sid}`;
      const right = `m3pyramid_right_${sid}`;
      const edge = `m3pyramid_edge_${sid}`;
      const shine = `m3pyramid_shine_${sid}`;

      return (
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <defs>
            <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff8d6" />
              <stop offset="34%" stopColor="#ffd96a" />
              <stop offset="100%" stopColor="#d28a08" />
            </linearGradient>

            <linearGradient id={left} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff1b0" />
              <stop offset="100%" stopColor="#e0a112" />
            </linearGradient>

            <linearGradient id={right} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f6bb2a" />
              <stop offset="100%" stopColor="#8a5400" />
            </linearGradient>

            <linearGradient id={edge} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff7d2" />
              <stop offset="100%" stopColor="#9a5d05" />
            </linearGradient>

            <radialGradient id={shine} cx="32%" cy="20%" r="64%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
              <stop offset="30%" stopColor="rgba(255,255,255,0.24)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>

          <path
            d="M50 18L75 72H25L50 18Z"
            fill={`url(#${body})`}
            stroke={`url(#${edge})`}
            strokeWidth="3.6"
            strokeLinejoin="round"
          />
          <path d="M50 18L50 72H25L50 18Z" fill={`url(#${left})`} opacity="0.76" />
          <path d="M50 18L75 72H50V18Z" fill={`url(#${right})`} opacity="0.88" />

          <path
            d="M50 18L50 72"
            fill="none"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          <ellipse
            cx="42"
            cy="34"
            rx="11"
            ry="6"
            transform="rotate(-18 42 34)"
            fill={`url(#${shine})`}
          />
        </svg>
      );
    }

    case "amethyst": {
      const body = `m3spade_body_${sid}`;
      const edge = `m3spade_edge_${sid}`;
      const stem = `m3spade_stem_${sid}`;
      const shine = `m3spade_shine_${sid}`;

      return (
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <defs>
            <radialGradient id={body} cx="34%" cy="24%" r="76%">
              <stop offset="0%" stopColor="#fdf6ff" />
              <stop offset="18%" stopColor="#efd9ff" />
              <stop offset="42%" stopColor="#d18eff" />
              <stop offset="72%" stopColor="#a63cff" />
              <stop offset="100%" stopColor="#5b1697" />
            </radialGradient>

            <linearGradient id={edge} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff7ff" />
              <stop offset="100%" stopColor="#6b21a8" />
            </linearGradient>

            <linearGradient id={stem} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7e22ce" />
              <stop offset="100%" stopColor="#2e1065" />
            </linearGradient>

            <radialGradient id={shine} cx="28%" cy="18%" r="66%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
              <stop offset="34%" stopColor="rgba(255,255,255,0.24)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>

          <path
            d="M50 16C63 28 81 39 81 55C81 66 73 74 63 74C57 74 53 71 50 66C47 71 43 74 37 74C27 74 19 66 19 55C19 39 37 28 50 16Z"
            fill={`url(#${body})`}
            stroke={`url(#${edge})`}
            strokeWidth="3.6"
            strokeLinejoin="round"
          />

          <path
            d="M50 66L57 84H43L50 66Z"
            fill={`url(#${stem})`}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />

          <ellipse
            cx="39"
            cy="33"
            rx="12"
            ry="6.6"
            transform="rotate(-18 39 33)"
            fill={`url(#${shine})`}
          />
        </svg>
      );
    }

    case "coin": {
      const face = `m3coin_face_${sid}`;
      const edge = `m3coin_edge_${sid}`;
      const side = `m3coin_side_${sid}`;
      const shine = `m3coin_shine_${sid}`;
      const inner = `m3coin_inner_${sid}`;

      return (
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <defs>
            <radialGradient id={face} cx="30%" cy="22%" r="75%">
              <stop offset="0%" stopColor="#fffde2" />
              <stop offset="18%" stopColor="#ffefab" />
              <stop offset="40%" stopColor="#ffd957" />
              <stop offset="68%" stopColor="#f0b700" />
              <stop offset="100%" stopColor="#9a6800" />
            </radialGradient>

            <linearGradient id={edge} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff7cb" />
              <stop offset="100%" stopColor="#9a6800" />
            </linearGradient>

            <linearGradient id={side} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d99800" />
              <stop offset="100%" stopColor="#7b5100" />
            </linearGradient>

            <radialGradient id={shine} cx="28%" cy="18%" r="68%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
              <stop offset="34%" stopColor="rgba(255,255,255,0.26)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>

            <linearGradient id={inner} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff0b3" />
              <stop offset="100%" stopColor="#c58900" />
            </linearGradient>
          </defs>

          <g transform="translate(50 50) rotate(-18) translate(-50 -50)">
            <ellipse
              cx="52"
              cy="58"
              rx="25"
              ry="23"
              fill={`url(#${side})`}
              opacity="0.96"
            />

            <ellipse
              cx="50"
              cy="49"
              rx="27"
              ry="24"
              fill={`url(#${face})`}
              stroke={`url(#${edge})`}
              strokeWidth="3.8"
            />

            <ellipse
              cx="50"
              cy="49"
              rx="19.5"
              ry="17"
              fill="none"
              stroke={`url(#${inner})`}
              strokeWidth="3"
            />

            <ellipse
              cx="39"
              cy="35"
              rx="11"
              ry="6.2"
              transform="rotate(-18 39 35)"
              fill={`url(#${shine})`}
            />

            <path
              d="M31 28C39 22 50 21 61 24"
              fill="none"
              stroke="rgba(255,255,255,0.24)"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </g>
        </svg>
      );
    }

    default:
      return <span className="text-[1.4em]">✨</span>;
  }
}

async function animateCascade(
  initialBoard: Cell[][],
  setBoard: (b: Cell[][]) => void,
  setMatchedNow: (s: Set<string>) => void,
  setFallingNow: (s: Set<string>) => void,
  setSpawnedNow: (s: Set<string>) => void,
  setBombFx: (v: BombFxState | null) => void,
  setPowerSpawnFx: (v: PowerSpawnFxState | null) => void,
  setFallOffsets: (map: Map<string, number>) => void,
  clearFallOffsets: () => void,
  preferredSpawnPos?: Pos | null
) {
  let current = cloneBoard(initialBoard);
  let totalCleared = 0;
  let cascade = 0;
  let totalBombHits = 0;
  let totalPowerScore = 0;

  while (true) {
    const analyzed = analyzeBoard(
      current,
      cascade === 0 ? preferredSpawnPos || null : null
    );

    if (analyzed.matched.size === 0) break;
    cascade += 1;

    const boardWithPowers = cloneBoard(current);
    const preBlastSpawnedIds = new Set<string>();
    const preBlastSpawnFx: Array<{ row: number; col: number; power: Power }> = [];
    const spawnKeepKeys = new Set<string>();

for (const sp of analyzed.spawnPowers) {
  const k = keyOf(sp.row, sp.col);
  const existingCell = boardWithPowers[sp.row]?.[sp.col];
  const existingPower = existingCell?.power;
  const resolvedPower: Power =
    existingPower === "nuke" || sp.power === "nuke" ? "nuke" : "bomb";

  // Если в клетке уже есть power, не пересоздаём сущность без необходимости:
  // просто апгрейдим bomb -> nuke при необходимости.
  if (existingCell?.power) {
    boardWithPowers[sp.row][sp.col] = {
      ...existingCell,
      power: resolvedPower,
    };
  } else {
    boardWithPowers[sp.row][sp.col] = makeCell(existingCell?.gem, resolvedPower);
  }

  spawnKeepKeys.add(k);
  preBlastSpawnedIds.add(boardWithPowers[sp.row][sp.col].id);

  preBlastSpawnFx.push({
    row: sp.row,
    col: sp.col,
    power: resolvedPower,
  });
}

    setBoard(boardWithPowers);
    setSpawnedNow(preBlastSpawnedIds);
    setMatchedNow(new Set(analyzed.matched));
    await nextFrame();

    if (preBlastSpawnFx.length > 0) {
      await playPowerSpawnSequence(preBlastSpawnFx, setPowerSpawnFx);
      await wait(8);
    } else {
      await wait(92);
    }

const clearBase = new Set<string>();
for (const k of analyzed.matched) {
  if (spawnKeepKeys.has(k)) continue;

  const { row, col } = parseKey(k);
  const cell = boardWithPowers[row]?.[col];

  // ВАЖНО:
  // обычное совпадение не должно само активировать bomb/nuke.
  // Power должна выживать в обычной match-волне и взрываться
  // только от тапа, drag или blast другой power.
  if (cell?.power) {
    continue;
  }

  clearBase.add(k);
}

    const chainSeed = new Set<string>(clearBase);

    // Новые powers, созданные в этой же волне, не должны сразу считаться
    // "старыми бомбами", которые уже участвуют в chain-реакции.
    // Поэтому убираем их из стартового seed для expandClearWithBombs.
    for (const keepKey of spawnKeepKeys) {
      chainSeed.delete(keepKey);
    }

    const { expanded, triggeredBombs } = expandClearWithBombs(
      boardWithPowers,
      chainSeed,
      true
    );

    // И дополнительно гарантируем, что новые spawned powers останутся жить
    // после этой волны и не будут случайно очищены.
    for (const keepKey of spawnKeepKeys) {
      expanded.delete(keepKey);
    }

    if (triggeredBombs.length > 0) {
      totalBombHits += triggeredBombs.length;
      totalPowerScore += getTriggeredPowerScore(triggeredBombs);
      setMatchedNow(new Set(expanded));
      await nextFrame();
      await playBombSequence(triggeredBombs, setBombFx);
      await wait(6);
    } else {
      setMatchedNow(new Set(expanded));
      await wait(52);
    }

    totalCleared += expanded.size;

    const fallen = collapseBoard(boardWithPowers, expanded);
    const { fallingIds, offsetRowsById, maxOffset } = buildFallMotion(
      boardWithPowers,
      fallen
    );

    const fallMs = Math.min(360, 190 + maxOffset * 24);

    setMatchedNow(new Set());
    setSpawnedNow(new Set());
    setFallingNow(new Set());
    setFallOffsets(offsetRowsById);
    setBoard(fallen);

    await nextFrame();
    setFallingNow(fallingIds);

    await wait(fallMs);

    setFallingNow(new Set());
    clearFallOffsets();

    await wait(8);

    current = fallen;
  }

  return {
    board: current,
    totalCleared,
    cascade,
    totalBombHits,
    totalPowerScore,
  };
}

type Props = {
  returnTo?: string;
};

export default function Match3RushRuntime({ returnTo: returnToProp }: Props) {
  const sp = useSearchParams();

  const meta = getGameMeta("match-3-rush");
  const defaultReturnTo = meta.routes?.modesHref || "/games/match-3-rush/modes";
  const returnTo = (returnToProp || sp.get("returnTo") || defaultReturnTo).trim();

  const mode = (sp.get("mode") || "warm-up").trim();
  const modeId = (sp.get("modeId") || "").trim();
  const prize = Number(sp.get("prize") || "0");
  const currencyParam = (sp.get("currency") || "gems").trim().toLowerCase();
  const resultCurrency = currencyParam === "cash" ? "cash" : "gems";

  const gameConfig = getGameConfig("match-3-rush");
  const resolvedModeMeta =
    gameConfig.modes.find((m) => m.id === modeId) ||
    gameConfig.modes.find((m) => m.mode === mode) ||
    null;

  const resolvedModeTitle = resolvedModeMeta?.title || mode;

  const committedRef = React.useRef(false);
  const dragPointerStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const dragStartRef = React.useRef<Pos | null>(null);
  const suppressClickRef = React.useRef(false);
  const boardWrapRef = React.useRef<HTMLDivElement | null>(null);
  const hintTimerRef = React.useRef<number | null>(null);
  const cellSizePxRef = React.useRef(0);
  const fallOffsetRowsByIdRef = React.useRef<Map<string, number>>(new Map());

  const [board, setBoard] = React.useState<Cell[][]>(() => buildBoard());
  const [score, setScore] = React.useState(0);
  const [movesLeft, setMovesLeft] = React.useState(START_MOVES);
  const [selected, setSelected] = React.useState<Pos | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [lastClear, setLastClear] = React.useState(0);
  const [cascade, setCascade] = React.useState(0);
  const [streak, setStreak] = React.useState(0);
  const [comboLabel, setComboLabel] = React.useState<string | null>(null);
  const [matchedNow, setMatchedNow] = React.useState<Set<string>>(new Set());
  const [fallingNow, setFallingNow] = React.useState<Set<string>>(new Set());
  const [hintCells, setHintCells] = React.useState<Set<string>>(new Set());
  const [spawnedNow, setSpawnedNow] = React.useState<Set<string>>(new Set());
  const [bombFx, setBombFx] = React.useState<BombFxState | null>(null);
  const [superComboFx, setSuperComboFx] =
    React.useState<SuperComboFxState | null>(null);
  const [omegaBursts, setOmegaBursts] = React.useState<OmegaBurst[]>([]);
  const [omegaBurstMode, setOmegaBurstMode] =
    React.useState<"omega" | "mega" | null>(null);
  const [powerSpawnFx, setPowerSpawnFx] =
    React.useState<PowerSpawnFxState | null>(null);
  const [phase, setPhase] = React.useState<"playing" | "won" | "lost">("playing");
  const [showTutorialHand, setShowTutorialHand] = React.useState(true);

  const [dragVisual, setDragVisual] = React.useState<{
    active: boolean;
    cell: Cell | null;
    from: Pos | null;
    dx: number;
    dy: number;
  }>({
    active: false,
    cell: null,
    from: null,
    dx: 0,
    dy: 0,
  });

  const [dragTarget, setDragTarget] = React.useState<Pos | null>(null);

  const [invalidSwap, setInvalidSwap] = React.useState<{
    a: Pos;
    b: Pos;
  } | null>(null);

  function clearHintTimer() {
    if (hintTimerRef.current) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
  }

  function armHintTimer(nextBoard: Cell[][]) {
    clearHintTimer();
    setHintCells(new Set());

    if (busy || phase !== "playing") return;

    hintTimerRef.current = window.setTimeout(() => {
      const hint = findBestHint(nextBoard);
      if (!hint) return;

      setHintCells(
        new Set([
          keyOf(hint.from.row, hint.from.col),
          keyOf(hint.to.row, hint.to.col),
        ])
      );
    }, 2400);
  }

  function restart() {
    committedRef.current = false;
    dragStartRef.current = null;
    dragPointerStartRef.current = null;
    clearHintTimer();

    const fresh = buildBoard();

    setBoard(fresh);
    setScore(0);
    setMovesLeft(START_MOVES);
    setSelected(null);
    setBusy(false);
    setLastClear(0);
    setCascade(0);
    setStreak(0);
    setComboLabel(null);
    setMatchedNow(new Set());
    setFallingNow(new Set());
    setSpawnedNow(new Set());
    setHintCells(new Set());
    setBombFx(null);
    setSuperComboFx(null);
    setOmegaBursts([]);
    setOmegaBurstMode(null);
    setPowerSpawnFx(null);
    fallOffsetRowsByIdRef.current = new Map();
    setDragTarget(null);
    setInvalidSwap(null);
    setDragVisual({
      active: false,
      cell: null,
      from: null,
      dx: 0,
      dy: 0,
    });
    setPhase("playing");
    setShowTutorialHand(true);

    armHintTimer(fresh);
  }

  React.useEffect(() => {
    armHintTimer(board);
    return () => clearHintTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    function updateCellSize() {
      const rect = boardWrapRef.current?.getBoundingClientRect();
      if (!rect) return;

      const horizontalPadding = 20;
      const gaps = 7 * 7;
      const usable = Math.max(0, rect.width - horizontalPadding - gaps);
      cellSizePxRef.current = usable / SIZE;
    }

    updateCellSize();

    window.addEventListener("resize", updateCellSize);
    return () => {
      window.removeEventListener("resize", updateCellSize);
    };
  }, []);

  React.useEffect(() => {
    if (phase !== "playing") return;
    if (movesLeft > 0) return;

    setPhase(score >= GOAL_SCORE ? "won" : "lost");
  }, [movesLeft, score, phase]);

  React.useEffect(() => {
    if (!(phase === "won" || phase === "lost")) return;
    if (committedRef.current) return;

    committedRef.current = true;

    const practicePrize = getPracticePrize(score, phase);

    commitRun({
      gameId: "match-3-rush",
      title: `Match 3 Rush · ${resolvedModeTitle}`,
      currency: resultCurrency,
      prize:
        resultCurrency === "cash" && Number.isFinite(prize) && prize > 0
          ? prize
          : practicePrize,
      mode,
      score,
      serverScore: score,
      verified: true,
      outcome: phase === "won" ? "win" : "loss",
      durationMs: 0,
      placement: phase === "won" ? 1 : null,
      rewardSource: resultCurrency === "cash" ? "cash" : "practice",
      walletDelta: resultCurrency === "gems" ? practicePrize : 0,
    });
  }, [phase, score, resultCurrency, prize, resolvedModeTitle, mode]);

  React.useEffect(() => {
    if (busy || phase !== "playing") return;
    if (movesLeft <= 0) return;

    if (!hasAnyMoves(board)) {
      setBusy(true);
      setComboLabel("RESHUFFLE");

      window.setTimeout(() => {
        const next = reshuffleBoard(board);
        setBoard(next);
        setBusy(false);
        setComboLabel(null);
        armHintTimer(next);
      }, 300);
    }
  }, [board, busy, phase, movesLeft]);

  React.useEffect(() => {
    if (!comboLabel) return;
    const t = window.setTimeout(() => setComboLabel(null), 900);
    return () => window.clearTimeout(t);
  }, [comboLabel]);

  async function settleAfterBoardClear(
    sourceBoard: Cell[][],
    cleared: Set<string>,
    label: string,
    directPowerScore: number
  ) {
    const fallen = collapseBoard(sourceBoard, cleared);
    const { fallingIds, offsetRowsById, maxOffset } = buildFallMotion(
      sourceBoard,
      fallen
    );

    setMatchedNow(new Set(cleared));
    await nextFrame();

    setMatchedNow(new Set());
    setFallingNow(new Set());
    fallOffsetRowsByIdRef.current = offsetRowsById;
    setBoard(fallen);

    await nextFrame();
    setFallingNow(fallingIds);

    const fallMs = Math.min(340, 185 + maxOffset * 22);
    await wait(fallMs);

    setFallingNow(new Set());
    fallOffsetRowsByIdRef.current = new Map();

    await wait(30);

    const seededBoard = hasAnyMoves(fallen) ? fallen : reshuffleBoard(fallen);

    const extraResolved =
      findMatches(seededBoard).size > 0
        ? await animateCascade(
            seededBoard,
            setBoard,
            setMatchedNow,
            setFallingNow,
            setSpawnedNow,
            setBombFx,
            setPowerSpawnFx,
            (map) => {
              fallOffsetRowsByIdRef.current = map;
            },
            () => {
              fallOffsetRowsByIdRef.current = new Map();
            }
          )
        : {
            board: seededBoard,
            totalCleared: 0,
            cascade: 0,
            totalBombHits: 0,
            totalPowerScore: 0,
          };

    const finalBoard = hasAnyMoves(extraResolved.board)
      ? extraResolved.board
      : reshuffleBoard(extraResolved.board);

    const totalCleared = cleared.size + extraResolved.totalCleared;
    const totalPowerScore = directPowerScore + extraResolved.totalPowerScore;
    const totalCascade = Math.max(1, 1 + extraResolved.cascade);

    const moveScore = getMoveScore({
      cleared: totalCleared,
      cascade: totalCascade,
      streak: 0,
      powerScore: totalPowerScore,
    });

    setBoard(finalBoard);
    setScore((prev) => prev + moveScore);
    setMovesLeft((prev) => Math.max(0, prev - 1));
    setLastClear(totalCleared);
    setCascade(totalCascade);
    setStreak(0);
    setComboLabel(label);
    setBusy(false);
    armHintTimer(finalBoard);
  }

  async function triggerManualPower(pos: Pos) {
    const cell = board[pos.row]?.[pos.col];
    if (!cell?.power) return;
    if (busy || phase !== "playing") return;

    clearHintTimer();
    setHintCells(new Set());
    setBusy(true);
    setSelected(null);
    setDragVisual({
      active: false,
      cell: null,
      from: null,
      dx: 0,
      dy: 0,
    });
    setDragTarget(null);

    const base = new Set<string>([keyOf(pos.row, pos.col)]);
    const { expanded, triggeredBombs } = expandClearWithBombs(board, base);

    setMatchedNow(new Set(expanded));
    await nextFrame();
    await playBombSequence(triggeredBombs, setBombFx);

    await settleAfterBoardClear(
      board,
      expanded,
      cell.power === "nuke" ? "NUKE" : "BOMB HIT",
      getTriggeredPowerScore(triggeredBombs)
    );
  }

  function getSwipeTarget(
    start: Pos,
    clientX: number,
    clientY: number,
    rect: DOMRect
  ): Pos | null {
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    const cellW = rect.width / SIZE;
    const cellH = rect.height / SIZE;

    const centerX = (start.col + 0.5) * cellW;
    const centerY = (start.row + 0.5) * cellH;

    const dx = localX - centerX;
    const dy = localY - centerY;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    const threshold = Math.min(cellW, cellH) * 0.22;
    if (Math.max(absX, absY) < threshold) return null;

    if (absX > absY) {
      const nextCol = dx > 0 ? start.col + 1 : start.col - 1;
      if (nextCol < 0 || nextCol >= SIZE) return null;
      return { row: start.row, col: nextCol };
    }

    const nextRow = dy > 0 ? start.row + 1 : start.row - 1;
    if (nextRow < 0 || nextRow >= SIZE) return null;
    return { row: nextRow, col: start.col };
  }

  function handlePointerDown(
    e: React.PointerEvent<HTMLButtonElement>,
    row: number,
    col: number
  ) {
    if (busy || phase !== "playing") return;

    clearHintTimer();
    setHintCells(new Set());
    setShowTutorialHand(false);

    const cell = board[row]?.[col];
    if (!cell) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    dragStartRef.current = { row, col };
    dragPointerStartRef.current = { x: e.clientX, y: e.clientY };

    setSelected({ row, col });
    setDragTarget(null);

    setDragVisual({
      active: true,
      cell,
      from: { row, col },
      dx: 0,
      dy: 0,
    });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (busy || phase !== "playing") return;
    if (!dragStartRef.current || !dragPointerStartRef.current) return;

    const rect = boardWrapRef.current?.getBoundingClientRect();
    if (!rect) return;

    const start = dragStartRef.current;
    const target = getSwipeTarget(start, e.clientX, e.clientY, rect);

    const rawDx = e.clientX - dragPointerStartRef.current.x;
    const rawDy = e.clientY - dragPointerStartRef.current.y;

    const step = cellSizePxRef.current || 44;

    let dx = 0;
    let dy = 0;

    if (target) {
      dx = (target.col - start.col) * step;
      dy = (target.row - start.row) * step;
    } else {
      if (Math.abs(rawDx) > Math.abs(rawDy)) {
        dx = Math.max(-16, Math.min(16, rawDx * 0.22));
      } else {
        dy = Math.max(-16, Math.min(16, rawDy * 0.22));
      }
    }

    setDragTarget(target);

    setDragVisual((prev) =>
      prev.active
        ? {
            ...prev,
            dx,
            dy,
          }
        : prev
    );
  }

function finishDragWithoutMove() {
  setDragTarget(null);

  setDragVisual({
    active: false,
    cell: null,
    from: null,
    dx: 0,
    dy: 0,
  });

  armHintTimer(board);
}

  async function resolveMove(from: Pos, to: Pos) {
    if (busy || phase !== "playing") return;

    clearHintTimer();
    setHintCells(new Set());

    const fromCellBefore = board[from.row]?.[from.col];
    const toCellBefore = board[to.row]?.[to.col];

    const movedPowerSource = fromCellBefore?.power
      ? { from, to }
      : toCellBefore?.power
      ? { from: to, to: from }
      : null;

    if (movedPowerSource) {
      const swapped = swapCells(board, from, to);

      setBusy(true);
      setSelected(null);
      setBoard(swapped);
      setDragVisual({
        active: false,
        cell: null,
        from: null,
        dx: 0,
        dy: 0,
      });
      setDragTarget(null);

      await nextFrame();
      await wait(24);

      const comboPair = getBombNukeComboPair(swapped, from, to);

    if (comboPair) {
      setComboLabel("NUKE + BOMB");
      setSuperComboFx({
        active: true,
        from: comboPair.bomb,
        to: comboPair.nuke,
        phase: "pull",
      });

      await wait(110);

      setSuperComboFx((prev) =>
        prev ? { ...prev, phase: "merge" } : prev
      );

      await wait(82);

      setSuperComboFx((prev) =>
        prev ? { ...prev, phase: "detonate" } : prev
      );

      setOmegaBurstMode("omega");
      setOmegaBursts(buildOmegaBursts());

      // ВАЖНО:
      // сначала показываем спец-центр combo,
      // без раннего массового clear по всей доске
      await playBombSequence(
        [
          {
            row: comboPair.bomb.row,
            col: comboPair.bomb.col,
            power: "bomb",
          },
          {
            row: comboPair.nuke.row,
            col: comboPair.nuke.col,
            power: "nuke",
          },
        ],
        setBombFx
      );

      await wait(10);

      const expanded = getAllBoardKeys();

      setMatchedNow(new Set(expanded));
      await nextFrame();
      await wait(26);

      await settleAfterBoardClear(swapped, expanded, "OMEGA BLAST", 1400);

      setSuperComboFx(null);
      setOmegaBursts([]);
      setOmegaBurstMode(null);
      return;
    }

      const bombBombPair = getBombBombComboPair(swapped, from, to);

    if (bombBombPair) {
      setComboLabel("BOMB + BOMB");
      setSuperComboFx({
        active: true,
        from: bombBombPair.first,
        to: bombBombPair.second,
        phase: "pull",
      });

      await wait(104);

      setSuperComboFx((prev) =>
        prev ? { ...prev, phase: "merge" } : prev
      );

      await wait(78);

      setSuperComboFx((prev) =>
        prev ? { ...prev, phase: "detonate" } : prev
      );

      const centers = [bombBombPair.first, bombBombPair.second];
      const expanded = new Set<string>();

      for (const center of centers) {
        for (
          let rr = Math.max(0, center.row - 2);
          rr <= Math.min(SIZE - 1, center.row + 2);
          rr += 1
        ) {
          for (
            let cc = Math.max(0, center.col - 2);
            cc <= Math.min(SIZE - 1, center.col + 2);
            cc += 1
          ) {
            expanded.add(keyOf(rr, cc));
          }
        }
      }

      setOmegaBurstMode("mega");
      setOmegaBursts(buildMegaBombBursts(centers));

      // ВАЖНО:
      // сначала именно взрыв двух центров,
      // и только потом общее очищение зоны
      await playBombSequence(
        [
          {
            row: bombBombPair.first.row,
            col: bombBombPair.first.col,
            power: "bomb",
          },
          {
            row: bombBombPair.second.row,
            col: bombBombPair.second.col,
            power: "bomb",
          },
        ],
        setBombFx
      );

      await wait(10);

      setMatchedNow(new Set(expanded));
      await nextFrame();
      await wait(24);

      await settleAfterBoardClear(swapped, expanded, "MEGA BOMB", 720);

      setSuperComboFx(null);
      setOmegaBursts([]);
      setOmegaBurstMode(null);
      return;
    }

      const sourcePowerPos = movedPowerSource.from;
      const armedPos = movedPowerSource.to;
      const armedCell = swapped[armedPos.row]?.[armedPos.col];

      if (!armedCell?.power) {
        setBusy(false);
        armHintTimer(swapped);
        return;
      }

      // Жёстко страхуемся: центр power должен остаться только в новой клетке,
      // а старая клетка не должна вести себя как второй источник спец-эффекта.
      const sanitized = cloneBoard(swapped);

      if (
        (sourcePowerPos.row !== armedPos.row ||
          sourcePowerPos.col !== armedPos.col) &&
        sanitized[sourcePowerPos.row]?.[sourcePowerPos.col]?.power
      ) {
        sanitized[sourcePowerPos.row][sourcePowerPos.col] = {
          ...sanitized[sourcePowerPos.row][sourcePowerPos.col],
          power: undefined,
        };
      }

      const base = new Set<string>([keyOf(armedPos.row, armedPos.col)]);
      const { expanded, triggeredBombs } = expandClearWithBombs(sanitized, base);

      // ВАЖНО:
      // сначала показываем blast-центр только в новой клетке,
      // и только потом запускаем общее очищение зоны.
      await playBombSequence(
        [
          {
            row: armedPos.row,
            col: armedPos.col,
            power: armedCell.power,
          },
          ...triggeredBombs.filter(
            (item) => item.row !== armedPos.row || item.col !== armedPos.col
          ),
        ],
        setBombFx
      );

      setMatchedNow(new Set(expanded));
      await nextFrame();
      await wait(22);

      await settleAfterBoardClear(
        sanitized,
        expanded,
        armedCell.power === "nuke" ? "NUKE" : "BOMB HIT",
        getTriggeredPowerScore(triggeredBombs)
      );

      return;
    }

    const swapped = swapCells(board, from, to);
    const analyzed = analyzeBoard(swapped, to);

    if (analyzed.matched.size === 0) {
      setDragVisual({
        active: false,
        cell: null,
        from: null,
        dx: 0,
        dy: 0,
      });
      setDragTarget(null);
      setBusy(true);
      setInvalidSwap({ a: from, b: to });
      setSelected(null);
      setStreak(0);
      setComboLabel("NO MATCH");

      window.setTimeout(() => {
        setInvalidSwap(null);
        setBusy(false);
        armHintTimer(board);
      }, 150);

      return;
    }

    setBusy(true);
    setSelected(null);
    setBoard(swapped);
    setDragVisual({
      active: false,
      cell: null,
      from: null,
      dx: 0,
      dy: 0,
    });
    setDragTarget(null);

    await nextFrame();

    const resolved = await animateCascade(
      swapped,
      setBoard,
      setMatchedNow,
      setFallingNow,
      setSpawnedNow,
      setBombFx,
      setPowerSpawnFx,
      (map) => {
        fallOffsetRowsByIdRef.current = map;
      },
      () => {
        fallOffsetRowsByIdRef.current = new Map();
      },
      to
    );

    const nextStreak = streak + 1;

    const moveScore = getMoveScore({
      cleared: resolved.totalCleared,
      cascade: resolved.cascade,
      streak: nextStreak,
      powerScore: resolved.totalPowerScore,
    });

    const nextBoard = hasAnyMoves(resolved.board)
      ? resolved.board
      : reshuffleBoard(resolved.board);

    setBoard(nextBoard);
    setScore((prev) => prev + moveScore);
    setMovesLeft((prev) => Math.max(0, prev - 1));
    setLastClear(resolved.totalCleared);
    setCascade(resolved.cascade);
    setStreak(nextStreak);

    if (resolved.cascade >= 4) {
      setComboLabel(`MEGA x${resolved.cascade}`);
    } else if (resolved.cascade === 3) {
      setComboLabel("SUPER CASCADE");
    } else if (resolved.cascade === 2) {
      setComboLabel("CASCADE");
    } else if (resolved.totalBombHits > 0) {
      setComboLabel("BOMB HIT");
    } else if (nextStreak >= 3) {
      setComboLabel(`STREAK x${nextStreak}`);
    } else if (resolved.totalCleared >= 5) {
      setComboLabel("JUICY");
    }

    setBusy(false);
    armHintTimer(nextBoard);
  }

function handlePointerUp() {
  const start = dragStartRef.current;
  const target = dragTarget;

  dragStartRef.current = null;
  dragPointerStartRef.current = null;

  if (!start || !target || !areAdjacent(start, target)) {
    finishDragWithoutMove();
    return;
  }

  suppressClickRef.current = true;
  window.setTimeout(() => {
    suppressClickRef.current = false;
  }, 220);

  setDragTarget(null);
  setDragVisual({
    active: false,
    cell: null,
    from: null,
    dx: 0,
    dy: 0,
  });

  void resolveMove(start, target);
}

  function handleCellClick(row: number, col: number) {
  if (suppressClickRef.current) {
    return;
  }

  if (busy || phase !== "playing") return;

    clearHintTimer();
    setHintCells(new Set());

    const pos = { row, col };
    const tappedCell = board[row]?.[col];

    if (!selected) {
      if (tappedCell?.power) {
        void triggerManualPower(pos);
        return;
      }

      setSelected(pos);
      return;
    }

    if (selected.row === row && selected.col === col) {
      if (tappedCell?.power) {
        void triggerManualPower(pos);
        return;
      }

      setSelected(null);
      armHintTimer(board);
      return;
    }

    if (!areAdjacent(selected, pos)) {
      if (tappedCell?.power) {
        void triggerManualPower(pos);
        return;
      }

      setSelected(pos);
      return;
    }

    void resolveMove(selected, pos);
  }

  const progressPct = Math.min(100, Math.round((score / GOAL_SCORE) * 100));
  const goalRemaining = Math.max(0, GOAL_SCORE - score);

  return (
    <main className="min-h-screen text-white">
      <style jsx global>{`
        @keyframes m3_invalid {
          0% {
            transform: translateX(0) scale(1);
          }
          18% {
            transform: translateX(-3px) scale(0.995);
          }
          38% {
            transform: translateX(3px) scale(0.998);
          }
          58% {
            transform: translateX(-2px) scale(0.999);
          }
          78% {
            transform: translateX(2px) scale(1);
          }
          100% {
            transform: translateX(0) scale(1);
          }
        }

        @keyframes m3_bomb_flash {
          0% {
            transform: scale(0.42);
            opacity: 0;
            filter: brightness(1.35) saturate(1.18);
          }
          28% {
            transform: scale(0.92);
            opacity: 1;
            filter: brightness(1.2) saturate(1.12);
          }
          100% {
            transform: scale(1.28);
            opacity: 0;
            filter: brightness(1) saturate(1);
          }
        }

@keyframes m3_fall_soft {
  0% {
    transform: translate3d(0, calc(-1 * var(--fall-start, 30px)), 0) scale(0.972);
    opacity: 0.14;
  }
  54% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 1;
  }
  78% {
    transform: translate3d(0, 5px, 0) scale(1.012);
    opacity: 1;
  }
  100% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 1;
  }
}

@keyframes m3_piece_implode {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  18% {
    transform: scale(1.05);
    opacity: 1;
  }
  48% {
    transform: scale(0.88);
    opacity: 0.94;
  }
  78% {
    transform: scale(0.46);
    opacity: 0.42;
  }
  100% {
    transform: scale(0.08);
    opacity: 0;
  }
}

@keyframes m3_hint_pulse {
  0%,
  100% {
    transform: scale(1);
    box-shadow:
      0 0 0 rgba(255,255,255,0),
      0 0 0 rgba(255,212,80,0);
  }
  50% {
    transform: scale(1.014);
    box-shadow:
      0 0 0 2px rgba(255,255,255,0.08),
      0 0 10px rgba(255,212,80,0.10);
  }
}

@keyframes m3_bomb_ignite {
  0% {
    transform: scale(0.58);
    opacity: 0.26;
  }
  55% {
    transform: scale(1.08);
    opacity: 1;
  }
  100% {
    transform: scale(0.96);
    opacity: 0.94;
  }
}

@keyframes m3_bomb_core {
  0% {
    transform: scale(0.56);
    opacity: 0.14;
  }
  26% {
    transform: scale(0.98);
    opacity: 0.76;
  }
  60% {
    transform: scale(1.42);
    opacity: 1;
  }
  100% {
    transform: scale(2.12);
    opacity: 0;
  }
}

@keyframes m3_combo_pop {
  0% {
    transform: translate(-50%, 8px) scale(0.92);
    opacity: 0;
  }
  18% {
    transform: translate(-50%, 0px) scale(1.02);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -10px) scale(1);
    opacity: 0;
  }
}

@keyframes m3_sparkle {
  0%,
  100% {
    opacity: 0.18;
    transform: scale(0.9);
  }
  50% {
    opacity: 0.52;
    transform: scale(1.04);
  }
}

@keyframes m3_match_glow_fade {
  0% {
    transform: scale(0.94);
    opacity: 0;
  }
  35% {
    transform: scale(1.02);
    opacity: 0.28;
  }
  100% {
    transform: scale(1.12);
    opacity: 0;
  }
}

@keyframes m3_fragment_burst {
  0% {
    transform: translate3d(0, 0, 0) scale(0.4) rotate(0deg);
    opacity: 0;
  }
  16% {
    opacity: 1;
  }
  62% {
    transform: translate3d(
        calc(var(--frag-x) * 0.72),
        calc(var(--frag-y) * 0.72),
        0
      )
      scale(1.01) rotate(calc(var(--frag-rot) * 0.62));
    opacity: 0.92;
  }
  100% {
    transform: translate3d(var(--frag-x), var(--frag-y), 0)
      scale(1.06) rotate(var(--frag-rot));
    opacity: 0;
  }
}

@keyframes m3_tutorial_hand_move {
  0% {
    transform: translate3d(0px, 0px, 0) scale(1);
    opacity: 0;
  }
  10% {
    transform: translate3d(0px, 0px, 0) scale(1);
    opacity: 1;
  }
  58% {
    transform: translate3d(34px, 0px, 0) scale(1);
    opacity: 1;
  }
  82% {
    transform: translate3d(34px, 0px, 0) scale(1);
    opacity: 0.9;
  }
  100% {
    transform: translate3d(34px, 0px, 0) scale(1);
    opacity: 0;
  }
}

@keyframes m3_power_spawn {
  0% {
    transform: scale(0.54) rotate(-4deg);
    opacity: 0;
  }
  44% {
    transform: scale(1.08) rotate(1deg);
    opacity: 1;
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

@keyframes m3_bomb_idle {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(0, -1px, 0) scale(1.028);
  }
}

@keyframes m3_nuke_idle {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(0, -1px, 0) scale(1.042);
  }
}
      `}</style>

      <div className="min-h-screen bg-[radial-gradient(1200px_760px_at_50%_-180px,rgba(255,255,255,0.24),transparent_52%),radial-gradient(680px_420px_at_50%_15%,rgba(255,131,214,0.14),transparent_60%),linear-gradient(180deg,#6d28d9_0%,#4c1d95_28%,#22104b_62%,#0f172a_100%)]">
        <div className="mx-auto flex min-h-screen max-w-md flex-col px-3 pb-24 pt-3">
          <div className="flex items-center justify-between">
            <Link
              href={returnTo}
              className="grid h-12 w-12 place-items-center rounded-[18px] border border-white/15 bg-white/10 text-xl shadow-[0_12px_30px_rgba(0,0,0,0.25)] backdrop-blur"
            >
              ←
            </Link>

            <div className="text-center">
              <div className="text-[12px] font-semibold uppercase tracking-[0.24em] text-white/72">
                Match 3 Rush
              </div>
              <div className="mt-1 text-4xl font-extrabold text-yellow-300 drop-shadow-[0_10px_20px_rgba(250,204,21,0.36)]">
                {score}
              </div>
            </div>

            <button
              type="button"
              onClick={restart}
              className="grid h-12 w-12 place-items-center rounded-[18px] border border-white/15 bg-white/10 text-xl shadow-[0_12px_30px_rgba(0,0,0,0.25)] backdrop-blur"
              title="Restart"
            >
              ↺
            </button>
          </div>

          <div className="relative mt-4 overflow-hidden rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.08))] p-4 shadow-[0_40px_120px_-70px_rgba(0,0,0,0.95)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.22),transparent_22%),radial-gradient(circle_at_84%_18%,rgba(255,255,255,0.12),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_32%,rgba(0,0,0,0.12)_100%)]" />

            <div className="relative h-1" />

            <div className="relative mt-3 rounded-[20px] border border-white/10 bg-black/16 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
              <div className="mb-1.5 flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.14em] text-white/60">
                <span>Crystal Goal</span>
                <span>
                  {score} / {GOAL_SCORE}
                </span>
              </div>

              <div className="h-2.5 overflow-hidden rounded-full border border-white/10 bg-black/25 shadow-[inset_0_1px_4px_rgba(0,0,0,0.28)]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#f472b6_0%,#f59e0b_52%,#fde047_100%)] shadow-[0_4px_10px_rgba(250,204,21,0.22)] transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="mt-1.5 flex items-center justify-between text-[9px] text-white/54">
                <span>Need {goalRemaining} more</span>
                <span>Cascade {cascade || "—"}</span>
              </div>
            </div>
          </div>

          <div
            ref={boardWrapRef}
            className="relative mt-4 overflow-visible rounded-[34px] border-0 bg-transparent p-[10px] shadow-none"
          >
            <div className="pointer-events-none absolute inset-x-6 top-0 h-10 rounded-b-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0))] blur-md opacity-70" />

            <div className="pointer-events-none absolute inset-0 opacity-60">
              {Array.from({ length: 18 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute h-1.5 w-1.5 rounded-full bg-white/80"
                  style={{
                    left: `${8 + ((i * 17) % 82)}%`,
                    top: `${6 + ((i * 23) % 84)}%`,
                    animation: `m3_sparkle ${
                      1.8 + (i % 4) * 0.5
                    }s ease-in-out ${i * 0.12}s infinite`,
                    filter: "blur(0.2px)",
                  }}
                />
              ))}
            </div>

            {comboLabel ? (
              <div
                className="pointer-events-none absolute left-1/2 top-4 z-[120] rounded-full border border-white/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.26),rgba(255,255,255,0.12))] px-4 py-2 text-sm font-black tracking-[0.18em] text-yellow-200 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur"
                style={{ animation: "m3_combo_pop 0.9s ease-out forwards" }}
              >
                {comboLabel}
              </div>
            ) : null}

            {showTutorialHand && phase === "playing" && !busy ? (
              <div className="pointer-events-none absolute inset-[14px] z-[110]">
                <div
                  className="absolute"
                  style={{
                    left: "12.5%",
                    top: "18%",
                    animation: "m3_tutorial_hand_move 1.45s ease-in-out infinite",
                  }}
                >
                  <div className="relative grid h-10 w-10 place-items-center rounded-full bg-white/10 backdrop-blur-sm">
                    <span className="text-[26px] drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]">
                      ☞
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="relative grid grid-cols-8 gap-[7px] rounded-[26px] border border-transparent bg-transparent p-[7px] shadow-none">
              {board.flatMap((line, row) =>
                line.map((cell, col) => {
                  const key = keyOf(row, col);
                  const isSelected = selected?.row === row && selected?.col === col;
                  const isMatchedNow = matchedNow.has(key);
                  const isFalling = fallingNow.has(cell.id);
                  const isSpawnedNow = spawnedNow.has(cell.id);
                  const isHint = hintCells.has(key);

                  const isDragSource =
                    dragVisual.active &&
                    dragVisual.from?.row === row &&
                    dragVisual.from?.col === col;

                  const isDragTarget =
                    dragTarget?.row === row && dragTarget?.col === col;

                  const isInvalidA =
                    invalidSwap?.a?.row === row && invalidSwap?.a?.col === col;

                  const isInvalidB =
                    invalidSwap?.b?.row === row && invalidSwap?.b?.col === col;

                  const fragmentPalette = getCellFragmentPalette(cell);

                  let moveX = 0;
                  let moveY = 0;

                  const step = cellSizePxRef.current || 44;

                  if (dragVisual.active && dragVisual.from && dragTarget) {
                    const deltaCol = dragTarget.col - dragVisual.from.col;
                    const deltaRow = dragTarget.row - dragVisual.from.row;

                    if (isDragSource) {
                      moveX = deltaCol * step;
                      moveY = deltaRow * step;
                    }

                    if (isDragTarget) {
                      moveX = -deltaCol * step * 0.82;
                      moveY = -deltaRow * step * 0.82;
                    }
                  } else if (isDragSource) {
                    moveX = dragVisual.dx;
                    moveY = dragVisual.dy;
                  }

                  const fallOffsetRows =
                    fallOffsetRowsByIdRef.current.get(cell.id) || 0;

const tileAnimation =
  isFalling
    ? "m3_fall_soft"
    : isMatchedNow
    ? "m3_piece_implode"
    : isSpawnedNow
    ? "m3_power_spawn"
    : "";

const tileDuration =
  isFalling
    ? `${Math.min(460, 250 + fallOffsetRows * 34)}ms`
    : isMatchedNow
    ? "260ms"
    : isSpawnedNow
    ? "240ms"
    : "0ms";

const tileTiming =
  isFalling
    ? "cubic-bezier(0.16,1,0.3,1)"
    : isMatchedNow || isSpawnedNow
    ? "cubic-bezier(0.22,1,0.36,1)"
    : "linear";

                  return (
                    <button
                      key={cell.id}
                      type="button"
                      disabled={busy || phase !== "playing"}
                      onClick={() => handleCellClick(row, col)}
                      onPointerDown={(e) => handlePointerDown(e, row, col)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      style={{ touchAction: "none" }}
                      className={
                        "group relative aspect-square overflow-visible rounded-[22px] transition-all duration-200 " +
                        (isSelected ? "z-20 " : "") +
                        (isMatchedNow ? "z-30 " : "") +
                        (isDragTarget ? "z-20 " : "") +
                        (isHint
                          ? "animate-[m3_hint_pulse_1.15s_ease-in-out_infinite] "
                          : "") +
                        (isInvalidA || isInvalidB
                          ? "animate-[m3_invalid_0.15s_ease-in-out_1] "
                          : "") +
                        (busy ? "pointer-events-none" : "")
                      }
                    >
                      <div
                        className="absolute inset-0 z-[2]"
                        style={{
                          transform: `translate3d(${moveX}px, ${moveY}px, 0) ${
                            dragVisual.active && isDragSource
                              ? "scale(1.012)"
                              : isDragTarget
                              ? "scale(1.004)"
                              : "scale(1)"
                          }`,
transition:
  dragVisual.active && isDragSource
    ? "transform 0s linear"
    : dragVisual.active && isDragTarget
    ? "transform 160ms cubic-bezier(0.16,1,0.3,1)"
    : "transform 180ms cubic-bezier(0.16,1,0.3,1)",
                          willChange: "transform",
                          transformOrigin: "center center",
                          backfaceVisibility: "hidden",
                          WebkitBackfaceVisibility: "hidden",
                          perspective: "1000px",
                          contain: "layout style paint",
                        }}
                      >
                        <div
                          className="absolute inset-0"
                          style={{
animation: tileAnimation
  ? `${tileAnimation} ${tileDuration} ${tileTiming} ${
      !isFalling &&
      !isMatchedNow &&
      !isSpawnedNow &&
      (cell.power === "bomb" || cell.power === "nuke")
        ? "infinite"
        : "forwards"
    }`
  : undefined,
                            transition:
                              "filter 180ms ease-out, opacity 160ms ease-out, transform 120ms ease-out",
                            willChange: "opacity, filter, transform",
filter: isMatchedNow
  ? "brightness(1.03) saturate(1.03)"
  : isFalling
  ? "none"
  : isDragTarget
  ? "brightness(1.02) saturate(1.01)"
  : dragVisual.active && isDragSource
  ? "brightness(1.03) saturate(1.03)"
  : "none",
                            opacity: isMatchedNow ? 0 : 1,
                            ["--fall-start" as string]: `${Math.max(
                              30,
                              fallOffsetRows * (cellSizePxRef.current || 44) * 0.9
                            )}px`,
                          }}
                        >
                          <div
                            className="pointer-events-none absolute inset-[4%] rounded-[20px]"
                            style={{
                              background: isDragTarget
                                ? "radial-gradient(circle at 50% 50%, rgba(125,211,252,0.09), rgba(125,211,252,0.00) 64%)"
                                : "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.05), transparent 48%)",
                            }}
                          />

                          {isSpawnedNow ? (
                            <>
                              <div
                                className="pointer-events-none absolute inset-[2%] z-[1] rounded-full"
                                style={{
                                  background:
                                    cell.power === "nuke"
                                      ? "radial-gradient(circle, rgba(255,252,220,0.40) 0%, rgba(255,216,110,0.28) 32%, rgba(255,132,26,0.14) 58%, rgba(255,132,26,0) 100%)"
                                      : "radial-gradient(circle, rgba(230,255,240,0.36) 0%, rgba(110,255,170,0.24) 28%, rgba(34,197,94,0.14) 52%, rgba(34,197,94,0) 100%)",
                                  boxShadow:
                                    cell.power === "nuke"
                                      ? "0 0 18px rgba(255,230,140,0.22), 0 0 36px rgba(255,150,40,0.16)"
                                      : "0 0 14px rgba(180,255,210,0.22), 0 0 28px rgba(34,197,94,0.16)",
                                  animation: "m3_bomb_flash 220ms cubic-bezier(0.22,1,0.36,1)",
                                }}
                              />
                              <div
                                className="pointer-events-none absolute inset-[10%] z-[1] rounded-full"
                                style={{
                                  border:
                                    cell.power === "nuke"
                                      ? "1.5px solid rgba(255,233,160,0.24)"
                                      : "1.5px solid rgba(160,255,200,0.30)",
                                  boxShadow:
                                    cell.power === "nuke"
                                      ? "0 0 16px rgba(255,210,110,0.12), inset 0 0 12px rgba(255,210,110,0.08)"
                                      : "0 0 16px rgba(120,255,180,0.12), inset 0 0 12px rgba(120,255,180,0.08)",
                                  animation: "m3_match_glow_fade 220ms cubic-bezier(0.22,1,0.36,1)",
                                }}
                              />
                            </>
                          ) : null}

<div
  className={`absolute inset-[1%] z-[2] ${
    cell.power ? gemTileGlowClass(cell) : ""
  }`}
  style={{
    filter: isFalling
      ? "none"
      : isDragTarget
      ? "drop-shadow(0 0 6px rgba(125,211,252,0.14))"
      : undefined,
    transform: "scale(1)",
    opacity: isMatchedNow ? 0 : 1,
  }}
>
  {isMatchedNow ? null : renderGemFace(cell)}
</div>

                          <div className="pointer-events-none absolute inset-[6%] z-[3] rounded-[18px] bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.16),transparent_24%),radial-gradient(circle_at_72%_76%,rgba(255,255,255,0.05),transparent_18%)]" />
                        </div>

                        {isMatchedNow ? (
                          <div className="pointer-events-none absolute inset-0 z-[5]">
{Array.from({
  length:
    cell.power === "nuke"
      ? 42
      : cell.power === "bomb"
      ? 26
      : 14,
}).map((_, i) => {
                              const total =
                                cell.power === "nuke"
                                  ? 64
                                  : cell.power === "bomb"
                                  ? 42
                                  : 28;

                              const noise = ((row * 17 + col * 11 + i * 7) % 17) / 17;
                              const angle =
                                (Math.PI * 2 * i) / total +
                                (((row * 17 + col * 11) % 9) * Math.PI) / 24 +
                                noise * 0.42;

                              const radius =
                                cell.power === "nuke"
                                  ? 16 + (i % 6) * 5 + noise * 11
                                  : cell.power === "bomb"
                                  ? 11 + (i % 5) * 4 + noise * 8
                                  : 8 + (i % 4) * 3 + noise * 5;

                              const x = Math.cos(angle) * radius;
                              const y = Math.sin(angle) * radius;

                              const size =
                                cell.power === "nuke"
                                  ? i % 7 === 0
                                    ? 7
                                    : i % 3 === 0
                                    ? 5
                                    : 3.2
                                  : cell.power === "bomb"
                                  ? i % 6 === 0
                                    ? 6
                                    : i % 3 === 0
                                    ? 4.2
                                    : 2.8
                                  : i % 5 === 0
                                  ? 4.4
                                  : i % 2 === 0
                                  ? 3.1
                                  : 2.2;

                              const color =
                                fragmentPalette[i % fragmentPalette.length];

                              const shape = i % 6;
                              const width =
                                shape === 0
                                  ? size * 1.9
                                  : shape === 1
                                  ? size
                                  : shape === 2
                                  ? size * 1.3
                                  : shape === 3
                                  ? size * 0.9
                                  : shape === 4
                                  ? size * 1.5
                                  : size;

                              const height =
                                shape === 0
                                  ? Math.max(2, size * 0.34)
                                  : shape === 1
                                  ? size * 1.7
                                  : shape === 2
                                  ? size * 1.3
                                  : shape === 3
                                  ? size * 0.9
                                  : shape === 4
                                  ? size * 0.5
                                  : size;

                              const borderRadius =
                                shape === 0
                                  ? 9999
                                  : shape === 1
                                  ? 9999
                                  : shape === 2
                                  ? 2
                                  : shape === 3
                                  ? "50% 35% 60% 40%"
                                  : shape === 4
                                  ? 1.5
                                  : 9999;

                              const rotationDeg =
                                i * 29 + ((row * 13 + col * 19) % 27);

                              return (
                                <div
                                  key={`frag-${cell.id}-${i}`}
                                  className="absolute"
                                  style={{
                                    left: "50%",
                                    top: "50%",
                                    width,
                                    height,
                                    marginLeft: -width / 2,
                                    marginTop: -height / 2,
                                    borderRadius,
                                    background:
                                      shape === 4
                                        ? `linear-gradient(90deg, ${color}, rgba(255,255,255,0.92), ${color})`
                                        : color,
boxShadow:
  shape === 4
    ? `0 0 6px ${color}`
    : `0 0 4px ${color}`,
                                    opacity: 0,
                                    transform: `rotate(${rotationDeg}deg)`,
                                    ["--frag-x" as string]: `${x}px`,
                                    ["--frag-y" as string]: `${y}px`,
                                    ["--frag-rot" as string]: `${
                                      rotationDeg + 90 + (i % 5) * 18
                                    }deg`,
animation: `m3_fragment_burst ${
  cell.power === "nuke"
    ? "520ms"
    : cell.power === "bomb"
    ? "430ms"
    : "360ms"
} cubic-bezier(0.22,1,0.36,1) ${
  i % 8 === 0 ? "16ms" : "0ms"
} forwards`,
                                  }}
                                />
                              );
                            })}
                          </div>
                        ) : null}

                        {isDragTarget ? (
                          <div
                            className="pointer-events-none absolute inset-[3%] z-[4] rounded-[20px]"
                            style={{
                              background:
                                "radial-gradient(circle, rgba(125,211,252,0.08), transparent 68%)",
                              transition:
                                "opacity 120ms ease-out, transform 120ms ease-out",
                              transform: "scale(0.985)",
                            }}
                          />
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {superComboFx?.active ? (
              <div className="pointer-events-none absolute inset-0 z-[78]">
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {(() => {
                    const fromX = ((superComboFx.from.col + 0.5) / SIZE) * 100;
                    const fromY = ((superComboFx.from.row + 0.5) / SIZE) * 100;
                    const toX = ((superComboFx.to.col + 0.5) / SIZE) * 100;
                    const toY = ((superComboFx.to.row + 0.5) / SIZE) * 100;

                    const dx = toX - fromX;
                    const dy = toY - fromY;
                    const midX = (fromX + toX) / 2;
                    const midY = (fromY + toY) / 2;

                    const curveLift =
                      superComboFx.phase === "pull"
                        ? 4
                        : superComboFx.phase === "merge"
                        ? 7
                        : 2;

                    const c1x = fromX + dx * 0.28;
                    const c1y = fromY + dy * 0.18 - curveLift;
                    const c2x = toX - dx * 0.28;
                    const c2y = toY - dy * 0.18 - curveLift;

                    const beamOpacity =
                      superComboFx.phase === "pull"
                        ? 0.82
                        : superComboFx.phase === "merge"
                        ? 0.98
                        : 1;

                    const beamWidth =
                      superComboFx.phase === "pull"
                        ? 2.4
                        : superComboFx.phase === "merge"
                        ? 3.8
                        : 5.8;

                    const fromRadius =
                      superComboFx.phase === "pull"
                        ? 5.2
                        : superComboFx.phase === "merge"
                        ? 7.2
                        : 10.8;

                    const toRadius =
                      superComboFx.phase === "pull"
                        ? 6.2
                        : superComboFx.phase === "merge"
                        ? 8.8
                        : 12.6;

                    const midRadius =
                      superComboFx.phase === "pull"
                        ? 3.4
                        : superComboFx.phase === "merge"
                        ? 6.6
                        : 12.4;

                    const midOpacity =
                      superComboFx.phase === "pull"
                        ? 0.36
                        : superComboFx.phase === "merge"
                        ? 0.78
                        : 0.98;

                    return (
                      <>
                        <defs>
                          <linearGradient
                            id="m3-supercombo-beam"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="0%"
                          >
                            <stop offset="0%" stopColor="rgba(120,255,180,0.00)" />
                            <stop offset="18%" stopColor="rgba(120,255,180,0.82)" />
                            <stop offset="50%" stopColor="rgba(255,255,210,0.98)" />
                            <stop offset="82%" stopColor="rgba(255,210,120,0.86)" />
                            <stop offset="100%" stopColor="rgba(255,210,120,0.00)" />
                          </linearGradient>

                          <radialGradient id="m3-supercombo-core" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="rgba(255,255,255,1)" />
                            <stop offset="24%" stopColor="rgba(210,255,228,0.94)" />
                            <stop offset="56%" stopColor="rgba(120,255,180,0.36)" />
                            <stop offset="100%" stopColor="rgba(120,255,180,0)" />
                          </radialGradient>

                          <radialGradient
                            id="m3-supercombo-core-warm"
                            cx="50%"
                            cy="50%"
                            r="50%"
                          >
                            <stop offset="0%" stopColor="rgba(255,255,255,1)" />
                            <stop offset="24%" stopColor="rgba(255,245,190,0.96)" />
                            <stop offset="56%" stopColor="rgba(255,175,72,0.42)" />
                            <stop offset="100%" stopColor="rgba(255,175,72,0)" />
                          </radialGradient>
                        </defs>

                        <path
                          d={`M ${fromX} ${fromY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${toX} ${toY}`}
                          fill="none"
                          stroke="rgba(255,255,255,0.18)"
                          strokeWidth={beamWidth + 2.2}
                          strokeLinecap="round"
                          opacity={beamOpacity * 0.52}
                        />

                        <path
                          d={`M ${fromX} ${fromY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${toX} ${toY}`}
                          fill="none"
                          stroke="url(#m3-supercombo-beam)"
                          strokeWidth={beamWidth}
                          strokeLinecap="round"
                          opacity={beamOpacity}
                        />

                        <circle
                          cx={fromX}
                          cy={fromY}
                          r={fromRadius}
                          fill="url(#m3-supercombo-core)"
                          opacity={superComboFx.phase === "detonate" ? 1 : 0.92}
                        />

                        <circle
                          cx={toX}
                          cy={toY}
                          r={toRadius}
                          fill="url(#m3-supercombo-core-warm)"
                          opacity={superComboFx.phase === "detonate" ? 1 : 0.94}
                        />

                        <circle
                          cx={midX}
                          cy={midY}
                          r={midRadius}
                          fill="rgba(255,255,255,0.92)"
                          opacity={midOpacity}
                        />
                      </>
                    );
                  })()}
                </svg>

                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      superComboFx.phase === "pull"
                        ? "radial-gradient(circle at 50% 50%, rgba(120,255,180,0.06), rgba(120,255,180,0.00) 40%)"
                        : superComboFx.phase === "merge"
                        ? "radial-gradient(circle at 50% 50%, rgba(255,245,190,0.10), rgba(120,255,180,0.05) 24%, rgba(120,255,180,0.00) 46%)"
                        : "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.14), rgba(255,230,150,0.10) 20%, rgba(255,160,72,0.05) 34%, rgba(255,160,72,0.00) 58%)",
                    opacity: superComboFx.phase === "detonate" ? 0.92 : 0.86,
                    transition: "all 140ms ease-out",
                  }}
                />
              </div>
            ) : null}

            {omegaBursts.length > 0 ? (
              <div className="pointer-events-none absolute inset-0 z-[79]">
                {omegaBursts.map((burst, i) => {
                  const sizePx =
                    burst.size === "lg" ? 74 : burst.size === "md" ? 54 : 34;

                  const corePx =
                    burst.size === "lg" ? 20 : burst.size === "md" ? 14 : 10;

                  const ringPx =
                    burst.size === "lg" ? 94 : burst.size === "md" ? 68 : 44;

                  const isMega = burst.palette === "mega";

                  return (
                    <React.Fragment
                      key={`omega-burst-${burst.row}-${burst.col}-${i}`}
                    >
                      <div
                        className="absolute rounded-full"
                        style={{
                          left: `calc(${((burst.col + 0.5) / SIZE) * 100}% - ${
                            ringPx / 2
                          }px)`,
                          top: `calc(${((burst.row + 0.5) / SIZE) * 100}% - ${
                            ringPx / 2
                          }px)`,
                          width: ringPx,
                          height: ringPx,
                          borderRadius: 9999,
                          border: isMega
                            ? burst.size === "lg"
                              ? "2px solid rgba(170,255,210,0.22)"
                              : "1.5px solid rgba(170,255,210,0.16)"
                            : burst.size === "lg"
                            ? "2px solid rgba(255,232,150,0.22)"
                            : "1.5px solid rgba(255,232,150,0.16)",
                          boxShadow: isMega
                            ? burst.size === "lg"
                              ? "0 0 22px rgba(140,255,190,0.16), inset 0 0 18px rgba(140,255,190,0.08)"
                              : "0 0 14px rgba(140,255,190,0.10), inset 0 0 12px rgba(140,255,190,0.05)"
                            : burst.size === "lg"
                            ? "0 0 22px rgba(255,220,120,0.16), inset 0 0 18px rgba(255,220,120,0.08)"
                            : "0 0 14px rgba(255,220,120,0.10), inset 0 0 12px rgba(255,220,120,0.05)",
                          animation: `m3_bomb_flash 0.48s cubic-bezier(0.22,1,0.36,1) ${burst.delayMs}ms both`,
                        }}
                      />

                      <div
                        className="absolute rounded-full"
                        style={{
                          left: `calc(${((burst.col + 0.5) / SIZE) * 100}% - ${
                            sizePx / 2
                          }px)`,
                          top: `calc(${((burst.row + 0.5) / SIZE) * 100}% - ${
                            sizePx / 2
                          }px)`,
                          width: sizePx,
                          height: sizePx,
                          borderRadius: 9999,
                          background: isMega
                            ? burst.size === "lg"
                              ? "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(226,255,238,0.98) 16%, rgba(140,255,190,0.86) 34%, rgba(34,197,94,0.38) 56%, rgba(34,197,94,0.10) 76%, rgba(34,197,94,0) 100%)"
                              : "radial-gradient(circle, rgba(255,255,255,0.98) 0%, rgba(220,255,234,0.94) 18%, rgba(120,255,180,0.58) 42%, rgba(34,197,94,0.18) 68%, rgba(34,197,94,0) 100%)"
                            : burst.size === "lg"
                            ? "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,244,190,0.98) 14%, rgba(255,205,96,0.88) 32%, rgba(255,140,38,0.42) 54%, rgba(255,96,24,0.12) 76%, rgba(255,96,24,0) 100%)"
                            : "radial-gradient(circle, rgba(255,255,255,0.98) 0%, rgba(255,235,160,0.94) 18%, rgba(255,168,68,0.62) 42%, rgba(255,96,24,0.20) 68%, rgba(255,96,24,0) 100%)",
                          boxShadow: isMega
                            ? burst.size === "lg"
                              ? "0 0 26px rgba(255,255,255,0.30), 0 0 54px rgba(120,255,180,0.28), 0 0 88px rgba(34,197,94,0.18)"
                              : burst.size === "md"
                              ? "0 0 18px rgba(255,255,255,0.24), 0 0 38px rgba(120,255,180,0.22), 0 0 60px rgba(34,197,94,0.14)"
                              : "0 0 12px rgba(255,255,255,0.20), 0 0 22px rgba(120,255,180,0.16), 0 0 34px rgba(34,197,94,0.10)"
                            : burst.size === "lg"
                            ? "0 0 28px rgba(255,255,255,0.34), 0 0 64px rgba(255,188,72,0.34), 0 0 110px rgba(255,96,24,0.22)"
                            : burst.size === "md"
                            ? "0 0 20px rgba(255,255,255,0.28), 0 0 44px rgba(255,188,72,0.24), 0 0 70px rgba(255,96,24,0.16)"
                            : "0 0 12px rgba(255,255,255,0.22), 0 0 26px rgba(255,188,72,0.18), 0 0 42px rgba(255,96,24,0.10)",
                          animation: `m3_bomb_flash 0.44s cubic-bezier(0.22,1,0.36,1) ${burst.delayMs}ms both`,
                        }}
                      />

                      <div
                        className="absolute rounded-full"
                        style={{
                          left: `calc(${((burst.col + 0.5) / SIZE) * 100}% - ${
                            corePx / 2
                          }px)`,
                          top: `calc(${((burst.row + 0.5) / SIZE) * 100}% - ${
                            corePx / 2
                          }px)`,
                          width: corePx,
                          height: corePx,
                          borderRadius: 9999,
                          background: isMega
                            ? "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(228,255,240,0.98) 46%, rgba(120,255,180,0) 100%)"
                            : "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,246,196,0.98) 46%, rgba(255,180,80,0) 100%)",
                          boxShadow: isMega
                            ? "0 0 12px rgba(255,255,255,0.34), 0 0 20px rgba(120,255,180,0.22)"
                            : "0 0 12px rgba(255,255,255,0.38), 0 0 24px rgba(255,210,110,0.24)",
                          animation: `m3_bomb_flash 0.34s cubic-bezier(0.22,1,0.36,1) ${burst.delayMs}ms both`,
                        }}
                      />
                    </React.Fragment>
                  );
                })}
              </div>
            ) : null}

            {powerSpawnFx?.active ? (
              <div className="pointer-events-none absolute inset-0 z-[79]">
                <div
                  className="absolute rounded-full"
                  style={{
                    left: `calc(${((powerSpawnFx.col + 0.5) / SIZE) * 100}% - ${
                      powerSpawnFx.power === "nuke" ? 44 : 32
                    }px)`,
                    top: `calc(${((powerSpawnFx.row + 0.5) / SIZE) * 100}% - ${
                      powerSpawnFx.power === "nuke" ? 44 : 32
                    }px)`,
                    width: powerSpawnFx.power === "nuke" ? 88 : 64,
                    height: powerSpawnFx.power === "nuke" ? 88 : 64,
                    borderRadius: 9999,
                    background:
                      powerSpawnFx.power === "nuke"
                        ? "radial-gradient(circle, rgba(255,252,220,0.98) 0%, rgba(255,224,130,0.92) 22%, rgba(255,160,60,0.56) 52%, rgba(255,110,20,0.00) 100%)"
                        : "radial-gradient(circle, rgba(238,255,244,0.98) 0%, rgba(150,255,194,0.94) 26%, rgba(34,197,94,0.66) 56%, rgba(34,197,94,0.00) 100%)",
                    boxShadow:
                      powerSpawnFx.power === "nuke"
                        ? "0 0 22px rgba(255,225,150,0.30), 0 0 48px rgba(255,150,40,0.22), 0 0 74px rgba(255,120,30,0.12)"
                        : "0 0 16px rgba(190,255,215,0.32), 0 0 34px rgba(34,197,94,0.24), 0 0 52px rgba(34,197,94,0.12)",
                    animation: "m3_bomb_ignite 0.2s ease-out",
                  }}
                />

                <div
                  className="absolute rounded-full"
                  style={{
                    left: `calc(${((powerSpawnFx.col + 0.5) / SIZE) * 100}% - ${
                      powerSpawnFx.power === "nuke" ? 20 : 13
                    }px)`,
                    top: `calc(${((powerSpawnFx.row + 0.5) / SIZE) * 100}% - ${
                      powerSpawnFx.power === "nuke" ? 20 : 13
                    }px)`,
                    width: powerSpawnFx.power === "nuke" ? 40 : 26,
                    height: powerSpawnFx.power === "nuke" ? 40 : 26,
                    borderRadius: 9999,
                    background:
                      "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(220,255,232,0.76) 40%, rgba(34,197,94,0.00) 100%)",
                    filter: "blur(0.4px)",
                    animation: "m3_bomb_ignite 0.18s ease-out",
                  }}
                />

                <div
                  className="absolute rounded-full"
                  style={{
                    left: `calc(${((powerSpawnFx.col + 0.5) / SIZE) * 100}% - ${
                      powerSpawnFx.power === "nuke" ? 54 : 38
                    }px)`,
                    top: `calc(${((powerSpawnFx.row + 0.5) / SIZE) * 100}% - ${
                      powerSpawnFx.power === "nuke" ? 54 : 38
                    }px)`,
                    width: powerSpawnFx.power === "nuke" ? 108 : 76,
                    height: powerSpawnFx.power === "nuke" ? 108 : 76,
                    borderRadius: 9999,
                    border:
                      powerSpawnFx.power === "nuke"
                        ? "2px solid rgba(255,232,160,0.18)"
                        : "1.5px solid rgba(170,255,210,0.16)",
                    boxShadow:
                      powerSpawnFx.power === "nuke"
                        ? "0 0 18px rgba(255,220,120,0.10), inset 0 0 12px rgba(255,220,120,0.06)"
                        : "0 0 18px rgba(120,255,180,0.10), inset 0 0 12px rgba(120,255,180,0.06)",
                    animation: "m3_bomb_flash 0.22s ease-out",
                  }}
                />
              </div>
            ) : null}

            {bombFx?.active ? (
              <div className="pointer-events-none absolute inset-0 z-[80]">
                <div
                  className="absolute rounded-full"
                  style={{
                    left: `calc(${((bombFx.col + 0.5) / SIZE) * 100}% - ${
                      bombFx.power === "nuke"
                        ? bombFx.phase === "ignite"
                          ? 26
                          : 46
                        : bombFx.phase === "ignite"
                        ? 18
                        : 32
                    }px)`,
                    top: `calc(${((bombFx.row + 0.5) / SIZE) * 100}% - ${
                      bombFx.power === "nuke"
                        ? bombFx.phase === "ignite"
                          ? 26
                          : 46
                        : bombFx.phase === "ignite"
                        ? 18
                        : 32
                    }px)`,
                    width:
                      bombFx.power === "nuke"
                        ? bombFx.phase === "ignite"
                          ? 52
                          : 92
                        : bombFx.phase === "ignite"
                        ? 36
                        : 64,
                    height:
                      bombFx.power === "nuke"
                        ? bombFx.phase === "ignite"
                          ? 52
                          : 92
                        : bombFx.phase === "ignite"
                        ? 36
                        : 64,
                    borderRadius: 9999,
background:
  bombFx.phase === "ignite"
    ? bombFx.power === "nuke"
      ? "radial-gradient(circle, rgba(255,252,220,1) 0%, rgba(255,228,130,0.94) 38%, rgba(255,160,40,0.16) 100%)"
      : "radial-gradient(circle, rgba(245,255,250,0.98) 0%, rgba(150,255,205,0.90) 38%, rgba(34,197,94,0.14) 100%)"
    : bombFx.power === "nuke"
    ? "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,240,170,0.96) 14%, rgba(255,196,92,0.88) 28%, rgba(255,132,34,0.52) 52%, rgba(255,84,18,0.18) 76%, rgba(255,84,18,0) 100%)"
    : "radial-gradient(circle, rgba(255,255,255,0.98) 0%, rgba(210,255,232,0.92) 18%, rgba(120,255,180,0.66) 38%, rgba(34,197,94,0.28) 66%, rgba(34,197,94,0) 100%)",
boxShadow:
  bombFx.phase === "ignite"
    ? bombFx.power === "nuke"
      ? "0 0 18px rgba(255,230,140,0.22), 0 0 34px rgba(255,170,50,0.10)"
      : "0 0 14px rgba(150,255,205,0.18), 0 0 24px rgba(34,197,94,0.08)"
    : bombFx.power === "nuke"
    ? "0 0 30px rgba(255,245,190,0.32), 0 0 62px rgba(255,170,48,0.22), 0 0 92px rgba(255,92,20,0.12)"
    : "0 0 20px rgba(210,255,232,0.22), 0 0 38px rgba(80,230,140,0.16), 0 0 56px rgba(34,197,94,0.08)",
animation:
  bombFx.phase === "ignite"
    ? "m3_bomb_ignite 0.14s ease-out"
    : "m3_bomb_core 0.22s cubic-bezier(0.22,1,0.36,1) forwards",
                  }}
                />

                {bombFx.phase === "blast" ? (
                  <div
                    className="absolute rounded-full"
                    style={{
                      left: `calc(${((bombFx.col + 0.5) / SIZE) * 100}% - ${
                        bombFx.power === "nuke" ? 78 : 50
                      }px)`,
                      top: `calc(${((bombFx.row + 0.5) / SIZE) * 100}% - ${
                        bombFx.power === "nuke" ? 78 : 50
                      }px)`,
                      width: bombFx.power === "nuke" ? 156 : 100,
                      height: bombFx.power === "nuke" ? 156 : 100,
                      borderRadius: 9999,
                      border:
                        bombFx.power === "nuke"
                          ? "2px solid rgba(255,224,140,0.20)"
                          : "1.5px solid rgba(180,255,220,0.18)",
                      boxShadow:
                        bombFx.power === "nuke"
                          ? "0 0 20px rgba(255,220,120,0.16), inset 0 0 18px rgba(255,220,120,0.08)"
                          : "0 0 16px rgba(180,255,220,0.12), inset 0 0 14px rgba(180,255,220,0.06)",
                      animation: "m3_bomb_flash 0.18s ease-out",
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.04))] p-3 backdrop-blur">
            <div className="rounded-2xl bg-black/18 px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/54">
                Moves
              </div>
              <div className="mt-1 text-2xl font-black text-white">{movesLeft}</div>
            </div>

            <div className="rounded-2xl bg-black/18 px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/54">
                Clear
              </div>
              <div className="mt-1 text-2xl font-black text-white">
                {lastClear || "—"}
              </div>
            </div>

            <div className="rounded-2xl bg-black/18 px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/54">
                Streak
              </div>
              <div className="mt-1 text-2xl font-black text-white">
                {streak || "—"}
              </div>
            </div>
          </div>

          {(phase === "won" || phase === "lost") && (
            <div className="mt-5 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(0,0,0,0.35))] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur">
              <div className="text-center text-3xl font-extrabold">
                {phase === "won" ? "Sweet Victory!" : "Round finished"}
              </div>

              <div className="mt-2 text-center text-sm text-white/66">
                {phase === "won"
                  ? "You crushed the crystal goal."
                  : "You used all moves. Try a cleaner chain next run."}
              </div>

              <div className="mt-4 space-y-3 text-base">
                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <span>Total Score</span>
                  <span className="font-extrabold">{score}</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <span>Moves Left</span>
                  <span className="font-extrabold">{movesLeft}</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <span>Best Cascade</span>
                  <span className="font-extrabold">{cascade || 1}</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <span>Best Streak</span>
                  <span className="font-extrabold">{streak || 1}</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={restart}
                  className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-black"
                >
                  Play again
                </button>

                <Link
                  href={returnTo}
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center text-sm font-semibold text-white"
                >
                  Back
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
// ===== FILE END: apps/web/components/game/Match3RushRuntime.tsx =====