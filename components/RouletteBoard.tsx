// DO NOT WRITE OVER
import React, { useMemo, useState, useCallback } from 'react';
import { BetType, BetPlacement, Bet } from '../core/types';
import { getPlacementIdentifier } from '../utils/placements';
import { CHIP_COLORS } from '../core/constants';

interface RouletteTableProps {
  onBetSelect: (betPlacement: BetPlacement) => void;
  bets: Bet[];
  highlightedBetId?: string | null;
  onStackMove?: (fromPlacement: BetPlacement, toPlacement: BetPlacement, moveAll: boolean) => void;
  onStackSelectForMove?: (placement: BetPlacement | null) => void;
  moveSourceId?: string | null;
  onStackDelete?: (placement: BetPlacement, removeAll: boolean) => void;
  draggingStackId?: string | null;
  onStackDragStart?: (placement: BetPlacement, mode: DragMode) => void;
  onStackDragEnd?: () => void;
  triggerMode?: boolean;
  triggerHighlightIds?: string[];
}

const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

interface HotspotConfig {
  width: string;
  height: string;
  borderRadius?: string;
}

interface BetDefinition {
  type: BetType;
  numbers: number[];
  displayName: string;
  chipPosition: { top: string; left: string };
  hotspot?: HotspotConfig;
}

type DragMode = 'single' | 'stack';

const DRAG_DATA_MIME = 'application/x-roulette-drag';

const OUTLINE_ELIGIBLE_TYPES = new Set<BetType>([
  BetType.STRAIGHT_UP,
  BetType.SPLIT,
  BetType.CORNER,
  BetType.STREET,
  BetType.SIX_LINE,
  BetType.BASKET,
  BetType.DOZEN_1ST,
  BetType.DOZEN_2ND,
  BetType.DOZEN_3RD,
  BetType.COLUMN_1ST,
  BetType.COLUMN_2ND,
  BetType.COLUMN_3RD,
  BetType.LOW_1_18,
  BetType.HIGH_19_36,
  BetType.EVEN,
  BetType.ODD,
]);

const EVEN_MONEY_TYPES = new Set<BetType>([
  BetType.LOW_1_18,
  BetType.HIGH_19_36,
  BetType.EVEN,
  BetType.ODD,
]);

const getNumberColor = (n: number) => {
  if (n === 0 || n === -1) return 'bg-green-700 hover:bg-green-600';
  if (redNumbers.has(n)) return 'bg-red-700 hover:bg-red-600';
  return 'bg-gray-800 hover:bg-gray-700';
};

// --- Layout Calculation ---
const ZERO_COLUMN_FR = 5;
const NUMBER_COLUMN_FR = 6;
const OUTSIDE_COLUMN_FR = 5;
const NUMBER_COLUMNS = 12;
const TOTAL_COLUMN_FR = ZERO_COLUMN_FR + NUMBER_COLUMN_FR * NUMBER_COLUMNS + OUTSIDE_COLUMN_FR;

const NUMBER_ROW_FR = 0.8;
const OUTSIDE_DOZEN_ROW_FR = 0.45;
const OUTSIDE_EVEN_MONEY_ROW_FR = 0.45;
const NUMBER_ROWS = 3;
const TOTAL_ROW_FR = NUMBER_ROW_FR * NUMBER_ROWS + OUTSIDE_DOZEN_ROW_FR + OUTSIDE_EVEN_MONEY_ROW_FR;

const zeroColumnWidthPercent = (ZERO_COLUMN_FR / TOTAL_COLUMN_FR) * 100;
const numberColumnWidthPercent = (NUMBER_COLUMN_FR / TOTAL_COLUMN_FR) * 100;
const outsideColumnWidthPercent = (OUTSIDE_COLUMN_FR / TOTAL_COLUMN_FR) * 100;

const numberRowHeightPercent = (NUMBER_ROW_FR / TOTAL_ROW_FR) * 100;
const dozenRowHeightPercent = (OUTSIDE_DOZEN_ROW_FR / TOTAL_ROW_FR) * 100;
const evenMoneyRowHeightPercent = (OUTSIDE_EVEN_MONEY_ROW_FR / TOTAL_ROW_FR) * 100;

const formatPercent = (value: number) => `${value.toFixed(4)}%`;

const getColumnCenterPercent = (index: number) => zeroColumnWidthPercent + numberColumnWidthPercent * (index + 0.5);
const getColumnBoundaryPercent = (boundaryIndex: number) => zeroColumnWidthPercent + numberColumnWidthPercent * boundaryIndex;
const getRowCenterPercent = (rowIndexFromTop: number) => numberRowHeightPercent * (rowIndexFromTop + 0.5);
const getRowBoundaryPercent = (boundaryIndexFromTop: number) => numberRowHeightPercent * boundaryIndexFromTop;

// --- Hotspot Definitions ---
const vSplitHotspotWidth = numberColumnWidthPercent * 0.3;
const hSplitHotspotHeight = numberRowHeightPercent * 0.25;

const straightHotspot: HotspotConfig = { width: formatPercent(numberColumnWidthPercent * 0.8), height: formatPercent(numberRowHeightPercent * 0.8), borderRadius: '4px' };
const horizontalSplitHotspot: HotspotConfig = { width: formatPercent(numberColumnWidthPercent * 0.8), height: formatPercent(hSplitHotspotHeight), borderRadius: '2px' };
const verticalSplitHotspot: HotspotConfig = { width: formatPercent(vSplitHotspotWidth), height: formatPercent(numberRowHeightPercent * 0.8), borderRadius: '2px' };
const cornerHotspot: HotspotConfig = { width: formatPercent(vSplitHotspotWidth), height: formatPercent(hSplitHotspotHeight), borderRadius: '2px' };

const streetAndSixLineHotspotHeight = dozenRowHeightPercent * 0.4;
const streetHotspot: HotspotConfig = { width: formatPercent(numberColumnWidthPercent * 0.8), height: formatPercent(streetAndSixLineHotspotHeight), borderRadius: '2px' };
const sixLineHotspot: HotspotConfig = { width: formatPercent(vSplitHotspotWidth), height: formatPercent(streetAndSixLineHotspotHeight), borderRadius: '2px' };
const topLineHotspot: HotspotConfig = sixLineHotspot;
const zeroBasketHotspot: HotspotConfig = { width: formatPercent(vSplitHotspotWidth), height: formatPercent(numberRowHeightPercent * 0.8), borderRadius: '2px' };

