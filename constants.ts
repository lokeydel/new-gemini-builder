import { BetType } from './types';

export const NUMBERS = [
  '0', '28', '9', '26', '30', '11', '7', '20', '32', '17', '5', '22', '34', '15', '3', '24', '36', '13', '1', '00', '27', '10', '25', '29', '12', '8', '19', '31', '18', '6', '21', '33', '16', '4', '23', '35', '14', '2'
];

export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export const getNumberColor = (num: number | string): 'red' | 'black' | 'green' => {
  if (num === '0' || num === '00' || num === 0 || num === -1) return 'green';
  return RED_NUMBERS.includes(Number(num)) ? 'red' : 'black';
};

export const CHIP_VALUES = [1, 5, 25, 100, 500, 1000];

// Map for Tailwind classes in the advanced table
export const CHIP_COLORS: Record<number, string> = {
  1: 'bg-gray-200 text-gray-900',
  5: 'bg-red-600 text-white',
  25: 'bg-green-600 text-white',
  100: 'bg-slate-900 text-white',
  500: 'bg-purple-600 text-white',
  1000: 'bg-yellow-400 text-black',
};

// Payout mapping (Optional if we calculate dynamically, but good for reference)
export const PAYOUTS: Record<BetType, number> = {
  [BetType.STRAIGHT_UP]: 35,
  [BetType.SPLIT]: 17,
  [BetType.STREET]: 11,
  [BetType.CORNER]: 8,
  [BetType.SIX_LINE]: 5,
  [BetType.BASKET]: 6, // 0,00,1,2,3
  [BetType.COLUMN_1ST]: 2,
  [BetType.COLUMN_2ND]: 2,
  [BetType.COLUMN_3RD]: 2,
  [BetType.DOZEN_1ST]: 2,
  [BetType.DOZEN_2ND]: 2,
  [BetType.DOZEN_3RD]: 2,
  [BetType.LOW_1_18]: 1,
  [BetType.HIGH_19_36]: 1,
  [BetType.EVEN]: 1,
  [BetType.ODD]: 1,
  [BetType.RED]: 1,
  [BetType.BLACK]: 1,
};