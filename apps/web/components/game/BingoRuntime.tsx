// ===== FILE START: apps/web/components/game/BingoRuntime.tsx =====
"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { getGameMeta } from "@/lib/games/registry";
import { getGameConfig } from "@/lib/games/catalog";
import { commitRun } from "@/lib/core/commitRun";

type BingoLetter = "B" | "I" | "N" | "G" | "O";

type BingoCell = {
  row: number;
  col: number;
  letter: BingoLetter;
  number: number | null;
  marked: boolean;
  free?: boolean;
  justMarked?: boolean;
  wrongFlash?: boolean;
};

type CalledBall = {
  letter: BingoLetter;
  number: number;
};

type Phase = "intro" | "countdown" | "playing" | "won" | "lost" | "paused";

const LETTERS: BingoLetter[] = ["B", "I", "N", "G", "O"];

const COLUMN_RANGES: Record<BingoLetter, [number, number]> = {
  B: [1, 15],
  I: [16, 30],
  N: [31, 45],
  G: [46, 60],
  O: [61, 75],
};

const TURN_MS = 3600;
const START_COUNTDOWN_MS = 1100;
const MAX_CALLED_VISIBLE = 5;
const EASY_TURNS = 2;
const HIT_CHANCE_AFTER_EASY = 0.2;

function ballKey(ball: CalledBall) {
  return `${ball.letter}-${ball.number}`;
}

function randomUniqueNumbers(min: number, max: number, count: number) {
  const arr: number[] = [];
  for (let i = min; i <= max; i += 1) arr.push(i);

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }

  return arr.slice(0, count).sort((a, b) => a - b);
}

function buildBoard(): BingoCell[][] {
  const cols = LETTERS.map((letter) => {
    const [min, max] = COLUMN_RANGES[letter];
    return randomUniqueNumbers(min, max, 5);
  });

  const board: BingoCell[][] = [];

  for (let row = 0; row < 5; row += 1) {
    const line: BingoCell[] = [];

    for (let col = 0; col < 5; col += 1) {
      const letter = LETTERS[col];

      if (row === 2 && col === 2) {
        line.push({
          row,
          col,
          letter,
          number: null,
          marked: true,
          free: true,
        });
      } else {
        line.push({
          row,
          col,
          letter,
          number: cols[col][row],
          marked: false,
        });
      }
    }

    board.push(line);
  }

  return board;
}

function buildFullBallPool(): CalledBall[] {
  const items: CalledBall[] = [];

  for (const letter of LETTERS) {
    const [min, max] = COLUMN_RANGES[letter];
    for (let n = min; n <= max; n += 1) {
      items.push({ letter, number: n });
    }
  }

  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }

  return items;
}

function getUnmarkedBoardBalls(board: BingoCell[][]): CalledBall[] {
  const items: CalledBall[] = [];

  for (const row of board) {
    for (const cell of row) {
      if (!cell.free && !cell.marked && cell.number !== null) {
        items.push({
          letter: cell.letter,
          number: cell.number,
        });
      }
    }
  }

  return items;
}

function boardHasBall(board: BingoCell[][], ball: CalledBall | null) {
  if (!ball) return false;

  for (const row of board) {
    for (const cell of row) {
      if (
        !cell.free &&
        !cell.marked &&
        cell.letter === ball.letter &&
        cell.number === ball.number
      ) {
        return true;
      }
    }
  }

  return false;
}

function takeSpecificBallFromPool(pool: CalledBall[], target: CalledBall) {
  const key = ballKey(target);
  const idx = pool.findIndex((b) => ballKey(b) === key);

  if (idx === -1) return null;

  const next = pool.slice();
  const [picked] = next.splice(idx, 1);

  return {
    picked,
    rest: next,
  };
}

function takeRandomHelpfulBall(pool: CalledBall[], board: BingoCell[][]) {
  const candidates = getUnmarkedBoardBalls(board).filter((ball) =>
    pool.some((p) => ballKey(p) === ballKey(ball))
  );

  if (!candidates.length) return null;

  const pickedCandidate =
    candidates[Math.floor(Math.random() * candidates.length)];

  return takeSpecificBallFromPool(pool, pickedCandidate);
}