// --- Bet Definitions ---
const BET_DEFINITIONS: BetDefinition[] = [];

// Zeros
const zeroAreaHeight = numberRowHeightPercent * NUMBER_ROWS;
BET_DEFINITIONS.push({ type: BetType.STRAIGHT_UP, numbers: [0], displayName: '0', chipPosition: { top: formatPercent(zeroAreaHeight * 0.25), left: formatPercent(zeroColumnWidthPercent / 2) }, hotspot: straightHotspot });
BET_DEFINITIONS.push({ type: BetType.STRAIGHT_UP, numbers: [-1], displayName: '00', chipPosition: { top: formatPercent(zeroAreaHeight * 0.75), left: formatPercent(zeroColumnWidthPercent / 2) }, hotspot: straightHotspot });
BET_DEFINITIONS.push({ type: BetType.SPLIT, numbers: [-1, 0].sort(), displayName: 'Split 0/00', chipPosition: { top: formatPercent(zeroAreaHeight * 0.5), left: formatPercent(zeroColumnWidthPercent / 2) }, hotspot: { ...horizontalSplitHotspot, height: formatPercent(numberRowHeightPercent * 0.8) } });
BET_DEFINITIONS.push({
  type: BetType.BASKET,
  numbers: [-1, 0, 2],
  displayName: 'Basket 0/00/2',
  chipPosition: { top: formatPercent(getRowCenterPercent(1)), left: formatPercent(getColumnBoundaryPercent(0)) },
  hotspot: zeroBasketHotspot,
});

// Numbers & Complex Bets (Straights, Splits, Corners, Streets, Six Lines)
for (let i = 0; i < NUMBER_COLUMNS; i++) {
  const columnCenter = formatPercent(getColumnCenterPercent(i));
  const columnBoundary = formatPercent(getColumnBoundaryPercent(i + 1));

  // Street (Covers 3 numbers in a column, e.g., 1-2-3)
  const streetNums = [i * 3 + 1, i * 3 + 2, i * 3 + 3];
  BET_DEFINITIONS.push({
    type: BetType.STREET,
    numbers: streetNums,
    displayName: `Street ${streetNums[0]}-${streetNums[2]}`,
    chipPosition: { top: formatPercent(getRowBoundaryPercent(3)), left: columnCenter },
    hotspot: streetHotspot,
  });

  // Six Line (Covers two adjacent streets)
  if (i < NUMBER_COLUMNS - 1) {
    const sixLineNums = [...streetNums, i * 3 + 4, i * 3 + 5, i * 3 + 6];
    BET_DEFINITIONS.push({
      type: BetType.SIX_LINE,
      numbers: sixLineNums,
      displayName: `Six Line ${sixLineNums[0]}-${sixLineNums[5]}`,
      chipPosition: { top: formatPercent(getRowBoundaryPercent(3)), left: columnBoundary },
      hotspot: sixLineHotspot,
    });
  }

  for (let j = 0; j < NUMBER_ROWS; j++) {
    const num = i * 3 + (NUMBER_ROWS - j); // From top to bottom: 3,2,1
    const rowIndexFromTop = j;
    const rowCenter = formatPercent(getRowCenterPercent(rowIndexFromTop));
    const rowBoundary = formatPercent(getRowBoundaryPercent(rowIndexFromTop + 1));

    // Straight Up
    BET_DEFINITIONS.push({ type: BetType.STRAIGHT_UP, numbers: [num], displayName: `${num}`, chipPosition: { top: rowCenter, left: columnCenter }, hotspot: straightHotspot });
    
    // Horizontal Splits (e.g., 2/3, 1/2)
    if (rowIndexFromTop < NUMBER_ROWS - 1) {
      const nextNum = num - 1;
      BET_DEFINITIONS.push({ type: BetType.SPLIT, numbers: [num, nextNum].sort(), displayName: `Split ${num}/${nextNum}`, chipPosition: { top: rowBoundary, left: columnCenter }, hotspot: horizontalSplitHotspot });
    }
    
    // Vertical Splits (e.g., 1/4, 2/5)
    if (i < NUMBER_COLUMNS - 1) {
      const nextNum = num + 3;
      BET_DEFINITIONS.push({ type: BetType.SPLIT, numbers: [num, nextNum].sort(), displayName: `Split ${num}/${nextNum}`, chipPosition: { top: rowCenter, left: columnBoundary }, hotspot: verticalSplitHotspot });
    }
    
    // Corners (e.g., 1/2/4/5)
    if (i < NUMBER_COLUMNS - 1 && rowIndexFromTop < NUMBER_ROWS - 1) {
      const cornerNums = [num, num - 1, num + 3, num + 2].sort();
      BET_DEFINITIONS.push({ type: BetType.CORNER, numbers: cornerNums, displayName: `Corner ${cornerNums.join('/')}`, chipPosition: { top: rowBoundary, left: columnBoundary }, hotspot: cornerHotspot });
    }
  }
}

// Top Line (Basket) Bet: 0, 00, 1, 2, 3
BET_DEFINITIONS.push({
  type: BetType.BASKET,
  numbers: [-1, 0, 1, 2, 3],
  displayName: 'Top Line (0,00,1,2,3)',
  chipPosition: { top: formatPercent(getRowBoundaryPercent(3)), left: formatPercent(getColumnBoundaryPercent(0)) },
  hotspot: topLineHotspot,
});

