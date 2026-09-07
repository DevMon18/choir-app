'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from '@/lib/audit';
import {
  MoneyCentavos,
  PaymentMethod,
  ContributorType,
  SolicitationStatus,
  getCurrentPeriodLabel,
  getPreviousPeriodLabel,
} from '@/lib/financeUtils';
import { getManilaDateString } from '@/lib/dateUtils';

const ALLOWED_FINANCE_ROLES = ['super_admin', 'director', 'treasurer'];

// ---------------------------------------------------------------------------
// Authorization Helper
// ---------------------------------------------------------------------------
async function verifyFinanceOfficer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated', user: null, profile: null };
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile || !ALLOWED_FINANCE_ROLES.includes(profile.role)) {
    return {
      error: 'Unauthorized: Only a Treasurer, Director, or Super Admin can manage finances.',
      user: null,
      profile: null,
    };
  }

  return { error: null, user, profile };
}

// ---------------------------------------------------------------------------
// SINKING FUND DUES ACTIONS
// ---------------------------------------------------------------------------

interface RecordDuesPaymentInput {
  memberId: string;
  periodLabel: string; // e.g. "2026-09"
  amountCentavos: MoneyCentavos;
  method: PaymentMethod;
  reference?: string | null;
  paidAt?: string;
  clientOperationId?: string | null;
}

/**
 * Records an immutable payment into the append-only dues_payments ledger.
 * If a dues_period row does not exist for this member and period_label, creates it automatically.
 */
