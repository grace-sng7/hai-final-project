import {
  ExtractionResponse,
  ExtractRequest,
  CorrectionRequest,
  Source,
} from '../types/extraction';

/**
 * Fixture: Case 3 from Grace's Notebook (Europe Trip — Messy/Ambiguous with expense breakdown, midpoint range, and deadline inference)
 */
export const NOTEBOOK_CASE_3_TRIP: ExtractionResponse = {
  assumptions: [
    {
      variable: 'monthly_income',
      value: 2000,
      unit: '$/month',
      source: 'stated',
      source_detail: "User stated 'around $2k most months'",
    },
    {
      variable: 'monthly_expenses_rent',
      value: 900,
      unit: '$/month',
      source: 'stated',
      source_detail: "User stated 'Rent is like $900'",
    },
    {
      variable: 'monthly_expenses_other',
      value: 750,
      unit: '$/month',
      source: 'stated',
      source_detail: "User stated 'probably spend another $700–800?', midpoint used",
    },
    {
      variable: 'monthly_expenses',
      value: 1650,
      unit: '$/month',
      source: 'inferred',
      source_detail: 'Sum of stated rent and other expenses',
    },
    {
      variable: 'monthly_surplus',
      value: 350,
      unit: '$/month',
      source: 'inferred',
      source_detail: 'Calculated from stated monthly income ($2000) minus inferred total monthly expenses ($1650)',
    },
    {
      variable: 'current_savings',
      value: 1200,
      unit: '$',
      source: 'stated',
      source_detail: "User stated 'I have $1,200 saved'",
    },
    {
      variable: 'goal_amount',
      value: 3000,
      unit: '$',
      source: 'stated',
      source_detail: "User stated 'it\'ll probably be around $3k'",
    },
    {
      variable: 'goal_deadline',
      value: 8,
      unit: 'months',
      source: 'stated',
      source_detail: 'You stated 8 months until the trip.',
    },
    {
      variable: 'goal_description',
      value: 'Europe trip with friends',
      unit: '',
      source: 'stated',
      source_detail: "User stated 'My friends want to go to Europe next May'",
    },
  ],
  clarification_questions: [
    {
      target_variable: 'monthly_income',
      question: "You mentioned your income 'changes'. What's the lowest you typically make in a month?",
      why_it_matters: 'Understanding your minimum income helps assess the most conservative savings potential.',
    },
    {
      target_variable: 'current_savings',
      question: "You mentioned you 'don't really want to use all' of your $1,200 savings. How much of that are you comfortable allocating towards the Europe trip?",
      why_it_matters: "Knowing how much of your current savings you're willing to use directly impacts how much you need to save from future income.",
    },
  ],
  goal_summary: 'The user wants to know if saving approximately $3,000 for a trip to Europe by next May is realistic, given their current income, expenses, and savings.',
  confidence_note: 'High confidence in extracting stated values; some inference made for expense totals and goal deadline based on typical calendar assumptions.',
};

/**
 * Fixture: Case 2 from Grace's Notebook (Laptop — Missing Information)
 */
