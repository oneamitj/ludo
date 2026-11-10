import {
  BASE,
  HOME,
  LAST_TRACK,
  SAFE_INDICES,
  TOKENS_PER_PLAYER,
  relativeProgress,
  trackIndex,
} from './board'
import { buildDeck, cardLabel } from './cards'
import { nextRandom, randomSeed, shuffle } from './random'
import {
  COLORS,
  type Action,
  type Card,
  type CapturedToken,
  type Color,
  type GameState,
  type Move,
  type Options,
  type Player,
  type SeatConfig,
  type TokenRef,
} from './types'

export const DEFAULT_OPTIONS: Options = {
  mode: 'cards',
  handSize: 3,
  bonusOnSix: true,
  bonusOnCapture: true,
  bonusOnHome: true,
  threeSixes: true,
  blockades: false,
  playToEnd: true,
}

export const COLOR_NAMES: Record<Color, string> = {
  red: 'Red',
  green: 'Green',
  yellow: 'Yellow',
  blue: 'Blue',
}

const MAX_LOG = 80

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/** Picks the verb form that fits the name, so a player called "You" reads right. */
export function verb(name: string, third: string, second: string): string {
  return name.trim().toLowerCase() === 'you' ? second : third
}

function log(s: GameState, color: Color | null, text: string) {
  s.log.push({ id: ++s.logSeq, color, text })
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG)
}

export function newGame(seats: SeatConfig[], options: Options, seed: number = randomSeed()): GameState {
  const active = COLORS.map((c) => seats.find((seat) => seat.color === c)).filter(
    (seat): seat is SeatConfig => !!seat && seat.kind !== 'off',
  )
  if (active.length < 2) throw new Error('Ludo needs at least two players')

  const players: Player[] = active.map((seat) => ({
    color: seat.color,
    name: seat.name.trim() || COLOR_NAMES[seat.color],
    bot: seat.kind === 'bot' ? seat.level : null,
    tokens: Array(TOKENS_PER_PLAYER).fill(BASE),
    hand: [],
    finished: false,
    stats: { captures: 0, lost: 0, sixes: 0, turns: 0, moves: 0 },
  }))

  const s: GameState = {
    version: 1,
    options: { ...options, handSize: clamp(options.handSize, 2, 5) },
    players,
    current: 0,
    phase: 'roll',
    dice: null,
    lastDice: null,
    rollSeq: 0,
    sixStreak: 0,
    stuck: null,
    bonus: false,
    deck: [],
    discard: [],
    lastCardBy: null,
    rankings: [],
    turnNo: 0,
    seed: seed >>> 0,
    log: [],
    logSeq: 0,
    event: null,
    eventSeq: 0,
  }

  if (s.options.mode === 'cards') {
    s.deck = shuffle(buildDeck(), s)
    for (let round = 0; round < s.options.handSize; round++) {
      for (const p of players) p.hand.push(s.deck.pop()!)
    }
  }

  const first = Math.floor(nextRandom(s) * players.length)
  log(s, players[first].color, `${players[first].name} ${verb(players[first].name, 'goes', 'go')} first`)
  startTurn(s, first, false)
  return s
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n) || lo))
}

/** Every token standing on a shared track square. */
export function tokensOnSquare(s: GameState, abs: number): TokenRef[] {
  const out: TokenRef[] = []
  s.players.forEach((p, player) => {
    p.tokens.forEach((progress, token) => {
      if (trackIndex(p.color, progress) === abs) out.push({ player, token })
    })
  })
  return out
}

/** True when another colour has two or more tokens on a non-safe square in the way. */
function pathBlocked(s: GameState, player: number, from: number, to: number): boolean {
  const color = s.players[player].color
  for (let q = Math.max(from + 1, 0); q <= Math.min(to, LAST_TRACK); q++) {
    const abs = trackIndex(color, q)!
    if (SAFE_INDICES.has(abs)) continue
    const counts = new Map<number, number>()
    for (const t of tokensOnSquare(s, abs)) {
      if (t.player === player) continue
      const n = (counts.get(t.player) ?? 0) + 1
      if (n >= 2) return true
      counts.set(t.player, n)
    }
  }
  return false
}

function stepMoves(s: GameState, player: number, value: number, cardId: number | null): Move[] {
  const p = s.players[player]
  const moves: Move[] = []
  p.tokens.forEach((from, token) => {
    if (from === HOME) return
    if (from === BASE) {
      if (value === 6) moves.push({ kind: 'step', player, token, from, to: 0, value, cardId })
      return
    }
    const to = from + value
    if (to > HOME) return
    if (s.options.blockades && pathBlocked(s, player, from, to)) return
    moves.push({ kind: 'step', player, token, from, to, value, cardId })
  })
  return moves
}