// Outside Bets
// Columns
const columnBetLeft = formatPercent(getColumnBoundaryPercent(12) + outsideColumnWidthPercent / 2);
BET_DEFINITIONS.push({ type: BetType.COLUMN_3RD, numbers: Array.from({ length: 12 }, (_, i) => i * 3 + 3), displayName: '3rd Column', chipPosition: { top: formatPercent(getRowCenterPercent(0)), left: columnBetLeft } });
BET_DEFINITIONS.push({ type: BetType.COLUMN_2ND, numbers: Array.from({ length: 12 }, (_, i) => i * 3 + 2), displayName: '2nd Column', chipPosition: { top: formatPercent(getRowCenterPercent(1)), left: columnBetLeft } });
BET_DEFINITIONS.push({ type: BetType.COLUMN_1ST, numbers: Array.from({ length: 12 }, (_, i) => i * 3 + 1), displayName: '1st Column', chipPosition: { top: formatPercent(getRowCenterPercent(2)), left: columnBetLeft } });

// Dozens
const dozenBetTop = formatPercent(getRowBoundaryPercent(3) + dozenRowHeightPercent / 2);
BET_DEFINITIONS.push({ type: BetType.DOZEN_1ST, numbers: Array.from({ length: 12 }, (_, i) => i + 1), displayName: '1st 12', chipPosition: { top: dozenBetTop, left: formatPercent(getColumnBoundaryPercent(0) + numberColumnWidthPercent * 2) } });
BET_DEFINITIONS.push({ type: BetType.DOZEN_2ND, numbers: Array.from({ length: 12 }, (_, i) => i + 13), displayName: '2nd 12', chipPosition: { top: dozenBetTop, left: formatPercent(getColumnBoundaryPercent(4) + numberColumnWidthPercent * 2) } });
BET_DEFINITIONS.push({ type: BetType.DOZEN_3RD, numbers: Array.from({ length: 12 }, (_, i) => i + 25), displayName: '3rd 12', chipPosition: { top: dozenBetTop, left: formatPercent(getColumnBoundaryPercent(8) + numberColumnWidthPercent * 2) } });

// Even Money Bets
const evenMoneyBetTop = formatPercent(getRowBoundaryPercent(3) + dozenRowHeightPercent + evenMoneyRowHeightPercent / 2);
BET_DEFINITIONS.push({ type: BetType.LOW_1_18, numbers: Array.from({ length: 18 }, (_, i) => i + 1), displayName: '1 to 18', chipPosition: { top: evenMoneyBetTop, left: formatPercent(getColumnBoundaryPercent(0) + numberColumnWidthPercent * 1) } });
BET_DEFINITIONS.push({ type: BetType.EVEN, numbers: Array.from({ length: 18 }, (_, i) => (i + 1) * 2), displayName: 'Even', chipPosition: { top: evenMoneyBetTop, left: formatPercent(getColumnBoundaryPercent(2) + numberColumnWidthPercent * 1) } });
BET_DEFINITIONS.push({ type: BetType.RED, numbers: Array.from(redNumbers), displayName: 'Red', chipPosition: { top: evenMoneyBetTop, left: formatPercent(getColumnBoundaryPercent(4) + numberColumnWidthPercent * 1) } });
BET_DEFINITIONS.push({ type: BetType.BLACK, numbers: Array.from({ length: 36 }, (_, i) => i + 1).filter(n => !redNumbers.has(n)), displayName: 'Black', chipPosition: { top: evenMoneyBetTop, left: formatPercent(getColumnBoundaryPercent(6) + numberColumnWidthPercent * 1) } });
BET_DEFINITIONS.push({ type: BetType.ODD, numbers: Array.from({ length: 18 }, (_, i) => i * 2 + 1), displayName: 'Odd', chipPosition: { top: evenMoneyBetTop, left: formatPercent(getColumnBoundaryPercent(8) + numberColumnWidthPercent * 1) } });
BET_DEFINITIONS.push({ type: BetType.HIGH_19_36, numbers: Array.from({ length: 18 }, (_, i) => i + 19), displayName: '19 to 36', chipPosition: { top: evenMoneyBetTop, left: formatPercent(getColumnBoundaryPercent(10) + numberColumnWidthPercent * 1) } });

// --- Dozen Highlight Overlay Calculation ---
const DOZEN_OVERLAY_HEIGHT_PERCENT = dozenRowHeightPercent;
const DOZEN_OVERLAY_TOP_PERCENT = getRowBoundaryPercent(3) + dozenRowHeightPercent / 2;
const DOZEN_HORIZONTAL_MARGIN = numberColumnWidthPercent * 0.05;
const DOZEN_VERTICAL_MARGIN = dozenRowHeightPercent * 0.05;
const DOZEN_OVERLAY_CONFIG = [
  { type: BetType.DOZEN_1ST, leftPercent: getColumnBoundaryPercent(0) + numberColumnWidthPercent * 2, widthPercent: numberColumnWidthPercent * 4 },
  { type: BetType.DOZEN_2ND, leftPercent: getColumnBoundaryPercent(4) + numberColumnWidthPercent * 2, widthPercent: numberColumnWidthPercent * 4 },
  { type: BetType.DOZEN_3RD, leftPercent: getColumnBoundaryPercent(8) + numberColumnWidthPercent * 2, widthPercent: numberColumnWidthPercent * 4 },
] as const;

interface ChipStackProps {
  bets: Bet[];
  totalAmount: number;
  position: { top: string; left: string };
  placement: BetPlacement;
  isSelected: boolean;
  onCtrlClick?: (placement: BetPlacement) => void;
  onDelete?: (placement: BetPlacement, removeAll: boolean) => void;
  onDragStart?: (placement: BetPlacement, mode: DragMode) => void;
  onDragEnd?: () => void;
  onPrimaryClick?: (placement: BetPlacement, event: React.MouseEvent<HTMLDivElement>) => void;
}

