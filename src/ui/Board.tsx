import { memo, type KeyboardEvent } from 'react'
import {
  HOME,
  HOME_COLUMN,
  HOME_COLUMN_START,
  SAFE_INDICES,
  START_INDEX,
  TRACK,
  YARD_ORIGIN,
  tokenSpot,
  trackIndex,
  type Point,
} from '../engine/board'
import { ordinal } from '../engine/rules'
import { COLORS, type Color, type GameState } from '../engine/types'
import { PALETTE } from './palette'
import { tokenKey, type Spot } from './useBoardAnimation'

/** Direction of travel out of each start square, in degrees (0 = right). */
const HEADING: Record<Color, number> = { red: 0, green: 90, yellow: 180, blue: 270 }

function starPath(cx: number, cy: number, outer = 0.31, inner = 0.13): string {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    d += `${i === 0 ? 'M' : 'L'}${(cx + r * Math.cos(a)).toFixed(3)} ${(cy + r * Math.sin(a)).toFixed(3)}`
  }
  return d + 'Z'
}

const BoardBase = memo(function BoardBase() {
  const lastTrackOf = (c: Color) => TRACK[trackIndex(c, 50)!]
  return (
    <g>
      <rect x={0} y={0} width={15} height={15} rx={0.5} fill="var(--board)" />
      {TRACK.map(([r, c], i) => {
        const startColor = COLORS.find((col) => START_INDEX[col] === i)
        return (
          <g key={`t${i}`}>
            <rect
              x={c}
              y={r}
              width={1}
              height={1}
              fill={startColor ? PALETTE[startColor].main : 'var(--cell)'}
              stroke="var(--grid)"
              strokeWidth={0.035}
            />
            {startColor && (
              <path
                d="M-0.16 -0.22 L0.16 0 L-0.16 0.22"
                fill="none"
                stroke="#fff"
                strokeWidth={0.09}
                strokeLinecap="round"
                strokeLinejoin="round"
                transform={`translate(${c + 0.5} ${r + 0.5}) rotate(${HEADING[startColor]})`}
              />
            )}
            {!startColor && SAFE_INDICES.has(i) && (
              <path d={starPath(c + 0.5, r + 0.5)} fill="var(--star)" stroke="var(--star-edge)" strokeWidth={0.03} />
            )}
          </g>
        )
      })}
      {COLORS.map((color) => {
        const [er, ec] = lastTrackOf(color)
        return (
          <g key={`hc-${color}`}>
            {HOME_COLUMN[color].map(([r, c], i) => (
              <rect
                key={i}
                x={c}
                y={r}
                width={1}
                height={1}
                fill={PALETTE[color].main}
                stroke="var(--grid)"
                strokeWidth={0.035}
              />
            ))}
            <path
              d="M-0.2 -0.2 L0.2 0 L-0.2 0.2 Z"
              fill={PALETTE[color].main}
              opacity={0.85}
              transform={`translate(${ec + 0.5} ${er + 0.5}) rotate(${HEADING[color]})`}
            />
          </g>
        )
      })}
      <polygon points="6,6 7.5,7.5 6,9" fill={PALETTE.red.main} />
      <polygon points="6,6 9,6 7.5,7.5" fill={PALETTE.green.main} />
      <polygon points="9,6 9,9 7.5,7.5" fill={PALETTE.yellow.main} />
      <polygon points="6,9 9,9 7.5,7.5" fill={PALETTE.blue.main} />
      <path d="M6 6 L9 9 M9 6 L6 9" stroke="rgba(255,255,255,0.55)" strokeWidth={0.04} />
      {/* Aayug & Aashvi monogram where every token is trying to get to. */}
      <circle cx={7.5} cy={7.5} r={0.47} fill="#fff" stroke="var(--gold)" strokeWidth={0.08} />
      <g transform="translate(7.5 7.62) scale(0.024)">
        <text textAnchor="middle" fontSize={14} fontWeight={900} fill="var(--board-edge)">
          A&amp;A
        </text>
      </g>
    </g>
  )
})

