import { BookOpen, Dices, Layers, Play } from 'lucide-react'
import { useState } from 'react'
import { COLOR_NAMES } from '../engine/rules'
import type { BotLevel, Options, SeatConfig, SeatKind } from '../engine/types'
import { Logo } from './Logo'
import { Modal } from './Modal'
import { PALETTE } from './palette'
import { Rules } from './Rules'
import type { SetupData } from './storage'

type Preset = 'solo' | 'duel' | 'duel-bots' | 'four'

const PRESETS: { id: Preset; label: string; kinds: SeatKind[] }[] = [
  { id: 'solo', label: 'You vs 3 bots', kinds: ['human', 'bot', 'bot', 'bot'] },
  { id: 'duel', label: '2 players', kinds: ['human', 'off', 'human', 'off'] },
  { id: 'duel-bots', label: '2 players + 2 bots', kinds: ['human', 'bot', 'human', 'bot'] },
  { id: 'four', label: '4 players', kinds: ['human', 'human', 'human', 'human'] },
]

function renameFor(seat: SeatConfig, kind: SeatKind): string {
  const name = seat.name.trim()
  if (kind === 'bot' && (name === '' || name === 'You')) return COLOR_NAMES[seat.color]
  return seat.name
}

export function SetupScreen({
  setup,
  onChange,
  onStart,
  resumeInfo,
  onResume,
}: {
  setup: SetupData
  onChange: (s: SetupData) => void
  onStart: () => void
  resumeInfo: string | null
  onResume: () => void
}) {
  const [rulesOpen, setRulesOpen] = useState(false)
  const { seats, options } = setup
  const active = seats.filter((s) => s.kind !== 'off')
  const humans = seats.filter((s) => s.kind === 'human').length
  const valid = active.length >= 2

  const setSeat = (i: number, patch: Partial<SeatConfig>) =>
    onChange({ ...setup, seats: seats.map((s, k) => (k === i ? { ...s, ...patch } : s)) })
  const setOpt = (patch: Partial<Options>) => onChange({ ...setup, options: { ...options, ...patch } })
  const applyPreset = (kinds: SeatKind[]) =>
    onChange({
      ...setup,
      seats: seats.map((s, i) => ({ ...s, kind: kinds[i], name: renameFor(s, kinds[i]) })),
    })

  return (
    <div className="screen setup-screen">
      <header className="hero">
        <Logo size={64} />
        <div>
          <h1>Ludo</h1>
          <p className="edition">
            Aayug <span>&amp;</span> Aashvi edition
          </p>
          <p>One to four players on this device. Bots take any seat you leave empty.</p>
        </div>
      </header>

      {resumeInfo && (
        <div className="resume">
          <span>{resumeInfo}</span>
          <button type="button" className="btn btn-primary" onClick={onResume}>
            <Play size={16} /> Continue
          </button>
        </div>
      )}

      <section className="panel">
        <h2>Game</h2>
        <div className="mode-pick" role="radiogroup" aria-label="Game type">
          <button
            type="button"
            role="radio"
            aria-checked={options.mode === 'cards'}
            className={options.mode === 'cards' ? 'mode mode-on' : 'mode'}
            onClick={() => setOpt({ mode: 'cards' })}
          >
            <Layers size={26} />
            <strong>Card Ludo</strong>
            <span>Play a card from your hand instead of rolling. Wilds and swaps give you real choices.</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={options.mode === 'dice'}
            className={options.mode === 'dice' ? 'mode mode-on' : 'mode'}
            onClick={() => setOpt({ mode: 'dice' })}
          >
            <Dices size={26} />
            <strong>Classic</strong>
            <span>Roll the die and hope for a 6. The game you grew up with.</span>
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Players</h2>
          <span className="muted">
            {humans} {humans === 1 ? 'person' : 'people'}, {active.length - humans} {active.length - humans === 1 ? 'bot' : 'bots'}
          </span>
        </div>
        <div className="presets">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="chip" onClick={() => applyPreset(p.kinds)}>
              {p.label}
            </button>
          ))}
        </div>
        <ul className="seats">
          {seats.map((seat, i) => {
            const shade = PALETTE[seat.color]
            const off = seat.kind === 'off'
            return (
              <li key={seat.color} className={`seat ${off ? 'seat-off' : ''}`} style={{ ['--accent' as string]: shade.main }}>
                <span className="seat-swatch" aria-hidden />
                <input
                  className="seat-name"
                  value={seat.name}
                  placeholder={COLOR_NAMES[seat.color]}
                  maxLength={16}
                  disabled={off}
                  aria-label={`${COLOR_NAMES[seat.color]} player name`}
                  onChange={(e) => setSeat(i, { name: e.target.value })}
                />
                <div className="segmented" role="radiogroup" aria-label={`${COLOR_NAMES[seat.color]} seat`}>
                  {(['human', 'bot', 'off'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={seat.kind === k}
                      className={seat.kind === k ? 'seg seg-on' : 'seg'}
                      onClick={() => setSeat(i, { kind: k, name: renameFor(seat, k) })}
                    >
                      {k === 'human' ? 'Human' : k === 'bot' ? 'Bot' : 'Off'}
                    </button>
                  ))}
                </div>
                {seat.kind === 'bot' && (
                  <select
                    className="seat-level"
                    value={seat.level}
                    aria-label={`${COLOR_NAMES[seat.color]} bot strength`}
                    onChange={(e) => setSeat(i, { level: e.target.value as BotLevel })}
                  >
                    <option value="easy">Easy</option>
                    <option value="normal">Normal</option>
                    <option value="hard">Hard</option>
                  </select>
                )}
              </li>
            )
          })}
        </ul>
        {!valid && <p className="warn">Turn on at least two seats to play.</p>}
      </section>

      <section className="panel">
        <details className="house">
          <summary>
            <h2>House rules</h2>
          </summary>
          <div className="options">
            {options.mode === 'cards' && (
              <div className="option-row">
                <span>Cards in each hand</span>
                <div className="segmented">
                  {[3, 4, 5].map((n) => (
                    <button key={n} type="button" className={options.handSize === n ? 'seg seg-on' : 'seg'} onClick={() => setOpt({ handSize: n })}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Check label="Extra turn after a 6" checked={options.bonusOnSix} onChange={(v) => setOpt({ bonusOnSix: v })} />
            <Check label="Extra turn after a capture" checked={options.bonusOnCapture} onChange={(v) => setOpt({ bonusOnCapture: v })} />
            <Check label="Extra turn when a token gets home" checked={options.bonusOnHome} onChange={(v) => setOpt({ bonusOnHome: v })} />
            {options.mode === 'dice' && (
              <Check label="Three 6s in a row ends your turn" checked={options.threeSixes} onChange={(v) => setOpt({ threeSixes: v })} />
            )}
            <Check
              label="Blockades: two tokens of one colour block the road"
              checked={options.blockades}
              onChange={(v) => setOpt({ blockades: v })}
            />
            <Check
              label="Keep playing after the winner to decide every place"
              checked={options.playToEnd}
              onChange={(v) => setOpt({ playToEnd: v })}
            />
          </div>
        </details>
      </section>

      <div className="setup-actions">
        <button type="button" className="btn btn-primary btn-big" disabled={!valid} onClick={onStart}>
          <Play size={18} /> Start game
        </button>
        <button type="button" className="btn" onClick={() => setRulesOpen(true)}>
          <BookOpen size={16} /> How to play
        </button>
      </div>

      {rulesOpen && (
        <Modal title="How to play" onClose={() => setRulesOpen(false)} wide>
          <Rules />
        </Modal>
      )}
    </div>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
