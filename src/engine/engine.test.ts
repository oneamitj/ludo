import { describe, expect, it } from 'vitest'
import {
  BASE,
  HOME,
  HOME_COLUMN,
  SAFE_INDICES,
  START_INDEX,
  TRACK,
  relativeProgress,
  trackIndex,
} from './board'
import { botAction } from './bot'
import { DECK_SIZE } from './cards'
import { nextRandom } from './random'
import { DEFAULT_OPTIONS, legalMoves, newGame, reducer } from './rules'
import { COLORS, type Card, type GameState, type Move, type Mode, type Options, type SeatKind } from './types'

function game(mode: Mode, kinds: SeatKind[] = ['human', 'human', 'off', 'off'], opts: Partial<Options> = {}, seed = 7) {
  const seats = COLORS.map((color, i) => ({ color, kind: kinds[i] ?? 'off', name: '', level: 'normal' as const }))
  return newGame(seats, { ...DEFAULT_OPTIONS, mode, ...opts }, seed)
}

/** Dice-mode state waiting for player `p` to move with die value `v`. */
function diceState(v: number, tokens: number[][], opts: Partial<Options> = {}): GameState {
  const kinds: SeatKind[] = tokens.map(() => 'human')
  const s = game('dice', kinds, opts)
  tokens.forEach((t, i) => (s.players[i].tokens = t.slice()))
  s.current = 0
  s.phase = 'move'
  s.dice = v
  return s
}

function seedRolling(v: number): number {
  for (let seed = 1; ; seed++) {
    if (1 + Math.floor(nextRandom({ seed }) * 6) === v) return seed
  }
}

function step(s: GameState, token: number): GameState {
  const m = legalMoves(s).find((x) => x.token === token)
  if (!m) throw new Error(`no legal move for token ${token}`)
  return reducer(s, { type: 'move', move: m })
}

function card(id: number, kind: Card['kind'], value = 0): Card {
  return { id, kind, value }
}

function cardsState(hand: Card[], tokens: number[][]): GameState {
  const s = game('cards', tokens.map(() => 'human'))
  // Put every dealt card back in the deck, minus the ones we hand out.
  const handIds = new Set(hand.map((c) => c.id))
  const all = [...s.deck, ...s.discard, ...s.players.flatMap((p) => p.hand)]
  s.deck = all.filter((c) => !handIds.has(c.id))
  s.discard = []
  s.players.forEach((p, i) => {
    p.tokens = tokens[i].slice()
    p.hand = []
  })
  s.players[0].hand = hand
  s.current = 0
  s.phase = legalMoves({ ...s, phase: 'move' }).length ? 'move' : 'discard'
  return s
}

describe('board geometry', () => {
  it('has 52 distinct squares, each adjacent to the next', () => {
    expect(TRACK).toHaveLength(52)
    expect(new Set(TRACK.map(([r, c]) => `${r},${c}`)).size).toBe(52)
    TRACK.forEach(([r, c], i) => {
      const [nr, nc] = TRACK[(i + 1) % 52]
      expect(Math.max(Math.abs(nr - r), Math.abs(nc - c))).toBe(1)
    })
  })

  it('puts each start square on its own arm', () => {
    expect(TRACK[START_INDEX.red]).toEqual([6, 1])
    expect(TRACK[START_INDEX.green]).toEqual([1, 8])
    expect(TRACK[START_INDEX.yellow]).toEqual([8, 13])
    expect(TRACK[START_INDEX.blue]).toEqual([13, 6])
    expect(SAFE_INDICES.size).toBe(8)
  })

  it('leads every colour from its last track square into its home column', () => {
    for (const color of COLORS) {
      const [r, c] = TRACK[trackIndex(color, 50)!]
      const [hr, hc] = HOME_COLUMN[color][0]
      expect(Math.abs(hr - r) + Math.abs(hc - c)).toBe(1)
      const [lr, lc] = HOME_COLUMN[color][4]
      expect(Math.max(Math.abs(lr - 7), Math.abs(lc - 7))).toBe(2)
    }
  })

  it('converts between relative progress and track index', () => {
    for (const color of COLORS) {
      for (let p = 0; p <= 50; p++) expect(relativeProgress(color, trackIndex(color, p)!)).toBe(p)
      expect(trackIndex(color, -1)).toBeNull()
      expect(trackIndex(color, 51)).toBeNull()
    }
  })
})

