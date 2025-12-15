
// CORE — DO NOT MODIFY WITHOUT INTENT
import { PlacedBet, SpinResult, BetType, BetPlacement } from './types';
import { RED_NUMBERS } from './constants';

export const spinWheel = (): SpinResult => {
  // American Roulette: 1-36, 0, 00 (38 pockets)
  const pocketIndex = Math.floor(Math.random() * 38);
  
  let number: number;
  let display: string;
  let color: 'red' | 'black' | 'green';

  if (pocketIndex === 37) {
    number = -1; // 00
    display = '00';
    color = 'green';
  } else if (pocketIndex === 0) {
    number = 0;
    display = '0';
    color = 'green';
  } else {
    number = pocketIndex;
    display = number.toString();
    color = RED_NUMBERS.includes(number) ? 'red' : 'black';
  }

  return { number: display, color };
};

export const getSpinResult = (val: string | number): SpinResult => {
  const display = val.toString().trim();
  const num = display === '00' ? -1 : Number(display);
  
  let color: 'red' | 'black' | 'green';
  
  if (num === -1 || num === 0) {
    color = 'green';
  } else {
    if (isNaN(num)) {
      console.warn("Invalid spin input:", val);
      return { number: '0', color: 'green' };
    }
    color = RED_NUMBERS.includes(num) ? 'red' : 'black';
  }
  
  return { number: display, color };
};

export const parseSequence = (sequenceStr: string): BetPlacement[] => {
  if (!sequenceStr.trim()) return [];

  const tokens = sequenceStr.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
  const placements: BetPlacement[] = [];

  const allNumbers = Array.from({ length: 36 }, (_, i) => i + 1);

  for (const token of tokens) {
    let placement: BetPlacement | null = null;

    switch (token) {
      case 'red':
        placement = { type: BetType.RED, numbers: [...RED_NUMBERS], displayName: 'Red' };
        break;
      case 'black':
        const blackNumbers = allNumbers.filter(n => !RED_NUMBERS.includes(n));
        placement = { type: BetType.BLACK, numbers: blackNumbers, displayName: 'Black' };
        break;
      case 'even':
        placement = { type: BetType.EVEN, numbers: allNumbers.filter(n => n % 2 === 0), displayName: 'Even' };
        break;
      case 'odd':
        placement = { type: BetType.ODD, numbers: allNumbers.filter(n => n % 2 !== 0), displayName: 'Odd' };
        break;
      case '1-18':
      case 'low':
        placement = { type: BetType.LOW_1_18, numbers: allNumbers.filter(n => n <= 18), displayName: '1 to 18' };
        break;
      case '19-36':
      case 'high':
        placement = { type: BetType.HIGH_19_36, numbers: allNumbers.filter(n => n >= 19), displayName: '19 to 36' };
        break;
      default:
        throw new Error(`Invalid bet in sequence: "${token}". Allowed: red, black, even, odd, 1-18, 19-36`);
    }

    if (placement) {
      placements.push(placement);
    }
  }

  return placements;
};
