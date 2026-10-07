import React, { useState } from 'react';
import {
  Assumption,
  AssumptionValue,
  ReviewStatus,
  ClarificationQuestion,
} from '../types/extraction';
import {
  ChevronDown,
  ChevronUp,
  Check,
  Edit2,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';

interface AssumptionRowProps {
  assumption: Assumption;
  reviewStatus: ReviewStatus;
  localOverrideValue?: AssumptionValue;
  isOverridden?: boolean;
  relatedQuestion?: ClarificationQuestion;
  questionAnswer?: string;
  compact?: boolean;
  onConfirmInference: (variable: string) => void;
  onSaveLocalEdit: (variable: string, newValue: AssumptionValue) => void;
  onResetLocalEdit: (variable: string) => void;
  onSaveQuestionAnswer?: (targetVariable: string, answer: string) => void;
}

// Fixed labels that do NOT introduce unsupported meaning
const HUMAN_LABELS: Record<string, string> = {
  monthly_income: 'Monthly income',
  monthly_expenses: 'Monthly expenses',
  monthly_surplus: 'Monthly surplus (available cash)',
  current_savings: 'Current savings',
  savings_allocated_to_goal: 'Savings allocated to goal',
  goal_amount: 'Goal amount',
  goal_deadline: 'Goal deadline',
  goal_description: 'Goal description',
  monthly_car_payment: 'Monthly car payment',
  monthly_student_loan_payment: 'Monthly student loan payment',
  current_rent: 'Current rent',
  proposed_rent: 'Proposed rent',
  monthly_expenses_rent: 'Rent',
  monthly_expenses_other: 'Other monthly expenses',
  monthly_expenses_rent_utilities: 'Rent and utilities',
  debt_to_friend: 'Debt to friend',
};

interface NumericConfig {
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
}

const NUMERIC_CONFIGS: Record<string, NumericConfig> = {
  monthly_income: { min: 500, max: 10000, step: 50, prefix: '$' },
  monthly_expenses: { min: 300, max: 8000, step: 25, prefix: '$' },
  monthly_expenses_rent: { min: 200, max: 4000, step: 50, prefix: '$' },
  monthly_expenses_other: { min: 100, max: 3000, step: 25, prefix: '$' },
  monthly_expenses_rent_utilities: { min: 200, max: 4000, step: 50, prefix: '$' },
  monthly_surplus: { min: -1000, max: 5000, step: 25, prefix: '$' },
  current_savings: { min: 0, max: 20000, step: 100, prefix: '$' },
  debt_to_friend: { min: 0, max: 5000, step: 25, prefix: '$' },
  goal_amount: { min: 200, max: 15000, step: 100, prefix: '$' },
  goal_deadline: { min: 1, max: 48, step: 1, suffix: ' mos' },
  monthly_car_payment: { min: 50, max: 1500, step: 25, prefix: '$' },
  monthly_student_loan_payment: { min: 50, max: 2000, step: 25, prefix: '$' },
  current_rent: { min: 300, max: 5000, step: 50, prefix: '$' },
  proposed_rent: { min: 300, max: 6000, step: 50, prefix: '$' },
};

export const AssumptionRow: React.FC<AssumptionRowProps> = ({
  assumption,
  reviewStatus,
  localOverrideValue,
  isOverridden,
  relatedQuestion,
  questionAnswer,
  compact = false,
  onConfirmInference,
  onSaveLocalEdit,
  onResetLocalEdit,
  onSaveQuestionAnswer,
}) => {
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Active value to display
  const activeValue = isOverridden && localOverrideValue !== undefined ? localOverrideValue : assumption.value;

  // Edit draft states
  const [draftValue, setDraftValue] = useState<AssumptionValue>(activeValue ?? '');
  const [inlineAnswerDraft, setInlineAnswerDraft] = useState<string>(questionAnswer || '');
  const [isEditingInlineAnswer, setIsEditingInlineAnswer] = useState(false);

  const isDerived = assumption.variable === 'monthly_surplus';
  const label =
    HUMAN_LABELS[assumption.variable] ||
    assumption.variable
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

  // Formatter for values (strict null check first per PRD!)
  const formatDisplayValue = (val: AssumptionValue, unit: string | null) => {
    if (val === null || val === undefined) {
      return <span className="text-[#8C827A] italic text-xs font-normal">Not provided yet</span>;
    }

    if (typeof val === 'number') {
      const formattedNum = val.toLocaleString('en-US', {
        maximumFractionDigits: 2,
      });
      if (unit === '$/month') {
        return (
          <span className="font-mono-num font-bold text-xs sm:text-sm text-[#1E232A]">
            ${formattedNum} <span className="text-[11px] font-normal text-[#6B7280]">/mo</span>
          </span>
        );
      }
      if (unit === '$') {
        return (
          <span className="font-mono-num font-bold text-xs sm:text-sm text-[#1E232A]">
            ${formattedNum}
          </span>
        );
      }
      if (unit === 'months') {
        return (
          <span className="font-mono-num font-bold text-xs sm:text-sm text-[#1E232A]">
            {formattedNum} <span className="text-[11px] font-normal text-[#6B7280]">{val === 1 ? 'mo' : 'mos'}</span>
          </span>
        );
      }
      return (
        <span className="font-mono-num font-bold text-xs sm:text-sm text-[#1E232A]">
          {formattedNum} {unit && <span className="text-[11px] font-normal text-[#6B7280]">{unit}</span>}
        </span>
      );
    }

    if (typeof val === 'string') {
      if (unit === 'date' || /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        try {
          const dateObj = new Date(val + 'T00:00:00');
          const dateStr = dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          return <span className="font-semibold text-xs sm:text-sm text-[#1E232A]">{dateStr}</span>;
        } catch {
          return <span className="font-semibold text-xs sm:text-sm text-[#1E232A]">{val}</span>;
        }
      }
      return <span className="font-medium text-xs sm:text-sm text-[#1E232A]">"{val}"</span>;
    }

    return String(val);
  };

  const handleStartEdit = () => {
    setDraftValue(activeValue !== null ? activeValue : '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    let finalVal: AssumptionValue = draftValue;
    if (typeof activeValue === 'number' || NUMERIC_CONFIGS[assumption.variable]) {
      const parsed = parseFloat(String(draftValue));
      finalVal = isNaN(parsed) ? null : parsed;
    } else if (draftValue === '') {
      finalVal = null;
    }
    onSaveLocalEdit(assumption.variable, finalVal);
    setIsEditing(false);
  };

  const numericConfig = NUMERIC_CONFIGS[assumption.variable];
  const currentNum = typeof draftValue === 'number' ? draftValue : parseFloat(String(draftValue)) || 0;
  const sliderMin = numericConfig ? Math.min(numericConfig.min, currentNum) : 0;
  const sliderMax = numericConfig ? Math.max(numericConfig.max, currentNum > 0 ? currentNum * 1.5 : 1000) : 1000;
  const sliderStep = numericConfig ? numericConfig.step : 1;

  const handleInlineAnswerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!relatedQuestion || !onSaveQuestionAnswer) return;
    if (inlineAnswerDraft.trim()) {
      onSaveQuestionAnswer(relatedQuestion.target_variable, inlineAnswerDraft.trim());
      setIsEditingInlineAnswer(false);
    }
  };

  // =========================================================================
  // COMPACT CARD VARIANT (For Stated Details — e.g. Rent: $900/mo on one line,
  // in distinct, pleasant soft light green styling to match color hierarchy)
  // =========================================================================
  if (compact) {
    return (
      <div className="bg-[#EAF6ED] border border-[#B8DEC0] rounded-lg px-3 py-2 shadow-3xs hover:border-[#96D1A2] hover:bg-[#E3F4E7] transition-colors">
        {/* Main row: Label on left, Value directly on the right without line-wrap! */}
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-[#164F28] truncate">
              {label}
            </span>
            <span className="inline-flex items-center text-[9px] font-medium px-1.5 py-0.2 rounded bg-[#D4EED8] text-[#164F28] border border-[#A8DBB1]">
              You told us
            </span>
            {isOverridden && (
              <span className="inline-flex items-center text-[9px] font-medium px-1.5 py-0.2 rounded bg-[#FFF7D6] text-[#806300] border border-[#FFE885]">
                Edited
              </span>
            )}
          </div>

          <div className="text-right shrink-0">
            {formatDisplayValue(activeValue, assumption.unit)}
          </div>
        </div>

        {/* Thin horizontal line with pencil on the right */}
        <div className="mt-1.5 pt-1.5 border-t border-[#CBE6D0] flex items-center justify-between text-[11px]">
          <button
            type="button"
            onClick={() => setIsDetailExpanded(!isDetailExpanded)}
            className="text-[10px] text-[#2F6139] hover:text-[#133A1F] flex items-center gap-0.5 cursor-pointer truncate max-w-[80%]"
            title={assumption.source_detail}
          >
            <span className="truncate">{assumption.source_detail || 'Source note'}</span>
            {isDetailExpanded ? <ChevronUp className="w-2.5 h-2.5 shrink-0" /> : <ChevronDown className="w-2.5 h-2.5 shrink-0" />}
          </button>

          <div className="flex items-center gap-1 shrink-0">
            {isOverridden && !isEditing && (
              <button
                type="button"
                onClick={() => onResetLocalEdit(assumption.variable)}
                className="p-0.5 text-[#2F6139] hover:text-[#9A550F] rounded cursor-pointer"
                title="Reset to original stated value"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}

            {!isEditing && (
              <button
                type="button"
                onClick={handleStartEdit}
                className="p-1 text-[#164F28] hover:text-[#0E351A] hover:bg-[#D4EED8] rounded cursor-pointer transition-colors"
                title="Edit this value"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Expandable note if toggled */}
        {isDetailExpanded && (
          <div className="mt-1.5 p-2 bg-[#DDF1E2] rounded border border-[#B7DDBF] text-[10px] text-[#164F28] leading-relaxed">
            {assumption.source_detail}
          </div>
        )}

        {/* Inline editor if active */}
        {isEditing && (
          <div className="mt-2 p-2 bg-[#DDF1E2] border border-[#B7DDBF] rounded space-y-1.5">
            <div className="flex items-center gap-1.5">
              {numericConfig && numericConfig.prefix && (
                <span className="text-xs text-[#164F28]">{numericConfig.prefix}</span>
              )}
              <input
                type={numericConfig ? 'number' : 'text'}
                value={draftValue === null ? '' : draftValue}
                onChange={(e) => {
                  const val = numericConfig
                    ? (e.target.value === '' ? null : parseFloat(e.target.value))
                    : e.target.value;
                  setDraftValue(val);
                }}
                className="flex-1 px-2 py-0.5 text-xs bg-white border border-[#96D1A2] rounded focus:outline-none focus:ring-1 focus:ring-[#164F28]"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSave}
                className="px-2.5 py-0.5 text-xs font-semibold text-white bg-[#185329] hover:bg-[#12401F] rounded cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-2 py-0.5 text-xs text-[#2F6139] hover:text-[#133A1F] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // STANDARD CARD VARIANT (For Inferred & Question Items)
  // =========================================================================
  return (
    <div className="bg-white border border-[#E2DDD3] rounded-xl p-3 shadow-2xs hover:border-[#C4BEB0] transition-all flex flex-col justify-between gap-2">
      {/* Top Header: Label & Source Badge */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-[#1E232A] leading-tight">
          {label}
        </span>

        {/* Source Badges */}
        <div className="flex items-center gap-1 shrink-0">
          {assumption.source === 'stated' && (
            <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#EAF5EC] text-[#226738] border border-[#CDE5D2]">
              You told us
            </span>
          )}

          {assumption.source === 'inferred' && (
            <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#F1ECFA] text-[#5B39A0] border border-[#DDD3F2]">
              We inferred
            </span>
          )}

          {assumption.source === 'missing' && (
            <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#FEF4E8] text-[#9A550F] border border-[#F9DEBD]">
              Still missing
            </span>
          )}
        </div>
      </div>

      {/* Value Display Row & Status Tags */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex-1 min-w-0">
          {formatDisplayValue(activeValue, assumption.unit)}
        </div>

        {/* Status flags */}
        <div className="flex items-center gap-1 shrink-0">
          {assumption.source === 'inferred' && reviewStatus === 'confirmed' && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#EAF5EC] text-[#226738] border border-[#CDE5D2]">
              <Check className="w-2.5 h-2.5" />
              Confirmed
            </span>
          )}

          {isOverridden && (
            <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#FFF7D6] text-[#806300] border border-[#FFE885]">
              {isDerived ? 'User override' : 'Local edit'}
            </span>
          )}
        </div>
      </div>

      {/* Action Affordances Bar */}
      <div className="flex items-center justify-between pt-1 border-t border-[#F2EFE8] text-xs">
        <div>
          {assumption.source === 'inferred' && reviewStatus !== 'confirmed' && !isOverridden ? (
            <button
              type="button"
              onClick={() => onConfirmInference(assumption.variable)}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md text-[#3D2E70] bg-[#ECE6F8] hover:bg-[#E0D7F3] transition-colors cursor-pointer"
              title="Confirm this inference looks right"
            >
              <Check className="w-3 h-3 text-[#5B39A0]" />
              <span>Looks right</span>
            </button>
          ) : (
            <span />
          )}
        </div>

        <div className="flex items-center gap-1">
          {!isEditing && (
            <button
              type="button"
              onClick={handleStartEdit}
              className="p-1 text-[#5C6573] hover:text-[#1E232A] hover:bg-[#F2EFE8] rounded transition-colors cursor-pointer"
              title={assumption.value === null ? 'Provide this value' : 'Edit value'}
            >
              <Edit2 className="w-3 h-3" />
            </button>
          )}

          {isOverridden && !isEditing && (
            <button
              type="button"
              onClick={() => onResetLocalEdit(assumption.variable)}
              className="p-1 text-[#5C6573] hover:text-[#9A550F] hover:bg-[#FEF4E8] rounded transition-colors cursor-pointer"
              title="Reset to model extraction"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsDetailExpanded(!isDetailExpanded)}
            className="p-1 text-[#737C8A] hover:text-[#1E232A] hover:bg-[#F2EFE8] rounded transition-colors cursor-pointer"
            title={isDetailExpanded ? 'Hide explanation' : 'Why this value?'}
            aria-expanded={isDetailExpanded}
          >
            {isDetailExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable "Why this value?" full source detail text */}
      {isDetailExpanded && (
        <div className="p-2 rounded-lg bg-[#F8F7F2] border border-[#E5DFD3] text-[11px] text-[#4F5762] leading-relaxed">
          <p className="whitespace-pre-line">{assumption.source_detail}</p>
        </div>
      )}

      {/* Inline Editor Drawer inside Card */}
      {isEditing && (
        <div className="p-2.5 bg-[#FAF9F5] border border-[#DDD9CE] rounded-lg shadow-2xs space-y-2">
          {isDerived && (
            <div className="p-1.5 bg-[#FFF9E6] border border-[#F0DC9E] rounded text-[10px] text-[#806300] flex items-start gap-1">
              <AlertCircle className="w-3 h-3 text-[#A87E00] shrink-0 mt-0.5" />
              <span>Derived from income minus expenses. Overriding sets a custom figure.</span>
            </div>
          )}

          {numericConfig ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <span className="font-semibold text-[#4F5762]">Value</span>
                <div className="flex items-center gap-0.5">
                  {numericConfig.prefix && <span className="text-[#737C8A]">{numericConfig.prefix}</span>}
                  <input
                    type="number"
                    value={draftValue === null ? '' : draftValue}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : parseFloat(e.target.value);
                      setDraftValue(val);
                    }}
                    step={numericConfig.step}
                    className="w-20 px-1.5 py-0.5 text-xs font-mono-num bg-white border border-[#D5D0C3] rounded text-right focus:outline-none"
                  />
                  {numericConfig.suffix && <span className="text-[#737C8A]">{numericConfig.suffix}</span>}
                </div>
              </div>

              <input
                type="range"
                min={sliderMin}
                max={sliderMax}
                step={sliderStep}
                value={typeof draftValue === 'number' ? draftValue : sliderMin}
                onChange={(e) => setDraftValue(parseFloat(e.target.value))}
                className="w-full accent-[#2B303A] cursor-pointer h-1.5"
              />
            </div>
          ) : assumption.unit === 'date' || (typeof activeValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(activeValue)) ? (
            <input
              type="date"
              value={typeof draftValue === 'string' ? draftValue : ''}
              onChange={(e) => setDraftValue(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-white border border-[#D5D0C3] rounded focus:outline-none"
            />
          ) : (
            <input
              type="text"
              value={draftValue === null ? '' : String(draftValue)}
              onChange={(e) => setDraftValue(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-white border border-[#D5D0C3] rounded focus:outline-none"
              placeholder="Enter value"
            />
          )}

          <div className="flex items-center justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-2 py-0.5 text-[11px] text-[#5C6573] hover:text-[#1E232A] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-2.5 py-0.5 text-[11px] font-semibold text-white bg-[#1E232A] rounded cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Embedded Clarification Question directly below the assumption inside the card */}
      {relatedQuestion && (
        <div className="p-2 rounded-lg bg-[#FAF7F0] border border-[#E6DECE] space-y-1.5 mt-0.5">
          <div className="flex items-start gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-[#9A550F] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-[#1E232A] block leading-snug">
                {relatedQuestion.question}
              </span>
              <span className="text-[10px] text-[#737C8A] block mt-0.5 leading-snug">
                {relatedQuestion.why_it_matters}
              </span>
            </div>
          </div>

          {questionAnswer && !isEditingInlineAnswer ? (
            <div className="flex items-center justify-between gap-1.5 p-1.5 bg-white rounded border border-[#DDD6C8] text-xs">
              <div className="flex items-center gap-1 text-[#226738] font-medium min-w-0">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span className="truncate text-[11px]">"{questionAnswer}"</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInlineAnswerDraft(questionAnswer);
                  setIsEditingInlineAnswer(true);
                }}
                className="text-[10px] text-[#5C6573] hover:text-[#1E232A] hover:underline cursor-pointer shrink-0"
              >
                Edit
              </button>
            </div>
          ) : (
            <form onSubmit={handleInlineAnswerSubmit} className="flex items-center gap-1">
              <input
                type="text"
                value={inlineAnswerDraft}
                onChange={(e) => setInlineAnswerDraft(e.target.value)}
                placeholder="Clarify this..."
                className="flex-1 px-2 py-0.5 text-xs bg-white border border-[#D5D0C3] rounded focus:outline-none focus:ring-1 focus:ring-[#1E232A]"
              />
              <button
                type="submit"
                disabled={!inlineAnswerDraft.trim()}
                className="px-2 py-0.5 text-[11px] font-semibold text-white bg-[#1E232A] disabled:bg-[#B0ABB0] rounded cursor-pointer disabled:cursor-not-allowed shrink-0"
              >
                Save
              </button>
              {isEditingInlineAnswer && (
                <button
                  type="button"
                  onClick={() => setIsEditingInlineAnswer(false)}
                  className="px-1.5 py-0.5 text-[11px] text-[#5C6573] hover:text-[#1E232A] cursor-pointer shrink-0"
                >
                  Cancel
                </button>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
};