function swapMoves(s: GameState, player: number, cardId: number): Move[] {
  const me = s.players[player]
  const moves: Move[] = []
  me.tokens.forEach((from, token) => {
    const myAbs = trackIndex(me.color, from)
    if (myAbs === null) return
    s.players.forEach((other, op) => {
      if (op === player || other.finished) return
      other.tokens.forEach((targetFrom, ot) => {
        const theirAbs = trackIndex(other.color, targetFrom)
        if (theirAbs === null || theirAbs === myAbs || SAFE_INDICES.has(theirAbs)) return
        const to = relativeProgress(me.color, theirAbs)
        const targetTo = relativeProgress(other.color, myAbs)
        // Progress 51 is the square just behind a start: reachable only by a full lap.
        if (to > LAST_TRACK || targetTo > LAST_TRACK) return
        moves.push({
          kind: 'swap',
          player,
          token,
          from,
          to,
          cardId,
          target: { player: op, token: ot },
          targetFrom,
          targetTo,
        })
      })
    })
  })
  return moves
}

/** All moves the current player may make right now. */
export function legalMoves(s: GameState): Move[] {
  if (s.phase === 'over') return []
  const player = s.current
  if (s.options.mode === 'dice') {
    if (s.phase !== 'move' || s.dice === null) return []
    return stepMoves(s, player, s.dice, null)
  }
  const moves: Move[] = []
  for (const card of s.players[player].hand) {
    if (card.kind === 'num') moves.push(...stepMoves(s, player, card.value, card.id))
    else if (card.kind === 'wild') {
      for (let v = 1; v <= 6; v++) moves.push(...stepMoves(s, player, v, card.id))
    } else moves.push(...swapMoves(s, player, card.id))
  }
  return moves
}

export function moveKey(m: Move): string {
  if (m.kind === 'swap') return `w:${m.token}:${m.cardId}:${m.target.player}:${m.target.token}`
  return `s:${m.token}:${m.from}:${m.to}:${m.value}:${m.cardId ?? '-'}`
}

/** Opponent tokens a step move would send back to their yard. */
export function capturesFor(s: GameState, m: Move): CapturedToken[] {
  if (m.kind !== 'step') return []
  const color = s.players[m.player].color
  const abs = trackIndex(color, m.to)
  if (abs === null || SAFE_INDICES.has(abs)) return []
  return tokensOnSquare(s, abs)
    .filter((t) => t.player !== m.player)
    .map((t) => ({ ...t, from: s.players[t.player].tokens[t.token] }))
}

function startTurn(s: GameState, idx: number, bonus: boolean) {
  s.current = idx
  s.bonus = bonus
  s.dice = null
  s.stuck = null
  if (!bonus) {
    s.sixStreak = 0
    s.turnNo++
    s.players[idx].stats.turns++
  }
  if (s.options.mode === 'dice') {
    s.phase = 'roll'
  } else {
    s.phase = 'move'
    if (legalMoves(s).length === 0) s.phase = 'discard'
  }
}

function finishTurn(s: GameState, bonus: boolean) {
  if (s.phase === 'over') return
  const cur = s.players[s.current]
  if (bonus && !cur.finished) {
    startTurn(s, s.current, true)
    return
  }
  let next = s.current
  do {
    next = (next + 1) % s.players.length
  } while (s.players[next].finished && next !== s.current)
  startTurn(s, next, false)
}

function progressSum(p: Player): number {
  return p.tokens.reduce((sum, t) => sum + Math.max(t, 0), 0)
}

function checkGameOver(s: GameState): boolean {
  const remaining = s.players.map((_, i) => i).filter((i) => !s.players[i].finished)
  if (remaining.length > 1 && (s.options.playToEnd || s.rankings.length === 0)) return false
  remaining
    .sort((a, b) => progressSum(s.players[b]) - progressSum(s.players[a]))
    .forEach((i) => s.rankings.push(i))
  s.phase = 'over'
  s.dice = null
  const winner = s.players[s.rankings[0]]
  log(s, winner.color, `Game over. ${winner.name} ${verb(winner.name, 'wins', 'win')}!`)
  return true
}

function drawCard(s: GameState, p: Player) {
  if (s.deck.length === 0) {
    if (s.discard.length === 0) return
    s.deck = shuffle(s.discard, s)
    s.discard = []
    log(s, null, 'Deck reshuffled')
  }
  p.hand.push(s.deck.pop()!)
}

function describeCaptures(s: GameState, captured: CapturedToken[]): string {
  const byPlayer = new Map<number, number>()
  for (const c of captured) byPlayer.set(c.player, (byPlayer.get(c.player) ?? 0) + 1)
  return [...byPlayer.entries()]
    .map(([pi, n]) => (n > 1 ? `${n} ${s.players[pi].name} tokens` : s.players[pi].name))
    .join(' and ')
}

