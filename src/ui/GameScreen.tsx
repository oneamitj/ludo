import confetti from 'canvas-confetti'
import { BookOpen, Lightbulb, Menu, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { tokenSpot } from '../engine/board'
import { bestMove, botAction } from '../engine/bot'
import { cardLabel } from '../engine/cards'
import { legalMoves, reducer, verb } from '../engine/rules'
import type { Card, GameState, Move } from '../engine/types'
import { Board } from './Board'
import { CardBack, CardView } from './CardView'
import { Dice } from './Dice'
import { GameLog } from './GameLog'
import { Logo } from './Logo'
import { Modal } from './Modal'
import { PALETTE } from './palette'
import { PlayerList } from './PlayerList'
import { Results } from './Results'
import { Rules } from './Rules'
import { sfx } from './sound'
import { saveGame, type Prefs, type Speed } from './storage'
import { tokenKey, useBoardAnimation } from './useBoardAnimation'

const STEP_MS: Record<Speed, number> = { slow: 230, normal: 150, fast: 75 }
const BOT_MS: Record<Speed, number> = { slow: 1100, normal: 700, fast: 280 }

interface Selection {
  cardId: number | null
  wildValue: number | null
  swapToken: number | null
}
const EMPTY: Selection = { cardId: null, wildValue: null, swapToken: null }

/** Moves that end up in the same place count once (e.g. two yard tokens both releasing). */
function distinct(moves: Move[]): Move[] {
  const seen = new Map<string, Move>()
  for (const m of moves) {
    const k = m.kind === 'swap' ? `w${m.token}-${m.target.player}-${m.target.token}` : `${m.from}>${m.to}`
    if (!seen.has(k)) seen.set(k, m)
  }
  return [...seen.values()]
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => setReduced(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return reduced
}

export interface GameScreenProps {
  initial: GameState
  prefs: Prefs
  onPrefs: (p: Prefs) => void
  onExit: () => void
  onRematch: () => void
}

export function GameScreen({ initial, prefs, onPrefs, onExit, onRematch }: GameScreenProps) {
  const [state, dispatch] = useReducer(reducer, initial)
  const reduced = useReducedMotion()
  const stepMs = reduced ? 30 : STEP_MS[prefs.speed]
  const { overrides, busy, rolling } = useBoardAnimation(state, stepMs)

  const [modal, setModal] = useState<'rules' | 'menu' | 'results' | null>(null)
  const [sel, setSel] = useState<Selection>(EMPTY)
  const [hover, setHover] = useState<string | null>(null)
  const [hint, setHint] = useState<Move | null>(null)
  const [revealedFor, setRevealedFor] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const celebrated = useRef(false)

  const me = state.players[state.current]
  const cardsMode = state.options.mode === 'cards'
  const humans = state.players.filter((p) => !p.bot).length
  const handHidden = cardsMode && !me.bot && prefs.hideHands && humans > 1 && revealedFor !== state.current
  const canAct = !me.bot && !busy && !modal && state.phase !== 'over'
  const moves = useMemo(() => legalMoves(state), [state])
  const selectedCard: Card | null = me.hand.find((c) => c.id === sel.cardId) ?? null
  const playable = useMemo(() => new Set(moves.map((m) => m.cardId)), [moves])

  useEffect(() => {
    saveGame(state.phase === 'over' ? null : state)
  }, [state])

  useEffect(() => {
    setSel(EMPTY)
    setHint(null)
    setHover(null)
    setNotice(null)
  }, [state])

  useEffect(() => {
    setRevealedFor((r) => (r === state.current ? r : null))
  }, [state.current])

  useEffect(() => {
    if (state.phase === 'pass') sfx.stuck()
  }, [state.phase, state.rollSeq])

  // Bots, auto-continue after a dead roll, and auto-moves when there is only one choice.
  const botDelay = BOT_MS[prefs.speed]
  useEffect(() => {
    if (busy || modal || state.phase === 'over') return
    let t: number | undefined
    if (me.bot) {
      const delay = state.phase === 'pass' ? botDelay + 350 : state.phase === 'roll' ? botDelay * 0.7 : botDelay
      t = window.setTimeout(() => {
        const a = botAction(state)
        if (!a) return
        if ((a.type === 'move' && a.move.cardId !== null) || a.type === 'discard') sfx.card()
        dispatch(a)
      }, delay)
    } else if (state.phase === 'pass') {
      t = window.setTimeout(() => dispatch({ type: 'pass' }), 1500)
    } else if (state.phase === 'move' && !cardsMode && prefs.autoMove) {
      const d = distinct(moves)
      if (d.length === 1) t = window.setTimeout(() => dispatch({ type: 'move', move: d[0] }), 450)
    }
    return () => clearTimeout(t)
  }, [state, busy, modal, botDelay, prefs.autoMove, cardsMode, me.bot, moves])

  useEffect(() => {
    if (state.phase !== 'over' || busy || celebrated.current) return
    celebrated.current = true
    setModal('results')
    if (!reduced) {
      const colors = state.rankings.slice(0, 1).map((i) => PALETTE[state.players[i].color].main)
      void confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: [...colors, '#ffffff', '#f2b400'] })
    }
  }, [state.phase, busy, reduced, state.rankings, state.players])

  // ---- what the human can click right now ----
  const movable = new Set<string>()
  const targets = new Set<string>()
  let candidates: Move[] = []
  if (state.phase === 'move' && canAct && !handHidden) {
    if (!cardsMode) {
      candidates = moves
    } else if (selectedCard?.kind === 'num') {
      candidates = moves.filter((m) => m.cardId === selectedCard.id)
    } else if (selectedCard?.kind === 'wild' && sel.wildValue !== null) {
      candidates = moves.filter((m) => m.cardId === selectedCard.id && m.kind === 'step' && m.value === sel.wildValue)
    } else if (selectedCard?.kind === 'swap') {
      const all = moves.filter((m) => m.cardId === selectedCard.id)
      all.forEach((m) => movable.add(tokenKey(m.player, m.token)))
      if (sel.swapToken !== null) {
        candidates = all.filter((m) => m.token === sel.swapToken)
        candidates.forEach((m) => m.kind === 'swap' && targets.add(tokenKey(m.target.player, m.target.token)))
      }
    }
    if (selectedCard?.kind !== 'swap') candidates.forEach((m) => movable.add(tokenKey(m.player, m.token)))
  }

  const play = (m: Move) => {
    if (m.cardId !== null) sfx.card()
    dispatch({ type: 'move', move: m })
  }

  const onToken = (player: number, token: number) => {
    if (!canAct || state.phase !== 'move') return
    if (selectedCard?.kind === 'swap') {
      if (player === state.current) {
        setSel((s) => ({ ...s, swapToken: token }))
        return
      }
      const m = candidates.find((c) => c.kind === 'swap' && c.target.player === player && c.target.token === token)
      if (m) play(m)
      return
    }
    const m = candidates.find((c) => c.player === player && c.token === token)
    if (m) play(m)
  }

  const onCard = (card: Card) => {
    if (!canAct || handHidden) return
    if (state.phase === 'discard') {
      setSel(sel.cardId === card.id ? EMPTY : { ...EMPTY, cardId: card.id })
      return
    }
    if (state.phase !== 'move') return
    if (sel.cardId === card.id) {
      setSel(EMPTY)
      return
    }
    const cardMoves = moves.filter((m) => m.cardId === card.id)
    if (cardMoves.length === 0) {
      setNotice(`The ${cardLabel(card)} can't move anything right now.`)
      return
    }
    setNotice(null)
    setHint(null)
    setSel({ ...EMPTY, cardId: card.id })
    if (card.kind === 'num' && prefs.autoMove) {
      const d = distinct(cardMoves)
      if (d.length === 1) play(d[0])
    }
  }

  const onWild = (v: number) => {
    if (!selectedCard || selectedCard.kind !== 'wild') return
    setSel((s) => ({ ...s, wildValue: v }))
    const vm = moves.filter((m) => m.cardId === selectedCard.id && m.kind === 'step' && m.value === v)
    if (prefs.autoMove && distinct(vm).length === 1) play(vm[0])
  }

  const onHint = () => {
    const m = bestMove(state, 'hard')
    if (!m) return
    setHint(m)
    if (cardsMode && m.cardId !== null) {
      const card = me.hand.find((c) => c.id === m.cardId)
      setSel({
        cardId: m.cardId,
        wildValue: card?.kind === 'wild' && m.kind === 'step' ? m.value : null,
        swapToken: m.kind === 'swap' ? m.token : null,
      })
    }
  }

  const canRoll = canAct && state.phase === 'roll'

  // Keyboard: Space/Enter rolls, digits pick cards or a Wild's number, Esc clears.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandler.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null
    if (modal || target?.closest('input, select, textarea')) return
    const onButton = !!target?.closest('button, [role="button"]')
    if ((e.key === ' ' || e.key === 'Enter') && !onButton) {
      if (canRoll) {
        e.preventDefault()
        dispatch({ type: 'roll' })
      }
    } else if (/^[1-6]$/.test(e.key) && cardsMode && canAct && !handHidden) {
      const n = Number(e.key)
      if (selectedCard?.kind === 'wild' && sel.wildValue === null) onWild(n)
      else if (me.hand[n - 1]) onCard(me.hand[n - 1])
    } else if (e.key === 'Escape') {
      setSel(EMPTY)
      setHint(null)
    }
  }
  useEffect(() => {
    const f = (e: KeyboardEvent) => keyHandler.current(e)
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  // Destination preview for the hovered token.
  let ghost: { point: { x: number; y: number }; color: typeof me.color } | null = null
  if (hover && canAct) {
    const m = candidates.find((c) => c.kind === 'step' && tokenKey(c.player, c.token) === hover)
    if (m) ghost = { point: tokenSpot(me.color, m.to, m.token).point, color: me.color }
  }
  const hinted = hint ? (hint.kind === 'swap' && sel.swapToken !== null ? tokenKey(hint.target.player, hint.target.token) : tokenKey(hint.player, hint.token)) : null
  const selectedToken = selectedCard?.kind === 'swap' && sel.swapToken !== null ? tokenKey(state.current, sel.swapToken) : null

  // While a move animates, the panel still belongs to whoever made it.
  const moving = busy && !rolling && state.event ? state.event.player : null
  const actor = moving !== null ? state.players[moving] : me
  const status = moving !== null ? 'Moving…' : statusText(state, { busy, rolling, handHidden, selectedCard, sel, cardsMode })
  const shade = PALETTE[actor.color]
  const topDiscard = state.discard[state.discard.length - 1]
  const discardColor = state.lastCardBy !== null ? state.players[state.lastCardBy].color : me.color

  return (
    <div className="screen game-screen">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => setModal('menu')} aria-label="Menu">
          <Menu size={20} />
        </button>
        <div className="brand">
          <Logo size={26} />
          <span>Ludo</span>
          <span className="mode-tag">{cardsMode ? 'Cards' : 'Classic'}</span>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={() => onPrefs({ ...prefs, sound: !prefs.sound })}
            aria-label={prefs.sound ? 'Mute sound' : 'Turn sound on'}
            aria-pressed={!prefs.sound}
          >
            {prefs.sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button type="button" className="icon-btn" onClick={() => setModal('rules')} aria-label="Rules">
            <BookOpen size={20} />
          </button>
        </div>
      </header>

      <main className="table">
        <section className="board-area">
          <div className="board-wrap">
            <Board
              state={state}
              overrides={overrides}
              movable={movable}
              targets={targets}
              selected={selectedToken}
              hinted={hinted}
              ghost={ghost}
              stepMs={stepMs}
              onToken={onToken}
              onHover={(p, t) => setHover(t === null ? null : tokenKey(p, t))}
            />
          </div>
        </section>

        <aside className="side">
          <div
            className={`action-panel ${state.phase === 'over' ? '' : 'action-live'}`}
            style={{ ['--accent' as string]: shade.main, ['--accent-dark' as string]: shade.dark, ['--accent-soft' as string]: shade.soft }}
          >
            <div className="turn-line">
              <span className="turn-dot" />
              <span className="turn-name">{state.phase === 'over' && moving === null ? 'Game over' : actor.name}</span>
              {state.bonus && state.phase !== 'over' && moving === null && <span className="bonus-tag">Bonus turn</span>}
            </div>
            <p className="status" role="status">
              {notice ?? status}
            </p>

            {!cardsMode && state.phase !== 'over' && (
              <div className="dice-row">
                <Dice value={state.dice ?? state.lastDice} color={me.color} rolling={rolling} canRoll={canRoll} onRoll={() => dispatch({ type: 'roll' })} />
                {state.phase === 'pass' && !me.bot && (
                  <button type="button" className="btn" onClick={() => dispatch({ type: 'pass' })}>
                    Continue
                  </button>
                )}
              </div>
            )}

            {cardsMode && state.phase !== 'over' && (
              <div className="hand-area">
                <div className="piles">
                  <div className="pile">
                    <CardBack small />
                    <span>{state.deck.length} in deck</span>
                  </div>
                  <div className="pile">
                    {topDiscard ? <CardView card={topDiscard} color={discardColor} small /> : <div className="card card-small card-empty" />}
                    <span>Last played</span>
                  </div>
                </div>

                {me.bot ? (
                  <div className="hand" aria-label={`${me.name}'s hand`}>
                    {me.hand.map((c) => (
                      <CardBack key={c.id} />
                    ))}
                  </div>
                ) : handHidden ? (
                  <button type="button" className="reveal" onClick={() => setRevealedFor(state.current)}>
                    <strong>{verb(me.name, `${me.name}, your turn.`, 'Your turn.')}</strong>
                    <span>Tap to see your cards</span>
                  </button>
                ) : (
                  <div className="hand" aria-label="Your hand">
                    {me.hand.map((c, i) => (
                      <CardView
                        key={c.id}
                        card={c}
                        index={i}
                        color={me.color}
                        selected={sel.cardId === c.id}
                        disabled={state.phase === 'move' && !playable.has(c.id)}
                        onClick={canAct ? () => onCard(c) : undefined}
                      />
                    ))}
                  </div>
                )}

                {selectedCard?.kind === 'wild' && canAct && state.phase === 'move' && (
                  <div className="wild-picker" role="group" aria-label="Wild card value">
                    {[1, 2, 3, 4, 5, 6].map((v) => {
                      const ok = moves.some((m) => m.cardId === selectedCard.id && m.kind === 'step' && m.value === v)
                      return (
                        <button
                          key={v}
                          type="button"
                          className={`btn btn-num ${sel.wildValue === v ? 'btn-num-on' : ''}`}
                          disabled={!ok}
                          onClick={() => onWild(v)}
                        >
                          {v}
                        </button>
                      )
                    })}
                  </div>
                )}

                {state.phase === 'discard' && canAct && !handHidden && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!selectedCard}
                    onClick={() => {
                      if (!selectedCard) return
                      sfx.card()
                      dispatch({ type: 'discard', cardId: selectedCard.id })
                    }}
                  >
                    {selectedCard ? `Throw away the ${cardLabel(selectedCard)}` : 'Pick a card to throw away'}
                  </button>
                )}
              </div>
            )}

            {state.phase === 'move' && canAct && !handHidden && (
              <button type="button" className="btn btn-ghost hint-btn" onClick={onHint}>
                <Lightbulb size={16} /> Hint
              </button>
            )}

            {state.phase === 'over' && (
              <button type="button" className="btn btn-primary" onClick={() => setModal('results')}>
                See results
              </button>
            )}
          </div>

          <PlayerList state={state} />
          <GameLog log={state.log} />
        </aside>
      </main>

      {modal === 'rules' && (
        <Modal title="How to play" onClose={() => setModal(null)} wide>
          <Rules />
        </Modal>
      )}

      {modal === 'menu' && (
        <Modal title="Menu" onClose={() => setModal(null)}>
          <GameMenu
            prefs={prefs}
            onPrefs={onPrefs}
            onResume={() => setModal(null)}
            onRestart={onRematch}
            onExit={onExit}
            showHideHands={cardsMode && humans > 1}
          />
        </Modal>
      )}

      {modal === 'results' && (
        <Modal title="Results" onClose={() => setModal(null)}>
          <Results state={state} onRematch={onRematch} onNewGame={onExit} />
        </Modal>
      )}
    </div>
  )
}

