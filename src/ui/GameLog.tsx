import type { LogEntry } from '../engine/types'
import { PALETTE } from './palette'

export function GameLog({ log }: { log: LogEntry[] }) {
  const recent = log.slice(-40).reverse()
  return (
    <details className="log" open>
      <summary>Game log</summary>
      <ol aria-live="polite">
        {recent.map((e) => (
          <li key={e.id}>
            <span className="log-dot" style={{ background: e.color ? PALETTE[e.color].main : 'var(--muted)' }} />
            {e.text}
          </li>
        ))}
      </ol>
    </details>
  )
}
