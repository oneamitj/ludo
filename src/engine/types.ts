export const COLORS = ['red', 'green', 'yellow', 'blue'] as const
export type Color = (typeof COLORS)[number]

/** 'cards': move with a hand of cards. 'dice': classic Ludo with one die. */
export type Mode = 'cards' | 'dice'
export type BotLevel = 'easy' | 'normal' | 'hard'
export type SeatKind = 'human' | 'bot' | 'off'

export interface SeatConfig {
  color: Color
  kind: SeatKind
  name: string
  level: BotLevel
}

export interface Options {
  mode: Mode
  /** Cards in each hand (cards mode). */
  handSize: number
  bonusOnSix: boolean
  bonusOnCapture: boolean
  bonusOnHome: boolean
  /** Dice mode: rolling three 6s in a row ends the turn. */
  threeSixes: boolean
  /** Two tokens of one color on a normal square block everyone else. */
  blockades: boolean
  /** true: keep playing until every place is decided. false: stop at the first winner. */
  playToEnd: boolean
}

export type CardKind = 'num' | 'wild' | 'swap'
export interface Card {
  id: number
  kind: CardKind
  /** 1-6 for number cards, 0 for wild and swap. */
  value: number
}

export interface PlayerStats {
  captures: number
  lost: number
  sixes: number
  turns: number
  moves: number
}

/**
 * Token progress is measured from the player's own start square:
 * -1 = in the yard, 0..50 = main track, 51..55 = home column, 56 = home.
 */
export interface Player {
  color: Color
  name: string
  bot: BotLevel | null
  tokens: number[]
  hand: Card[]
  finished: boolean
  stats: PlayerStats
}

export interface TokenRef {
  player: number
  token: number
}

export type Move =
  | {
      kind: 'step'
      player: number
      token: number
      from: number
      to: number
      value: number
      /** null in dice mode. */
      cardId: number | null
    }
  | {
      kind: 'swap'
      player: number
      token: number
      from: number
      to: number
      cardId: number
      target: TokenRef
      targetFrom: number
      targetTo: number
    }

export type Action =
  | { type: 'roll' }
  | { type: 'move'; move: Move }
  | { type: 'discard'; cardId: number }
  | { type: 'pass' }

/**
 * Phases:
 * roll    - dice mode, waiting for a roll
 * move    - a legal move exists and must be chosen
 * pass    - dice mode, the roll gave nothing to do (or three 6s); acknowledge to continue
 * discard - cards mode, no card can be played; throw one away to end the turn
 * over    - game finished
 */
export type Phase = 'roll' | 'move' | 'pass' | 'discard' | 'over'

export interface LogEntry {
  id: number
  color: Color | null
  text: string
}

export interface CapturedToken extends TokenRef {
  from: number
}

/** The most recent board change, so the UI can animate it and play sounds. */
export interface MoveEvent {
  seq: number
  kind: 'step' | 'swap'
  player: number
  token: number
  /** Progress values the token passes through, ending on its destination. */
  path: number[]
  captured: CapturedToken[]
  reachedHome: boolean
  finished: boolean
  swap?: { target: TokenRef; from: number; to: number }
}

export interface GameState {
  version: 1
  options: Options
  players: Player[]
  current: number
  phase: Phase
  /** Value of the die rolled this step (dice mode), null before rolling. */
  dice: number | null
  lastDice: number | null
  rollSeq: number
  sixStreak: number
  /** Why the player is in the 'pass' phase. */
  stuck: 'nomoves' | 'threesixes' | null
  /** The current turn is a bonus turn. */
  bonus: boolean
  deck: Card[]
  discard: Card[]
  /** Who put the top card on the discard pile. */
  lastCardBy: number | null
  /** Player indices in finishing order. */
  rankings: number[]
  turnNo: number
  seed: number
  log: LogEntry[]
  logSeq: number
  event: MoveEvent | null
  eventSeq: number
}
