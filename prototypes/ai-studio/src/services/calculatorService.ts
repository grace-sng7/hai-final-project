/**
 * Deterministic Savings Calculator Service
 * Strict implementation of PRD Section 9 & Acceptance Criteria A10, A11, A12, A13
 */

export interface SavingsCalculatorInputs {
  monthlyIncome: number;
  monthlyExpenses: number;
  goalAmount: number;
  monthsDeadline: number;
  allocatedSavings: number;
  monthlyContribution: number;
}

export interface CalculationDetails {
  formulaProjected: string;
  formulaRemainingCash: string;
  formulaGap: string;
  statedConditions: string[];
}

export interface SavingsCalculationResult {
  isValid: boolean;
  blockReason?: string;
  monthlySurplus: number;
  projectedAmount: number;
  targetGap: number;
  monthlyRemainingCash: number;
  isGoalMet: boolean;
  exceedsCashFlow: boolean;
  details: CalculationDetails;
}

export class CalculatorService {
  /**
   * Deterministically calculates savings projections.
   * Re-computes surplus from income and expenses to avoid double-counting categories.
   */
  static calculateSavings(inputs: SavingsCalculatorInputs): SavingsCalculationResult {
    const {
      monthlyIncome,
      monthlyExpenses,
      goalAmount,
      monthsDeadline,
      allocatedSavings,
      monthlyContribution,
    } = inputs;

    // Boundary validations
    if (monthsDeadline <= 0 || !Number.isInteger(monthsDeadline)) {
      return {
        isValid: false,
        blockReason: 'A positive whole number of months is required to project savings.',
        monthlySurplus: monthlyIncome - monthlyExpenses,
        projectedAmount: 0,
        targetGap: goalAmount,
        monthlyRemainingCash: 0,
        isGoalMet: false,
        exceedsCashFlow: false,
        details: this.getConditions(inputs),
      };
    }

    if (goalAmount <= 0) {
      return {
        isValid: false,
        blockReason: 'Goal amount must be greater than zero.',
        monthlySurplus: monthlyIncome - monthlyExpenses,
        projectedAmount: 0,
        targetGap: 0,
        monthlyRemainingCash: 0,
        isGoalMet: false,
        exceedsCashFlow: false,
        details: this.getConditions(inputs),
      };
    }

    const monthlySurplus = monthlyIncome - monthlyExpenses;
    const projectedAmount = allocatedSavings + monthlyContribution * monthsDeadline;
    const targetGap = Math.max(0, goalAmount - projectedAmount);
    const monthlyRemainingCash = monthlyIncome - monthlyExpenses - monthlyContribution;
    const exceedsCashFlow = monthlyContribution > monthlySurplus;
    const isGoalMet = projectedAmount >= goalAmount && !exceedsCashFlow;

    return {
      isValid: true,
      monthlySurplus,
      projectedAmount,
      targetGap,
      monthlyRemainingCash,
      isGoalMet,
      exceedsCashFlow,
      details: this.getConditions(inputs),
    };
  }

  private static getConditions(inputs: SavingsCalculatorInputs): CalculationDetails {
    return {
      formulaProjected: `${inputs.allocatedSavings} + (${inputs.monthlyContribution} × ${inputs.monthsDeadline}) = ${inputs.allocatedSavings + inputs.monthlyContribution * inputs.monthsDeadline}`,
      formulaRemainingCash: `${inputs.monthlyIncome} - ${inputs.monthlyExpenses} - ${inputs.monthlyContribution} = ${inputs.monthlyIncome - inputs.monthlyExpenses - inputs.monthlyContribution}`,
      formulaGap: `${inputs.goalAmount} - (${inputs.allocatedSavings} + ${inputs.monthlyContribution} × ${inputs.monthsDeadline}) = ${inputs.goalAmount - (inputs.allocatedSavings + inputs.monthlyContribution * inputs.monthsDeadline)}`,
      statedConditions: [
        'Income and living expenses remain constant each month.',
        'Zero interest / investment return is assumed for this short timeline.',
        'Only explicitly allocated savings are counted toward this goal, preserving emergency funds.',
        'Excludes unlisted unexpected costs, taxes, or competing savings goals.',
      ],
    };
  }
}