export const NOTEBOOK_CASE_2_LAPTOP: ExtractionResponse = {
  assumptions: [
    {
      variable: 'monthly_income',
      value: null,
      unit: '$/month',
      source: 'missing',
      source_detail: 'User did not state their monthly income.',
    },
    {
      variable: 'monthly_expenses',
      value: null,
      unit: '$/month',
      source: 'missing',
      source_detail: 'User did not state their monthly expenses.',
    },
    {
      variable: 'monthly_surplus',
      value: null,
      unit: '$/month',
      source: 'missing',
      source_detail: 'Monthly income and expenses are missing, so surplus cannot be inferred.',
    },
    {
      variable: 'current_savings',
      value: 1500,
      unit: '$',
      source: 'stated',
      source_detail: 'User stated they have around $1,500 saved.',
    },
    {
      variable: 'goal_amount',
      value: 2000,
      unit: '$',
      source: 'stated',
      source_detail: 'User stated the laptop costs $2,000.',
    },
    {
      variable: 'goal_deadline',
      value: null,
      unit: 'months',
      source: 'missing',
      source_detail: "User stated 'sometime next semester' but did not specify a number of months.",
    },
    {
      variable: 'goal_description',
      value: 'Purchase a laptop',
      unit: '',
      source: 'stated',
      source_detail: 'User wants to buy a laptop.',
    },
  ],
  clarification_questions: [
    {
      target_variable: 'monthly_income',
      question: 'What is your current monthly income?',
      why_it_matters: 'Knowing your income helps determine how much you can save each month.',
    },
    {
      target_variable: 'monthly_expenses',
      question: 'What are your typical monthly expenses?',
      why_it_matters: 'Understanding your expenses is crucial for calculating how much money you have left to save.',
    },
    {
      target_variable: 'goal_deadline',
      question: "When exactly is 'sometime next semester' in terms of months from now?",
      why_it_matters: 'The timeframe directly impacts how much you need to save per month to reach your goal.',
    },
  ],
  goal_summary: 'The user wants to know if they can afford a $2,000 laptop by sometime next semester, given their current savings of $1,500.',
  confidence_note: 'Confidence is moderate due to missing income, expenses, and a precise deadline for the goal.',
};

/**
 * Fixture: Simulated User Correction from Grace's Notebook (Case 2 Updated)
 */
export const NOTEBOOK_CASE_2_CORRECTION: ExtractionResponse = {
  assumptions: [
    {
      variable: 'monthly_income',
      value: 1800,
      unit: '$/month',
      source: 'stated',
      source_detail: 'User stated they make about $1,800/month from their part-time job.',
    },
    {
      variable: 'monthly_expenses',
      value: 1300,
      unit: '$/month',
      source: 'stated',
      source_detail: 'User stated they spend around $1,300.',
    },
    {
      variable: 'monthly_surplus',
      value: 500,
      unit: '$/month',
      source: 'inferred',
      source_detail: 'Calculated from stated monthly income ($1,800) minus stated monthly expenses ($1,300).',
    },
    {
      variable: 'current_savings',
      value: 1500,
      unit: '$',
      source: 'stated',
      source_detail: 'User stated they have around $1,500 saved.',
    },
    {
      variable: 'goal_amount',
      value: 2000,
      unit: '$',
      source: 'stated',
      source_detail: 'User stated the laptop costs $2,000.',
    },
    {
      variable: 'goal_deadline',
      value: 4,
      unit: 'months',
      source: 'stated',
      source_detail: 'User clarified they want the laptop by February, which is about 4 months from now.',
    },
    {
      variable: 'goal_description',
      value: 'Purchase a laptop',
      unit: '',
      source: 'stated',
      source_detail: 'User wants to buy a laptop.',
    },
  ],
  clarification_questions: [],
  goal_summary: 'The user wants to know if they can afford a $2,000 laptop by February (4 months from now), given their current savings of $1,500, monthly income of $1,800, and monthly expenses of $1,300.',
  confidence_note: 'Confidence is high as all critical financial variables and the goal deadline have been stated or inferred.',
};

/**
 * Fixture: Apartment Case from Grace's Notebook (55k salary, car payment, student loans, rent transition)
 */