function takeNextBallFromPool(
  pool: CalledBall[],
  board: BingoCell[][],
  turn: number
) {
  if (!pool.length) return null;

  if (turn < EASY_TURNS) {
    const helpful = takeRandomHelpfulBall(pool, board);
    if (helpful) return helpful;
  } else {
    if (Math.random() < HIT_CHANCE_AFTER_EASY) {
      const helpful = takeRandomHelpfulBall(pool, board);
      if (helpful) return helpful;
    }
  }

  return {
    picked: pool[0],
    rest: pool.slice(1),
  };
}

function hasWinningLine(board: BingoCell[][]) {
  for (let row = 0; row < 5; row += 1) {
    let ok = true;
    for (let col = 0; col < 5; col += 1) {
      if (!board[row][col].marked) ok = false;
    }
    if (ok) return true;
  }

  for (let col = 0; col < 5; col += 1) {
    let ok = true;
    for (let row = 0; row < 5; row += 1) {
      if (!board[row][col].marked) ok = false;
    }
    if (ok) return true;
  }

  let diag1 = true;
  for (let i = 0; i < 5; i += 1) {
    if (!board[i][i].marked) diag1 = false;
  }
  if (diag1) return true;

  let diag2 = true;
  for (let i = 0; i < 5; i += 1) {
    if (!board[i][4 - i].marked) diag2 = false;
  }
  if (diag2) return true;

  return false;
}

function countWinningLines(board: BingoCell[][]) {
  let total = 0;

  for (let row = 0; row < 5; row += 1) {
    let ok = true;
    for (let col = 0; col < 5; col += 1) {
      if (!board[row][col].marked) ok = false;
    }
    if (ok) total += 1;
  }

  for (let col = 0; col < 5; col += 1) {
    let ok = true;
    for (let row = 0; row < 5; row += 1) {
      if (!board[row][col].marked) ok = false;
    }
    if (ok) total += 1;
  }

  let diag1 = true;
  for (let i = 0; i < 5; i += 1) {
    if (!board[i][i].marked) diag1 = false;
  }
  if (diag1) total += 1;

  let diag2 = true;
  for (let i = 0; i < 5; i += 1) {
    if (!board[i][4 - i].marked) diag2 = false;
  }
  if (diag2) total += 1;

  return total;
}

function boardScore(board: BingoCell[][], lines: number) {
  let marked = 0;

  for (const row of board) {
    for (const cell of row) {
      if (cell.marked) marked += 1;
    }
  }

  const markedScore = Math.max(0, marked - 1) * 100;
  const bingoScore = lines * 1000;

  return markedScore + bingoScore;
}

function letterBg(letter: BingoLetter) {
  switch (letter) {
    case "B":
      return "bg-red-500";
    case "I":
      return "bg-green-500";
    case "N":
      return "bg-yellow-500";
    case "G":
      return "bg-sky-500";
    case "O":
      return "bg-fuchsia-500";
    default:
      return "bg-white/20";
  }
}

function letterRing(letter: BingoLetter) {
  switch (letter) {
    case "B":
      return "border-red-400";
    case "I":
      return "border-green-400";
    case "N":
      return "border-yellow-400";
    case "G":
      return "border-sky-400";
    case "O":
      return "border-fuchsia-400";
    default:
      return "border-white/30";
  }
}

function formatTenths(ms: number) {
  return (Math.max(0, ms) / 1000).toFixed(1);
}

type Props = {
  returnTo?: string;
};

