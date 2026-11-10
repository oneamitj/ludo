import type { Color } from './types'

/**
 * Board geometry for the classic 15x15 cross-shaped Ludo board.
 * Cells are [row, col]. Red's yard is top-left, then clockwise:
 * green top-right, yellow bottom-right, blue bottom-left.
 */

export const BASE = -1
export const LAST_TRACK = 50
export const HOME_COLUMN_START = 51
export const HOME = 56
export const TRACK_LENGTH = 52
export const TOKENS_PER_PLAYER = 4

export type Cell = [number, number]

function line(r: number, c: number, dr: number, dc: number, n: number): Cell[] {
  return Array.from({ length: n }, (_, i) => [r + dr * i, c + dc * i] as Cell)
}

/** The 52 shared squares, clockwise, starting on red's start square. */
export const TRACK: Cell[] = [
  ...line(6, 1, 0, 1, 5), // red arm, top row, heading right
  ...line(5, 6, -1, 0, 6), // green arm, left column, heading up
  ...line(0, 7, 0, 1, 2),
  ...line(1, 8, 1, 0, 5), // green arm, right column, heading down
  ...line(6, 9, 0, 1, 6), // yellow arm, top row, heading right
  ...line(7, 14, 1, 0, 2),
  ...line(8, 13, 0, -1, 5), // yellow arm, bottom row, heading left
  ...line(9, 8, 1, 0, 6), // blue arm, right column, heading down
  ...line(14, 7, 0, -1, 2),
  ...line(13, 6, -1, 0, 5), // blue arm, left column, heading up
  ...line(8, 5, 0, -1, 6), // red arm, bottom row, heading left
  ...line(7, 0, -1, 0, 2),
]

export const START_INDEX: Record<Color, number> = { red: 0, green: 13, yellow: 26, blue: 39 }

/** Start squares plus the four star squares eight steps after each start. */
export const SAFE_INDICES: ReadonlySet<number> = new Set([0, 8, 13, 21, 26, 34, 39, 47])

export const HOME_COLUMN: Record<Color, Cell[]> = {
  red: line(7, 1, 0, 1, 5),
  green: line(1, 7, 1, 0, 5),
  yellow: line(7, 13, 0, -1, 5),
  blue: line(13, 7, -1, 0, 5),
}

/** Absolute track index for a progress value on the main track, else null. */
export function trackIndex(color: Color, progress: number): number | null {
  if (progress < 0 || progress > LAST_TRACK) return null
  return (START_INDEX[color] + progress) % TRACK_LENGTH
}

/** Progress (0..51) a token of `color` would have if it stood on track index `abs`. */
export function relativeProgress(color: Color, abs: number): number {
  return (abs - START_INDEX[color] + TRACK_LENGTH) % TRACK_LENGTH
}

export function isSafeProgress(color: Color, progress: number): boolean {
  const abs = trackIndex(color, progress)
  return abs === null ? progress >= HOME_COLUMN_START : SAFE_INDICES.has(abs)
}

export interface Point {
  x: number
  y: number
}

/** Top-left corner of each 6x6 yard, in board units (x = column, y = row). */
export const YARD_ORIGIN: Record<Color, Point> = {
  red: { x: 0, y: 0 },
  green: { x: 9, y: 0 },
  yellow: { x: 9, y: 9 },
  blue: { x: 0, y: 9 },
}

const YARD_SLOTS: Point[] = [
  { x: 2.05, y: 2.05 },
  { x: 3.95, y: 2.05 },
  { x: 2.05, y: 3.95 },
  { x: 3.95, y: 3.95 },
]

/** Centre of each colour's triangle in the middle of the board. */
export const HOME_CENTER: Record<Color, Point> = {
  red: { x: 6.62, y: 7.5 },
  green: { x: 7.5, y: 6.62 },
  yellow: { x: 8.38, y: 7.5 },
  blue: { x: 7.5, y: 8.38 },
}

export function cellCenter([r, c]: Cell): Point {
  return { x: c + 0.5, y: r + 0.5 }
}

/**
 * Where a token sits, plus a key identifying the spot so tokens sharing it
 * can be fanned out. Yard tokens each have their own slot.
 */
export function tokenSpot(color: Color, progress: number, token: number): { key: string; point: Point } {
  if (progress === BASE) {
    const o = YARD_ORIGIN[color]
    const s = YARD_SLOTS[token % 4]
    return { key: `yard-${color}-${token}`, point: { x: o.x + s.x, y: o.y + s.y } }
  }
  if (progress >= HOME) {
    return { key: `home-${color}`, point: HOME_CENTER[color] }
  }
  if (progress >= HOME_COLUMN_START) {
    const cell = HOME_COLUMN[color][progress - HOME_COLUMN_START]
    return { key: `hc-${color}-${progress}`, point: cellCenter(cell) }
  }
  const abs = trackIndex(color, progress)!
  return { key: `t-${abs}`, point: cellCenter(TRACK[abs]) }
}
