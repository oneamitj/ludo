import { useEffect, useState } from 'react'
import type { Color } from '../engine/types'
import { PALETTE } from './palette'

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
}

export function DieFace({ value, color, size = 64 }: { value: number | null; color: Color; size?: number }) {
  const shade = PALETTE[color]
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden>
      <rect x={1} y={1} width={28} height={28} rx={6} fill="#fff" stroke={shade.dark} strokeWidth={1.6} />
      {value !== null &&
        PIPS[value].map(([r, c], i) => <circle key={i} cx={7.5 + c * 7.5} cy={7.5 + r * 7.5} r={2.7} fill={shade.dark} />)}
      {value === null && <text x={15} y={19.5} textAnchor="middle" fontSize={11} fontWeight={700} fill={shade.dark}>?</text>}
    </svg>
  )
}

export function Dice({
  value,
  color,
  rolling,
  canRoll,
  onRoll,
}: {
  value: number | null
  color: Color
  rolling: boolean
  canRoll: boolean
  onRoll: () => void
}) {
  const [face, setFace] = useState<number | null>(value)

  useEffect(() => {
    if (!rolling) {
      setFace(value)
      return
    }
    const id = window.setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 70)
    return () => clearInterval(id)
  }, [rolling, value])

  return (
    <button
      type="button"
      className={`die ${rolling ? 'die-rolling' : ''} ${canRoll ? 'die-ready' : ''}`}
      onClick={onRoll}
      disabled={!canRoll}
      aria-label={canRoll ? 'Roll the die' : value ? `Die shows ${value}` : 'Die'}
      style={{ ['--glow' as string]: PALETTE[color].main }}
    >
      <DieFace value={face} color={color} size={76} />
    </button>
  )
}