function statusText(
  state: GameState,
  ctx: { busy: boolean; rolling: boolean; handHidden: boolean; selectedCard: Card | null; sel: Selection; cardsMode: boolean },
): string {
  const me = state.players[state.current]
  if (state.phase === 'over') {
    const w = state.players[state.rankings[0]].name
    return `${w} ${verb(w, 'wins', 'win')}!`
  }
  if (ctx.rolling) return 'Rolling…'
  if (state.phase === 'pass') {
    return state.stuck === 'threesixes' ? 'Three 6s in a row. Turn over.' : `A ${state.dice} doesn't move anything.`
  }
  if (me.bot) return `${me.name} is thinking…`
  if (ctx.handHidden) return 'Pass the device, then tap to see the cards.'
  if (state.phase === 'roll') return state.bonus ? 'Roll again.' : 'Roll the die. Tap it or press Space.'
  if (state.phase === 'discard') return 'None of your cards can move. Throw one away.'
  if (!ctx.cardsMode) return `You rolled ${state.dice}. Pick a token.`
  const c = ctx.selectedCard
  if (!c) return 'Pick a card to play.'
  if (c.kind === 'num') return `Move a token ${c.value}.`
  if (c.kind === 'wild') return ctx.sel.wildValue ? `Move a token ${ctx.sel.wildValue}.` : 'Choose a number for the Wild.'
  return ctx.sel.swapToken === null ? 'Pick one of your tokens to swap.' : "Now pick the opponent's token to swap with."
}