export const NOTEBOOK_APARTMENT: ExtractionResponse = {
  assumptions: [
    {
      variable: 'monthly_income',
      value: 4583.33,
      unit: '$/month',
      source: 'inferred',
      source_detail: 'Annual salary of $55,000 divided by 12 months. Tax treatment is not established.',
    },
    {
      variable: 'monthly_expenses',
      value: null,
      unit: '$/month',
      source: 'missing',
      source_detail: 'Total monthly expenses not explicitly stated',
    },
    {
      variable: 'monthly_car_payment',
      value: 350,
      unit: '$/month',
      source: 'stated',
      source_detail: 'User stated car payment is $350/month',
    },
    {
      variable: 'monthly_student_loan_payment',
      value: null,
      unit: '$/month',
      source: 'missing',
      source_detail: 'Student loan payment amount not specified, only total debt and interest rate',
    },
    {
      variable: 'current_rent',
      value: 1000,
      unit: '$/month',
      source: 'stated',
      source_detail: 'User stated current rent is $1000/month',
    },
    {
      variable: 'proposed_rent',
      value: 1400,
      unit: '$/month',
      source: 'stated',
      source_detail: 'User stated new apartment rent would be $1400/month',
    },
    {
      variable: 'monthly_surplus',
      value: null,
      unit: '$/month',
      source: 'missing',
      source_detail: 'Cannot infer without total monthly expenses',
    },
    {
      variable: 'current_savings',
      value: null,
      unit: '$',
      source: 'missing',
      source_detail: 'Current savings not mentioned',
    },
    {
      variable: 'goal_amount',
      value: null,
      unit: '$',
      source: 'missing',
      source_detail: 'No specific amount for the goal (e.g., security deposit, moving costs) was stated',
    },
    {
      variable: 'goal_deadline',
      value: null,
      unit: 'months',
      source: 'missing',
      source_detail: 'No specific timeline for moving was stated',
    },
    {
      variable: 'goal_description',
      value: 'Move to a new apartment with $1400/month rent',
      unit: '',
      source: 'stated',
      source_detail: 'User explicitly stated the goal',
    },
  ],
  clarification_questions: [
    {
      target_variable: 'monthly_income',
      question: 'What is your take-home monthly income after taxes and deductions?',
      why_it_matters: 'Gross salary of $55,000 does not reflect spendable cash flow.',
    },
    {
      target_variable: 'monthly_expenses',
      question: 'Could you tell me your other regular monthly expenses, such as food, utilities, insurance, and entertainment?',
      why_it_matters: 'Knowing your total expenses is crucial to determine if you can afford the new rent.',
    },
    {
      target_variable: 'monthly_student_loan_payment',
      question: 'What is your minimum monthly payment for your student loans?',
      why_it_matters: 'This payment is a fixed expense that impacts your available funds.',
    },
    {
      target_variable: 'current_savings',
      question: 'How much do you currently have in savings?',
      why_it_matters: 'This helps assess your financial buffer and ability to cover moving costs or emergencies.',
    },
    {
      target_variable: 'goal_deadline',
      question: 'When are you hoping to move into the new apartment?',
      why_it_matters: 'The timeline affects how much you need to save per month for any upfront costs.',
    },
  ],
  goal_summary: 'The user wants to know if they can afford to move into a new apartment with a monthly rent of $1400, given their new salary and existing debts.',
  confidence_note: 'Some key expense details are missing, which limits the confidence in a complete financial picture.',
};

/**
 * Fixture: Case 7 from Grace's Notebook (Debt to friend & range midpoint)
 */
