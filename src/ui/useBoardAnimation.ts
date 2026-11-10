import { useLayoutEffect, useRef, useState } from 'react'
import { tokenSpot, type Point } from '../engine/board'
import type { GameState } from '../engine/types'
import { sfx } from './sound'

export interface Spot {
  key: string
  point: Point
}

export const tokenKey = (player: number, token: number) => `${player}:${token}`

/**
 * Plays back the last move in `state.event` square by square. While it runs,
 * `overrides` pins the moving token (and anything it captured) to where it
 * should appear, and `busy` tells the game to hold off on bots and input.
 */
export function useBoardAnimation(state: GameState, stepMs: number) {
  const [overrides, setOverrides] = useState<Record<string, Spot>>({})
  const [moving, setMoving] = useState(false)
  const [rolling, setRolling] = useState(false)
  const seenEvent = useRef(state.event?.seq ?? 0)
  const seenRoll = useRef(state.rollSeq)
  const stateRef = useRef(state)
  stateRef.current = state

  useLayoutEffect(() => {
    const ev = state.event
    if (!ev || ev.seq === seenEvent.current) return
    seenEvent.current = ev.seq
    const s = stateRef.current
    let cancelled = false
    const timers: number[] = []
    const wait = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)))
    const colorOf = (p: number) => s.players[p].color
    const key = tokenKey(ev.player, ev.token)

    const held: Record<string, Spot> = {}
    for (const c of ev.captured) held[tokenKey(c.player, c.token)] = tokenSpot(colorOf(c.player), c.from, c.token)

    setMoving(true)
    ;(async () => {
      if (ev.kind === 'swap') {
        sfx.swap()
        setOverrides({})
        await wait(Math.max(380, stepMs * 3))
      } else {
        for (let i = 0; i < ev.path.length; i++) {
          if (cancelled) return
          setOverrides({ ...held, [key]: tokenSpot(colorOf(ev.player), ev.path[i], ev.token) })
          if (i === 0 && ev.path.length === 1 && ev.path[0] === 0) sfx.release()
          else sfx.step()
          await wait(stepMs)
        }
        if (cancelled) return
        setOverrides({})
        if (ev.captured.length) {
          sfx.capture()
          await wait(Math.max(360, stepMs * 3))
        } else if (ev.reachedHome) {
          sfx.home()
          await wait(stepMs)
        }
        if (ev.finished) sfx.win()
      }
      if (!cancelled) setMoving(false)
    })()

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
      setOverrides({})
      setMoving(false)
    }
  }, [state.event?.seq]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (state.rollSeq === seenRoll.current) return
    seenRoll.current = state.rollSeq
    sfx.roll()
    setRolling(true)
    const t = window.setTimeout(() => setRolling(false), Math.max(320, stepMs * 4))
    return () => {
      clearTimeout(t)
      setRolling(false)
    }
  }, [state.rollSeq, stepMs])

  return { overrides, busy: moving || rolling, rolling }
}
