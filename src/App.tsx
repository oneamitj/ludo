import { useEffect, useState } from 'react'
import { COLOR_NAMES, newGame } from './engine/rules'
import { COLORS, type GameState, type SeatConfig } from './engine/types'
import { GameScreen } from './ui/GameScreen'
import { SetupScreen } from './ui/SetupScreen'
import { setSoundEnabled } from './ui/sound'
import {
  loadGame,
  loadPrefs,
  loadSetup,
  saveGame,
  savePrefs,
  saveSetup,
  type Prefs,
  type SetupData,
} from './ui/storage'

/** The seats and rules a running game was started with, for rematches. */
function setupFromGame(g: GameState): SetupData {
  const seats: SeatConfig[] = COLORS.map((color) => {
    const p = g.players.find((x) => x.color === color)
    if (!p) return { color, kind: 'off', name: COLOR_NAMES[color], level: 'normal' }
    return { color, kind: p.bot ? 'bot' : 'human', name: p.name, level: p.bot ?? 'normal' }
  })
  return { seats, options: g.options }
}

function describeSave(g: GameState): string {
  const names = g.players.map((p) => p.name).join(', ')
  return `Unfinished ${g.options.mode === 'cards' ? 'card' : 'classic'} game: ${names}.`
}

export default function App() {
  const [setup, setSetupState] = useState<SetupData>(loadSetup)
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs)
  const [game, setGame] = useState<GameState | null>(null)
  const [gameKey, setGameKey] = useState(0)
  const [saved, setSaved] = useState<GameState | null>(loadGame)

  useEffect(() => setSoundEnabled(prefs.sound), [prefs.sound])

  const setSetup = (s: SetupData) => {
    setSetupState(s)
    saveSetup(s)
  }
  const setPrefs = (p: Prefs) => {
    setPrefsState(p)
    savePrefs(p)
  }

  const launch = (from: SetupData) => {
    const g = newGame(from.seats, from.options)
    saveGame(g)
    setGame(g)
    setGameKey((k) => k + 1)
  }

  const exit = () => {
    saveGame(null)
    setSaved(null)
    setGame(null)
  }

  if (game) {
    return (
      <GameScreen
        key={gameKey}
        initial={game}
        prefs={prefs}
        onPrefs={setPrefs}
        onExit={exit}
        onRematch={() => launch(setupFromGame(game))}
      />
    )
  }

  return (
    <SetupScreen
      setup={setup}
      onChange={setSetup}
      onStart={() => launch(setup)}
      resumeInfo={saved ? describeSave(saved) : null}
      onResume={() => {
        if (!saved) return
        setGame(saved)
        setGameKey((k) => k + 1)
      }}
    />
  )
}
