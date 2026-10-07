import React from 'react';
import { RotateCcw } from 'lucide-react';

interface TopNavProps {
  onNewQuestion: () => void;
  onSelectSample: (fixtureId: string) => void;
  activeFixtureId: string | null;
}

export const TopNav: React.FC<TopNavProps> = ({
  onNewQuestion,
  onSelectSample,
  activeFixtureId,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#F8F7F5]/90 backdrop-blur-md border-b border-[#E8E4DA] transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
        {/* Zone 1: Clean Brand Wordmark (Clean Sans-Serif) */}
        <div className="flex items-center gap-2.5">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNewQuestion();
            }}
            className="text-base font-bold tracking-tight text-[#1E232A] hover:opacity-90 transition-opacity"
          >
            Show Your Work
          </a>
        </div>

        {/* Zone 2: Compact Clean Scenario Switcher */}
        <nav className="hidden sm:flex items-center gap-4 text-xs font-medium text-[#5C6573]">
          <button
            type="button"
            onClick={() => onSelectSample('trip')}
            className={`hover:text-[#1E232A] transition-colors cursor-pointer py-1 ${
              activeFixtureId === 'trip' ? 'text-[#1E232A] font-semibold border-b-2 border-[#1E232A]' : ''
            }`}
          >
            Europe Trip
          </button>
          <button
            type="button"
            onClick={() => onSelectSample('laptop')}
            className={`hover:text-[#1E232A] transition-colors cursor-pointer py-1 ${
              activeFixtureId === 'laptop' ? 'text-[#1E232A] font-semibold border-b-2 border-[#1E232A]' : ''
            }`}
          >
            Laptop
          </button>
          <button
            type="button"
            onClick={() => onSelectSample('apartment')}
            className={`hover:text-[#1E232A] transition-colors cursor-pointer py-1 ${
              activeFixtureId === 'apartment' ? 'text-[#1E232A] font-semibold border-b-2 border-[#1E232A]' : ''
            }`}
          >
            Apartment
          </button>
          <button
            type="button"
            onClick={() => onSelectSample('debt_laptop')}
            className={`hover:text-[#1E232A] transition-colors cursor-pointer py-1 ${
              activeFixtureId === 'debt_laptop' ? 'text-[#1E232A] font-semibold border-b-2 border-[#1E232A]' : ''
            }`}
          >
            Debt & Budget
          </button>
        </nav>

        {/* Zone 3: Action */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewQuestion}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-[#1E232A] hover:bg-[#323944] rounded-md transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>New question</span>
          </button>
        </div>
      </div>
    </header>
  );
};
