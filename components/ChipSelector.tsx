import React, { useState } from 'react';
import { CHIP_VALUES } from '../core/constants';

interface ChipSelectorProps {
  selectedChip: number;
  onSelectChip: (value: number) => void;
}

const ChipSelector: React.FC<ChipSelectorProps> = ({ selectedChip, onSelectChip }) => {
  return (
    <div className="flex gap-4 justify-center items-center py-4 bg-slate-900 rounded-lg shadow-inner border border-slate-700">
      <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider mr-2">Chip Value:</span>
      {CHIP_VALUES.map((value) => (
        <button
          key={value}
          onClick={() => onSelectChip(value)}
          className={`
            relative w-12 h-12 rounded-full flex items-center justify-center font-bold text-xs shadow-lg transition-transform hover:scale-110
            ${selectedChip === value ? 'ring-4 ring-yellow-400 scale-110' : ''}
            ${getChipColor(value)}
          `}
        >
          <div className="absolute inset-1 border-2 border-dashed border-white/30 rounded-full pointer-events-none"></div>
          {value}
        </button>
      ))}
    </div>
  );
};

const getChipColor = (value: number) => {
  switch (value) {
    case 1: return 'bg-gray-200 text-gray-800 border-4 border-gray-300';
    case 5: return 'bg-red-600 text-white border-4 border-red-700';
    case 25: return 'bg-green-600 text-white border-4 border-green-700';
    case 100: return 'bg-black text-white border-4 border-slate-700';
    case 500: return 'bg-purple-600 text-white border-4 border-purple-700';
    case 1000: return 'bg-yellow-500 text-black border-4 border-yellow-600';
    default: return 'bg-blue-500';
  }
};

export default ChipSelector;