function Yard({ color, name, active, rank, present }: { color: Color; name?: string; active: boolean; rank: number | null; present: boolean }) {
  const o = YARD_ORIGIN[color]
  const shade = PALETTE[color]
  return (
    <g transform={`translate(${o.x} ${o.y})`} className={active ? 'yard yard-active' : 'yard'}>
      <rect x={0} y={0} width={6} height={6} fill={present ? shade.main : 'var(--yard-off)'} />
      <rect x={0.75} y={0.75} width={4.5} height={4.5} rx={0.45} fill="var(--yard-inner)" />
      {[
        [2.05, 2.05],
        [3.95, 2.05],
        [2.05, 3.95],
        [3.95, 3.95],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={0.55} fill={present ? shade.soft : 'var(--yard-slot-off)'} stroke={present ? shade.main : 'var(--grid)'} strokeWidth={0.06} />
      ))}
      {name && (
        // Text is drawn at a normal font size and scaled down, so browser
        // minimum-font-size settings can't blow it up.
        <g transform="translate(3 5.06) scale(0.035)">
          <text textAnchor="middle" className="yard-name" fill={present ? shade.dark : 'var(--muted)'} fontSize={12}>
            {name.length > 14 ? name.slice(0, 13) + '…' : name}
          </text>
        </g>
      )}
      {active && <rect x={0.1} y={0.1} width={5.8} height={5.8} rx={0.3} className="yard-glow" stroke={shade.light} />}
      {rank !== null && (
        <g className="yard-rank">
          <circle cx={3} cy={3} r={1.1} fill={shade.dark} />
          <g transform="translate(3 3.25) scale(0.05)">
            <text textAnchor="middle" fill="#fff" fontSize={14} fontWeight={800}>
              {ordinal(rank)}
            </text>
          </g>
        </g>
      )}
    </g>
  )
}

function fan(n: number, i: number): { dx: number; dy: number; scale: number } {
  if (n <= 1) return { dx: 0, dy: 0, scale: 1 }
  if (n === 2) return { dx: i === 0 ? -0.2 : 0.2, dy: 0, scale: 0.72 }
  if (n <= 4) return { dx: i % 2 ? 0.2 : -0.2, dy: i < 2 ? -0.2 : 0.2, scale: 0.62 }
  const a = (i / n) * Math.PI * 2
  return { dx: Math.cos(a) * 0.27, dy: Math.sin(a) * 0.27, scale: 0.5 }
}

function describe(progress: number): string {
  if (progress < 0) return 'in the yard'
  if (progress >= HOME) return 'home'
  if (progress >= HOME_COLUMN_START) return `${HOME - progress} from home`
  return `${HOME - progress} squares from home`
}

const FRAME = 0.85
const NAME_SHADES = [PALETTE.red.light, PALETTE.green.light, PALETTE.yellow.light, PALETTE.blue.light]

function heart(x: number, y: number) {
  return (
    <path
      d="M0 0.15 C-0.34 -0.08 -0.2 -0.36 0 -0.17 C0.2 -0.36 0.34 -0.08 0 0.15 Z"
      transform={`translate(${x} ${y})`}
      fill="var(--gold)"
    />
  )
}

/**
 * The frame carries the two names this edition is made for: Aayug along the
 * top, Aashvi along the bottom, one letter per player colour, with a heart in
 * each corner.
 */
const BoardFrame = memo(function BoardFrame() {
  const word = (text: string, y: number, shift: number) => (
    // Drawn at a normal font size and scaled down, so browser minimum-font-size
    // settings can't blow the letters up. The x nudge offsets the trailing
    // letter-spacing so the word sits centred.
    <g transform={`translate(7.64 ${y}) scale(0.04)`}>
      <text textAnchor="middle" fontSize={14} fontWeight={900} letterSpacing={7}>
        {[...text].map((ch, i) => (
          <tspan key={i} fill={NAME_SHADES[(i + shift) % NAME_SHADES.length]}>
            {ch}
          </tspan>
        ))}
      </text>
    </g>
  )
  const lo = -FRAME / 2
  const hi = 15 + FRAME / 2
  return (
    <g aria-hidden>
      <rect x={-FRAME} y={-FRAME} width={15 + FRAME * 2} height={15 + FRAME * 2} rx={0.9} fill="var(--board-edge)" />
      <rect
        x={-FRAME + 0.12}
        y={-FRAME + 0.12}
        width={15 + FRAME * 2 - 0.24}
        height={15 + FRAME * 2 - 0.24}
        rx={0.8}
        fill="none"
        stroke="var(--gold)"
        strokeOpacity={0.35}
        strokeWidth={0.04}
      />
      {word('AAYUG', -0.25, 0)}
      {word('AASHVI', 15.61, 2)}
      {heart(lo, lo)}
      {heart(hi, lo)}
      {heart(hi, hi)}
      {heart(lo, hi)}
    </g>
  )
})

export interface BoardProps {
  state: GameState
  overrides: Record<string, Spot>
  movable: Set<string>
  targets: Set<string>
  selected: string | null
  hinted: string | null
  ghost: { point: Point; color: Color } | null
  stepMs: number
  onToken: (player: number, token: number) => void
  onHover: (player: number, token: number | null) => void
}

interface Placed {
  key: string
  player: number
  token: number
  color: Color
  progress: number
  spot: Spot
}