export async function recordDuesPayment(input: RecordDuesPaymentInput) {
  try {
    const authCheck = await verifyFinanceOfficer();
    if (authCheck.error || !authCheck.user || !authCheck.profile) {
      return { error: authCheck.error };
    }

    if (!input.memberId) return { error: 'Member ID is required.' };
    if (!input.periodLabel) return { error: 'Period label is required.' };
    if (!input.amountCentavos || input.amountCentavos <= 0) {
      return { error: 'Payment amount must be greater than zero.' };
    }

    const adminSupabase = createAdminClient();

    // 1. Idempotency Check: if clientOperationId exists and was already recorded, return success
    if (input.clientOperationId) {
      const { data: existingPayment } = await adminSupabase
        .from('dues_payments')
        .select('id, amount_centavos')
        .eq('client_operation_id', input.clientOperationId)
        .maybeSingle();

      if (existingPayment) {
        return { success: true, paymentId: existingPayment.id, deduplicated: true };
      }
    }

    // 2. Fetch or create dues_period
    let { data: period, error: periodErr } = await adminSupabase
      .from('dues_periods')
      .select('id, base_amount_centavos, carried_balance_centavos, is_exempt')
      .eq('member_id', input.memberId)
      .eq('period_label', input.periodLabel)
      .maybeSingle();

    if (periodErr) {
      return { error: `Failed to query dues period: ${periodErr.message}` };
    }

    if (!period) {
      // Create new period for this member
      const { data: newPeriod, error: createPeriodErr } = await adminSupabase
        .from('dues_periods')
        .insert({
          member_id: input.memberId,
          period_label: input.periodLabel,
          base_amount_centavos: 4000,
          carried_balance_centavos: 0,
          is_exempt: false,
        })
        .select('id, base_amount_centavos, carried_balance_centavos, is_exempt')
        .single();

      if (createPeriodErr || !newPeriod) {
        return { error: `Failed to initialize dues period: ${createPeriodErr?.message}` };
      }
      period = newPeriod;
    }

    // 3. Insert append-only payment
    const { data: insertedPayment, error: insertErr } = await adminSupabase
      .from('dues_payments')
      .insert({
        dues_period_id: period.id,
        amount_centavos: input.amountCentavos,
        method: input.method,
        reference: input.reference?.trim() || null,
        recorded_by: authCheck.profile.id,
        paid_at: input.paidAt || new Date().toISOString(),
        client_operation_id: input.clientOperationId?.trim() || null,
      })
      .select('id')
      .single();

    if (insertErr || !insertedPayment) {
      return { error: `Failed to record payment: ${insertErr?.message}` };
    }

    // 4. Audit Log
    await recordAuditLog({
      actorId: authCheck.profile.id,
      actorEmail: authCheck.profile.email,
      action: 'dues_payment_created',
      entityType: 'dues_payment',
      entityId: insertedPayment.id,
      metadata: {
        memberId: input.memberId,
        periodLabel: input.periodLabel,
        amountCentavos: input.amountCentavos,
        method: input.method,
        reference: input.reference,
        clientOperationId: input.clientOperationId,
      },
    });

    revalidatePath('/admin/finances');
    revalidatePath('/dues');

    return { success: true, paymentId: insertedPayment.id };
  } catch (err: any) {
    console.error('Error in recordDuesPayment:', err);
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

interface VoidDuesPaymentInput {
  paymentId: string;
  reason: string;
}

/**
 * Soft-voids a payment in the dues_payments ledger with mandatory reason and auditor tracking.
 */
export async function voidDuesPayment(input: VoidDuesPaymentInput) {
  try {
    const authCheck = await verifyFinanceOfficer();
    if (authCheck.error || !authCheck.user || !authCheck.profile) {
      return { error: authCheck.error };
    }

    if (!input.paymentId) return { error: 'Payment ID is required.' };
    if (!input.reason || !input.reason.trim()) {
      return { error: 'A specific reason is required to void a financial transaction.' };
    }

    const adminSupabase = createAdminClient();

    // Check if already voided
    const { data: currentPayment, error: fetchErr } = await adminSupabase
      .from('dues_payments')
      .select('id, voided_at, dues_period_id, amount_centavos')
      .eq('id', input.paymentId)
      .single();

    if (fetchErr || !currentPayment) {
      return { error: 'Payment record not found.' };
    }

    if (currentPayment.voided_at) {
      return { error: 'This payment has already been voided.' };
    }

    const nowIso = new Date().toISOString();
    const { error: voidErr } = await adminSupabase
      .from('dues_payments')
      .update({
        voided_at: nowIso,
        voided_reason: input.reason.trim(),
        voided_by: authCheck.profile.id,
      })
      .eq('id', input.paymentId);

    if (voidErr) {
      return { error: `Failed to void payment: ${voidErr.message}` };
    }

    // Audit Log
    await recordAuditLog({
      actorId: authCheck.profile.id,
      actorEmail: authCheck.profile.email,
      action: 'dues_payment_voided',
      entityType: 'dues_payment',
      entityId: input.paymentId,
      metadata: {
        reason: input.reason.trim(),
        amountCentavos: currentPayment.amount_centavos,
        duesPeriodId: currentPayment.dues_period_id,
      },
    });

    revalidatePath('/admin/finances');
    revalidatePath('/dues');

    return { success: true };
  } catch (err: any) {
    console.error('Error in voidDuesPayment:', err);
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

/**
 * Toggles a member's dues-exempt status for a given period.
 */
export async function toggleMemberDuesExemption(periodId: string, isExempt: boolean) {
  try {
    const authCheck = await verifyFinanceOfficer();
    if (authCheck.error || !authCheck.user || !authCheck.profile) {
      return { error: authCheck.error };
    }

    const adminSupabase = createAdminClient();
    const { error: updateErr } = await adminSupabase
      .from('dues_periods')
      .update({ is_exempt: isExempt })
      .eq('id', periodId);

    if (updateErr) {
      return { error: `Failed to update exemption status: ${updateErr.message}` };
    }

    await recordAuditLog({
      actorId: authCheck.profile.id,
      actorEmail: authCheck.profile.email,
      action: isExempt ? 'dues_period_exempted' : 'dues_period_unexempted',
      entityType: 'dues_period',
      entityId: periodId,
      metadata: { isExempt },
    });

    revalidatePath('/admin/finances');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

// ---------------------------------------------------------------------------
// MONTHLY ROLLOVER ACTION
// ---------------------------------------------------------------------------

interface TriggerMonthlyRolloverInput {
  targetPeriodLabel?: string; // e.g. "2026-09", defaults to current month in Manila
}

/**
 * Executes an atomic, idempotent monthly rollover:
 * 1. Identifies all active, non-exempt choir members.
 * 2. Checks if target period already exists.
 * 3. Reads previous period and computes carried balance (debt or overpaid credit).
 * 4. Creates target period for active members.
 */
export async function triggerMonthlyRollover(input?: TriggerMonthlyRolloverInput) {
  try {
    const authCheck = await verifyFinanceOfficer();
    if (authCheck.error || !authCheck.user || !authCheck.profile) {
      return { error: authCheck.error };
    }

    const targetLabel = input?.targetPeriodLabel || getCurrentPeriodLabel();
    const prevLabel = getPreviousPeriodLabel(targetLabel);

    const adminSupabase = createAdminClient();

    // 1. Fetch all active members
    const { data: members, error: memberErr } = await adminSupabase
      .from('profiles')
      .select('id, full_name, email, role')
      .neq('role', 'pending')
      .neq('role', 'rejected');

    if (memberErr || !members) {
      return { error: `Failed to fetch members: ${memberErr?.message}` };
    }

    // 2. Fetch existing periods for previous month with payments
    const { data: prevPeriods } = await adminSupabase
      .from('dues_periods')
      .select(`
        id,
        member_id,
        period_label,
        base_amount_centavos,
        carried_balance_centavos,
        is_exempt,
        payments:dues_payments(amount_centavos, voided_at)
      `)
      .eq('period_label', prevLabel);

    const prevPeriodMap = new Map<string, any>();
    (prevPeriods || []).forEach((p) => {
      prevPeriodMap.set(p.member_id, p);
    });

    // 3. Fetch any already created periods for target month to maintain idempotency
    const { data: existingTargetPeriods } = await adminSupabase
      .from('dues_periods')
      .select('id, member_id')
      .eq('period_label', targetLabel);

    const existingMemberIds = new Set((existingTargetPeriods || []).map((p) => p.member_id));

    let createdCount = 0;
    let skippedCount = 0;

    for (const member of members) {
      if (existingMemberIds.has(member.id)) {
        skippedCount++;
        continue;
      }

      // Compute carry from previous period
      let carriedBalanceCentavos = 0;
      const prevPeriod = prevPeriodMap.get(member.id);

      if (prevPeriod && !prevPeriod.is_exempt) {
        const prevBase = prevPeriod.base_amount_centavos;
        const prevCarry = prevPeriod.carried_balance_centavos;
        const prevGrossTarget = prevBase + prevCarry;
        const prevEffectiveDue = Math.max(0, prevGrossTarget);

        const prevPaid = (prevPeriod.payments || [])
          .filter((p: any) => !p.voided_at)
          .reduce((sum: number, p: any) => sum + p.amount_centavos, 0);

        // Remaining balance: positive = unpaid shortfall, negative = overpayment credit
        const remaining = prevEffectiveDue - prevPaid;

        // If grossTarget was negative (excess credit), add it to the overpayment calculation
        if (prevGrossTarget < 0) {
          carriedBalanceCentavos = prevGrossTarget - prevPaid;
        } else {
          carriedBalanceCentavos = remaining;
        }
      }

      // Insert new period
      const { error: insertPeriodErr } = await adminSupabase
        .from('dues_periods')
        .insert({
          member_id: member.id,
          period_label: targetLabel,
          base_amount_centavos: 4000,
          carried_balance_centavos: carriedBalanceCentavos,
          is_exempt: false,
        });

      if (!insertPeriodErr) {
        createdCount++;
      }
    }

    await recordAuditLog({
      actorId: authCheck.profile.id,
      actorEmail: authCheck.profile.email,
      action: 'dues_rollover_executed',
      entityType: 'dues_periods_batch',
      metadata: {
        targetPeriodLabel: targetLabel,
        previousPeriodLabel: prevLabel,
        createdCount,
        skippedCount,
      },
    });

    revalidatePath('/admin/finances');
    revalidatePath('/dues');

    return {
      success: true,
      targetPeriodLabel: targetLabel,
      createdCount,
      skippedCount,
    };
  } catch (err: any) {
    console.error('Error in triggerMonthlyRollover:', err);
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

// ---------------------------------------------------------------------------
// SOLICITATIONS (FUNDRAISING CAMPAIGNS) ACTIONS
// ---------------------------------------------------------------------------

interface CreateSolicitationInput {
  title: string;
  description?: string | null;
  targetAmountCentavos?: MoneyCentavos | null;
  startDate: string; // YYYY-MM-DD
  endDate?: string | null;
}

export async function createSolicitation(input: CreateSolicitationInput) {
  try {
    const authCheck = await verifyFinanceOfficer();
    if (authCheck.error || !authCheck.user || !authCheck.profile) {
      return { error: authCheck.error };
    }

    if (!input.title || !input.title.trim()) {
      return { error: 'Campaign title is required.' };
    }
    if (!input.startDate) {
      return { error: 'Campaign start date is required.' };
    }

    const adminSupabase = createAdminClient();
    const { data: newSolicitation, error: insertErr } = await adminSupabase
      .from('solicitations')
      .insert({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        target_amount_centavos: input.targetAmountCentavos || null,
        start_date: input.startDate,
        end_date: input.endDate || null,
        status: 'active',
        created_by: authCheck.profile.id,
      })
      .select('id')
      .single();

    if (insertErr || !newSolicitation) {
      return { error: `Failed to create campaign: ${insertErr?.message}` };
    }

    await recordAuditLog({
      actorId: authCheck.profile.id,
      actorEmail: authCheck.profile.email,
      action: 'solicitation_created',
      entityType: 'solicitation',
      entityId: newSolicitation.id,
      metadata: {
        title: input.title,
        targetAmountCentavos: input.targetAmountCentavos,
      },
    });

    revalidatePath('/admin/finances');
    revalidatePath('/solicitations');

    return { success: true, solicitationId: newSolicitation.id };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function updateSolicitationStatus(solicitationId: string, status: SolicitationStatus) {
  try {
    const authCheck = await verifyFinanceOfficer();
    if (authCheck.error || !authCheck.user || !authCheck.profile) {
      return { error: authCheck.error };
    }

    const adminSupabase = createAdminClient();
    const { error: updateErr } = await adminSupabase
      .from('solicitations')
      .update({ status })
      .eq('id', solicitationId);

    if (updateErr) {
      return { error: `Failed to update campaign status: ${updateErr.message}` };
    }

    await recordAuditLog({
      actorId: authCheck.profile.id,
      actorEmail: authCheck.profile.email,
      action: status === 'closed' ? 'solicitation_closed' : 'solicitation_reopened',
      entityType: 'solicitation',
      entityId: solicitationId,
      metadata: { newStatus: status },
    });

    revalidatePath('/admin/finances');
    revalidatePath('/solicitations');
    revalidatePath(`/solicitations/${solicitationId}`);

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

interface RecordSolicitationContributionInput {
  solicitationId: string;
  contributorType: ContributorType;
  memberId?: string | null;
  contributorName?: string | null;
  amountCentavos: MoneyCentavos;
  method: PaymentMethod;
  reference?: string | null;
  contributedAt?: string;
  clientOperationId?: string | null;
}

/**
 * Records an immutable contribution into the solicitations_contributions append-only ledger.
 */
export async function recordSolicitationContribution(input: RecordSolicitationContributionInput) {
  try {
    const authCheck = await verifyFinanceOfficer();
    if (authCheck.error || !authCheck.user || !authCheck.profile) {
      return { error: authCheck.error };
    }

    if (!input.solicitationId) return { error: 'Campaign ID is required.' };
    if (!input.amountCentavos || input.amountCentavos <= 0) {
      return { error: 'Contribution amount must be greater than zero.' };
    }

    if (input.contributorType === 'member' && !input.memberId) {
      return { error: 'Please select the contributing choir member.' };
    }
    if (input.contributorType === 'external' && (!input.contributorName || !input.contributorName.trim())) {
      return { error: 'Please specify the external donor or organization name.' };
    }

    const adminSupabase = createAdminClient();

    // Verify campaign is active
    const { data: campaign, error: campErr } = await adminSupabase
      .from('solicitations')
      .select('id, status, title')
      .eq('id', input.solicitationId)
      .single();

    if (campErr || !campaign) {
      return { error: 'Solicitation campaign not found.' };
    }
    if (campaign.status === 'closed') {
      return { error: 'This campaign is closed and cannot accept new contributions.' };
    }

    // Idempotency check
    if (input.clientOperationId) {
      const { data: existing } = await adminSupabase
        .from('solicitations_contributions')
        .select('id')
        .eq('client_operation_id', input.clientOperationId)
        .maybeSingle();

      if (existing) {
        return { success: true, contributionId: existing.id, deduplicated: true };
      }
    }

    const { data: inserted, error: insertErr } = await adminSupabase
      .from('solicitations_contributions')
      .insert({
        solicitation_id: input.solicitationId,
        contributor_type: input.contributorType,
        member_id: input.contributorType === 'member' ? input.memberId : null,
        contributor_name: input.contributorType === 'external' ? input.contributorName?.trim() : null,
        amount_centavos: input.amountCentavos,
        method: input.method,
        reference: input.reference?.trim() || null,
        recorded_by: authCheck.profile.id,
        contributed_at: input.contributedAt || new Date().toISOString(),
        client_operation_id: input.clientOperationId?.trim() || null,
      })
      .select('id')
      .single();

    if (insertErr || !inserted) {
      return { error: `Failed to record contribution: ${insertErr?.message}` };
    }

    await recordAuditLog({
      actorId: authCheck.profile.id,
      actorEmail: authCheck.profile.email,
      action: 'solicitation_contribution_created',
      entityType: 'solicitation_contribution',
      entityId: inserted.id,
      metadata: {
        solicitationId: input.solicitationId,
        contributorType: input.contributorType,
        memberId: input.memberId,
        contributorName: input.contributorName,
        amountCentavos: input.amountCentavos,
        method: input.method,
        reference: input.reference,
      },
    });

    revalidatePath('/admin/finances');
    revalidatePath('/solicitations');
    revalidatePath(`/solicitations/${input.solicitationId}`);

    return { success: true, contributionId: inserted.id };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

interface VoidSolicitationContributionInput {
  contributionId: string;
  reason: string;
}

export async function voidSolicitationContribution(input: VoidSolicitationContributionInput) {
  try {
    const authCheck = await verifyFinanceOfficer();
    if (authCheck.error || !authCheck.user || !authCheck.profile) {
      return { error: authCheck.error };
    }

    if (!input.contributionId) return { error: 'Contribution ID is required.' };
    if (!input.reason || !input.reason.trim()) {
      return { error: 'A specific reason is required to void a contribution.' };
    }

    const adminSupabase = createAdminClient();
    const { data: contribution, error: fetchErr } = await adminSupabase
      .from('solicitations_contributions')
      .select('id, solicitation_id, amount_centavos, voided_at')
      .eq('id', input.contributionId)
      .single();

    if (fetchErr || !contribution) {
      return { error: 'Contribution record not found.' };
    }
    if (contribution.voided_at) {
      return { error: 'This contribution has already been voided.' };
    }

    const nowIso = new Date().toISOString();
    const { error: voidErr } = await adminSupabase
      .from('solicitations_contributions')
      .update({
        voided_at: nowIso,
        voided_reason: input.reason.trim(),
        voided_by: authCheck.profile.id,
      })
      .eq('id', input.contributionId);

    if (voidErr) {
      return { error: `Failed to void contribution: ${voidErr.message}` };
    }

    await recordAuditLog({
      actorId: authCheck.profile.id,
      actorEmail: authCheck.profile.email,
      action: 'solicitation_contribution_voided',
      entityType: 'solicitation_contribution',
      entityId: input.contributionId,
      metadata: {
        reason: input.reason.trim(),
        solicitationId: contribution.solicitation_id,
        amountCentavos: contribution.amount_centavos,
      },
    });

    revalidatePath('/admin/finances');
    revalidatePath('/solicitations');
    revalidatePath(`/solicitations/${contribution.solicitation_id}`);

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}
