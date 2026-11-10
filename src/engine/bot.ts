import { BASE, HOME, HOME_COLUMN_START, LAST_TRACK, SAFE_INDICES, TRACK_LENGTH, isSafeProgress, trackIndex } from './board'
import { capturesFor, legalMoves, tokensOnSquare } from './rules'
import type { Action, BotLevel, Card, GameState, Move, TokenRef } from './types'

/** How many opponent tokens could land on track square `abs` with their next move (1-6 steps). */
export function threatsAt(s: GameState, player: number, abs: number, ignore: TokenRef[] = []): number {
  let threats = 0
  s.players.forEach((other, op) => {
    if (op === player || other.finished) return
    other.tokens.forEach((q, ot) => {
      if (ignore.some((t) => t.player === op && t.token === ot)) return
      const a = trackIndex(other.color, q)
      if (a === null) return
      const d = (abs - a + TRACK_LENGTH) % TRACK_LENGTH
      if (d >= 1 && d <= 6 && q + d <= LAST_TRACK) threats++
    })
  })
  return threats
}

/** Opponent tokens 1-6 squares ahead of `abs` (targets for next turn). */
function preyAhead(s: GameState, player: number, abs: number): number {
  let prey = 0
  s.players.forEach((other, op) => {
    if (op === player) return
    other.tokens.forEach((q) => {
      const a = trackIndex(other.color, q)
      if (a === null || SAFE_INDICES.has(a)) return
      const d = (a - abs + TRACK_LENGTH) % TRACK_LENGTH
      if (d >= 1 && d <= 6) prey++
    })
  })
  return prey
}

function cardOf(s: GameState, m: Move): Card | null {
  if (m.cardId === null) return null
  return s.players[m.player].hand.find((c) => c.id === m.cardId) ?? null
}

/** Heuristic value of a move for the player making it. Higher is better. */
export function scoreMove(s: GameState, m: Move, level: BotLevel = 'hard'): number {
  const p = s.players[m.player]
  const color = p.color
  const careful = level !== 'easy'
  let score = 0

  if (m.kind === 'swap') {
    score += (m.to - m.from) * 1.1 + (m.targetFrom - m.targetTo) * 0.9 - 12
    if (careful && !isSafeProgress(color, m.to)) {
      const abs = trackIndex(color, m.to)!
      // The swapped opponent now sits where our token was, so it is no threat from there.
      if (threatsAt(s, m.player, abs, [m.target]) > 0) score -= 20 + m.to * 0.5
    }
    return score
  }

  const captured = capturesFor(s, m)
  if (m.from === BASE) score += 45
  else score += m.value * 1.2

  if (m.to === HOME) score += 70
  else if (m.to >= HOME_COLUMN_START && m.from <= LAST_TRACK) score += 30

  for (const c of captured) score += 55 + c.from * 0.9

  if (careful) {
    if (m.from >= 0 && m.from <= LAST_TRACK && !isSafeProgress(color, m.from)) {
      if (threatsAt(s, m.player, trackIndex(color, m.from)!) > 0) score += 18 + m.from * 0.5
    }
    if (m.to <= LAST_TRACK) {
      const abs = trackIndex(color, m.to)!
      if (SAFE_INDICES.has(abs)) {
        if (m.from !== BASE) score += 10
      } else if (threatsAt(s, m.player, abs, captured) > 0) {
        score -= 25 + m.to * 0.6
      }
      if (level === 'hard') score += preyAhead(s, m.player, abs) * 5
      if (s.options.blockades && !SAFE_INDICES.has(abs)) {
        const mine = tokensOnSquare(s, abs).filter((t) => t.player === m.player).length
        if (mine >= 1) score += 8
      }
    }
  }

  const card = cardOf(s, m)
  if (card) {
    const inYard = p.tokens.some((t) => t === BASE)
    if (card.kind === 'wild') score -= 14
    else if (card.value === 6 && inYard && m.from !== BASE) score -= 10
  }
  return score
}

/** How much the bot wants to keep a card. The lowest one gets thrown away when stuck. */
function keepValue(s: GameState, player: number, card: Card): number {
  const p = s.players[player]
  if (card.kind === 'wild') return 100
  if (card.kind === 'swap') return 40
  const inYard = p.tokens.some((t) => t === BASE)
  if (card.value === 6 && inYard) return 90
  const onTrack = p.tokens.some((t) => t >= 0 && t <= LAST_TRACK)
  // Near the end only small exact numbers help, so keep those instead.
  return onTrack || inYard ? card.value : 7 - card.value
}

export function bestMove(s: GameState, level: BotLevel = 'hard', rng: () => number = Math.random): Move | null {
  const moves = legalMoves(s)
  if (moves.length === 0) return null
  if (level === 'easy' && rng() < 0.45) return moves[Math.floor(rng() * moves.length)]
  const noise = level === 'normal' ? 6 : level === 'easy' ? 10 : 0
  let best = moves[0]
  let bestScore = -Infinity
  for (const m of moves) {
    const sc = scoreMove(s, m, level) + rng() * noise
    if (sc > bestScore) {
      bestScore = sc
      best = m
    }
  }
  return best
}

/** What a bot does in the current state, or null when it isn't a bot's turn. */
export function botAction(s: GameState, rng: () => number = Math.random): Action | null {
  if (s.phase === 'over') return null
  const p = s.players[s.current]
  const level = p.bot
  if (!level) return null
  switch (s.phase) {
    case 'roll':
      return { type: 'roll' }
    case 'pass':
      return { type: 'pass' }
    case 'discard': {
      const card = p.hand.reduce((lo, c) => (keepValue(s, s.current, c) < keepValue(s, s.current, lo) ? c : lo))
      return { type: 'discard', cardId: card.id }
    }
    case 'move': {
      const move = bestMove(s, level, rng)
      return move ? { type: 'move', move } : null
    }
  }
}