function applyMove(s: GameState, m: Move, card: Card | null): boolean {
  const p = s.players[m.player]
  const opts = s.options
  p.stats.moves++

  if (m.kind === 'swap') {
    const other = s.players[m.target.player]
    p.tokens[m.token] = m.to
    other.tokens[m.target.token] = m.targetTo
    s.event = {
      seq: ++s.eventSeq,
      kind: 'swap',
      player: m.player,
      token: m.token,
      path: [m.to],
      captured: [],
      reachedHome: false,
      finished: false,
      swap: { target: m.target, from: m.targetFrom, to: m.targetTo },
    }
    log(s, p.color, `${p.name} played Swap with ${other.name}`)
    return false
  }

  const captured = capturesFor(s, m)
  p.tokens[m.token] = m.to
  for (const c of captured) {
    s.players[c.player].tokens[c.token] = BASE
    s.players[c.player].stats.lost++
    p.stats.captures++
  }
  const reachedHome = m.to === HOME
  const finished = p.tokens.every((t) => t === HOME)
  const path: number[] = []
  if (m.from === BASE) path.push(0)
  else for (let q = m.from + 1; q <= m.to; q++) path.push(q)
  s.event = { seq: ++s.eventSeq, kind: 'step', player: m.player, token: m.token, path, captured, reachedHome, finished }

  const played = card ? (card.kind === 'wild' ? `played Wild as ${m.value}` : `played ${cardLabel(card)}`) : null
  if (m.from === BASE) {
    log(s, p.color, played ? `${p.name} ${played} and brought a token out` : `${p.name} rolled 6 and brought a token out`)
  } else {
    log(s, p.color, played ? `${p.name} ${played}` : `${p.name} moved ${m.value}`)
  }
  if (captured.length) log(s, p.color, `${p.name} captured ${describeCaptures(s, captured)}!`)
  if (reachedHome) {
    const home = p.tokens.filter((t) => t === HOME).length
    log(s, p.color, `${p.name} got a token home (${home}/${TOKENS_PER_PLAYER})`)
  }
  if (finished) {
    p.finished = true
    s.rankings.push(m.player)
    log(s, p.color, `${p.name} finished ${ordinal(s.rankings.length)}!`)
  }

  return (
    (m.value === 6 && opts.bonusOnSix) ||
    (captured.length > 0 && opts.bonusOnCapture) ||
    (reachedHome && opts.bonusOnHome)
  )
}

export function reducer(state: GameState, action: Action): GameState {
  if (state.phase === 'over') return state
  const s: GameState = structuredClone(state)
  const p = s.players[s.current]

  switch (action.type) {
    case 'roll': {
      if (s.options.mode !== 'dice' || s.phase !== 'roll') return state
      const v = 1 + Math.floor(nextRandom(s) * 6)
      s.dice = v
      s.lastDice = v
      s.rollSeq++
      if (v === 6) {
        s.sixStreak++
        p.stats.sixes++
      } else {
        s.sixStreak = 0
      }
      if (v === 6 && s.options.threeSixes && s.sixStreak >= 3) {
        s.phase = 'pass'
        s.stuck = 'threesixes'
        log(s, p.color, `${p.name} rolled three 6s in a row and ${verb(p.name, 'loses', 'lose')} the turn`)
        return s
      }
      s.phase = 'move'
      if (legalMoves(s).length === 0) {
        s.phase = 'pass'
        s.stuck = 'nomoves'
        log(s, p.color, `${p.name} rolled ${v}, no move`)
      }
      return s
    }

    case 'pass': {
      if (s.phase !== 'pass') return state
      const bonus = s.stuck === 'nomoves' && s.dice === 6 && s.options.bonusOnSix
      finishTurn(s, bonus)
      return s
    }

    case 'discard': {
      if (s.phase !== 'discard') return state
      const idx = p.hand.findIndex((c) => c.id === action.cardId)
      if (idx < 0) return state
      const [card] = p.hand.splice(idx, 1)
      s.discard.push(card)
      s.lastCardBy = s.current
      log(s, p.color, `${p.name} couldn't play and threw away a ${cardLabel(card)}`)
      drawCard(s, p)
      finishTurn(s, false)
      return s
    }

    case 'move': {
      if (s.phase !== 'move') return state
      const key = moveKey(action.move)
      const move = legalMoves(s).find((m) => moveKey(m) === key)
      if (!move) return state
      let card: Card | null = null
      if (move.cardId !== null) {
        const idx = p.hand.findIndex((c) => c.id === move.cardId)
        card = p.hand.splice(idx, 1)[0]
        s.discard.push(card)
        s.lastCardBy = s.current
      }
      const bonus = applyMove(s, move, card)
      if (s.options.mode === 'cards') {
        if (p.finished) {
          // Keep the card just played on top so the pile still shows it.
          s.discard.splice(s.discard.length - 1, 0, ...p.hand)
          p.hand = []
        } else {
          drawCard(s, p)
        }
      }
      s.dice = null
      if (p.finished && checkGameOver(s)) return s
      finishTurn(s, bonus)
      return s
    }
  }
}

/** Tokens home for each player, for scoreboards. */
export function tokensHome(p: Player): number {
  return p.tokens.filter((t) => t === HOME).length
}