export const NOTEBOOK_CASE_7_LAPTOP_DEBT: ExtractionResponse = {
  assumptions: [
    {
      variable: 'monthly_income',
      value: null,
      unit: '$/month',
      source: 'missing',
      source_detail: 'User mentioned working but not income amount or frequency',
    },
    {
      variable: 'monthly_expenses',
      value: null,
      unit: '$/month',
      source: 'missing',
      source_detail: 'User did not mention any regular expenses',
    },
    {
      variable: 'monthly_surplus',
      value: null,
      unit: '$/month',
      source: 'missing',
      source_detail: 'Cannot infer without income and expenses',
    },
    {
      variable: 'current_savings',
      value: null,
      unit: '$',
      source: 'missing',
      source_detail: "User mentioned having 'some money saved' but no specific amount",
    },
    {
      variable: 'debt_to_friend',
      value: 300,
      unit: '$',
      source: 'stated',
      source_detail: 'User explicitly stated owing a friend $300',
    },
    {
      variable: 'goal_amount',
      value: 1150,
      unit: '$',
      source: 'inferred',
      source_detail: 'User provided a range ($800-$1500), midpoint used',
    },
    {
      variable: 'goal_deadline',
      value: null,
      unit: 'months',
      source: 'missing',
      source_detail: "User mentioned 'for school' but no specific timeframe",
    },
    {
      variable: 'goal_description',
      value: 'new laptop for school',
      unit: '',
      source: 'stated',
      source_detail: 'User explicitly stated the goal',
    },
  ],
  clarification_questions: [
    {
      target_variable: 'monthly_income',
      question: 'What is your average monthly income from your Starbucks job?',
      why_it_matters: 'Knowing your income helps determine how quickly you can save for your goal.',
    },
    {
      target_variable: 'current_savings',
      question: 'How much money do you currently have saved?',
      why_it_matters: 'Your current savings will directly impact how much more you need to save for the laptop.',
    },
    {
      target_variable: 'goal_amount',
      question: 'What is the exact price of the laptop you are considering, or what is your firm budget for it?',
      why_it_matters: 'A precise goal amount is needed to calculate the exact savings required.',
    },
  ],
  goal_summary: 'The user wants to know if they can afford a new laptop for school, costing between $800 and $1500, while also considering a $300 debt to a friend.',
  confidence_note: 'Confidence is moderate due to several key financial variables being missing or given as a range.',
};

export interface SampleFixtureOption {
  id: string;
  title: string;
  samplePrompt: string;
  description: string;
  fixture: ExtractionResponse;
}

export const SAMPLE_FIXTURES: SampleFixtureOption[] = [
  {
    id: 'trip',
    title: 'Europe Trip ($3,000 in 9 months)',
    samplePrompt:
      "I make around $2k most months from my campus job and tutoring, but it changes. Rent is like $900 and I probably spend another $700–800? I have $1,200 saved but don't really want to use all of it. My friends want to go to Europe next May and it'll probably be around $3k. Is that realistic?",
    description: "Grace's Notebook Case 3: Expense categories, $750 midpoint, inferred expenses $1,650, surplus $350, and 9-month timeline.",
    fixture: NOTEBOOK_CASE_3_TRIP,
  },
  {
    id: 'laptop',
    title: 'New Laptop ($2,000 next semester)',
    samplePrompt:
      'I have around $1,500 saved and want to buy a $2,000 laptop sometime next semester. Can I afford it?',
    description: "Grace's Notebook Case 2: Missing income, missing expenses, and ambiguous deadline.",
    fixture: NOTEBOOK_CASE_2_LAPTOP,
  },
  {
    id: 'apartment',
    title: 'New Apartment ($55k salary, $1,400 rent)',
    samplePrompt:
      'I just got a raise to 55k but I have 12k in student loans at 6% interest and my car payment is $350/month. I want to move to a new apartment that costs $1400/month instead of my current $1000. Can I swing it?',
    description: "Grace's Notebook Apartment Case: $4,583.33/mo gross income (not after tax), car payment, student loans, current and proposed rent.",
    fixture: NOTEBOOK_APARTMENT,
  },
  {
    id: 'debt_laptop',
    title: 'Laptop with Debt to Friend',
    samplePrompt:
      'so i need a new laptop for school, probably like 1500, well actually maybe i could get away with a cheaper one like 800? i have some money saved but i also owe my friend 300. i work at starbucks but my hours are random',
    description: "Grace's Notebook Case 7: Midpoint $1,150 goal amount, $300 debt to friend, and irregular income.",
    fixture: NOTEBOOK_CASE_7_LAPTOP_DEBT,
  },
];

/**
 * Runtime schema validator
 */
