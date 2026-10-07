import React, { useState } from 'react';
import { CalculatorService } from '../services/calculatorService';
import { ChevronDown, ChevronUp, AlertTriangle, Info, CheckCircle2, Sliders } from 'lucide-react';

interface ScenarioPreviewProps {
  scenarioType: 'savings' | 'other';
  goalDescription: string;
  income: number | null;
  expenses: number | null;
  currentSavings: number | null;
  goalAmount: number | null;
  deadlineMonths: number | null;
  isDateDeadline?: boolean;
}

export const ScenarioPreview: React.FC<ScenarioPreviewProps> = ({
  scenarioType,
  goalDescription,
  income,
  expenses,
  currentSavings,
  goalAmount,
  deadlineMonths,
  isDateDeadline,
}) => {
  // Explicit savings allocation (do NOT auto-allocate all current savings per PRD)
  const [allocatedSavings, setAllocatedSavings] = useState<number>(() => {
    if (currentSavings !== null && currentSavings > 0) {
      return Math.min(500, currentSavings);
    }
    return 0;
  });

  const [monthlyContribution, setMonthlyContribution] = useState<number>(300);
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);

  // If scenario is not a savings goal (e.g. Apartment Move)
  if (scenarioType === 'other' || isDateDeadline) {
    return (
      <div className="mt-4 p-4 bg-[#F6F5F0] border border-[#DDD8CB] rounded-xl">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#737C8A] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-[#1E232A]">
              Calculator not connected for this scenario
            </h4>
            <p className="mt-0.5 text-xs text-[#5C6573] leading-relaxed">
              This scenario includes rent transitions or multi-factor debt structures. The Phase 1 deterministic calculator currently models fixed savings goals.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check for missing required inputs
  const missingInputs: string[] = [];
  if (income === null) missingInputs.push('Monthly income');
  if (expenses === null) missingInputs.push('Monthly expenses');
  if (goalAmount === null) missingInputs.push('Goal target amount');
  if (deadlineMonths === null || deadlineMonths <= 0) missingInputs.push('Valid positive month deadline');

  if (missingInputs.length > 0) {
    return (
      <div className="mt-4 p-4 bg-[#FEF6EE] border border-[#F6D5B3] rounded-xl">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-[#B55D08] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-[#252B35]">
              Scenario calculation paused — outstanding information needed
            </h4>
            <p className="mt-0.5 text-xs text-[#735032] leading-relaxed">
              To project savings, the following assumptions must be clarified first:
            </p>
            <ul className="mt-1.5 list-disc list-inside text-xs text-[#874A07] space-y-0.5 font-medium">
              {missingInputs.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const validIncome = income as number;
  const validExpenses = expenses as number;
  const validGoalAmount = goalAmount as number;
  const validDeadlineMonths = deadlineMonths as number;
  const maxSavingsAvailable = currentSavings !== null ? currentSavings : 0;

  const result = CalculatorService.calculateSavings({
    monthlyIncome: validIncome,
    monthlyExpenses: validExpenses,
    goalAmount: validGoalAmount,
    monthsDeadline: validDeadlineMonths,
    allocatedSavings,
    monthlyContribution,
  });

  const availableSurplus = validIncome - validExpenses;
  const maxContribSlider = Math.max(800, availableSurplus > 0 ? availableSurplus * 1.5 : 1000);

  return (
    <div className="mt-4 bg-white border border-[#DDD8CB] rounded-xl shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 bg-[#F9F8F5] border-b border-[#EBE7DD] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-[#5B39A0]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#3D2E70]">
            Deterministic Savings Calculation
          </h3>
        </div>
        <span className="text-[11px] text-[#737C8A]">
          Independent from AI extraction
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Warnings */}
        {availableSurplus <= 0 ? (
          <div className="p-3 bg-[#FDF2F2] border border-[#F8B4B4] rounded-lg text-xs text-[#9B1C1C]">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>No monthly surplus available</span>
            </div>
            <p className="mt-0.5 text-[11px]">
              Expenses (${validExpenses.toLocaleString()}) match or exceed income (${validIncome.toLocaleString()}).
            </p>
          </div>
        ) : result.exceedsCashFlow ? (
          <div className="p-3 bg-[#FFF8EB] border border-[#FAD79A] rounded-lg text-xs text-[#92400E]">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
              <span>Cash flow exceeds available amount</span>
            </div>
            <p className="mt-0.5 text-[11px]">
              Planned contribution (${monthlyContribution.toLocaleString()}/mo) exceeds available surplus (${availableSurplus.toLocaleString()}/mo).
            </p>
          </div>
        ) : null}

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-2.5 bg-[#F9F8F5] rounded-lg border border-[#EBE7DD]">
            <span className="text-[10px] font-semibold text-[#737C8A] uppercase tracking-wider block">
              Goal
            </span>
            <div className="text-base sm:text-lg font-bold font-mono-num text-[#1E232A] mt-0.5">
              ${validGoalAmount.toLocaleString()}
            </div>
            <span className="text-[10px] text-[#737C8A] block">
              {validDeadlineMonths} mos
            </span>
          </div>

          <div className="p-2.5 bg-[#F9F8F5] rounded-lg border border-[#EBE7DD]">
            <span className="text-[10px] font-semibold text-[#737C8A] uppercase tracking-wider block">
              Projected
            </span>
            <div className="text-base sm:text-lg font-bold font-mono-num text-[#1E232A] mt-0.5">
              ${result.projectedAmount.toLocaleString()}
            </div>
            <span className="text-[10px] text-[#737C8A] block">
              at month {validDeadlineMonths}
            </span>
          </div>

          <div className={`p-2.5 rounded-lg border ${result.targetGap === 0 ? 'bg-[#EAF5EC] border-[#CDE5D2]' : 'bg-[#F9F8F5] border-[#EBE7DD]'}`}>
            <span className="text-[10px] font-semibold text-[#737C8A] uppercase tracking-wider block">
              Remaining gap
            </span>
            <div className={`text-base sm:text-lg font-bold font-mono-num mt-0.5 ${result.targetGap === 0 ? 'text-[#226738]' : 'text-[#874A07]'}`}>
              ${result.targetGap.toLocaleString()}
            </div>
            <span className="text-[10px] text-[#737C8A] block">
              {result.targetGap === 0 ? 'Fully met' : 'Still needed'}
            </span>
          </div>

          <div className={`p-2.5 rounded-lg border ${result.monthlyRemainingCash < 0 ? 'bg-[#FDF2F2] border-[#F8B4B4]' : 'bg-[#F9F8F5] border-[#EBE7DD]'}`}>
            <span className="text-[10px] font-semibold text-[#737C8A] uppercase tracking-wider block">
              Buffer
            </span>
            <div className={`text-base sm:text-lg font-bold font-mono-num mt-0.5 ${result.monthlyRemainingCash < 0 ? 'text-[#9B1C1C]' : 'text-[#1E232A]'}`}>
              ${result.monthlyRemainingCash.toLocaleString()}
            </div>
            <span className="text-[10px] text-[#737C8A] block">
              unallocated/mo
            </span>
          </div>
        </div>

        {/* Sliders */}
        <div className="p-3 bg-[#FAF9F5] border border-[#E7E4DC] rounded-lg space-y-3">
          {/* Allocated Savings */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#4F5762]">
                Savings allocated to this goal
              </span>
              <div className="flex items-center gap-0.5 font-mono-num font-semibold">
                <span>$</span>
                <input
                  type="number"
                  min={0}
                  max={Math.max(maxSavingsAvailable, 5000)}
                  step={50}
                  value={allocatedSavings}
                  onChange={(e) => setAllocatedSavings(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-20 px-1.5 py-0.5 text-xs bg-white border border-[#D5D0C3] rounded text-right focus:outline-none"
                />
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(maxSavingsAvailable, 3000)}
              step={50}
              value={allocatedSavings}
              onChange={(e) => setAllocatedSavings(parseFloat(e.target.value))}
              className="w-full accent-[#2B303A] cursor-pointer h-1.5"
            />
          </div>

          {/* Monthly Contribution */}
          <div className="space-y-1 pt-2 border-t border-[#ECE8DE]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#4F5762]">
                Monthly contribution
              </span>
              <div className="flex items-center gap-0.5 font-mono-num font-semibold">
                <span>$</span>
                <input
                  type="number"
                  min={0}
                  max={maxContribSlider}
                  step={25}
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-20 px-1.5 py-0.5 text-xs bg-white border border-[#D5D0C3] rounded text-right focus:outline-none"
                />
                <span className="text-[10px] text-[#737C8A] font-normal">/mo</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={maxContribSlider}
              step={25}
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(parseFloat(e.target.value))}
              className="w-full accent-[#2B303A] cursor-pointer h-1.5"
            />
          </div>
        </div>

        {/* Calculation Details Toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowFormulaDetails(!showFormulaDetails)}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#5C6573] hover:text-[#1E232A] cursor-pointer"
          >
            {showFormulaDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span>{showFormulaDetails ? 'Hide calculation formulas' : 'Show calculation formulas'}</span>
          </button>

          {showFormulaDetails && (
            <div className="mt-2 p-3 bg-[#F7F6F1] border border-[#E0DBCF] rounded-lg text-xs space-y-2 font-mono">
              <div>
                <span className="text-[10px] text-[#737C8A] font-sans block">
                  Projected: Allocated + (Monthly Contribution × Months)
                </span>
                <div className="text-[11px] text-[#1E232A] font-semibold">
                  {result.details.formulaProjected}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-[#737C8A] font-sans block">
                  Buffer: Income - Expenses - Contribution
                </span>
                <div className="text-[11px] text-[#1E232A] font-semibold">
                  {result.details.formulaRemainingCash}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
