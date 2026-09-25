/* ============================================================================
   HOIST pcard() OUT OF completeSet()
   ----------------------------------------------------------------------------
   Jayden 2026-09-25: "the Save Later button doesn't even work and doesn't go
   into the saved kits at all."

   The button worked. Saving worked. localStorage held the kit and the saved
   page's own counter read 1. The page rendered ZERO cards, because it threw:

       Uncaught (in promise) ReferenceError: pcard is not defined
           at js/das-store-pages.js:283

   pcard's block had been pasted into the MIDDLE of completeSet() — its
   declaration landed right after that function's `var picks = ...` line, and
   its closing brace split completeSet in two. So pcard was a nested function
   declaration scoped to completeSet, invisible to paintSaved(), emptyState()
   and paintCart(), which are its siblings.

   The comment above pcard says "ONE CARD, THREE CALLERS". Two of those three
   callers could not see it.

   This moves the block to the top level of the file's IIFE, where all callers
   can reach it, and leaves completeSet whole again.

   Run once:  node scripts/fix-pcard-scope.mjs
   ========================================================================== */
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = 'js/das-store-pages.js'
const lines = readFileSync(FILE, 'utf8').split(/\r?\n/)

/* 1-indexed 129..166: the comment through pcard's closing brace. */
const START = 130
const END = 166
const block = lines.slice(START - 1, END)

if (!/ONE CARD, THREE CALLERS/.test(block[0])) { console.error('first line is not the pcard comment: ' + block[0]); process.exit(1) }
if (block[block.length - 1] !== '  }') { console.error('last line is not pcard closing brace: ' + JSON.stringify(block[block.length - 1])); process.exit(1) }
if (!block.some((l) => /function pcard\(/.test(l))) { console.error('pcard declaration not inside the block'); process.exit(1) }

const rest = lines.slice(0, START - 1).concat(lines.slice(END))

/* Put it just above the CART PAGE banner, at the IIFE's top level. */
const idx = rest.findIndex((l, i) => /CART PAGE/.test(l) && /^\s*\/\* ═/.test(rest[i - 1] || ''))
if (idx < 1) { console.error('CART PAGE banner not found'); process.exit(1) }
const insertAt = idx - 1

const WHY = [
  '  /* HOISTED OUT OF completeSet(), 2026-09-25. This block had been pasted into',
  '     the MIDDLE of completeSet: its declaration landed after that function’s',
  '     `var picks = ...` line and its closing brace split the function in two, so',
  '     pcard was scoped to completeSet and invisible to every sibling. The saved',
  '     page threw a ReferenceError in production and rendered zero cards while its',
  '     own counter read 1, and the cart’s empty state carried the same fault.',
  '     Three callers, two of which could not see it. It belongs here. */',
]

writeFileSync(FILE, rest.slice(0, insertAt).concat(WHY, block, [''], rest.slice(insertAt)).join('\n'))
console.log('moved ' + block.length + ' lines to the IIFE top level, above the CART PAGE section')
