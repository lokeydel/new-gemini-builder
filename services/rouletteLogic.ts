import { PlacedBet, SpinResult, BetType, BetPlacement } from '../types';
import { RED_NUMBERS, PAYOUTS } from '../constants';

export const spinWheel = (): SpinResult => {
  // American Roulette: 1-36, 0, 00 (38 pockets)
  // We represent 00 as -1 internally
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

  return { number: display, color }; // separate numeric + display
};

// Clean winnings calculation
export const calculateWinnings = (bets: PlacedBet[], result: SpinResult): number => {
  let totalWinnings = 0;
  const resultNum = result.number === '00' ? -1 : Number(result.number); // already numeric now

  bets.forEach((bet) => {
    const isWin = bet.placement.numbers.includes(resultNum);

    if (isWin) {
      let payoutRatio = PAYOUTS[bet.placement.type];

      // fallback if type not in PAYOUTS
      if (payoutRatio === undefined) {
        const count = bet.placement.numbers.length;
        payoutRatio = count > 0 ? (36 / count - 1) : 0;
      }

      totalWinnings += bet.amount * (1 + payoutRatio); // stake + profit
    }
  });

  return totalWinnings;
};

// Supports basic colors, even/odd, low/high, AND single numbers
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
        placement = { type: BetType.BLACK, numbers: allNumbers.filter(n => !RED_NUMBERS.includes(n)), displayName: 'Black' };
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
        // Try parsing as a single number bet
        const num = Number(token);
        if (!isNaN(num) && (num >= 0 && num <= 36)) {
          placement = { type: BetType.STRAIGHT_UP, numbers: [num], displayName: num.toString() };
        } else if (token === '00') {
          placement = { type: BetType.STRAIGHT_UP, numbers: [-1], displayName: '00' };
        } else {
          throw new Error(`Invalid bet in sequence: "${token}". Allowed: red, black, even, odd, low, high, 1-36, 0, 00`);
        }
    }

    if (placement) placements.push(placement);
  }

  return placements;
};