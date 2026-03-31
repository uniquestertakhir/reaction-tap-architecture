// ===== FILE START: apps/web/lib/games/blackjackRuntime.ts =====

export type CardSuit = "♠" | "♥" | "♦" | "♣";

export type CardRank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export type Card = {
  id: string;
  suit: CardSuit;
  rank: CardRank;
  value: number;
};

export type BlackjackLane = {
  id: number;
  cards: Card[];
  score: number;
  soft: boolean;
  cleared: number;
  busted: boolean;
};

export type BlackjackRuntimeState = {
  deck: Card[];
  activeCard: Card | null;
  lanes: BlackjackLane[];
  finished: boolean;
  result: "playing" | "won" | "lost";
  score: number;
  streak: number;
  clears: number;
  busts: number;
  moves: number;
};

const SUITS: CardSuit[] = ["♠", "♥", "♦", "♣"];

const RANKS: CardRank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

const LANE_COUNT = 4;
const TARGET_SCORE = 21;
const MAX_BUSTS = 3;

function uid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `bj_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  }
}

export function getCardValue(rank: CardRank): number {
  if (rank === "A") return 11;
  if (rank === "K" || rank === "Q" || rank === "J") return 10;
  return Number(rank);
}

export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }

  return arr;
}

export function createDeck(decks = 1): Card[] {
  const cards: Card[] = [];

  for (let d = 0; d < decks; d += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          id: uid(),
          suit,
          rank,
          value: getCardValue(rank),
        });
      }
    }
  }

  return shuffle(cards);
}

export function scoreCards(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    total += card.value;
    if (card.rank === "A") aces += 1;
  }

  let soft = false;

  while (total > TARGET_SCORE && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  if (cards.some((c) => c.rank === "A") && total <= TARGET_SCORE) {
    const hardTotal = cards.reduce(
      (sum, c) => sum + (c.rank === "A" ? 1 : c.value),
      0
    );
    soft = total !== hardTotal;
  }

  return { total, soft };
}

function makeLane(id: number): BlackjackLane {
  return {
    id,
    cards: [],
    score: 0,
    soft: false,
    cleared: 0,
    busted: false,
  };
}

function cloneLane(lane: BlackjackLane): BlackjackLane {
  return {
    id: lane.id,
    cards: [...lane.cards],
    score: lane.score,
    soft: lane.soft,
    cleared: lane.cleared,
    busted: lane.busted,
  };
}

function drawNext(deck: Card[]): { card: Card | null; rest: Card[] } {
  if (!deck.length) {
    return { card: null, rest: [] };
  }

  const next = [...deck];
  const card = next.shift() || null;

  return {
    card,
    rest: next,
  };
}

function recomputeLane(lane: BlackjackLane): BlackjackLane {
  const scored = scoreCards(lane.cards);

  return {
    ...lane,
    score: scored.total,
    soft: scored.soft,
  };
}

function clearLane(lane: BlackjackLane): BlackjackLane {
  return {
    ...lane,
    cards: [],
    score: 0,
    soft: false,
    cleared: lane.cleared + 1,
    busted: false,
  };
}

function bustLane(lane: BlackjackLane): BlackjackLane {
  return {
    ...lane,
    cards: [],
    score: 0,
    soft: false,
    busted: true,
  };
}

function allLanesBlocked(lanes: BlackjackLane[]) {
  return lanes.every((lane) => lane.busted);
}

function cleanBustFlags(lanes: BlackjackLane[]) {
  return lanes.map((lane) => ({
    ...lane,
    busted: false,
  }));
}

export function startBlackjackRuntime(): BlackjackRuntimeState {
  const firstDeck = createDeck(1);
  const drawn = drawNext(firstDeck);

  return {
    deck: drawn.rest,
    activeCard: drawn.card,
    lanes: Array.from({ length: LANE_COUNT }, (_, i) => makeLane(i)),
    finished: false,
    result: "playing",
    score: 0,
    streak: 0,
    clears: 0,
    busts: 0,
    moves: 0,
  };
}

export function placeActiveCard(
  state: BlackjackRuntimeState,
  laneId: number
): BlackjackRuntimeState {
  if (state.finished) return state;
  if (!state.activeCard) return state;

  const lane = state.lanes.find((x) => x.id === laneId);
  if (!lane) return state;

  const nextLanes = state.lanes.map(cloneLane);
  const targetIndex = nextLanes.findIndex((x) => x.id === laneId);
  const targetLane = nextLanes[targetIndex];

  targetLane.cards.push(state.activeCard);

  let updatedLane = recomputeLane(targetLane);

  let nextScore = state.score;
  let nextStreak = state.streak;
  let nextClears = state.clears;
  let nextBusts = state.busts;

  if (updatedLane.score === TARGET_SCORE) {
    nextClears += 1;
    nextStreak += 1;
    nextScore += 250 + nextStreak * 50;
    updatedLane = clearLane(updatedLane);
  } else if (updatedLane.score > TARGET_SCORE) {
    nextBusts += 1;
    nextStreak = 0;
    nextScore = Math.max(0, nextScore - 75);
    updatedLane = bustLane(updatedLane);
  } else {
    nextScore += 25;
  }

  nextLanes[targetIndex] = updatedLane;

  const drawn = drawNext(state.deck);
  let result: BlackjackRuntimeState["result"] = "playing";
  let finished = false;

  const shouldLose = nextBusts >= MAX_BUSTS;
  const shouldWin = drawn.card === null && nextBusts < MAX_BUSTS;

  if (shouldLose) {
    result = "lost";
    finished = true;
  } else if (shouldWin) {
    result = "won";
    finished = true;
  }

  return {
    deck: drawn.rest,
    activeCard: drawn.card,
    lanes: shouldLose ? cleanBustFlags(nextLanes) : nextLanes,
    finished,
    result,
    score: nextScore,
    streak: nextStreak,
    clears: nextClears,
    busts: nextBusts,
    moves: state.moves + 1,
  };
}

export function canPlaceOnLane(
  state: BlackjackRuntimeState,
  laneId: number
): boolean {
  if (state.finished) return false;
  if (!state.activeCard) return false;

  const lane = state.lanes.find((x) => x.id === laneId);
  if (!lane) return false;

  return true;
}

export function getPreviewScore(
  lane: BlackjackLane,
  card: Card | null
): { total: number; soft: boolean } {
  if (!card) {
    return {
      total: lane.score,
      soft: lane.soft,
    };
  }

  return scoreCards([...lane.cards, card]);
}

export function isBlackjackBust(total: number): boolean {
  return total > TARGET_SCORE;
}

export function isBlackjackClear(total: number): boolean {
  return total === TARGET_SCORE;
}

export function runtimeProgress(state: BlackjackRuntimeState): number {
  const totalCards = state.deck.length + (state.activeCard ? 1 : 0);
  const usedCards = 52 - totalCards;
  return Math.max(0, Math.min(100, Math.round((usedCards / 52) * 100)));
}

export function getRuntimeSummary(state: BlackjackRuntimeState) {
  return {
    score: state.score,
    clears: state.clears,
    busts: state.busts,
    streak: state.streak,
    progress: runtimeProgress(state),
    result: state.result,
    finished: state.finished,
  };
}

// ===== FILE END: apps/web/lib/games/blackjackRuntime.ts =====