import { ArrowLeftRight, Sparkles } from 'lucide-react'
import type { Card, Color } from '../engine/types'
import { PALETTE } from './palette'

export function CardView({
  card,
  color,
  selected,
  disabled,
  small,
  onClick,
  index,
}: {
  card: Card
  color: Color
  selected?: boolean
  disabled?: boolean
  small?: boolean
  onClick?: () => void
  index?: number
}) {
  const shade = PALETTE[color]
  const label = card.kind === 'wild' ? 'Wild' : card.kind === 'swap' ? 'Swap' : String(card.value)
  const hint = card.kind === 'wild' ? 'any 1-6' : card.kind === 'swap' ? 'trade places' : card.value === 6 ? 'move or start' : 'move'
  const body = (
    <>
      <span className="card-corner">{card.kind === 'num' ? card.value : card.kind === 'wild' ? '★' : '⇄'}</span>
      <span className="card-main">
        {card.kind === 'wild' ? <Sparkles size={small ? 18 : 26} /> : card.kind === 'swap' ? <ArrowLeftRight size={small ? 18 : 26} /> : card.value}
      </span>
      {!small && <span className="card-hint">{card.kind === 'num' ? hint : label}</span>}
    </>
  )
  const style = { ['--card-accent' as string]: shade.main, ['--card-dark' as string]: shade.dark, ['--card-soft' as string]: shade.soft }
  const cls = ['card', `card-${card.kind}`, selected ? 'card-selected' : '', disabled ? 'card-disabled' : '', small ? 'card-small' : ''].join(' ')
  if (!onClick) {
    return (
      <div className={cls} style={style} aria-label={`${label} card`}>
        {body}
      </div>
    )
  }
  return (
    <button
      type="button"
      className={cls}
      style={style}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${label} card${disabled ? ', cannot be played' : ''}${index !== undefined ? ` (key ${index + 1})` : ''}`}
    >
      {body}
    </button>
  )
}

export function CardBack({ small }: { small?: boolean }) {
  return <div className={`card card-back ${small ? 'card-small' : ''}`} aria-hidden />
}
