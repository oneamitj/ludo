import { PALETTE } from './palette'

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect x={1} y={1} width={14} height={14} rx={3.5} fill={PALETTE.red.main} />
      <rect x={17} y={1} width={14} height={14} rx={3.5} fill={PALETTE.green.main} />
      <rect x={17} y={17} width={14} height={14} rx={3.5} fill={PALETTE.yellow.main} />
      <rect x={1} y={17} width={14} height={14} rx={3.5} fill={PALETTE.blue.main} />
      <circle cx={16} cy={16} r={4.2} fill="#fff" />
    </svg>
  )
}
