import { ordinal } from '../engine/rules'
import type { GameState } from '../engine/types'
import { PALETTE } from './palette'

export function Results({ state, onRematch, onNewGame }: { state: GameState; onRematch: () => void; onNewGame: () => void }) {
  return (
    <div className="results">
      <ol className="results-list">
        {state.rankings.map((pi, place) => {
          const p = state.players[pi]
          return (
            <li key={p.color} style={{ ['--accent' as string]: PALETTE[p.color].main }}>
              <span className={`medal medal-${place + 1}`}>{ordinal(place + 1)}</span>
              <span className="results-name">
                {p.name}
                {p.bot && <small> (bot)</small>}
              </span>
              <span className="results-stats">
                {p.stats.captures} captured · {p.stats.lost} lost · {p.stats.turns} {p.stats.turns === 1 ? 'turn' : 'turns'}
              </span>
            </li>
          )
        })}
      </ol>
      <div className="results-actions">
        <button type="button" className="btn btn-primary" onClick={onRematch}>
          Rematch
        </button>
        <button type="button" className="btn" onClick={onNewGame}>
          New setup
        </button>
      </div>
    </div>
  )
}
