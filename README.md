# Ludo, Aayug & Aashvi edition

Play it at **https://oneamitj.github.io/ludo/**

Ludo for one to four people sharing a phone, tablet or laptop. Any seat you don't fill goes to a bot (easy, normal or hard), or you can switch it off. The board carries Aayug's name along the top edge and Aashvi's along the bottom, with their initials in the middle where every token is headed.

There are two ways to play. Card Ludo is the default: nobody rolls, everyone holds a hand of cards and plays one per turn. Number cards move a token 1 to 6 squares (a 6 can also bring one out), a Wild counts as any number, and a Swap trades places with an opponent's token. Classic is plain Ludo with a die. House rules let you turn bonus turns, the three-6s rule and blockades on or off, and choose whether the game stops at the first winner.

The game saves after every move, so closing the tab or the phone locking doesn't lose it. The full rules are under "How to play" in the game.

## Running it locally

You need Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5180
npm test           # rules engine tests
npm run typecheck
npm run build      # static site in dist/
```

## How it's published

Every push to `main` runs `.github/workflows/deploy.yml`. If the type check and tests pass, it builds the site and force-pushes `dist/` to the `gh-pages` branch, which is what GitHub Pages serves. Asset paths are relative, so the same build works under `/ludo/` or anywhere else.

## Layout

`src/engine/` holds the rules as a plain TypeScript reducer, `reducer(state, action)`, with the random seed kept in the game state. There's no React in there, which keeps the tests quick: `engine.test.ts` checks the board geometry, captures, safe squares, exact finishes, bonus turns, blockades and every card, then plays complete four-bot games in both modes. `src/ui/` is the React side. The board is one SVG, tokens step square by square, and the sound effects are made on the fly with Web Audio, so there are no audio files.