describe('dice mode', () => {
  it('only releases tokens on a 6', () => {
    expect(legalMoves(diceState(5, [[BASE, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]]))).toHaveLength(0)
    const moves = legalMoves(diceState(6, [[BASE, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]]))
    expect(moves).toHaveLength(4)
    expect(moves.every((m) => m.kind === 'step' && m.to === 0)).toBe(true)
  })

  it('captures on a normal square and grants a bonus turn', () => {
    // Red at progress 3 (track 3). Green token on track 5 = green progress 44.
    const s = diceState(2, [[3, BASE, BASE, BASE], [44, BASE, BASE, BASE]])
    const next = step(s, 0)
    expect(next.players[0].tokens[0]).toBe(5)
    expect(next.players[1].tokens[0]).toBe(BASE)
    expect(next.event?.captured).toEqual([{ player: 1, token: 0, from: 44 }])
    expect(next.current).toBe(0)
    expect(next.bonus).toBe(true)
  })

  it('never captures on a safe square', () => {
    // Track 8 is a star. Green progress 47 is track 8.
    const s = diceState(3, [[5, BASE, BASE, BASE], [47, BASE, BASE, BASE]])
    const next = step(s, 0)
    expect(next.players[0].tokens[0]).toBe(8)
    expect(next.players[1].tokens[0]).toBe(47)
    expect(next.current).toBe(1)
  })

  it('needs an exact count to get home', () => {
    expect(legalMoves(diceState(3, [[54, HOME, HOME, HOME], [0, 0, 0, 0]]))).toHaveLength(0)
    const next = step(diceState(2, [[54, BASE, BASE, BASE], [0, 0, 0, 0]]), 0)
    expect(next.players[0].tokens[0]).toBe(HOME)
    expect(next.current).toBe(0) // bonus for reaching home
  })

  it('gives a bonus turn for a 6 but not for other numbers', () => {
    expect(step(diceState(6, [[10, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]]), 0).current).toBe(0)
    expect(step(diceState(4, [[10, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]]), 0).current).toBe(1)
    const off = step(diceState(6, [[10, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]], { bonusOnSix: false }), 0)
    expect(off.current).toBe(1)
  })

  it('takes the turn away after three 6s in a row', () => {
    const s = diceState(6, [[10, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]])
    s.phase = 'roll'
    s.dice = null
    s.sixStreak = 2
    s.seed = seedRolling(6)
    const rolled = reducer(s, { type: 'roll' })
    expect(rolled.phase).toBe('pass')
    expect(rolled.stuck).toBe('threesixes')
    const passed = reducer(rolled, { type: 'pass' })
    expect(passed.current).toBe(1)
    expect(passed.players[0].tokens[0]).toBe(10)
  })

  it('moves to pass when the roll gives nothing to do', () => {
    const s = diceState(1, [[BASE, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]])
    s.phase = 'roll'
    s.seed = seedRolling(3)
    const rolled = reducer(s, { type: 'roll' })
    expect(rolled.phase).toBe('pass')
    expect(reducer(rolled, { type: 'pass' }).current).toBe(1)
  })

  it('stops tokens passing an opponent blockade when blockades are on', () => {
    // Green has two tokens on track 6 (green progress 45), a normal square.
    const tokens = [
      [3, BASE, BASE, BASE],
      [45, 45, BASE, BASE],
    ]
    expect(legalMoves(diceState(5, tokens, { blockades: true }))).toHaveLength(0)
    expect(legalMoves(diceState(2, tokens, { blockades: true }))).toHaveLength(1)
    expect(legalMoves(diceState(5, tokens, { blockades: false }))).toHaveLength(1)
  })

  it('ignores moves that are not legal', () => {
    const s = diceState(3, [[10, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]])
    const fake: Move = { kind: 'step', player: 0, token: 0, from: 10, to: 16, value: 6, cardId: null }
    expect(reducer(s, { type: 'move', move: fake })).toBe(s)
  })
})

