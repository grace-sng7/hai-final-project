import React, { useState } from 'react';
import {
  ExtractionResponse,
  Assumption,
  AssumptionValue,
  ReviewStatus,
} from '../types/extraction';
import { AssumptionRow } from './AssumptionRow';
import { ScenarioPreview } from './ScenarioPreview';
import {
  AlertCircle,
  Sliders,
  ArrowRight,
  Edit2,
  Check,
  RotateCcw,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface WorkingCardProps {
  extraction: ExtractionResponse;
  reviewState: Record<string, ReviewStatus>;
  draftOverrides: Record<string, AssumptionValue>;
  questionAnswers: Record<string, string>;
  onConfirmInference: (variable: string) => void;
  onSaveLocalEdit: (variable: string, newValue: AssumptionValue) => void;
  onResetLocalEdit: (variable: string) => void;
  onSaveQuestionAnswer: (targetVariable: string, answer: string) => void;
  onUpdateGoalSummary: (newGoalSummary: string) => void;
  onApplyCorrections: () => void;
  pendingCorrectionCount: number;
}

export const WorkingCard: React.FC<WorkingCardProps> = ({
  extraction,
  reviewState,
  draftOverrides,
  questionAnswers,
  onConfirmInference,
  onSaveLocalEdit,
  onResetLocalEdit,
  onSaveQuestionAnswer,
  onApplyCorrections,
  pendingCorrectionCount,
}) => {
  const [showScenarioPreview, setShowScenarioPreview] = useState(false);
  const [showConfidenceNote, setShowConfidenceNote] = useState(false);

  // Local editing inside Card 2
  const [inlineEditingVar, setInlineEditingVar] = useState<string | null>(null);
  const [inlineEditDraft, setInlineEditDraft] = useState<string>('');

  // Strict non-overlapping hierarchical partition:
  // 1. LEVEL 1 (Key questions to clarify): variables with questions or completely missing
  const questionTargetVariables = new Set(
    extraction.clarification_questions.map((q) => q.target_variable)
  );

  // 2. LEVEL 2 (Inferred): source === 'inferred' AND NOT in Level 1
  const level2InferredAssumptions = extraction.assumptions.filter(
    (a) => a.source === 'inferred' && !questionTargetVariables.has(a.variable)
  );

  // 3. LEVEL 3 (Stated / high-confidence): stated items AND NOT in Level 1 AND NOT in Level 2
  const level3StatedAssumptions = extraction.assumptions.filter(
    (a) => !questionTargetVariables.has(a.variable) && a.source !== 'inferred'
  );

  // Questions for Level 1
  const allQuestions = extraction.clarification_questions;
  const unansweredQuestions = allQuestions.filter((q) => !questionAnswers[q.target_variable]);

  // Values resolution for scenario calculator
  const getResolvedValue = (varName: string): AssumptionValue => {
    if (varName in draftOverrides) {
      return draftOverrides[varName];
    }
    const found = extraction.assumptions.find((a) => a.variable === varName);
    return found ? found.value : null;
  };

  const monthlyIncome = getResolvedValue('monthly_income');
  const monthlyExpenses = getResolvedValue('monthly_expenses');
  const currentSavings = getResolvedValue('current_savings');
  const goalAmount = getResolvedValue('goal_amount');
  const goalDeadline = getResolvedValue('goal_deadline');

  const isNumericDeadline = typeof goalDeadline === 'number';
  const isDateDeadline = typeof goalDeadline === 'string';

  const isSavingsScenario =
    extraction.assumptions.some((a) => a.variable === 'goal_amount') &&
    (extraction.assumptions.some((a) => a.variable === 'monthly_income') ||
      extraction.assumptions.some((a) => a.variable === 'current_savings'));

  const handleStartReviewEdit = (asm: Assumption) => {
    const activeVal = draftOverrides[asm.variable] !== undefined ? draftOverrides[asm.variable] : asm.value;
    setInlineEditDraft(activeVal !== null ? String(activeVal) : '');
    setInlineEditingVar(asm.variable);
  };

  const handleSaveReviewEdit = (variable: string) => {
    const parsed = parseFloat(inlineEditDraft);
    const finalVal = isNaN(parsed) ? (inlineEditDraft.trim() || null) : parsed;
    onSaveLocalEdit(variable, finalVal);
    setInlineEditingVar(null);
  };

  return (
    <div className="w-full max-w-[1040px] mx-auto bg-white rounded-xl border border-[#DCD7CA] shadow-xs overflow-hidden">
      {/* Compact Card Header */}
      <div className="px-5 py-3 bg-[#FAF9F5] border-b border-[#ECE7DC] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#735032]">
            Working card
          </span>
          <span className="text-xs text-[#8C827A]">·</span>
          <span className="text-xs text-[#5C6573] font-medium">
            Structured interpretation ({extraction.assumptions.length} assumptions)
          </span>
        </div>

        {/* Header Right Action */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowScenarioPreview(!showScenarioPreview)}
            className="px-3 py-1 text-xs font-semibold text-[#1E232A] bg-white border border-[#D5D0C3] hover:bg-[#F2EFE8] rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showScenarioPreview ? 'Hide calculation' : 'Preview calculation'}</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* ======================================================== */}
        {/* CARD 1: KEY QUESTIONS TO CLARIFY (完全不知道 / 需要询问的信息) */}
        {/* ======================================================== */}
        {allQuestions.length > 0 && (
          <div className="rounded-xl border border-[#E9DFCE] bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#FEF0DE] border border-[#FAD7A0] flex items-center justify-center text-[#B55D08] shrink-0 font-bold text-xs">
                  !
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#92400E]">
                    Key Questions to Clarify
                  </h3>
                  <p className="text-[11px] text-[#A66212]">
                    Information we don't know yet or need you to clarify
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-[#B55D08] px-2 py-0.5 rounded-full bg-[#FEF0DE] border border-[#FAD7A0]">
                {unansweredQuestions.length > 0 ? `${unansweredQuestions.length} open` : 'All answered'}
              </span>
            </div>

            {/* Questions list with contextual baseline value and answer input */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {allQuestions.map((q, idx) => {
                const ans = questionAnswers[q.target_variable];
                const matchingAsm = extraction.assumptions.find((a) => a.variable === q.target_variable);
                const currentVal = matchingAsm
                  ? (draftOverrides[matchingAsm.variable] !== undefined
                      ? draftOverrides[matchingAsm.variable]
                      : matchingAsm.value)
                  : null;

                return (
                  <div
                    key={`${q.target_variable}-${idx}`}
                    className="p-3 bg-[#FAF8F5] rounded-lg border border-[#EAE4D7] space-y-2.5 flex flex-col justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[#8C827A] uppercase tracking-wide">
                          Question {idx + 1}
                        </span>

                        {/* Baseline mention if available */}
                        {currentVal !== null && currentVal !== undefined && (
                          <span className="text-[10px] text-[#63554B] bg-[#EFECE3] px-1.5 py-0.5 rounded">
                            Mentioned: {typeof currentVal === 'number' ? `$${currentVal.toLocaleString()}` : String(currentVal)}
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-semibold text-[#1E232A] leading-snug">
                        {q.question}
                      </p>
                      <p className="text-[11px] text-[#737C8A] leading-relaxed">
                        {q.why_it_matters}
                      </p>
                    </div>

                    {/* Answer input or saved state */}
                    {ans ? (
                      <div className="flex items-center justify-between p-2 bg-white rounded border border-[#E0D9CB] text-xs">
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] text-[#737C8A] block">Your clarification:</span>
                          <span className="text-[#226738] font-semibold text-xs truncate block">
                            "{ans}"
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSaveQuestionAnswer(q.target_variable, '')}
                          className="text-[11px] text-[#5C6573] hover:text-[#1E232A] hover:underline cursor-pointer shrink-0"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 pt-1">
                        <input
                          type="text"
                          placeholder="Type clarification..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = (e.target as HTMLInputElement).value.trim();
                              if (val) onSaveQuestionAnswer(q.target_variable, val);
                            }
                          }}
                          className="flex-1 px-2.5 py-1 text-xs bg-white border border-[#D5D0C3] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E232A]"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            const input = (e.currentTarget.previousSibling as HTMLInputElement);
                            if (input && input.value.trim()) {
                              onSaveQuestionAnswer(q.target_variable, input.value.trim());
                            }
                          }}
                          className="px-3 py-1 text-xs font-semibold text-white bg-[#1E232A] rounded-md cursor-pointer shrink-0 hover:bg-[#323944]"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* CARD 2: WE INFERRED · REVIEW NEEDED (不太确定的信息，模型猜的) */}
        {/* ======================================================== */}
        {level2InferredAssumptions.length > 0 && (
          <div className="rounded-xl border border-[#DDD3F2] bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F1ECFA] text-[#5B39A0] border border-[#DDD3F2]">
                  We inferred
                </span>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#3D2E70]">
                    Review Needed
                  </h3>
                  <p className="text-[11px] text-[#63554B]">
                    Calculated estimates with uncertainty (&lt;80% certainty). Select "Looks right" or "Edit".
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-[#5B39A0]">
                {level2InferredAssumptions.filter(a => reviewState[a.variable] !== 'confirmed').length > 0
                  ? `${level2InferredAssumptions.filter(a => reviewState[a.variable] !== 'confirmed').length} to review`
                  : 'All reviewed'}
              </span>
            </div>

            {/* Inferences Choices Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {level2InferredAssumptions.map((asm) => {
                const isConfirmed = reviewState[asm.variable] === 'confirmed';
                const isOverridden = asm.variable in draftOverrides;
                const activeVal = isOverridden ? draftOverrides[asm.variable] : asm.value;
                const isEditingThis = inlineEditingVar === asm.variable;

                return (
                  <div
                    key={asm.variable}
                    className={`p-3 bg-[#FAF9FC] rounded-lg border transition-all ${
                      isConfirmed
                        ? 'border-[#CDE5D2] bg-[#FAFDFB]'
                        : isOverridden
                        ? 'border-[#FAD79A] bg-[#FFFDF9]'
                        : 'border-[#E0D7F0]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold text-[#1E232A] block">
                          {asm.variable.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-[#737C8A] line-clamp-1">
                          {asm.source_detail}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono-num font-bold text-sm text-[#1E232A]">
                          {activeVal !== null ? `$${Number(activeVal).toLocaleString()}` : '—'}
                        </span>
                        <span className="text-[10px] text-[#737C8A] block">{asm.unit}</span>
                      </div>
                    </div>

                    {/* Inline Editor if active */}
                    {isEditingThis ? (
                      <div className="mt-2.5 pt-2 border-t border-[#EDE8DC] flex items-center gap-1.5">
                        <input
                          type="number"
                          value={inlineEditDraft}
                          onChange={(e) => setInlineEditDraft(e.target.value)}
                          placeholder="New amount"
                          className="flex-1 px-2 py-1 text-xs bg-white border border-[#D5D0C3] rounded focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveReviewEdit(asm.variable)}
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-[#1E232A] rounded cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setInlineEditingVar(null)}
                          className="px-2 py-1 text-xs text-[#5C6573] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      /* Explicit user choices: "Looks right" vs "Edit" */
                      <div className="mt-2.5 pt-2 border-t border-[#EDE7F6] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          {isConfirmed ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#226738] bg-[#EAF5EC] px-2 py-0.5 rounded border border-[#CDE5D2]">
                              <Check className="w-3 h-3 text-[#226738]" />
                              Confirmed by you
                            </span>
                          ) : isOverridden ? (
                            <span className="inline-flex items-center text-[11px] font-semibold text-[#806300] bg-[#FFF7D6] px-2 py-0.5 rounded border border-[#FFE885]">
                              User edited
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#737C8A]">Needs decision</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {!isConfirmed && !isOverridden && (
                            <button
                              type="button"
                              onClick={() => onConfirmInference(asm.variable)}
                              className="px-2.5 py-1 text-xs font-semibold text-[#3D2E70] bg-[#EDE7F6] hover:bg-[#E0D5F3] rounded-md transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3 h-3 text-[#5B39A0]" />
                              <span>Looks right</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleStartReviewEdit(asm)}
                            className="px-2.5 py-1 text-xs font-medium text-[#4A5260] hover:text-[#1E232A] bg-white border border-[#DDD6EA] hover:bg-[#F2EDFA] rounded-md transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          {isOverridden && (
                            <button
                              type="button"
                              onClick={() => onResetLocalEdit(asm.variable)}
                              className="p-1 text-[#8C827A] hover:text-[#9A550F] rounded cursor-pointer"
                              title="Reset to AI estimate"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* CARD 3: STATED DETAILS · NEED CONFIRMATION (80%+ 确定，仅需确认) */}
        {/* 包含 Rent, Other monthly expenses, Goal amount, Deadline, Description 等 */}
        {/* ======================================================== */}
        {level3StatedAssumptions.length > 0 && (
          <div className="rounded-xl border border-[#BCE1C3] bg-[#F7FCF8] p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#DFEFE3]">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#D4EED8] text-[#164F28] border border-[#A8DBB1]">
                  You told us
                </span>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#164F28]">
                    Stated Details · Need Confirmation
                  </h3>
                  <p className="text-[11px] text-[#2F6139]">
                    High-confidence facts directly stated by you (&gt;80% certainty). Quick check to confirm.
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-[#164F28] px-2 py-0.5 rounded-full bg-[#E5F5E8] border border-[#CCE5D1]">
                {level3StatedAssumptions.length} items
              </span>
            </div>

            {/* 2-column card grid for stated facts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-start">
              {level3StatedAssumptions.map((asm) => (
                <AssumptionRow
                  key={asm.variable}
                  assumption={asm}
                  reviewStatus={reviewState[asm.variable] || 'unreviewed'}
                  localOverrideValue={draftOverrides[asm.variable]}
                  isOverridden={asm.variable in draftOverrides}
                  compact={true}
                  onConfirmInference={onConfirmInference}
                  onSaveLocalEdit={onSaveLocalEdit}
                  onResetLocalEdit={onResetLocalEdit}
                  onSaveQuestionAnswer={onSaveQuestionAnswer}
                />
              ))}
            </div>
          </div>
        )}

        {/* Confidence note expandable */}
        {extraction.confidence_note && (
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setShowConfidenceNote(!showConfidenceNote)}
              className="text-xs text-[#737C8A] hover:text-[#1E232A] flex items-center gap-1 cursor-pointer"
            >
              <span>Extraction note</span>
              {showConfidenceNote ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showConfidenceNote && (
              <div className="mt-1.5 p-2.5 bg-[#F8F7F2] rounded-lg border border-[#E5DFD3] text-xs text-[#5C6573] leading-relaxed">
                {extraction.confidence_note}
              </div>
            )}
          </div>
        )}

        {/* Scenario Preview within Card */}
        {showScenarioPreview && (
          <ScenarioPreview
            scenarioType={isSavingsScenario ? 'savings' : 'other'}
            goalDescription={extraction.goal_summary}
            income={typeof monthlyIncome === 'number' ? monthlyIncome : null}
            expenses={typeof monthlyExpenses === 'number' ? monthlyExpenses : null}
            currentSavings={typeof currentSavings === 'number' ? currentSavings : null}
            goalAmount={typeof goalAmount === 'number' ? goalAmount : null}
            deadlineMonths={isNumericDeadline ? (goalDeadline as number) : null}
            isDateDeadline={isDateDeadline}
          />
        )}
      </div>

      {/* Card Footer: Status and Next Action */}
      <div className="px-5 py-3 bg-[#FAF9F5] border-t border-[#ECE7DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-[#5C6573]">
          {pendingCorrectionCount > 0 ? (
            <span className="font-semibold text-[#806300]">
              {pendingCorrectionCount} local change(s) / clarification(s) ready
            </span>
          ) : (
            <span className="text-[#226738] font-medium flex items-center gap-1">
              <Check className="w-3 h-3" /> All displayed values match current interpretation
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {pendingCorrectionCount > 0 && (
            <button
              type="button"
              onClick={onApplyCorrections}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1E232A] hover:bg-[#323944] rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>Apply corrections</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
