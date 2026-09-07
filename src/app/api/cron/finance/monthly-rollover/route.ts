import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentPeriodLabel, getPreviousPeriodLabel } from '@/lib/financeUtils';
import { recordAuditLog } from '@/lib/audit';
import { sendPushToAll } from '@/lib/push';

/**
 * Monthly Sinking Fund Rollover Cron Handler.
 * Executes on the 1st of every month in Asia/Manila (UTC+8).
 * 1. Derives prior month obligations vs payments.
 * 2. Computes carryovers (unpaid debt or overpaid credit).
 * 3. Initializes new monthly target periods (₱40 default).
 * 4. Broadcasts targeted push reminders to members.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    const targetLabel = getCurrentPeriodLabel();
    const prevLabel = getPreviousPeriodLabel(targetLabel);

    // 1. Fetch active choir members
    const { data: members, error: memberErr } = await adminSupabase
      .from('profiles')
      .select('id, full_name, role')
      .neq('role', 'pending')
      .neq('role', 'rejected');

    if (memberErr || !members) {
      console.error('Error fetching members for rollover cron:', memberErr);
      return NextResponse.json({ error: memberErr?.message || 'Member query failed' }, { status: 500 });
    }

    // 2. Fetch previous periods
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

    // 3. Fetch existing target periods to ensure strict idempotency
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

        const remaining = prevEffectiveDue - prevPaid;

        if (prevGrossTarget < 0) {
          carriedBalanceCentavos = prevGrossTarget - prevPaid;
        } else {
          carriedBalanceCentavos = remaining;
        }
      }

      const { error: insertErr } = await adminSupabase
        .from('dues_periods')
        .insert({
          member_id: member.id,
          period_label: targetLabel,
          base_amount_centavos: 4000,
          carried_balance_centavos: carriedBalanceCentavos,
          is_exempt: false,
        });

      if (!insertErr) {
        createdCount++;
      }
    }

    // 4. Log audit trail
    await recordAuditLog({
      actorId: '00000000-0000-0000-0000-000000000000',
      actorEmail: 'system-cron@choircollective.app',
      action: 'dues_rollover_cron_executed',
      entityType: 'dues_periods_batch',
      metadata: {
        targetPeriodLabel: targetLabel,
        previousPeriodLabel: prevLabel,
        createdCount,
        skippedCount,
      },
    });

    // 5. Send announcement reminder push to members
    try {
      await sendPushToAll({
        title: `📅 ${targetLabel} Sinking Fund Ready`,
        body: 'New monthly sinking fund target has been generated. Check your balance in My Dues.',
        url: '/dues',
      });
    } catch (pushErr) {
      console.warn('Non-blocking push error during monthly rollover:', pushErr);
    }

    return NextResponse.json({
      success: true,
      targetPeriodLabel: targetLabel,
      createdCount,
      skippedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error in monthly rollover route:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
