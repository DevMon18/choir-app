import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/supabase/user';
import { Navbar } from '@/components/Navbar';
import Link from 'next/link';
import { Sparkles, Calendar, Users, ArrowRight, HeartHandshake, CheckCircle2 } from 'lucide-react';
import { formatPHPFromCentavos } from '@/lib/financeUtils';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Choir Fundraising & Solicitations — Choir Collective',
  description: 'Support active choir projects, robes, sound equipment, and ministry campaigns.',
};

const SolicitationsPage = async () => {
  const profile = await getProfile();
  const supabase = await createClient();

  // Fetch all campaigns and contributions
  const [
    { data: solicitations },
    { data: contributions },
  ] = await Promise.all([
    supabase
      .from('solicitations')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('solicitations_contributions')
      .select('solicitation_id, amount_centavos, voided_at')
      .is('voided_at', null),
  ]);

  const allSolicitations = solicitations || [];
  const allContributions = contributions || [];

  // Group contributions by solicitation_id
  const raisedMap = new Map<string, { totalCentavos: number; count: number }>();
  allContributions.forEach((c) => {
    const prev = raisedMap.get(c.solicitation_id) || { totalCentavos: 0, count: 0 };
    raisedMap.set(c.solicitation_id, {
      totalCentavos: prev.totalCentavos + c.amount_centavos,
      count: prev.count + 1,
    });
  });

  const activeCampaigns = allSolicitations.filter((s) => s.status === 'active');
  const closedCampaigns = allSolicitations.filter((s) => s.status !== 'active');

  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1 w-[500px] h-[500px]" />
      <div className="bg-orb bg-orb-2 w-[400px] h-[400px]" />

      {profile && <Navbar profile={profile} />}

      <main className="flex-1 py-4 sm:py-8 px-3 sm:px-6 max-w-[1100px] mx-auto w-full pb-28 sm:pb-16">
        {/* Header */}
        <div className="mb-6 sm:mb-10 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1 rounded-full mb-2 sm:mb-3">
            <HeartHandshake size={14} /> Ministry Projects & Solicitations
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Support Our Choir Ministry
          </h1>
          <p className="text-muted text-xs sm:text-base mt-2">
            Every contribution directly funds our liturgical vestments, music scores, instruments, and parish outreach missions.
          </p>
        </div>

        {/* Active Campaigns Grid */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Sparkles size={20} className="text-purple-600" />
              Active Campaigns ({activeCampaigns.length})
            </h2>
          </div>

          {activeCampaigns.length === 0 ? (
            <div className="glass-container text-center py-12 text-muted">
              <p className="text-base font-semibold">No active campaigns at the moment.</p>
              <p className="text-xs mt-1">Check back soon for new choir projects and solicitations.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeCampaigns.map((camp) => {
                const stats = raisedMap.get(camp.id) || { totalCentavos: 0, count: 0 };
                const pct = camp.target_amount_centavos > 0
                  ? Math.min(100, Math.round((stats.totalCentavos / camp.target_amount_centavos) * 100))
                  : 0;

                return (
                  <Link
                    key={camp.id}
                    href={`/solicitations/${camp.id}`}
                    className="glass-container p-6 flex flex-col justify-between hover:shadow-xl transition-all duration-300 border border-purple-200/50 group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="badge badge-approved !bg-purple-100 !text-purple-800">
                          Active Campaign
                        </span>
                        {camp.end_date && (
                          <span className="text-[11px] font-semibold text-muted flex items-center gap-1">
                            <Calendar size={12} />
                            Due {new Date(camp.end_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                        {camp.title}
                      </h3>
                      <p className="text-xs text-muted line-clamp-3 mt-2 leading-relaxed">
                        {camp.description || 'Join us in supporting this special choir initiative.'}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-glass-border">
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-lg font-extrabold text-purple-600">
                          {formatPHPFromCentavos(stats.totalCentavos)}
                        </span>
                        <span className="text-xs text-muted">
                          Goal: {formatPHPFromCentavos(camp.target_amount_centavos)}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-2">
                        <div
                          className="bg-purple-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>{pct}% funded</span>
                        <span className="flex items-center gap-1">
                          <Users size={12} /> {stats.count} contributors
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-end text-xs font-bold text-primary group-hover:translate-x-1 transition-transform">
                        View Details & Contribute <ArrowRight size={14} className="ml-1" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Completed / Past Campaigns */}
        {closedCampaigns.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600" />
              Past & Completed Projects ({closedCampaigns.length})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {closedCampaigns.map((camp) => {
                const stats = raisedMap.get(camp.id) || { totalCentavos: 0, count: 0 };
                return (
                  <Link
                    key={camp.id}
                    href={`/solicitations/${camp.id}`}
                    className="p-4 rounded-2xl bg-secondary/30 hover:bg-secondary/50 border border-glass-border transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-muted capitalize">{camp.status}</span>
                        <span className="text-emerald-600 font-bold">
                          {formatPHPFromCentavos(stats.totalCentavos)} raised
                        </span>
                      </div>
                      <strong className="text-sm font-semibold text-foreground">{camp.title}</strong>
                    </div>
                    <span className="text-xs text-primary font-semibold mt-3 self-end">View archive →</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SolicitationsPage;
