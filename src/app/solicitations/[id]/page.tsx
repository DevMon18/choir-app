import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/supabase/user';
import { Navbar } from '@/components/Navbar';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Sparkles,
  Calendar,
  Users,
  ArrowLeft,
  HeartHandshake,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { formatPHPFromCentavos } from '@/lib/financeUtils';
import { Avatar } from '@/components/Avatar';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from('solicitations')
    .select('title, description')
    .eq('id', id)
    .single();

  return {
    title: campaign ? `${campaign.title} — Choir Collective` : 'Fundraising Campaign',
    description: campaign?.description || 'Support this choir fundraising initiative.',
  };
}

const SolicitationDetailPage = async ({ params }: PageProps) => {
  const { id } = await params;
  const profile = await getProfile();
  const supabase = await createClient();

  const [
    { data: campaign, error: campErr },
    { data: contributions },
  ] = await Promise.all([
    supabase
      .from('solicitations')
      .select('*, creator:profiles!created_by(full_name)')
      .eq('id', id)
      .single(),
    supabase
      .from('solicitations_contributions')
      .select('*, member:profiles!member_id(full_name, avatar_url, voice_part)')
      .eq('solicitation_id', id)
      .is('voided_at', null)
      .order('contributed_at', { ascending: false }),
  ]);

  if (campErr || !campaign) {
    notFound();
  }

  const allContributions = contributions || [];
  const totalRaisedCentavos = allContributions.reduce((acc, c) => acc + c.amount_centavos, 0);
  const targetCentavos = campaign.target_amount_centavos || 0;
  const progressPercent = targetCentavos > 0
    ? Math.min(100, Math.round((totalRaisedCentavos / targetCentavos) * 100))
    : 0;

  // Check if current user is an authorized officer who can view unmasked external donor details
  const canViewUnmasked = profile && ['super_admin', 'director', 'treasurer'].includes(profile.role);

  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1 w-[500px] h-[500px]" />
      <div className="bg-orb bg-orb-2 w-[400px] h-[400px]" />

      {profile && <Navbar profile={profile} />}

      <main className="flex-1 py-4 sm:py-8 px-3 sm:px-6 max-w-[960px] mx-auto w-full pb-28 sm:pb-16">
        {/* Back navigation */}
        <Link
          href="/solicitations"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-foreground mb-4 sm:mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Back to all campaigns
        </Link>

        {/* Campaign Hero Card */}
        <div className="glass-container p-6 sm:p-8 mb-8 border border-purple-200 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <span className={`badge ${campaign.status === 'active' ? 'badge-approved !bg-purple-100 !text-purple-800' : 'badge-rejected !bg-slate-200 !text-slate-700'}`}>
              {campaign.status === 'active' ? 'Active Fundraising' : campaign.status}
            </span>

            {campaign.end_date && (
              <span className="text-xs font-semibold text-muted flex items-center gap-1.5">
                <Calendar size={14} className="text-purple-600" />
                Target Deadline: {new Date(campaign.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {campaign.title}
          </h1>

          <p className="text-muted text-sm sm:text-base mt-3 leading-relaxed whitespace-pre-line">
            {campaign.description || 'Join our parish community in supporting this special project.'}
          </p>

          {/* Goal & Funding Progress */}
          <div className="mt-8 pt-6 border-t border-glass-border">
            <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-2 mb-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">Total Raised So Far</span>
                <div className="text-3xl font-extrabold text-purple-600 mt-0.5">
                  {formatPHPFromCentavos(totalRaisedCentavos)}
                </div>
              </div>

              <div className="text-right sm:text-right">
                <span className="text-xs text-muted block">Fundraising Target Goal</span>
                <span className="text-xl font-bold text-foreground">
                  {formatPHPFromCentavos(targetCentavos)}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden mt-3 mb-2">
              <div
                className="bg-purple-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs font-semibold text-muted">
              <span>{progressPercent}% of goal reached</span>
              <span className="flex items-center gap-1">
                <Users size={13} /> {allContributions.length} generous contributions
              </span>
            </div>
          </div>
        </div>

        {/* Content Layout: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Contributors Feed */}
          <div className="lg:col-span-2 glass-container p-6">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <HeartHandshake size={20} className="text-purple-600" />
              Campaign Supporters & Donors ({allContributions.length})
            </h2>

            {allContributions.length === 0 ? (
              <div className="text-center py-10 text-muted">
                <Sparkles size={32} className="mx-auto mb-2 opacity-40 text-purple-600" />
                <p className="text-sm font-semibold">Be the first to contribute to this campaign!</p>
                <p className="text-xs mt-1">Every donation helps us reach our goal for the choir ministry.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {allContributions.map((c) => {
                  // External Donor Privacy Masking logic
                  const isExternal = c.contributor_type === 'external';
                  const displayName = isExternal
                    ? canViewUnmasked
                      ? `${c.contributor_name || 'External Donor'} (External)`
                      : 'External Donor'
                    : c.member?.full_name || 'Choir Member';

                  const avatarUrl = isExternal ? undefined : c.member?.avatar_url;

                  return (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-2xl bg-secondary/25 border border-glass-border flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={avatarUrl}
                          name={displayName}
                          size={38}
                          border
                        />
                        <div>
                          <strong className="block text-sm font-semibold text-foreground">
                            {displayName}
                          </strong>
                          <span className="text-[11px] text-muted">
                            {new Date(c.contributed_at).toLocaleDateString()} · {c.method.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <span className="font-bold text-purple-600 text-sm">
                        {formatPHPFromCentavos(c.amount_centavos)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: How to Give Card */}
          <div className="glass-container p-6 flex flex-col justify-between border border-primary/20">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-3">
                <QrCode size={18} className="text-primary" />
                How to Send Contributions
              </h3>

              <div className="space-y-4 text-xs text-muted leading-relaxed">
                <div className="p-3 rounded-xl bg-secondary/40 border border-glass-border">
                  <strong className="block text-foreground font-semibold mb-1">Option 1: In-Person (Cash)</strong>
                  Hand your contribution to the Choir Treasurer or Director during Sunday rehearsal or post-Mass.
                </div>

                <div className="p-3 rounded-xl bg-secondary/40 border border-glass-border">
                  <strong className="block text-foreground font-semibold mb-1">Option 2: Electronic (GCash / Bank)</strong>
                  Please coordinate with the Choir Treasurer for the official GCash/Bank account details and share your screenshot for verified ledger recording.
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-glass-border flex items-center gap-2 text-[11px] text-muted">
              <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
              <span>All donations are audited and recorded in the official Choir Financial Ledger.</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SolicitationDetailPage;
