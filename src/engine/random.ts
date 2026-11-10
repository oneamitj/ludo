/** Seeded PRNG (mulberry32). The seed lives in game state so saves replay identically. */
export function nextRandom(holder: { seed: number }): number {
  let t = (holder.seed = (holder.seed + 0x6d2b79f5) >>> 0)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function shuffle<T>(items: T[], holder: { seed: number }): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(holder) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function randomSeed(): number {
  return (Math.random() * 2 ** 32) >>> 0
}