describe('cards mode', () => {
  it('deals a hand to every player from a full deck', () => {
    const s = game('cards', ['human', 'bot', 'human', 'bot'], { handSize: 4 })
    expect(s.players.every((p) => p.hand.length === 4)).toBe(true)
    expect(s.deck.length + s.players.reduce((n, p) => n + p.hand.length, 0)).toBe(DECK_SIZE)
  })

  it('plays a card, discards it and draws a replacement', () => {
    const s = cardsState([card(100, 'num', 3), card(101, 'num', 2), card(102, 'num', 1)], [[10, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]])
    const m = legalMoves(s).find((x) => x.cardId === 100)!
    const next = reducer(s, { type: 'move', move: m })
    expect(next.players[0].tokens[0]).toBe(13)
    expect(next.players[0].hand).toHaveLength(3)
    expect(next.players[0].hand.some((c) => c.id === 100)).toBe(false)
    expect(next.discard.map((c) => c.id)).toContain(100)
    expect(next.current).toBe(1)
  })

  it('lets a wild card count as any number, including 6 to release', () => {
    const s = cardsState([card(200, 'wild')], [[BASE, BASE, BASE, 20], [BASE, BASE, BASE, BASE]])
    const moves = legalMoves(s)
    expect(moves.filter((m) => m.token === 3).map((m) => (m.kind === 'step' ? m.value : 0))).toEqual([1, 2, 3, 4, 5, 6])
    expect(moves.some((m) => m.kind === 'step' && m.from === BASE && m.value === 6)).toBe(true)
  })

  it('makes the player throw a card away when nothing can be played', () => {
    const s = cardsState([card(300, 'num', 2), card(301, 'num', 4)], [[BASE, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]])
    expect(s.phase).toBe('discard')
    const next = reducer(s, { type: 'discard', cardId: 301 })
    expect(next.players[0].hand.map((c) => c.id)).toContain(300)
    expect(next.players[0].hand).toHaveLength(2)
    expect(next.current).toBe(1)
  })

  it('swaps with an opponent token but never one on a safe square', () => {
    // Red on track 10. Green on track 30 (green progress 17) and on track 21 (a star).
    const s = cardsState([card(400, 'swap')], [[10, BASE, BASE, BASE], [17, 8, BASE, BASE]])
    const swaps = legalMoves(s)
    expect(swaps).toHaveLength(1)
    const next = reducer(s, { type: 'move', move: swaps[0] })
    expect(next.players[0].tokens[0]).toBe(30)
    expect(next.players[1].tokens[0]).toBe(relativeProgress('green', 10))
  })

  it('never swaps a token onto the square just behind its own start', () => {
    // Track 51 is red progress 51; red can't stand there on the main track.
    const s = cardsState([card(500, 'swap')], [[10, BASE, BASE, BASE], [38, BASE, BASE, BASE]])
    expect(trackIndex('green', 38)).toBe(51)
    expect(legalMoves(s)).toHaveLength(0)
  })

  it('reshuffles the discard pile when the deck runs out', () => {
    const s = cardsState([card(600, 'num', 1)], [[10, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]])
    s.discard = s.deck
    s.deck = []
    const next = reducer(s, { type: 'move', move: legalMoves(s)[0] })
    expect(next.players[0].hand).toHaveLength(1)
    expect(next.log.some((l) => l.text === 'Deck reshuffled')).toBe(true)
  })
})

describe('finishing', () => {
  it('ranks players as they finish and ends when one is left', () => {
    const s = diceState(1, [
      [HOME, HOME, HOME, 55],
      [HOME, HOME, 50, 55],
      [BASE, BASE, BASE, BASE],
    ])
    const next = step(s, 3)
    expect(next.players[0].finished).toBe(true)
    expect(next.rankings).toEqual([0])
    expect(next.phase).not.toBe('over')
    expect(next.current).toBe(1)
  })

  it('stops at the first winner when playing for first place only', () => {
    const s = diceState(1, [[HOME, HOME, HOME, 55], [BASE, BASE, BASE, 30], [BASE, BASE, BASE, BASE]], { playToEnd: false })
    const next = step(s, 3)
    expect(next.phase).toBe('over')
    expect(next.rankings).toEqual([0, 1, 2])
  })
})

function playOut(mode: Mode, seed: number, opts: Partial<Options> = {}) {
  const levels = ['easy', 'normal', 'hard', 'normal'] as const
  const seats = COLORS.map((color, i) => ({ color, kind: 'bot' as const, name: '', level: levels[i] }))
  let s = newGame(seats, { ...DEFAULT_OPTIONS, mode, ...opts }, seed)
  let rng = seed
  const random = () => nextRandom({ seed: rng++ })
  let actions = 0
  while (s.phase !== 'over' && actions < 20000) {
    const a = botAction(s, random)
    expect(a).not.toBeNull()
    const next = reducer(s, a!)
    expect(next).not.toBe(s) // every bot action must be accepted
    s = next
    actions++
    for (const p of s.players) {
      expect(p.tokens).toHaveLength(4)
      for (const t of p.tokens) expect(t >= BASE && t <= HOME).toBe(true)
    }
    if (mode === 'cards') {
      const total = s.deck.length + s.discard.length + s.players.reduce((n, p) => n + p.hand.length, 0)
      expect(total).toBe(DECK_SIZE)
    }
  }
  return { s, actions }
}

describe('bot games', () => {
  for (const mode of ['dice', 'cards'] as const) {
    it(`four bots finish a ${mode} game`, () => {
      for (let seed = 1; seed <= 6; seed++) {
        const { s } = playOut(mode, seed, { blockades: seed % 2 === 0 })
        expect(s.phase).toBe('over')
        expect(new Set(s.rankings).size).toBe(4)
      }
    }, 30000)
  }
})
