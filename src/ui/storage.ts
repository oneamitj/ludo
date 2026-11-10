import { DEFAULT_OPTIONS, COLOR_NAMES } from '../engine/rules'
import { COLORS, type GameState, type Options, type SeatConfig } from '../engine/types'

const GAME_KEY = 'ludo.game.v1'
const SETUP_KEY = 'ludo.setup.v1'
const PREFS_KEY = 'ludo.prefs.v1'

export type Speed = 'slow' | 'normal' | 'fast'

export interface Prefs {
  sound: boolean
  speed: Speed
  /** Make the move automatically when there's only one thing to do. */
  autoMove: boolean
  /** Cards mode with 2+ humans: hide the hand until its owner taps to see it. */
  hideHands: boolean
}

export interface SetupData {
  seats: SeatConfig[]
  options: Options
}

export const DEFAULT_PREFS: Prefs = { sound: true, speed: 'normal', autoMove: true, hideHands: true }

export function defaultSeats(): SeatConfig[] {
  return COLORS.map((color, i) => ({
    color,
    kind: i === 0 ? 'human' : 'bot',
    name: i === 0 ? 'You' : COLOR_NAMES[color],
    level: 'normal',
  }))
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode or full storage: the game still works, it just won't resume.
  }
}

export function loadSetup(): SetupData {
  const saved = read<Partial<SetupData>>(SETUP_KEY)
  const seats = defaultSeats().map((d) => {
    const s = saved?.seats?.find((x) => x.color === d.color)
    return s ? { ...d, ...s, color: d.color } : d
  })
  return { seats, options: { ...DEFAULT_OPTIONS, ...(saved?.options ?? {}) } }
}

export const saveSetup = (s: SetupData) => write(SETUP_KEY, s)

export function loadPrefs(): Prefs {
  return { ...DEFAULT_PREFS, ...(read<Partial<Prefs>>(PREFS_KEY) ?? {}) }
}

export const savePrefs = (p: Prefs) => write(PREFS_KEY, p)

export function loadGame(): GameState | null {
  const g = read<GameState>(GAME_KEY)
  if (!g || g.version !== 1 || !Array.isArray(g.players) || g.phase === 'over') return null
  return g
}

export const saveGame = (g: GameState | null) => write(GAME_KEY, g)