export function validateExtractionResponse(data: unknown): {
  valid: boolean;
  errors: string[];
  duplicateVariables: string[];
} {
  const errors: string[] = [];
  const duplicateVariables: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Response must be an object'], duplicateVariables: [] };
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.assumptions)) {
    errors.push('assumptions must be an array');
  } else {
    const seen = new Set<string>();
    obj.assumptions.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        errors.push(`assumptions[${index}] must be an object`);
        return;
      }
      const asm = item as Record<string, unknown>;
      if (typeof asm.variable !== 'string' || !asm.variable.trim()) {
        errors.push(`assumptions[${index}].variable must be a non-empty string`);
      } else {
        if (seen.has(asm.variable)) {
          duplicateVariables.push(asm.variable);
        }
        seen.add(asm.variable);
      }

      const validSources: Source[] = ['stated', 'inferred', 'missing'];
      if (!validSources.includes(asm.source as Source)) {
        errors.push(
          `assumptions[${index}].source must be one of: stated, inferred, missing. Got: ${asm.source}`
        );
      }

      if (asm.unit !== null && typeof asm.unit !== 'string') {
        errors.push(`assumptions[${index}].unit must be a string or null`);
      }

      if (typeof asm.source_detail !== 'string') {
        errors.push(`assumptions[${index}].source_detail must be a string`);
      }

      const validValueType =
        asm.value === null || typeof asm.value === 'number' || typeof asm.value === 'string';
      if (!validValueType) {
        errors.push(
          `assumptions[${index}].value must be number, string, or null. Got: ${typeof asm.value}`
        );
      }
    });
  }

  if (!Array.isArray(obj.clarification_questions)) {
    errors.push('clarification_questions must be an array');
  } else {
    obj.clarification_questions.forEach((q, index) => {
      if (!q || typeof q !== 'object') {
        errors.push(`clarification_questions[${index}] must be an object`);
        return;
      }
      const cq = q as Record<string, unknown>;
      if (typeof cq.target_variable !== 'string') {
        errors.push(`clarification_questions[${index}].target_variable must be a string`);
      }
      if (typeof cq.question !== 'string') {
        errors.push(`clarification_questions[${index}].question must be a string`);
      }
      if (typeof cq.why_it_matters !== 'string') {
        errors.push(`clarification_questions[${index}].why_it_matters must be a string`);
      }
    });
  }

  if (typeof obj.goal_summary !== 'string') {
    errors.push('goal_summary must be a string');
  }

  if (typeof obj.confidence_note !== 'string') {
    errors.push('confidence_note must be a string');
  }

  return {
    valid: errors.length === 0,
    errors,
    duplicateVariables: Array.from(new Set(duplicateVariables)),
  };
}

/**
 * Service interface matching PRD Section 8
 */
export interface ExtractionService {
  extract(request: ExtractRequest): Promise<ExtractionResponse>;
  correct(request: CorrectionRequest): Promise<ExtractionResponse>;
}

/**
 * MockExtractionService implementation for Phase 1 demo mode
 */
export class MockExtractionService implements ExtractionService {
  private artificialDelayMs: number;

  constructor(delayMs = 400) {
    this.artificialDelayMs = delayMs;
  }

  async extract(request: ExtractRequest): Promise<ExtractionResponse> {
    await new Promise((resolve) => setTimeout(resolve, this.artificialDelayMs));

    const trimmed = request.user_message.trim().toLowerCase();

    if (
      trimmed.includes('europe') ||
      trimmed.includes('trip with friends') ||
      trimmed.includes('next may') ||
      trimmed.includes('3k') ||
      trimmed.includes('3,000') ||
      trimmed.includes('3000')
    ) {
      return structuredClone(NOTEBOOK_CASE_3_TRIP);
    }
    if (
      trimmed.includes('laptop') &&
      (trimmed.includes('next semester') || trimmed.includes('2,000') || trimmed.includes('2000'))
    ) {
      return structuredClone(NOTEBOOK_CASE_2_LAPTOP);
    }
    if (
      trimmed.includes('apartment') ||
      trimmed.includes('55k') ||
      trimmed.includes('55,000') ||
      trimmed.includes('1400')
    ) {
      return structuredClone(NOTEBOOK_APARTMENT);
    }
    if (
      trimmed.includes('starbucks') ||
      trimmed.includes('debt') ||
      trimmed.includes('friend 300') ||
      trimmed.includes('owe')
    ) {
      return structuredClone(NOTEBOOK_CASE_7_LAPTOP_DEBT);
    }

    const error = new Error('This version uses sample data. Please select an example.');
    (error as unknown as { code: string }).code = 'DEMO_SAMPLE_REQUIRED';
    throw error;
  }

