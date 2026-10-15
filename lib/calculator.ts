export interface SavingsInputs { income:number; expenses:number; allocated:number; savings:number; goal:number; months:number; contribution:number }
export class CalculatorService {
 calculate(i:SavingsInputs) {
  if(!Object.values(i).every(Number.isFinite)) throw new Error('Complete all numeric inputs.');
  if(!Number.isInteger(i.months)||i.months<=0) throw new Error('Deadline must be a positive whole number of months.');
  if(i.income<0||i.expenses<0||i.goal<0||i.allocated<0||i.allocated>i.savings||i.contribution<0) throw new Error('Use nonnegative amounts and allocate no more than your savings.');
  const available=i.income-i.expenses;
  if(available<0) throw new Error('No monthly surplus is currently available. Review income and expenses.');
  const projected=i.allocated+i.contribution*i.months;
  return {projected,gap:Math.max(0,i.goal-projected),remaining:available-i.contribution,available, exceeds:i.contribution>available};
 }
}
export const calculatorService=new CalculatorService();