export default function BingoRuntime({ returnTo: returnToProp }: Props) {
  const sp = useSearchParams();
  const meta = getGameMeta("bingo");
  const defaultReturnTo = meta.routes?.modesHref || "/games/bingo/modes";
  const returnTo = (returnToProp || sp.get("returnTo") || defaultReturnTo).trim();

  const mode = (sp.get("mode") || "warm-up").trim();
  const modeId = (sp.get("modeId") || "").trim();
  const entry = Number(sp.get("entry") || "0");
  const prize = Number(sp.get("prize") || "0");
  const currencyParam = (sp.get("currency") || "gems").trim().toLowerCase();
  const resultCurrency = currencyParam === "cash" ? "cash" : "gems";

  const gameConfig = getGameConfig("bingo");
  const resolvedModeMeta =
    gameConfig.modes.find((m) => m.id === modeId) ||
    gameConfig.modes.find((m) => m.mode === mode) ||
    null;

  const resolvedModeTitle = resolvedModeMeta?.title || mode;

  const committedRunRef = useRef(false);

  const [board, setBoard] = React.useState<BingoCell[][]>(() => buildBoard());
  const [currentBall, setCurrentBall] = React.useState<CalledBall | null>(null);
  const [hintBall, setHintBall] = React.useState<CalledBall | null>(null);
  const [calledBalls, setCalledBalls] = React.useState<CalledBall[]>([]);
  const [score, setScore] = React.useState(0);
  const [phase, setPhase] = React.useState<Phase>("intro");
  const [headline, setHeadline] = React.useState("Warm up");
  const [subline, setSubline] = React.useState("Press Play Now");
  const [turnEndsAt, setTurnEndsAt] = React.useState<number | null>(null);
  const [now, setNow] = React.useState(Date.now());
  const [bingoLines, setBingoLines] = React.useState(0);
  const [mistakes, setMistakes] = React.useState(0);
  const [turn, setTurn] = React.useState(0);

  const countdownRef = React.useRef<number | null>(null);
  const turnTimerRef = React.useRef<number | null>(null);
  const flashTimerRef = React.useRef<number | null>(null);

  const phaseRef = React.useRef<Phase>(phase);
  const currentBallRef = React.useRef<CalledBall | null>(currentBall);
  const boardRef = React.useRef<BingoCell[][]>(board);
  const calledBallsRef = React.useRef<CalledBall[]>(calledBalls);
  const fullPoolRef = React.useRef<CalledBall[]>(buildFullBallPool());
  const turnRef = React.useRef(0);

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  React.useEffect(() => {
    currentBallRef.current = currentBall;
  }, [currentBall]);

  React.useEffect(() => {
    boardRef.current = board;
  }, [board]);

  React.useEffect(() => {
    calledBallsRef.current = calledBalls;
  }, [calledBalls]);

  React.useEffect(() => {
    turnRef.current = turn;
  }, [turn]);

  React.useEffect(() => {
    return () => {
      if (countdownRef.current) window.clearTimeout(countdownRef.current);
      if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!(phase === "won" || phase === "lost")) return;
    if (committedRunRef.current) return;

    committedRunRef.current = true;

    const practicePrize =
      phase === "won"
        ? Math.max(120, Math.floor(score / 8))
        : Math.max(1, Math.floor(score / 30));

    commitRun({
      gameId: "bingo",
      title: `Bingo · ${resolvedModeTitle}`,
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
  }, [phase, score, resultCurrency, prize, mode, modeId, resolvedModeTitle]);

  const timeLeftMs = React.useMemo(() => {
    if (!turnEndsAt) return TURN_MS;
    return Math.max(0, turnEndsAt - now);
  }, [turnEndsAt, now]);

  function clearCellFx() {
    setBoard((prev) =>
      prev.map((row) =>
        row.map((cell) => ({
          ...cell,
          justMarked: false,
          wrongFlash: false,
        }))
      )
    );
  }

  function scheduleTurnTimeout() {
    if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current);

    const endsAt = Date.now() + TURN_MS;
    setTurnEndsAt(endsAt);

    turnTimerRef.current = window.setTimeout(() => {
      onTurnExpired();
    }, TURN_MS);
  }

  function drawNextBall(nextBoard?: BingoCell[][], nextTurn?: number) {
    const boardToUse = nextBoard ?? boardRef.current;
    const turnToUse = typeof nextTurn === "number" ? nextTurn : turnRef.current;

    const result = takeNextBallFromPool(
      fullPoolRef.current,
      boardToUse,
      turnToUse
    );

    if (!result) {
      setCurrentBall(null);
      setHintBall(null);
      setTurnEndsAt(null);
      setPhase("lost");
      setHeadline("Round over");
      setSubline("No more balls");
      return;
    }

    fullPoolRef.current = result.rest;
    setCurrentBall(result.picked);
    setHintBall(null);
    setCalledBalls((prev) => [result.picked, ...prev].slice(0, MAX_CALLED_VISIBLE));
    setPhase("playing");
    setHeadline(`${result.picked.letter}${result.picked.number}`);
    setSubline("Find and tap the matching cell");
    setTurn(turnToUse + 1);
    scheduleTurnTimeout();
  }

  function startGame() {
    committedRunRef.current = false;

    if (countdownRef.current) window.clearTimeout(countdownRef.current);
    if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);

    const freshBoard = buildBoard();
    const freshPool = buildFullBallPool();

    fullPoolRef.current = freshPool;
    turnRef.current = 0;

    setBoard(freshBoard);
    setCurrentBall(null);
    setHintBall(null);
    setCalledBalls([]);
    setScore(0);
    setBingoLines(0);
    setMistakes(0);
    setTurn(0);
    setTurnEndsAt(null);
    setPhase("countdown");
    setHeadline("GO!");
    setSubline("Get ready");

    countdownRef.current = window.setTimeout(() => {
      drawNextBall(freshBoard, 0);
    }, START_COUNTDOWN_MS);
  }

  function resumeGame() {
    if (phase !== "paused") return;
    setPhase("playing");
    setHeadline(currentBall ? `${currentBall.letter}${currentBall.number}` : "Bingo");
    setSubline("Find and tap the matching cell");
    scheduleTurnTimeout();
  }

  function onTurnExpired() {
    if (phaseRef.current !== "playing") return;

    const current = currentBallRef.current;
    const boardNow = boardRef.current;

    const shouldCountMiss = boardHasBall(boardNow, current);

    if (shouldCountMiss) {
      setMistakes((prev) => prev + 1);
      setHintBall(current);
      setHeadline("Missed");
      setSubline("You missed a valid ball");
    } else {
      setHeadline("Next");
      setSubline("No match on your board");
    }

    window.setTimeout(() => {
      drawNextBall(boardNow, turnRef.current);
    }, 450);
  }

  function flashWrongCell(rowIndex: number, colIndex: number) {
    setBoard((prev) =>
      prev.map((row) =>
        row.map((cell) =>
          cell.row === rowIndex && cell.col === colIndex
            ? { ...cell, wrongFlash: true }
            : cell
        )
      )
    );

    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => {
      setBoard((prev) =>
        prev.map((row) =>
          row.map((cell) => ({
            ...cell,
            wrongFlash: false,
          }))
        )
      );
    }, 260);
  }

  function findMatchingCalledBallForCell(
    cell: BingoCell,
    visibleBalls: CalledBall[]
  ) {
    if (cell.free || cell.marked || cell.number === null) return null;

    for (const ball of visibleBalls) {
      if (ball.letter === cell.letter && ball.number === cell.number) {
        return ball;
      }
    }

    return null;
  }

  function onCellClick(rowIndex: number, colIndex: number) {
    if (phase !== "playing") return;

    const cell = board[rowIndex][colIndex];
    const matchedBall = findMatchingCalledBallForCell(cell, calledBallsRef.current);

    if (!matchedBall) {
      flashWrongCell(rowIndex, colIndex);
      return;
    }

    const isCurrentBall =
      !!currentBall &&
      matchedBall.letter === currentBall.letter &&
      matchedBall.number === currentBall.number;

    const nextBoard = board.map((row) =>
      row.map((item) =>
        item.row === rowIndex && item.col === colIndex
          ? { ...item, marked: true, justMarked: true, wrongFlash: false }
          : { ...item, justMarked: false, wrongFlash: false }
      )
    );

    const nextScore = boardScore(nextBoard, countWinningLines(nextBoard));
    const lines = countWinningLines(nextBoard);

    setBoard(nextBoard);
    setHintBall(null);
    setBingoLines(lines);
    setScore(nextScore);

    if (hasWinningLine(nextBoard)) {
      if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current);
      setTurnEndsAt(null);
      setPhase("won");
      setHeadline("BINGO!");
      setSubline("You completed a line");
      return;
    }

    if (isCurrentBall) {
      if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current);

      window.setTimeout(() => {
        clearCellFx();
        drawNextBall(nextBoard, turnRef.current);
      }, 220);

      return;
    }

    window.setTimeout(() => {
      clearCellFx();
    }, 220);
  }

  function onBingoClick() {
    if (phase !== "playing") return;

    if (hasWinningLine(board)) {
      if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current);
      setTurnEndsAt(null);
      setPhase("won");
      setHeadline("BINGO!");
      setSubline("You completed a line");
      return;
    }

    setMistakes((prev) => prev + 1);
    setHeadline("Wrong Bingo");
    setSubline("Keep playing");
  }

  const progressPct = Math.min(100, (score / 2500) * 100);

  return (
    <main className="min-h-screen text-white">
      <div className="min-h-screen bg-[radial-gradient(1200px_700px_at_50%_-120px,rgba(255,255,255,0.18),transparent_55%),linear-gradient(180deg,#c026d3_0%,#7e22ce_45%,#4c1d95_100%)]">
        <div className="mx-auto flex min-h-screen max-w-md flex-col px-3 pb-24 pt-3">
          <div className="flex items-center justify-between">
            <Link
              href={returnTo}
              className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/10 text-xl"
            >
              ←
            </Link>

            <div className="text-center">
              <div className="text-sm font-semibold text-white/80">Bingo</div>
              <div className="text-4xl font-extrabold text-yellow-300 drop-shadow">
                {score}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (phase === "playing") {
                  if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current);
                  setPhase("paused");
                  setHeadline("Paused");
                  setSubline("Press Resume");
                  setTurnEndsAt(null);
                }
              }}
              className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/10 text-xl"
            >
              ⏸
            </button>
          </div>

          <div className="mt-4 rounded-[28px] border border-white/10 bg-white/10 p-4 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)] backdrop-blur">
            <div className="flex min-h-[80px] items-center justify-center overflow-hidden">
              {phase === "countdown" ? (
                <div className="text-6xl font-extrabold text-sky-200 drop-shadow-[0_0_18px_rgba(125,211,252,0.6)]">
                  GO!
                </div>
              ) : phase === "won" ? (
                <div className="text-5xl font-extrabold text-yellow-300 drop-shadow">
                  BINGO!
                </div>
              ) : (
                <div className="flex w-full items-center gap-3 overflow-hidden">
                  {calledBalls.slice(0, MAX_CALLED_VISIBLE).map((ball, idx) => (
                    <div
                      key={`${ball.letter}-${ball.number}-${idx}`}
                      className={
                        "grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 bg-white text-center shadow-[0_12px_30px_rgba(0,0,0,0.25)] transition-transform duration-300 " +
                        letterRing(ball.letter) +
                        (idx === 0 ? " scale-100" : " scale-[0.92] opacity-95")
                      }
                    >
                      <div className="leading-none">
                        <div className="text-xs font-bold text-black/60">
                          {ball.letter}
                        </div>
                        <div className="text-2xl font-extrabold text-black">
                          {ball.number}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 text-center">
              <div className="text-2xl font-extrabold text-white">{headline}</div>
              <div className="mt-1 text-sm font-semibold text-white/80">{subline}</div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2">
                <div className="text-white/55">TURN</div>
                <div className="mt-1 text-lg font-extrabold text-yellow-200">
                  {phase === "playing" ? formatTenths(timeLeftMs) : "—"}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2">
                <div className="text-white/55">LINES</div>
                <div className="mt-1 text-lg font-extrabold text-emerald-200">
                  {bingoLines}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2">
                <div className="text-white/55">MISSES</div>
                <div className="mt-1 text-lg font-extrabold text-rose-200">
                  {mistakes}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-[28px] border border-white/10 bg-[#f4dccd] p-2 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)]">
            <div className="grid grid-cols-5 gap-2">
              {LETTERS.map((letter) => (
                <div
                  key={letter}
                  className={`rounded-xl px-2 py-2 text-center text-2xl font-extrabold text-white ${letterBg(letter)}`}
                >
                  {letter}
                </div>
              ))}

              {board.flat().map((cell) => {
                const isHint =
                  !!hintBall &&
                  !cell.free &&
                  !cell.marked &&
                  cell.letter === hintBall.letter &&
                  cell.number === hintBall.number;

                const isMarked = cell.marked;

                return (
                  <button
                    key={`${cell.row}-${cell.col}`}
                    type="button"
                    onClick={() => onCellClick(cell.row, cell.col)}
                    disabled={phase !== "playing"}
                    className={
                      "relative min-h-[84px] rounded-2xl border-2 text-center transition-all duration-150 " +
                      (cell.free
                        ? "border-purple-400 bg-purple-600 text-white"
                        : isMarked
                        ? "border-yellow-300 bg-yellow-300 text-black"
                        : cell.wrongFlash
                        ? "border-rose-400 bg-rose-100 text-black scale-[0.96]"
                        : isHint
                        ? "border-emerald-400 bg-white text-black ring-4 ring-emerald-300/60 animate-pulse"
                        : "border-black/10 bg-white text-black")
                    }
                  >
                    {cell.free ? (
                      <div className="flex h-full items-center justify-center text-3xl font-extrabold">
                        ★
                      </div>
                    ) : (
                      <div
                        className={
                          "flex h-full items-center justify-center text-4xl font-extrabold transition-all duration-150 " +
                          (cell.justMarked ? "scale-110 text-purple-800" : "")
                        }
                      >
                        {cell.number}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="h-5 flex-1 overflow-hidden rounded-full border border-white/25 bg-white/15">
              <div
                className="h-full rounded-full bg-yellow-300 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <button
              type="button"
              disabled
              className="grid h-14 w-14 place-items-center rounded-full border border-white/20 bg-fuchsia-500/20 text-2xl text-white/70"
              title="Bonus later"
            >
              ★
            </button>

            <button
              type="button"
              onClick={onBingoClick}
              disabled={phase !== "playing"}
              className={
                "h-14 min-w-[140px] rounded-[18px] px-6 text-xl font-extrabold shadow-[0_12px_30px_rgba(0,0,0,0.2)] transition " +
                (phase === "playing"
                  ? "bg-yellow-300 text-purple-900"
                  : "bg-purple-400/50 text-white/60")
              }
            >
              BINGO
            </button>
          </div>

          {(phase === "intro" || phase === "paused") && (
            <button
              type="button"
              onClick={phase === "paused" ? resumeGame : startGame}
              className="mt-6 h-14 rounded-[20px] bg-green-500 text-2xl font-extrabold text-white shadow-[0_16px_40px_rgba(0,0,0,0.25)]"
            >
              {phase === "paused" ? "Resume" : "Play Now"}
            </button>
          )}

          {(phase === "won" || phase === "lost") && (
            <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
              <div className="text-center text-3xl font-extrabold">
                {phase === "won" ? "Congratulations!" : "Round finished"}
              </div>

              <div className="mt-4 space-y-3 text-base">
                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <span>Total Score</span>
                  <span className="font-extrabold">{score}</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <span>Bingo Lines</span>
                  <span className="font-extrabold">{bingoLines}</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <span>Mistakes</span>
                  <span className="font-extrabold">{mistakes}</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={startGame}
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
// ===== FILE END: apps/web/components/game/BingoRuntime.tsx =====