  async correct(request: CorrectionRequest): Promise<ExtractionResponse> {
    await new Promise((resolve) => setTimeout(resolve, this.artificialDelayMs));

    const correctionLower = request.user_correction.toLowerCase();

    // Check if correction corresponds to the notebook Case 2 correction
    if (
      correctionLower.includes('1800') ||
      correctionLower.includes('1,800') ||
      correctionLower.includes('1300') ||
      correctionLower.includes('1,300') ||
      correctionLower.includes('february') ||
      correctionLower.includes('4 months')
    ) {
      return structuredClone(NOTEBOOK_CASE_2_CORRECTION);
    }

    // Check if correcting the trip fixture
    if (
      correctionLower.includes('1500') ||
      correctionLower.includes('1,500') ||
      correctionLower.includes('600') ||
      correctionLower.includes('expense')
    ) {
      const updated = structuredClone(NOTEBOOK_CASE_3_TRIP);
      const exp = updated.assumptions.find((a) => a.variable === 'monthly_expenses');
      if (exp) {
        exp.value = 1500;
        exp.source = 'stated';
        exp.source_detail = 'User updated expenses to $1,500 in correction.';
      }
      const sur = updated.assumptions.find((a) => a.variable === 'monthly_surplus');
      if (sur) {
        sur.value = 500;
        sur.source_detail = 'Recalculated: $2,000 income minus $1,500 expenses.';
      }
      return updated;
    }

    const error = new Error(
      'In demo mode, arbitrary corrections remain pending drafts. You can try: "I make about $1,800/month from my part-time job and I spend around $1,300. I want the laptop by February, so about 4 months from now."'
    );
    (error as unknown as { code: string }).code = 'DEMO_CORRECTION_PENDING';
    throw error;
  }
}

/**
 * Prepared HttpExtractionService matching proposed backend contract (POST /api/extract & POST /api/correct)
 */
export class HttpExtractionService implements ExtractionService {
  private baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  async extract(request: ExtractRequest): Promise<ExtractionResponse> {
    const res = await fetch(`${this.baseUrl}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const message = errBody?.error?.message || 'Extraction failed. Please try again.';
      const err = new Error(message);
      (err as unknown as { code: string }).code = errBody?.error?.code || 'EXTRACTION_FAILED';
      throw err;
    }

    const data = await res.json();
    const validation = validateExtractionResponse(data);
    if (!validation.valid) {
      throw new Error(`Invalid response schema from backend: ${validation.errors.join(', ')}`);
    }

    return data as ExtractionResponse;
  }

  async correct(request: CorrectionRequest): Promise<ExtractionResponse> {
    const res = await fetch(`${this.baseUrl}/api/correct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const message = errBody?.error?.message || 'Correction failed. Please try again.';
      const err = new Error(message);
      (err as unknown as { code: string }).code = errBody?.error?.code || 'CORRECTION_FAILED';
      throw err;
    }

    const data = await res.json();
    const validation = validateExtractionResponse(data);
    if (!validation.valid) {
      throw new Error(`Invalid response schema from backend: ${validation.errors.join(', ')}`);
    }

    return data as ExtractionResponse;
  }
}

// Active singleton instance
export const activeExtractionService: ExtractionService = new MockExtractionService(350);