const ChipStack: React.FC<ChipStackProps> = ({
  bets,
  totalAmount,
  position,
  placement,
  isSelected,
  onCtrlClick,
  onDelete,
  onDragStart,
  onDragEnd,
  onPrimaryClick,
}) => {
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    // Require Ctrl/Cmd to initiate drag selection
    if (event.ctrlKey || event.metaKey) {
      onCtrlClick?.(placement);
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onPrimaryClick?.(placement, event);
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onDelete?.(placement, event.ctrlKey || event.metaKey);
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const dragMode: DragMode = event.ctrlKey || event.metaKey ? 'stack' : 'single';
    if (event.dataTransfer) {
      const payload = JSON.stringify({
        id: getPlacementIdentifier(placement),
        mode: dragMode,
      });
      event.dataTransfer.setData(DRAG_DATA_MIME, payload);
      event.dataTransfer.setData('text/plain', getPlacementIdentifier(placement));
      event.dataTransfer.effectAllowed = 'move';

      if (dragMode === 'single') {
        const topChip = event.currentTarget.querySelector('[data-chip-role="top"]') as HTMLElement | null;
        if (topChip) {
          const rect = topChip.getBoundingClientRect();
          event.dataTransfer.setDragImage(topChip, rect.width / 2, rect.height / 2);
        }
      }
    }
    onDragStart?.(placement, dragMode);
  };

  const handleDragEnd = (event: React.DragEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onDragEnd?.();
  };

  return (
    <div
      style={{ top: position.top, left: position.left, touchAction: 'none' }}
      className={`absolute z-30 w-6 h-6 transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-grab active:cursor-grabbing rounded-full ${
        isSelected ? 'ring-4 ring-amber-300 shadow-amber-300/40' : ''
      }`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      draggable
      role="button"
      aria-label="Chip stack"
    >
      <div className="relative w-full h-full">
        {bets.map((bet, index) => {
          const isTopChip = index === bets.length - 1;
          const sizeRem = isTopChip ? 1.95 : 1.6;
          const chipColorClass = CHIP_COLORS[bet.amount] ?? 'bg-slate-500 text-white';
          return (
            <div
              key={bet.id}
              className={`absolute rounded-full border-[2.5px] flex items-center justify-center text-[9px] font-semibold transition-transform ${chipColorClass} ${
                isTopChip
                  ? 'border-amber-300 shadow-[0_0_18px_rgba(253,224,71,1)] scale-[1.08]'
                  : 'border-black shadow-[0_4px_10px_rgba(0,0,0,0.45)]'
              }`}
              style={{
                width: `${sizeRem}rem`,
                height: `${sizeRem}rem`,
                transform: `translate(-${index * 2}px, ${-index * 6}px)`,
                zIndex: index + 1,
              }}
              data-chip-role={isTopChip ? 'top' : undefined}
            >
              ${bet.amount}
            </div>
          );
        })}
        {bets.length > 0 && (
          <div className="absolute -top-3 -right-3 px-1.5 py-0.5 rounded-full bg-black/85 text-amber-200 text-[10px] font-semibold border border-amber-300 shadow-[0_0_10px_rgba(253,224,71,0.7)]">
            ${totalAmount}
          </div>
        )}
      </div>
    </div>
  );
};

const RouletteTable: React.FC<RouletteTableProps> = ({
  onBetSelect,
  bets,
  highlightedBetId,
  onStackMove,
  onStackSelectForMove,
  moveSourceId,
  onStackDelete,
  draggingStackId,
  onStackDragStart,
  onStackDragEnd,
  triggerMode = false,
  triggerHighlightIds = [],
}) => {
    const [hoveredHotspot, setHoveredHotspot] = useState<BetPlacement | null>(null);
    const [activeDragMode, setActiveDragMode] = useState<DragMode | null>(null);
  const triggerSet = useMemo(() => new Set(triggerHighlightIds), [triggerHighlightIds]);
  const TRIGGER_ALLOWED_TYPES = useMemo(
    () =>
      new Set<BetType>([
        BetType.STRAIGHT_UP,
        BetType.DOZEN_1ST,
        BetType.DOZEN_2ND,
        BetType.DOZEN_3RD,
        BetType.COLUMN_1ST,
        BetType.COLUMN_2ND,
        BetType.COLUMN_3RD,
        BetType.LOW_1_18,
        BetType.HIGH_19_36,
        BetType.EVEN,
        BetType.ODD,
        BetType.RED,
        BetType.BLACK,
      ]),
    [],
  );

    const highlightedPlacement = useMemo(() => {
        if (hoveredHotspot) return hoveredHotspot;
        const highlightedBet = bets.find(b => b.id === highlightedBetId);
        return highlightedBet?.placement || null;
    }, [bets, highlightedBetId, hoveredHotspot]);

    const isNumberHighlighted = useCallback((num: number) => {
        if (!highlightedPlacement) return false;
        return highlightedPlacement.numbers.includes(num);
    }, [highlightedPlacement]);
    
    const isOutsideBetHighlighted = useCallback((type: BetType, numbers: number[] = []) => {
      if (!highlightedPlacement) return false;
      const id1 = getPlacementIdentifier({type, numbers, displayName:''});
      const id2 = getPlacementIdentifier(highlightedPlacement);
      return id1 === id2;
    }, [highlightedPlacement]);

    const betsOnBoard = useMemo(() => {
        const groupedBets: Record<string, { bets: Bet[], totalAmount: number, position: {top: string, left: string}, placement: BetPlacement }> = {};
        bets.forEach(bet => {
            const definition = BET_DEFINITIONS.find(def => getPlacementIdentifier(def) === getPlacementIdentifier(bet.placement));
            if (!definition) return;

            const id = getPlacementIdentifier(bet.placement);
            if (!groupedBets[id]) {
                groupedBets[id] = { bets: [], totalAmount: 0, position: definition.chipPosition, placement: bet.placement };
            }
            groupedBets[id].bets.push(bet);
            groupedBets[id].totalAmount += bet.amount;
        });
        return Object.values(groupedBets);
    }, [bets]);

    const numberRows = [
        [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36], // Top row (3rd Column)
        [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35], // Middle row (2nd Column)
        [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34], // Bottom row (1st Column progression)
    ];
    const zeroPlacement = BET_DEFINITIONS.find(b => b.displayName === '0')!;
    const doubleZeroPlacement = BET_DEFINITIONS.find(b => b.displayName === '00')!;

    const sharedHighlightStyle = useMemo(
      () =>
        ({
          border: '2px solid rgba(253, 224, 71, 0.7)',
          boxShadow: '0 0 10px rgba(253, 224, 71, 0.4)',
          backgroundColor: 'transparent',
        }) as const,
      [],
    );
    const chipOutlineStyle = useMemo(
      () =>
        ({
          border: '2px solid rgba(250, 204, 21, 0.8)',
          boxShadow: '0 0 10px rgba(250, 204, 21, 0.45)',
          backgroundColor: 'transparent',
        }) as const,
      [],
    );
    const highlightedPlacementId = highlightedPlacement ? getPlacementIdentifier(highlightedPlacement) : null;
    const placementIdsWithChips = useMemo(() => {
        const ids = new Set<string>();
        bets.forEach(bet => {
            ids.add(getPlacementIdentifier(bet.placement));
        });
        return ids;
    }, [bets]);
    const numbersCoveredByStraightUps = useMemo<Set<number>>(() => {
        const numbers = new Set<number>();
        bets.forEach(bet => {
            if (bet.placement.type === BetType.STRAIGHT_UP) {
                bet.placement.numbers.forEach(num => {
                    numbers.add(num);
                });
            }
        });
        return numbers;
    }, [bets]);

    const numberPositionMap = useMemo<Map<number, { col: number; row: number }>>(() => {
        const map = new Map<number, { col: number; row: number }>();
        numberRows.forEach((row, rowIndex) => {
            row.forEach((num, colIndex) => {
                map.set(num, { col: colIndex, row: rowIndex });
            });
        });
        return map;
    }, [numberRows]);

    const getNumbersBoundingStyle = useCallback(
        (numbers: number[]) => {
            const positions = numbers
                .filter(num => num > 0)
                .map(num => numberPositionMap.get(num))
                .filter((pos): pos is { col: number; row: number } => !!pos);
            if (!positions.length) return null;
            const cols = positions.map(pos => pos.col);
            const rows = positions.map(pos => pos.row);
            const minCol = Math.min(...cols);
            const maxCol = Math.max(...cols);
            const minRow = Math.min(...rows);
            const maxRow = Math.max(...rows);

            const colStart = getColumnBoundaryPercent(minCol);
            const colEnd = getColumnBoundaryPercent(maxCol + 1);
            const rowStart = getRowBoundaryPercent(minRow);
            const rowEnd = getRowBoundaryPercent(maxRow + 1);

            return {
                left: formatPercent((colStart + colEnd) / 2),
                top: formatPercent((rowStart + rowEnd) / 2),
                width: formatPercent(colEnd - colStart),
                height: formatPercent(rowEnd - rowStart),
                borderRadius: '6px',
            } as const;
        },
        [numberPositionMap],
    );

    const placementOutlineOverlays = useMemo(() => {
        return betsOnBoard
            .filter(group => OUTLINE_ELIGIBLE_TYPES.has(group.placement.type))
            .map(group => {
                const placementId = getPlacementIdentifier(group.placement);
                const definition = BET_DEFINITIONS.find(def => getPlacementIdentifier(def) === placementId);
                if (!definition) return null;

                if (EVEN_MONEY_TYPES.has(group.placement.type)) {
                    return {
                        id: placementId,
                        style: {
                            left: definition.chipPosition.left,
                            top: definition.chipPosition.top,
                            width: formatPercent(numberColumnWidthPercent * 2),
                            height: formatPercent(evenMoneyRowHeightPercent),
                            borderRadius: '10px',
                            ...chipOutlineStyle,
                        } as React.CSSProperties,
                    };
                }

                const boundingStyle = getNumbersBoundingStyle(group.placement.numbers);
                if (!boundingStyle) return null;
                return {
                    id: placementId,
                    style: {
                        ...boundingStyle,
                        ...chipOutlineStyle,
                    } as React.CSSProperties,
                };
            })
            .filter((entry): entry is { id: string; style: React.CSSProperties } => entry !== null);
    }, [betsOnBoard, chipOutlineStyle, getNumbersBoundingStyle]);

    const extractDragInfo = (event: React.DragEvent<HTMLElement>) => {
        const dataTransfer = event.dataTransfer;
        let draggedId: string | null = null;
        let moveAll = false;

        if (dataTransfer) {
            const rawPayload = dataTransfer.getData(DRAG_DATA_MIME);
            if (rawPayload) {
                try {
                    const parsed = JSON.parse(rawPayload) as { id?: string; mode?: DragMode };
                    if (parsed && typeof parsed.id === 'string') {
                        draggedId = parsed.id;
                        moveAll = parsed.mode === 'stack';
                    }
                } catch {
                    // ignore malformed payloads
                }
            }
            if (!draggedId) {
                const fallback = dataTransfer.getData('text/plain');
                if (fallback) {
                    draggedId = fallback;
                    moveAll = event.ctrlKey || event.metaKey;
                }
            }
        }

        if (!draggedId && draggingStackId) {
            draggedId = draggingStackId;
            moveAll = event.ctrlKey || event.metaKey;
        }

        if (!draggedId) return null;
        return { draggedId, moveAll };
    };

    const toggleMoveSource = (placement: BetPlacement) => {
        if (!onStackSelectForMove) return;
        const id = getPlacementIdentifier(placement);
        if (moveSourceId && moveSourceId === id) {
            onStackSelectForMove(null);
        } else {
            onStackSelectForMove(placement);
        }
    };
    const handleStackCtrlClick = toggleMoveSource;

    const handleStackDelete = (placement: BetPlacement, removeAll: boolean) => {
        onStackDelete?.(placement, removeAll);
    };

    const handleStackDragStartInternal = (placement: BetPlacement, mode: DragMode) => {
        setActiveDragMode(mode);
        onStackDragStart?.(placement, mode);
    };

    const handleStackDragEndInternal = () => {
        setActiveDragMode(null);
        setHoveredHotspot(null);
        onStackDragEnd?.();
    };

    const handleDragOver = (event: React.DragEvent<HTMLElement>, placement?: BetPlacement) => {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
        if (placement) {
            setHoveredHotspot(placement);
        }
    };

    const handleDragLeave = (event: React.DragEvent<HTMLElement>, placement: BetPlacement) => {
        event.preventDefault();
        const placementId = getPlacementIdentifier(placement);
        setHoveredHotspot(current => {
            if (!current) return null;
            return getPlacementIdentifier(current) === placementId ? null : current;
        });
    };

    const handleDropOnPlacement = (event: React.DragEvent<HTMLElement>, targetPlacement: BetPlacement) => {
        event.preventDefault();
        event.stopPropagation();
        const dragInfo = extractDragInfo(event);
        if (dragInfo && onStackMove) {
            const { draggedId, moveAll } = dragInfo;
            const sourceGroup = betsOnBoard.find(group => getPlacementIdentifier(group.placement) === draggedId);
            if (sourceGroup && getPlacementIdentifier(sourceGroup.placement) !== getPlacementIdentifier(targetPlacement)) {
                onStackMove(sourceGroup.placement, targetPlacement, moveAll);
                onStackSelectForMove?.(null);
            }
        }
        setHoveredHotspot(null);
        setActiveDragMode(null);
        onStackDragEnd?.();
    };

    const handleDropOffTable = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const dragInfo = extractDragInfo(event);
        if (!dragInfo || !onStackDelete) {
            setActiveDragMode(null);
            setHoveredHotspot(null);
            onStackDragEnd?.();
            return;
        }
        const { draggedId, moveAll } = dragInfo;
        const sourceGroup = betsOnBoard.find(group => getPlacementIdentifier(group.placement) === draggedId);
        if (sourceGroup) {
            onStackDelete(sourceGroup.placement, moveAll);
            onStackSelectForMove?.(null);
        }
        setHoveredHotspot(null);
        setActiveDragMode(null);
        onStackDragEnd?.();
    };

    const handleBetClick = (placement: BetPlacement, event: React.MouseEvent) => {
        const sourceId = moveSourceId;
        const hasModifier = event.ctrlKey || event.metaKey;
        if (sourceId && onStackMove) {
            const sourceGroup = betsOnBoard.find(group => getPlacementIdentifier(group.placement) === sourceId);
            if (sourceGroup && getPlacementIdentifier(sourceGroup.placement) !== getPlacementIdentifier(placement)) {
                onStackMove(sourceGroup.placement, placement, true);
            }
            onStackSelectForMove?.(null);
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (hasModifier) {
            toggleMoveSource(placement);
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        onStackSelectForMove?.(null);
        onBetSelect(placement);
    };

    return (
        <div
            className="inline-block w-[720px] max-w-full aspect-[2.42/1] relative bg-green-800 p-0 rounded-lg select-none font-sans shadow-[0_12px_22px_rgba(0,0,0,0.4)] shadow-emerald-900/30 overflow-hidden text-white"
            onDragOver={(event) => handleDragOver(event)}
            onDrop={handleDropOffTable}
        >
            {/* Main Table Structure */}
            <div className="h-full w-full grid grid-cols-[5fr_repeat(12,6fr)_5fr] grid-rows-[repeat(3,0.8fr)_0.45fr_0.45fr] gap-px bg-green-900">
                {/* 0 and 00 */}
                <div className="col-start-1 row-start-1 row-span-3 grid grid-rows-2 gap-px bg-green-900">
                    <div
                        onClick={(event) => handleBetClick(zeroPlacement, event)}
                        onMouseEnter={() => setHoveredHotspot(zeroPlacement)}
                        onMouseLeave={() => setHoveredHotspot(null)}
                        onDragOver={(event) => handleDragOver(event, zeroPlacement)}
                        onDragLeave={(event) => handleDragLeave(event, zeroPlacement)}
                        onDrop={(event) => handleDropOnPlacement(event, zeroPlacement)}
                        className={`flex items-center justify-center cursor-pointer transition-colors ${getNumberColor(0)} ${
                          (isNumberHighlighted(0) || numbersCoveredByStraightUps.has(0)) ? 'relative' : ''
                        }`}
                        style={
                          (isNumberHighlighted(0) || numbersCoveredByStraightUps.has(0))
                            ? {
                                ...(numbersCoveredByStraightUps.has(0) ? chipOutlineStyle : {}),
                                ...(isNumberHighlighted(0) ? sharedHighlightStyle : {}),
                              }
                            : undefined
                        }
                    >
                        0
                    </div>
                    <div
                        onClick={(event) => handleBetClick(doubleZeroPlacement, event)}
                        onMouseEnter={() => setHoveredHotspot(doubleZeroPlacement)}
                        onMouseLeave={() => setHoveredHotspot(null)}
                        onDragOver={(event) => handleDragOver(event, doubleZeroPlacement)}
                        onDragLeave={(event) => handleDragLeave(event, doubleZeroPlacement)}
                        onDrop={(event) => handleDropOnPlacement(event, doubleZeroPlacement)}
                        className={`flex items-center justify-center cursor-pointer transition-colors ${getNumberColor(-1)} ${
                          (isNumberHighlighted(-1) || numbersCoveredByStraightUps.has(-1)) ? 'relative' : ''
                        }`}
                        style={
                          (isNumberHighlighted(-1) || numbersCoveredByStraightUps.has(-1))
                            ? {
                                ...(numbersCoveredByStraightUps.has(-1) ? chipOutlineStyle : {}),
                                ...(isNumberHighlighted(-1) ? sharedHighlightStyle : {}),
                              }
                            : undefined
                        }
                    >
                        00
                    </div>
                </div>

                {/* Number Grid */}
                {numberRows.map((row, rowIndex) =>
                    row.map((num, colIndex) => {
                        const def = BET_DEFINITIONS.find(b => b.type === BetType.STRAIGHT_UP && b.numbers[0] === num)!;
                        const isHighlighted = isNumberHighlighted(num);
                        return (
                            <div
                                key={num}
                                onClick={(event) => handleBetClick(def, event)}
                                onMouseEnter={() => setHoveredHotspot(def)}
                                onMouseLeave={() => setHoveredHotspot(null)}
                                onDragOver={(event) => handleDragOver(event, def)}
                                onDragLeave={(event) => handleDragLeave(event, def)}
                                onDrop={(event) => handleDropOnPlacement(event, def)}
                                className={`col-start-${colIndex + 2} row-start-${rowIndex + 1} flex items-center justify-center cursor-pointer transition-colors ${getNumberColor(
                                  num,
                                )} ${isHighlighted ? 'relative' : ''}`}
                                style={isHighlighted ? sharedHighlightStyle : undefined}
                            >
                                {num}
                            </div>
                        );
                    })
                )}

                {/* Column Bets */}
                {[BetType.COLUMN_3RD, BetType.COLUMN_2ND, BetType.COLUMN_1ST].map((type, rowIndex) => {
                    const def = BET_DEFINITIONS.find(b => b.type === type)!;
                    const isHighlighted = isOutsideBetHighlighted(def.type, def.numbers);
                    const hasChip = placementIdsWithChips.has(getPlacementIdentifier(def));
                    return (
                        <div
                            key={rowIndex}
                            onClick={(event) => handleBetClick(def, event)}
                            onMouseEnter={() => setHoveredHotspot(def)}
                            onMouseLeave={() => setHoveredHotspot(null)}
                            onDragOver={(event) => handleDragOver(event, def)}
                            onDragLeave={(event) => handleDragLeave(event, def)}
                            onDrop={(event) => handleDropOnPlacement(event, def)}
                            className={`col-start-14 row-start-${rowIndex + 1} flex items-center justify-center cursor-pointer text-white bg-green-700 hover:bg-green-600 transition-colors border border-amber-300/25 hover:border-amber-200/60 ${isHighlighted ? 'relative' : ''}`}
                            style={
                              isHighlighted || hasChip
                                ? {
                                    ...(hasChip ? chipOutlineStyle : {}),
                                    ...(isHighlighted ? sharedHighlightStyle : {}),
                                  }
                                : undefined
                            }
                        >
                            2-1
                        </div>
                    )
                })}

                {/* Dozen Bets */}
                {[BetType.DOZEN_1ST, BetType.DOZEN_2ND, BetType.DOZEN_3RD].map((type, i) => {
                    const def = BET_DEFINITIONS.find(b => b.type === type)!;
                    const isHighlighted = isOutsideBetHighlighted(def.type, def.numbers);
                    return (
                      <div
                        key={type}
                        onClick={(event) => handleBetClick(def, event)}
                        onMouseEnter={() => setHoveredHotspot(def)}
                        onMouseLeave={() => setHoveredHotspot(null)}
                        onDragOver={(event) => handleDragOver(event, def)}
                        onDragLeave={(event) => handleDragLeave(event, def)}
                        onDrop={(event) => handleDropOnPlacement(event, def)}
                        className={`col-start-${2 + i*4} col-span-4 row-start-4 flex items-center justify-center cursor-pointer text-white bg-green-700 hover:bg-green-600 transition-colors border border-amber-300/25 hover:border-amber-200/60 ${isHighlighted ? 'relative' : ''}`}
                        style={isHighlighted ? sharedHighlightStyle : undefined}
                      >
                        {def.displayName}
                      </div>
                    );
                })}

                {/* Outside Bets */}
                {[BetType.LOW_1_18, BetType.EVEN, BetType.RED, BetType.BLACK, BetType.ODD, BetType.HIGH_19_36].map((type, i) => {
                    const def = BET_DEFINITIONS.find(b => b.type === type)!;
                    const color = type === BetType.RED ? getNumberColor(1) : type === BetType.BLACK ? getNumberColor(2) : 'bg-green-700 hover:bg-green-600';
                    const isHighlighted = isOutsideBetHighlighted(def.type, def.numbers);
                    const hasChip = placementIdsWithChips.has(getPlacementIdentifier(def));
                    return (
                      <div
                        key={type}
                        onClick={(event) => handleBetClick(def, event)}
                        onMouseEnter={() => setHoveredHotspot(def)}
                        onMouseLeave={() => setHoveredHotspot(null)}
                        onDragOver={(event) => handleDragOver(event, def)}
                        onDragLeave={(event) => handleDragLeave(event, def)}
                        onDrop={(event) => handleDropOnPlacement(event, def)}
                        className={`col-start-${2 + i*2} col-span-2 row-start-5 flex items-center justify-center cursor-pointer text-white transition-colors ${color} border border-amber-300/25 hover:border-amber-200/60 ${isHighlighted ? 'relative' : ''}`}
                        style={
                          isHighlighted || hasChip
                            ? {
                                ...(hasChip ? chipOutlineStyle : {}),
                                ...(isHighlighted ? sharedHighlightStyle : {}),
                              }
                            : undefined
                        }
                      >
                        {def.displayName}
                      </div>
                    );
                })}

            </div>
            
            {/* Interaction Layer for complex bets */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
                {BET_DEFINITIONS.filter(def => def.hotspot && def.type !== BetType.STRAIGHT_UP).map(def => {
                    const hotspot = def.hotspot!;
                    const placementId = getPlacementIdentifier(def);
                    const isHighlighted = placementId === highlightedPlacementId;
                    const baseStyle: React.CSSProperties = {
                      top: def.chipPosition.top,
                      left: def.chipPosition.left,
                      width: hotspot.width,
                      height: hotspot.height,
                      borderRadius: hotspot.borderRadius ?? '6px',
                    };

                    return (
                        <div
                            key={placementId}
                            className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer"
                            style={baseStyle}
                            onMouseEnter={() => setHoveredHotspot(def)}
                            onMouseLeave={() => setHoveredHotspot(null)}
                            onClick={(event) => handleBetClick(def, event)}
                            onDragOver={(event) => handleDragOver(event, def)}
                            onDragLeave={(event) => handleDragLeave(event, def)}
                            onDrop={(event) => handleDropOnPlacement(event, def)}
                        >
                          {isHighlighted && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="w-4 h-4 rounded-full border border-amber-300/90 shadow-[0_0_10px_rgba(250,204,21,0.55)] bg-amber-200/20" />
                            </div>
                          )}
                        </div>
                    );
                })}
                {placementOutlineOverlays.map(outline => (
                    <div
                        key={`outline-${outline.id}`}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        style={outline.style}
                    />
                ))}
            </div>
            
            {/* Highlight overlays for dozens (visual only, no pointer capture) */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-[9]">
              {DOZEN_OVERLAY_CONFIG.map(config => {
                const def = BET_DEFINITIONS.find(b => b.type === config.type)!;
                const isHighlighted = isOutsideBetHighlighted(def.type, def.numbers);
                const hasChip = placementIdsWithChips.has(getPlacementIdentifier(def));
                const baseStyle = {
                  top: formatPercent(DOZEN_OVERLAY_TOP_PERCENT),
                  left: formatPercent(config.leftPercent),
                  width: formatPercent(config.widthPercent - DOZEN_HORIZONTAL_MARGIN * 2),
                  height: formatPercent(DOZEN_OVERLAY_HEIGHT_PERCENT - DOZEN_VERTICAL_MARGIN * 2),
                  borderRadius: '8px',
                  border: '2px solid transparent',
                  backgroundColor: 'transparent',
                  boxShadow: 'none',
                } as React.CSSProperties;
                if (isHighlighted) {
                  baseStyle.border = '2px solid rgba(253, 224, 71, 0.85)';
                  baseStyle.boxShadow = '0 0 16px rgba(253, 224, 71, 0.5)';
                  baseStyle.backgroundColor = 'rgba(253, 224, 71, 0.24)';
                } else if (hasChip) {
                  Object.assign(baseStyle, chipOutlineStyle);
                }
                return (
                  <div
                    key={config.type}
                    className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-150 pointer-events-none"
                    style={baseStyle}
                  />
                );
              })}
            </div>
            
            {/* Trigger Highlight Overlays */}
            {triggerMode &&
              BET_DEFINITIONS.map((def, idx) => {
                const placement: BetPlacement = { type: def.type, numbers: def.numbers, displayName: def.displayName };
                // Only allow straight numbers and outside bets in trigger mode
                if (!TRIGGER_ALLOWED_TYPES.has(placement.type)) return null;
                const id = getPlacementIdentifier(placement);
                if (!triggerSet.has(id)) return null;

                // Default overlay uses hotspot (smaller). For trigger mode we want to fill the whole button/tile.
                let top = def.chipPosition.top;
                let left = def.chipPosition.left;
                let width = def.hotspot?.width ?? '0%';
                let height = def.hotspot?.height ?? '0%';
                let borderRadius = def.hotspot?.borderRadius ?? '4px';

                // Expand certain bet types to fill their entire button/area
                switch (def.type) {
                  case BetType.STRAIGHT_UP: {
                    width = formatPercent(numberColumnWidthPercent);
                    height = formatPercent(numberRowHeightPercent);
                    borderRadius = '6px';
                    break;
                  }
                  case BetType.DOZEN_1ST:
                  case BetType.DOZEN_2ND:
                  case BetType.DOZEN_3RD: {
                    const cfg = DOZEN_OVERLAY_CONFIG.find((c) => c.type === def.type);
                    if (cfg) {
                      top = formatPercent(DOZEN_OVERLAY_TOP_PERCENT);
                      // Center exactly on the dozen button (cfg.leftPercent is already the center)
                      left = formatPercent(cfg.leftPercent);
                      width = formatPercent(cfg.widthPercent);
                      height = formatPercent(DOZEN_OVERLAY_HEIGHT_PERCENT);
                      borderRadius = '8px';
                    }
                    break;
                  }
                  case BetType.LOW_1_18:
                  case BetType.HIGH_19_36:
                  case BetType.EVEN:
                  case BetType.ODD:
                  case BetType.RED:
                  case BetType.BLACK: {
                    // Even money buttons: center on defined chipPosition and span exactly two number columns
                    const segmentWidth = numberColumnWidthPercent * 2.0;
                    top = formatPercent(getRowBoundaryPercent(3) + dozenRowHeightPercent + evenMoneyRowHeightPercent / 2);
                    left = def.chipPosition.left; // chip position is already centered on the button
                    width = formatPercent(segmentWidth);
                    height = formatPercent(evenMoneyRowHeightPercent);
                    borderRadius = '8px';
                    break;
                  }
                  case BetType.COLUMN_1ST:
                  case BetType.COLUMN_2ND:
                  case BetType.COLUMN_3RD: {
                    // Columns occupy the right-most outside column; approximate vertical segment per column
                    const columnIndex = def.type === BetType.COLUMN_1ST ? 2 : def.type === BetType.COLUMN_2ND ? 1 : 0;
                    top = formatPercent(getRowCenterPercent(columnIndex));
                    left = def.chipPosition.left; // centered on button
                    width = formatPercent(outsideColumnWidthPercent);
                    height = formatPercent(numberRowHeightPercent);
                    borderRadius = '8px';
                    break;
                  }
                  default:
                    // leave as hotspot-based (splits/corners/streets/six-lines/topline/basket)
                    break;
                }

                const style: React.CSSProperties = {
                  position: 'absolute',
                  top,
                  left,
                  width,
                  height,
                  transform: 'translate(-50%, -50%)',
                  borderRadius,
                  backgroundColor: 'rgba(253, 224, 71, 0.35)',
                  border: '2px solid rgba(253, 224, 71, 0.85)',
                  boxShadow: '0 0 16px rgba(253, 224, 71, 0.5)',
                  pointerEvents: 'none',
                  zIndex: 5,
                };
                return <div key={`trigger-overlay-${idx}`} style={style} />;
              })}

            {/* Chip Layer */}
            {!triggerMode && betsOnBoard.map(group => {
                const stackId = getPlacementIdentifier(group.placement);
                const isDraggingStack = activeDragMode === 'stack' && stackId === draggingStackId;
                const isSelected = stackId === moveSourceId || isDraggingStack;
                return (
                    <ChipStack
                        key={stackId}
                        bets={group.bets}
                        totalAmount={group.totalAmount}
                        position={group.position}
                        placement={group.placement}
                        isSelected={!!isSelected}
                        onCtrlClick={handleStackCtrlClick}
                        onDelete={handleStackDelete}
                        onDragStart={handleStackDragStartInternal}
                        onDragEnd={handleStackDragEndInternal}
                        onPrimaryClick={handleBetClick}
                    />
                );
            })}
        </div>
    );
};

export default RouletteTable;