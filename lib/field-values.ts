import type { AssumptionValue } from './extraction';
import type { Control } from './calculation-contract';
export function validDate(value: unknown): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function editingControl(value: AssumptionValue, unit: string | null): Control['type'] {
  if (typeof value === 'string') return unit === 'date' && validDate(value) ? 'date' : 'text';
  return typeof value === 'number' || (unit ?? '').startsWith('$') || ['months', '%'].includes(unit ?? '') ? 'number' : unit === 'date' ? 'date' : 'text';
}
export function parseEdit(value: AssumptionValue, control: Control): AssumptionValue | undefined {
  if (value === null || String(value).trim() === '') return null;
  if (control.type === 'number' || control.type === 'range') return Number.isFinite(Number(value)) ? Number(value) : undefined;
  if (control.type === 'date' && !validDate(value)) return undefined;
  if (control.type === 'select' && !control.options?.some(o => o.value === String(value))) return undefined;
  return String(value);
}
