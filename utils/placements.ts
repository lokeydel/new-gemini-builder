import { BetPlacement } from '../types';

export const getPlacementIdentifier = (placement: BetPlacement): string => {
  // Sort numbers to ensure Split 1/2 is same ID as Split 2/1
  const sortedNums = [...placement.numbers].sort((a, b) => a - b);
  return `${placement.type}:${sortedNums.join(',')}`;
};