export function Board({ state, overrides, movable, targets, selected, hinted, ghost, stepMs, onToken, onHover }: BoardProps) {
  const placed: Placed[] = []
  state.players.forEach((p, player) => {
    p.tokens.forEach((progress, token) => {
      const key = tokenKey(player, token)
      placed.push({ key, player, token, color: p.color, progress, spot: overrides[key] ?? tokenSpot(p.color, progress, token) })
    })
  })

  const groups = new Map<string, Placed[]>()
  for (const t of placed) {
    const g = groups.get(t.spot.key) ?? []
    g.push(t)
    groups.set(t.spot.key, g)
  }

  const movingKey = Object.keys(overrides).find((k) => state.event && k === tokenKey(state.event.player, state.event.token))
  const order = (t: Placed) =>
    (t.key === movingKey ? 4 : 0) + (movable.has(t.key) || targets.has(t.key) ? 2 : 0) + (t.player === state.current ? 1 : 0)
  const sorted = [...placed].sort((a, b) => order(a) - order(b))

  const rankOf = (player: number) => {
    const i = state.rankings.indexOf(player)
    return i < 0 ? null : i + 1
  }

  return (
    <svg
      className="board"
      viewBox={`${-FRAME} ${-FRAME} ${15 + FRAME * 2} ${15 + FRAME * 2}`}
      role="img"
      aria-label="Ludo board, Aayug and Aashvi edition"
    >
      <BoardFrame />
      <BoardBase />
      {COLORS.map((color) => {
        const pi = state.players.findIndex((p) => p.color === color)
        return (
          <Yard
            key={color}
            color={color}
            present={pi >= 0}
            name={pi >= 0 ? state.players[pi].name : undefined}
            active={pi === state.current && state.phase !== 'over'}
            rank={pi >= 0 ? rankOf(pi) : null}
          />
        )
      })}

      {ghost && (
        <circle
          className="ghost"
          cx={ghost.point.x}
          cy={ghost.point.y}
          r={0.34}
          fill={PALETTE[ghost.color].light}
          stroke={PALETTE[ghost.color].dark}
        />
      )}

      {sorted.map((t) => {
        const group = groups.get(t.spot.key)!
        const { dx, dy, scale: base } = fan(group.length, group.indexOf(t))
        const scale = t.spot.key.startsWith('home-') ? Math.min(base, 0.62) : base
        const x = t.spot.point.x + dx
        const y = t.spot.point.y + dy
        const clickable = movable.has(t.key) || targets.has(t.key)
        const shade = PALETTE[t.color]
        const player = state.players[t.player]
        const isMoving = t.key === movingKey
        const dur = isMoving ? Math.round(stepMs * 0.85) : Math.max(260, stepMs * 3)
        const onKey = (e: KeyboardEvent) => {
          if (clickable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onToken(t.player, t.token)
          }
        }
        return (
          <g
            key={t.key}
            className={[
              'token',
              clickable ? 'token-clickable' : '',
              targets.has(t.key) ? 'token-target' : '',
              selected === t.key ? 'token-selected' : '',
            ].join(' ')}
            style={{ transform: `translate(${x}px, ${y}px)`, transitionDuration: `${dur}ms` }}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : -1}
            aria-label={`${player.name} token ${t.token + 1}, ${describe(t.progress)}`}
            onClick={clickable ? () => onToken(t.player, t.token) : undefined}
            onKeyDown={onKey}
            onPointerEnter={clickable ? () => onHover(t.player, t.token) : undefined}
            onPointerLeave={clickable ? () => onHover(t.player, null) : undefined}
            onFocus={clickable ? () => onHover(t.player, t.token) : undefined}
            onBlur={clickable ? () => onHover(t.player, null) : undefined}
          >
            <g className="token-body" style={{ transform: `scale(${scale})`, transitionDuration: `${Math.max(200, stepMs * 2)}ms` }}>
              {clickable && <circle r={0.56} className="token-ring" stroke={targets.has(t.key) ? '#111' : shade.dark} />}
              {hinted === t.key && <circle r={0.66} className="token-hint" />}
              <ellipse cx={0} cy={0.17} rx={0.33} ry={0.13} fill="rgba(0,0,0,0.28)" />
              <circle r={0.37} fill={shade.main} stroke={shade.dark} strokeWidth={0.07} />
              <circle r={0.2} fill={shade.light} stroke={shade.dark} strokeWidth={0.045} />
              <circle cx={-0.12} cy={-0.15} r={0.075} fill="#fff" opacity={0.75} />
              {/* Bigger invisible hit area for fingers. */}
              {clickable && <circle r={0.62} fill="transparent" />}
            </g>
          </g>
        )
      })}
    </svg>
  )
}
