import { Bot, User } from 'lucide-react'
import { ordinal, tokensHome } from '../engine/rules'
import type { GameState } from '../engine/types'
import { PALETTE } from './palette'

export function PlayerList({ state }: { state: GameState }) {
  return (
    <ul className="players" aria-label="Players">
      {state.players.map((p, i) => {
        const rank = state.rankings.indexOf(i)
        const home = tokensHome(p)
        const active = i === state.current && state.phase !== 'over'
        return (
          <li
            key={p.color}
            className={`player ${active ? 'player-active' : ''} ${rank >= 0 ? 'player-done' : ''}`}
            style={{ ['--accent' as string]: PALETTE[p.color].main, ['--accent-soft' as string]: PALETTE[p.color].light }}
            aria-current={active ? 'true' : undefined}
          >
            <span className="player-dot" />
            <span className="player-name">
              {p.name}
              <span className="player-kind">
                {p.bot ? (
                  <>
                    <Bot size={12} /> {p.bot}
                  </>
                ) : (
                  <>
                    <User size={12} /> human
                  </>
                )}
              </span>
            </span>
            {rank >= 0 ? (
              <span className="player-rank">{ordinal(rank + 1)}</span>
            ) : (
              <span className="player-home" aria-label={`${home} of 4 home`}>
                {[0, 1, 2, 3].map((k) => (
                  <span key={k} className={k < home ? 'pip pip-on' : 'pip'} />
                ))}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
