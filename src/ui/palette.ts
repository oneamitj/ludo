import type { Color } from '../engine/types'

export interface Shade {
  main: string
  dark: string
  light: string
  soft: string
}

export const PALETTE: Record<Color, Shade> = {
  red: { main: '#e5484d', dark: '#a12a2e', light: '#ffc9cb', soft: '#fdeced' },
  green: { main: '#2f9e66', dark: '#1b6642', light: '#bfe9d2', soft: '#e7f6ee' },
  yellow: { main: '#f2b400', dark: '#9a7000', light: '#ffe7a1', soft: '#fff6d8' },
  blue: { main: '#3b7ff2', dark: '#1d4fae', light: '#c9dcff', soft: '#e9f0ff' },
}
