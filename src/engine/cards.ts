import type { Card } from './types'

export const NUMBER_COPIES = 6
export const WILD_COPIES = 4
export const SWAP_COPIES = 4
export const DECK_SIZE = 6 * NUMBER_COPIES + WILD_COPIES + SWAP_COPIES

/** 36 number cards (six each of 1-6), 4 wilds and 4 swaps. */
export function buildDeck(): Card[] {
  const deck: Card[] = []
  let id = 0
  for (let v = 1; v <= 6; v++) {
    for (let i = 0; i < NUMBER_COPIES; i++) deck.push({ id: id++, kind: 'num', value: v })
  }
  for (let i = 0; i < WILD_COPIES; i++) deck.push({ id: id++, kind: 'wild', value: 0 })
  for (let i = 0; i < SWAP_COPIES; i++) deck.push({ id: id++, kind: 'swap', value: 0 })
  return deck
}

export function cardLabel(card: Card): string {
  if (card.kind === 'wild') return 'Wild'
  if (card.kind === 'swap') return 'Swap'
  return String(card.value)
}
