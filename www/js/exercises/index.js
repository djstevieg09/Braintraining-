import maths from './quickmaths.js';
import numbers from './numbermemory.js';
import words from './wordmemory.js';
import colour from './colourclash.js';
import reaction from './reaction.js';
import count from './headcount.js';
import change from './change.js';
import clock from './clock.js';
import chain from './chain.js';
import dots from './dots.js';
import odd from './oddone.js';
import sequence from './sequence.js';
import pattern from './pattern.js';
import reading from './reading.js';
import sudoku from './sudoku.js';

export const EXERCISES = [maths, colour, words, reaction, change, sudoku, count, clock, numbers, dots, chain, odd, sequence, pattern, reading];
export const byId = id => EXERCISES.find(e => e.id === id);

// The Brain Age check picks 3 of these, with shorter settings.
export const CHECK_POOL = [
  { id: 'maths', opts: { count: 15 } },
  { id: 'colour', opts: { count: 15 } },
  { id: 'reaction', opts: { trials: 4 } },
  { id: 'count', opts: { rounds: 3 } },
  { id: 'numbers', opts: {} },
  { id: 'words', opts: { count: 10, study: 30 } },
];
