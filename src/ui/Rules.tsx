export function Rules() {
  return (
    <div className="rules">
      <p>
        Get all four of your tokens around the board and into the middle before anyone else does. Up to four people can
        play on one device, and bots fill any seat you don't want to.
      </p>

      <h3>Moving</h3>
      <p>
        Tokens start in your yard. A 6 brings one out onto your coloured start square. From there a token goes once round
        the board clockwise, turns up the column of its own colour, and finishes in the triangle in the centre. You need
        the exact number to get in, so a token three squares from home can't use a 5.
      </p>
      <p>
        Land on another player's token and it goes back to its yard. The starred squares and the coloured start squares
        are safe: nobody is captured there, and different colours can share them.
      </p>

      <h3>Extra turns</h3>
      <p>
        By default you go again after a 6, after a capture and after getting a token home. In classic mode, three 6s in a
        row ends your turn on the spot. All of these can be switched off under house rules.
      </p>

      <h3>Card Ludo</h3>
      <p>
        Nobody rolls. Everyone holds a hand of cards (three unless you change it), plays one per turn and draws a
        replacement. You have to play a card if any of them can move something. If none can, throw one away and draw. The
        deck has 44 cards:
      </p>
      <ul>
        <li>Numbers 1 to 6, six of each. Move one token that many squares. A 6 can also bring a token out.</li>
        <li>Wild, four of them. Use it as any number from 1 to 6.</li>
        <li>
          Swap, four of them. One of your tokens on the track trades places with an opponent's. Tokens on safe squares
          can't be swapped, and a swap never captures.
        </li>
      </ul>
      <p>
        With two or more people at the table, hands stay face down until their owner taps to see them, so you can pass the
        device round without giving your cards away.
      </p>

      <h3>Blockades (optional)</h3>
      <p>
        Two tokens of one colour on a normal square block the road. Nobody else can land on or go past them until one of
        them moves on.
      </p>

      <h3>Winning</h3>
      <p>
        First player with all four tokens home wins. The game keeps going after that so everyone gets a place, unless
        you've set it to stop at the first winner.
      </p>

      <h3>Controls</h3>
      <p>
        Tap a glowing token to move it. Hovering over one shows where it will land. On a keyboard, Space rolls the die,
        keys 1 to 5 pick a card (or a number for a Wild) and Esc clears what you picked.
      </p>
    </div>
  )
}
