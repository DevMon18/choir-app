/**
 * Financial utilities, type definitions, and money calculation helpers for Choir App.
 * Internally standardizes all monetary values to integer centavos (PHP 1.00 = 100 centavos)
 * to avoid floating-point rounding errors across financial ledgers.
 */

export type MoneyCentavos = number;

export type PaymentMethod = 'cash' | 'gcash' | 'bank_transfer' | 'other';

export type ContributorType = 'member' | 'external';

export type SolicitationStatus = 'active' | 'closed';

export interface DuesPeriod {
  id: string;
  member_id: string;
  period_label: string; // e.g. "2026-09"
  base_amount_centavos: MoneyCentavos; // Default: 4000 (₱40.00)
  carried_balance_centavos: MoneyCentavos; // Positive = unpaid debt, Negative = credit
  is_exempt: boolean;
  created_at: string;
  member?: {
    id: string;
    full_name: string;
    email: string;
    voice_part?: string | null;
    avatar_url?: string | null;
  };
  payments?: DuesPayment[];
}

export interface DuesPayment {
  id: string;
  dues_period_id: string;
  amount_centavos: MoneyCentavos;
  method: PaymentMethod;
  reference?: string | null;
  recorded_by: string;
  paid_at: string;
  client_operation_id?: string | null;
  voided_at?: string | null;
  voided_reason?: string | null;
  voided_by?: string | null;
  created_at: string;
  recorder?: {
    full_name: string;
    email: string;
  };
}

export interface Solicitation {
  id: string;
  title: string;
  description?: string | null;
  target_amount_centavos?: MoneyCentavos | null;
  start_date: string;
  end_date?: string | null;
  status: SolicitationStatus;
  created_by: string;
  created_at: string;
  creator?: {
    full_name: string;
  };
  contributions?: SolicitationContribution[];
  total_raised_centavos?: MoneyCentavos;
  contributions_count?: number;
}

export interface SolicitationContribution {
  id: string;
  solicitation_id: string;
  contributor_type: ContributorType;
  member_id?: string | null;
  contributor_name?: string | null;
  amount_centavos: MoneyCentavos;
  method: PaymentMethod;
  reference?: string | null;
  recorded_by: string;
  contributed_at: string;
  client_operation_id?: string | null;
  voided_at?: string | null;
  voided_reason?: string | null;
  voided_by?: string | null;
  created_at: string;
  member?: {
    full_name: string;
    avatar_url?: string | null;
  };
  recorder?: {
    full_name: string;
  };
}

export interface DuesPeriodSummary {
  period_label: string;
  base_amount_centavos: MoneyCentavos;
  carried_balance_centavos: MoneyCentavos;
  effective_due_centavos: MoneyCentavos; // base + carried (floored at 0 if credit exceeds base)
  excess_credit_centavos: MoneyCentavos; // Any credit remaining if credit > base
  total_paid_centavos: MoneyCentavos; // Sum of non-voided payments
  remaining_balance_centavos: MoneyCentavos; // effective_due - total_paid (can be negative if overpaid)
  is_fully_paid: boolean;
  percentage_paid: number;
}

// ---------------------------------------------------------------------------
// Formatting Helpers
// ---------------------------------------------------------------------------

/**
 * Format integer centavos into a formatted Philippine Peso string (e.g. 4000 -> "₱40.00").
 */
export function formatPHPFromCentavos(centavos: MoneyCentavos | null | undefined, includeDecimals: boolean = true): string {
  if (centavos === null || centavos === undefined || isNaN(centavos)) {
    return includeDecimals ? '₱0.00' : '₱0';
  }

  const pesos = centavos / 100;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(pesos);
}

/**
 * Converts integer centavos to decimal pesos (e.g. 4000 -> 40.00).
 */
export function centavosToPesos(centavos: MoneyCentavos): number {
  return Number((centavos / 100).toFixed(2));
}

/**
 * Converts a peso number to integer centavos (e.g. 40.50 -> 4050).
 */
export function pesosToCentavos(pesos: number): MoneyCentavos {
  return Math.round(pesos * 100);
}

/**
 * Formats a payment method into a human-readable display string.
 */
export function formatPaymentMethod(method: PaymentMethod | string): string {
  switch (method) {
    case 'cash':
      return 'Cash';
    case 'gcash':
      return 'GCash';
    case 'bank_transfer':
      return 'Bank Transfer';
    case 'other':
      return 'Other';
    default:
      return method;
  }
}

// ---------------------------------------------------------------------------
// Calculation Helpers
// ---------------------------------------------------------------------------

/**
 * Calculates derived financial metrics for a specific member dues period.
 */
export function calculatePeriodSummary(
  period: Pick<DuesPeriod, 'base_amount_centavos' | 'carried_balance_centavos' | 'is_exempt' | 'period_label'>,
  payments: Array<Pick<DuesPayment, 'amount_centavos' | 'voided_at'>> = []
): DuesPeriodSummary {
  const base = period.is_exempt ? 0 : period.base_amount_centavos;
  const carry = period.is_exempt ? 0 : period.carried_balance_centavos;

  // Total gross target: base + carry
  const grossTarget = base + carry;

  // Effective due cannot be negative for the month:
  // If carry was -₱60 and base is ₱40, grossTarget is -₱20. Effective due is ₱0, and ₱20 is excess credit.
  const effectiveDue = Math.max(0, grossTarget);
  const excessCredit = grossTarget < 0 ? Math.abs(grossTarget) : 0;

  // Sum non-voided payments
  const totalPaid = payments
    .filter((p) => !p.voided_at)
    .reduce((sum, p) => sum + p.amount_centavos, 0);

  const remainingBalance = effectiveDue - totalPaid;
  const isFullyPaid = period.is_exempt || (effectiveDue === 0 && totalPaid >= 0) || remainingBalance <= 0;

  const percentage = effectiveDue > 0 ? Math.min(100, Math.round((totalPaid / effectiveDue) * 100)) : 100;

  return {
    period_label: period.period_label,
    base_amount_centavos: base,
    carried_balance_centavos: carry,
    effective_due_centavos: effectiveDue,
    excess_credit_centavos: excessCredit,
    total_paid_centavos: totalPaid,
    remaining_balance_centavos: remainingBalance,
    is_fully_paid: isFullyPaid,
    percentage_paid: percentage,
  };
}

/**
 * Formats a period label like "2026-09" into "September 2026".
 */
export function formatPeriodLabel(label: string): string {
  if (!label || !label.includes('-')) return label;
  const [yearStr, monthStr] = label.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return label;

  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

/**
 * Returns current period label in "YYYY-MM" format in Asia/Manila timezone.
 */
export function getCurrentPeriodLabel(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
  });
  // 'en-CA' year-month produces 'YYYY-MM'
  return formatter.format(now).substring(0, 7);
}

/**
 * Computes the previous period label, e.g. "2026-09" -> "2026-08", "2026-01" -> "2025-12".
 */
export function getPreviousPeriodLabel(currentLabel: string): string {
  const [yearStr, monthStr] = currentLabel.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);

  month -= 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}
