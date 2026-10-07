import React, { useState, useRef, useEffect } from 'react';
import {
  ExtractionResponse,
  AssumptionValue,
  ReviewStatus,
} from './types/extraction';
import {
  SAMPLE_FIXTURES,
  activeExtractionService,
} from './services/extractionService';
import { WorkingCard } from './components/WorkingCard';
import { TopNav } from './components/TopNav';
import {
  ArrowRight,
  AlertCircle,
  RotateCcw,
  MessageSquare,
  Send,
  CornerDownRight,
} from 'lucide-react';

interface ConversationTurn {
  id: string;
  type: 'user_prompt' | 'user_correction';
  text: string;
  timestamp: string;
}

export default function App() {
  // Input State
  const [inputText, setInputText] = useState<string>('');
  const [activeFixtureId, setActiveFixtureId] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  // Async & Loading State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('Reviewing your description...');
  const [requestError, setRequestError] = useState<string | null>(null);
  const requestVersionRef = useRef<number>(0);

  // Extraction & Provenance State (Separated as required by PRD Section 7)
  const [rawExtraction, setRawExtraction] = useState<ExtractionResponse | null>(null);
  const [reviewState, setReviewState] = useState<Record<string, ReviewStatus>>({});
  const [draftOverrides, setDraftOverrides] = useState<Record<string, AssumptionValue>>({});
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});

  // Conversation history
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [correctionInput, setCorrectionInput] = useState<string>('');
  const [correctionNotice, setCorrectionNotice] = useState<string | null>(null);

  // Ref for working card
  const workingCardRef = useRef<HTMLDivElement>(null);

  // Default to Europe Trip case from notebook
  useEffect(() => {
    handleSelectSample('trip');
  }, []);

  const handleSelectSample = async (fixtureId: string) => {
    const sample = SAMPLE_FIXTURES.find((s) => s.id === fixtureId);
    if (!sample) return;

    setActiveFixtureId(sample.id);
    setInputText(sample.samplePrompt);
    setInputError(null);
    setRequestError(null);
    setCorrectionNotice(null);

    await runExtraction(sample.samplePrompt, sample.id);
  };

  const runExtraction = async (promptText: string, sampleId?: string) => {
    setIsLoading(true);
    setLoadingMessage('Extracting assumptions...');
    setRequestError(null);

    const currentVersion = ++requestVersionRef.current;

    try {
      const response = await activeExtractionService.extract({
        user_message: promptText,
        reference_date: new Date().toISOString().split('T')[0],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });

      if (currentVersion !== requestVersionRef.current) return;

      setRawExtraction(response);
      setReviewState({});
      setDraftOverrides({});
      setQuestionAnswers({});

      setConversationHistory([
        {
          id: `prompt-${Date.now()}`,
          type: 'user_prompt',
          text: promptText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      setIsLoading(false);

      setTimeout(() => {
        workingCardRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } catch (err: unknown) {
      if (currentVersion !== requestVersionRef.current) return;
      setIsLoading(false);
      const errMsg = err instanceof Error ? err.message : 'Extraction request failed.';
      setRequestError(errMsg);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const matched = SAMPLE_FIXTURES.find(
      (s) =>
        s.samplePrompt.toLowerCase() === inputText.trim().toLowerCase() ||
        inputText.toLowerCase().includes(s.id)
    );

    if (matched) {
      handleSelectSample(matched.id);
    } else {
      setInputError('This version uses sample data. Please select an example.');
    }
  };

  // Assumption Row Actions
  const handleConfirmInference = (variable: string) => {
    setReviewState((prev) => ({
      ...prev,
      [variable]: 'confirmed',
    }));
  };

  const handleSaveLocalEdit = (variable: string, newValue: AssumptionValue) => {
    setDraftOverrides((prev) => ({
      ...prev,
      [variable]: newValue,
    }));

    if (variable === 'monthly_income' || variable === 'monthly_expenses') {
      setReviewState((prev) => {
        const next = { ...prev };
        delete next['monthly_surplus'];
        return next;
      });
    }
  };

  const handleResetLocalEdit = (variable: string) => {
    setDraftOverrides((prev) => {
      const next = { ...prev };
      delete next[variable];
      return next;
    });
  };

  const handleSaveQuestionAnswer = (targetVariable: string, answer: string) => {
    setQuestionAnswers((prev) => ({
      ...prev,
      [targetVariable]: answer,
    }));
  };

  const handleUpdateGoalSummary = (newSummary: string) => {
    if (!rawExtraction) return;
    setRawExtraction({
      ...rawExtraction,
      goal_summary: newSummary,
    });
  };

  // Submit Correction from composer
  const handleAddCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionInput.trim() || !rawExtraction) return;

    setIsLoading(true);
    setLoadingMessage('Updating interpretation with your correction...');
    setCorrectionNotice(null);

    const currentVersion = ++requestVersionRef.current;

    try {
      const updatedExtraction = await activeExtractionService.correct({
        user_message: conversationHistory[0]?.text || '',
        reference_date: new Date().toISOString().split('T')[0],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        previous_extraction: rawExtraction,
        user_correction: correctionInput.trim(),
      });

      if (currentVersion !== requestVersionRef.current) return;

      setRawExtraction(updatedExtraction);
      setReviewState({});
      setDraftOverrides({});
      setQuestionAnswers({});

      setConversationHistory((prev) => [
        ...prev,
        {
          id: `corr-${Date.now()}`,
          type: 'user_correction',
          text: correctionInput.trim(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      setCorrectionInput('');
      setIsLoading(false);
      setCorrectionNotice('Correction applied successfully.');
    } catch (err: unknown) {
      if (currentVersion !== requestVersionRef.current) return;
      setIsLoading(false);
      const errMsg = err instanceof Error ? err.message : 'Correction failed.';
      setCorrectionNotice(errMsg);
    }
  };

  const handleApplyCorrections = () => {
    if (Object.keys(draftOverrides).length === 0 && Object.keys(questionAnswers).length === 0) return;

    const editsDesc = Object.entries(draftOverrides)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
      .join(', ');

    const answersDesc = Object.entries(questionAnswers)
      .map(([k, v]) => `clarified ${k.replace(/_/g, ' ')}: ${v}`)
      .join(', ');

    const combinedCorrection = [editsDesc, answersDesc].filter(Boolean).join('. ');
    setCorrectionInput(`Updated with reviewed values: ${combinedCorrection}`);
  };

  const pendingCorrectionCount =
    Object.keys(draftOverrides).length + Object.keys(questionAnswers).length;

  return (
    <div className="min-h-screen bg-[#F8F7F5] flex flex-col font-sans text-[#1E232A]">
      {/* Compact Top Navigation */}
      <TopNav
        onNewQuestion={() => {
          setRawExtraction(null);
          setInputText('');
          setActiveFixtureId(null);
          setInputError(null);
          setRequestError(null);
          setConversationHistory([]);
        }}
        onSelectSample={handleSelectSample}
        activeFixtureId={activeFixtureId}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-6">
        {/* Compact Hero & Prompt */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1E232A]">
              What's on your mind?
            </h1>
            <span className="text-xs text-[#737C8A]">
              Describe your financial goal, numbers, or uncertainties
            </span>
          </div>

          {/* Quick Example Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-xs font-semibold text-[#5C6573] mr-1">Examples:</span>
            {SAMPLE_FIXTURES.map((sample) => {
              const isSelected = activeFixtureId === sample.id;
              return (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSelectSample(sample.id)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer border ${
                    isSelected
                      ? 'bg-[#1E232A] text-white border-[#1E232A] font-medium'
                      : 'bg-white text-[#4A5260] border-[#DDD8CB] hover:bg-[#F2EFE8]'
                  }`}
                >
                  {sample.title}
                </button>
              );
            })}
          </div>

          {/* Compact Input Box */}
          <form onSubmit={handleCustomSubmit} className="space-y-2">
            <div className="relative bg-white rounded-xl border border-[#DDD8CB] shadow-xs focus-within:border-[#1E232A] transition-all">
              <textarea
                rows={3}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  if (inputError) setInputError(null);
                }}
                placeholder="e.g. I make around $2k most months. Rent is like $900 and other expenses are $750. I have $1,200 saved and want to save $3,000 for a Europe trip next May..."
                className="w-full p-3.5 text-xs sm:text-sm bg-transparent resize-none focus:outline-none text-[#1E232A] placeholder:text-[#9EA5B0] leading-relaxed"
              />

              <div className="px-3.5 pb-2.5 pt-1 flex items-center justify-between border-t border-[#F2EFE8]">
                <span className="text-[11px] text-[#8C827A]">
                  Select an example or paste scenario text
                </span>

                <button
                  type="submit"
                  disabled={isLoading || !inputText.trim()}
                  className="px-3.5 py-1 text-xs font-semibold text-white bg-[#1E232A] hover:bg-[#323944] disabled:bg-[#C9C4B7] rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {inputError && (
              <div className="p-2.5 bg-[#FFF9E6] border border-[#F0DC9E] rounded-lg text-xs text-[#806300] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#A87E00] shrink-0" />
                <span>{inputError}</span>
              </div>
            )}
          </form>
        </div>

        {/* Conversation Stream & Working Card */}
        <div ref={workingCardRef} className="space-y-5">
          {/* Conversation History Context (Sticky at top when scrolling down) */}
          {conversationHistory.length > 0 && (
            <div className="sticky top-12 z-20 pt-1 pb-2 bg-[#F8F7F5]/95 backdrop-blur-xs space-y-2">
              {conversationHistory.map((turn) => (
                <div
                  key={turn.id}
                  className="p-3 sm:p-3.5 rounded-xl bg-white border border-[#DDD7CB] shadow-xs flex items-start gap-2.5 text-xs transition-shadow"
                >
                  <div className="w-6 h-6 rounded-full bg-[#EFECE3] flex items-center justify-center text-[#5C6573] shrink-0 mt-0.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 space-y-0.5 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#1E232A]">
                          {turn.type === 'user_prompt' ? 'Your statement' : 'Your correction'}
                        </span>
                        <span className="text-[10px] text-[#737C8A] px-1.5 py-0.2 rounded bg-[#F4F1EA] border border-[#E4DFD5]">
                          Pinned statement
                        </span>
                      </div>
                      <span className="text-[11px] text-[#737C8A] font-mono">
                        {turn.timestamp}
                      </span>
                    </div>
                    <p className="text-[#4A5260] leading-relaxed">
                      {turn.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="w-full max-w-[1040px] mx-auto p-5 bg-white rounded-xl border border-[#DDD8CB] shadow-xs space-y-3 animate-pulse">
              <div className="h-4 bg-[#EBE7DD] rounded w-48"></div>
              <div className="h-3 bg-[#F2EFE8] rounded w-full"></div>
              <div className="h-3 bg-[#F2EFE8] rounded w-3/4"></div>
              <div className="text-xs text-[#737C8A] pt-1">{loadingMessage}</div>
            </div>
          )}

          {/* Error State */}
          {requestError && !isLoading && (
            <div className="p-4 bg-[#FEF4E8] border border-[#F9DEBD] rounded-xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-[#9A550F]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{requestError}</span>
              </div>
              <button
                type="button"
                onClick={() => runExtraction(inputText)}
                className="px-3 py-1 font-semibold text-white bg-[#9A550F] hover:bg-[#7D4207] rounded cursor-pointer shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* The Large Working Card with Compact 2-Column Sections */}
          {rawExtraction && !isLoading && (
            <div className="space-y-4">
              <WorkingCard
                extraction={rawExtraction}
                reviewState={reviewState}
                draftOverrides={draftOverrides}
                questionAnswers={questionAnswers}
                onConfirmInference={handleConfirmInference}
                onSaveLocalEdit={handleSaveLocalEdit}
                onResetLocalEdit={handleResetLocalEdit}
                onSaveQuestionAnswer={handleSaveQuestionAnswer}
                onUpdateGoalSummary={handleUpdateGoalSummary}
                onApplyCorrections={handleApplyCorrections}
                pendingCorrectionCount={pendingCorrectionCount}
              />

              {/* Compact Correction Composer */}
              <div className="w-full max-w-[1040px] mx-auto p-3.5 sm:p-4 bg-white rounded-xl border border-[#DDD8CB] shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1E232A]">
                    Add a correction
                  </span>
                  <span className="text-[11px] text-[#737C8A]">
                    Clarify numbers or state adjustments
                  </span>
                </div>

                <form onSubmit={handleAddCorrection} className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={correctionInput}
                      onChange={(e) => setCorrectionInput(e.target.value)}
                      placeholder='e.g. Actually my monthly expenses are $1300 and I want the laptop by February...'
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-[#FAF8F5] border border-[#DDD8CB] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1E232A] pr-20"
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !correctionInput.trim()}
                      className="absolute right-1.5 top-1.5 bottom-1.5 px-3 text-xs font-semibold text-white bg-[#1E232A] disabled:bg-[#BDB8AC] rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      <span>Send</span>
                    </button>
                  </div>

                  {correctionNotice && (
                    <div className="p-2 bg-[#F8F7F2] border border-[#E3DFC] rounded-md text-xs text-[#4A5260]">
                      {correctionNotice}
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E8E4DA] bg-[#F8F7F5] py-4 text-xs text-[#737C8A]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#1E232A]">Show Your Work</span>
            <span aria-hidden="true">·</span>
            <span>Structured financial assumption review</span>
          </div>
          <span>Compact Product Interface</span>
        </div>
      </footer>
    </div>
  );
}
