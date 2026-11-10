let ctx: AudioContext | null = null
let enabled = true

export function setSoundEnabled(on: boolean) {
  enabled = on
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    try {
      ctx = new Ctor()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  return ctx
}

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'sine', vol = 0.1, slideTo?: number) {
  if (!enabled) return
  const c = audio()
  if (!c) return
  const t0 = c.currentTime + at
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.03)
}

export const sfx = {
  roll() {
    for (let i = 0; i < 6; i++) tone(260 + Math.random() * 520, i * 0.055, 0.035, 'square', 0.035)
  },
  step() {
    tone(700, 0, 0.05, 'triangle', 0.05)
  },
  release() {
    tone(440, 0, 0.08, 'triangle', 0.09)
    tone(660, 0.08, 0.12, 'triangle', 0.09)
  },
  capture() {
    tone(560, 0, 0.3, 'sawtooth', 0.06, 120)
  },
  home() {
    ;[523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.16, 'triangle', 0.09))
  },
  card() {
    tone(1300, 0, 0.025, 'square', 0.025)
    tone(900, 0.025, 0.05, 'triangle', 0.04)
  },
  swap() {
    tone(380, 0, 0.14, 'sine', 0.09, 820)
    tone(820, 0.14, 0.14, 'sine', 0.09, 380)
  },
  stuck() {
    tone(240, 0, 0.22, 'sine', 0.07, 170)
  },
  win() {
    ;[523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.24, 'triangle', 0.1))
  },
}