function GameMenu({
  prefs,
  onPrefs,
  onResume,
  onRestart,
  onExit,
  showHideHands,
}: {
  prefs: Prefs
  onPrefs: (p: Prefs) => void
  onResume: () => void
  onRestart: () => void
  onExit: () => void
  showHideHands: boolean
}) {
  const [confirm, setConfirm] = useState<'restart' | 'exit' | null>(null)
  if (confirm) {
    return (
      <div className="menu">
        <p>{confirm === 'restart' ? 'Start over with the same players? This game will be lost.' : 'Leave this game and go back to setup? This game will be lost.'}</p>
        <div className="menu-row">
          <button type="button" className="btn btn-danger" onClick={confirm === 'restart' ? onRestart : onExit}>
            {confirm === 'restart' ? 'Start over' : 'Leave game'}
          </button>
          <button type="button" className="btn" onClick={() => setConfirm(null)}>
            Cancel
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="menu">
      <button type="button" className="btn btn-primary" onClick={onResume}>
        Back to the game
      </button>
      <div className="menu-group">
        <span className="menu-label">Speed</span>
        <div className="segmented">
          {(['slow', 'normal', 'fast'] as const).map((s) => (
            <button key={s} type="button" className={prefs.speed === s ? 'seg seg-on' : 'seg'} onClick={() => onPrefs({ ...prefs, speed: s })}>
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <label className="check">
        <input type="checkbox" checked={prefs.sound} onChange={(e) => onPrefs({ ...prefs, sound: e.target.checked })} />
        Sound
      </label>
      <label className="check">
        <input type="checkbox" checked={prefs.autoMove} onChange={(e) => onPrefs({ ...prefs, autoMove: e.target.checked })} />
        Move automatically when there's only one choice
      </label>
      {showHideHands && (
        <label className="check">
          <input type="checkbox" checked={prefs.hideHands} onChange={(e) => onPrefs({ ...prefs, hideHands: e.target.checked })} />
          Hide each player's cards until they tap
        </label>
      )}
      <div className="menu-row">
        <button type="button" className="btn" onClick={() => setConfirm('restart')}>
          Restart
        </button>
        <button type="button" className="btn" onClick={() => setConfirm('exit')}>
          New game
        </button>
      </div>
    </div>
  )
}
