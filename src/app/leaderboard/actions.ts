'use server';

import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/supabase/user';

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all_time';
export type LeaderboardCategory = 'all' | 'lyrics' | 'recordings';

export interface LeaderboardMemberPartBreakdown {
  mass_part: string;
  display_name: string;
  count: number;
  points: number;
}

export interface LeaderboardEntry {
  rank: number;
  member_id: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  total_points: number;
  approved_count: number;
  most_recent_contribution: string | null;
  breakdown: LeaderboardMemberPartBreakdown[];
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  currentUserEntry?: LeaderboardEntry | null;
  currentUserRank?: number | null;
  period: LeaderboardPeriod;
  category: LeaderboardCategory;
  activeOnly: boolean;
  totalContributors: number;
  totalPointsAwarded: number;
  error?: string;
}

/**
 * Computes period boundary timestamp in ISO string format (Asia/Manila reference).
 */
function getPeriodStartDate(period: LeaderboardPeriod): string | null {
  if (period === 'all_time') return null;

  const now = new Date();
  
  if (period === 'weekly') {
    // Start of current week (Monday)
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek.toISOString();
  }

  if (period === 'monthly') {
    // Start of current calendar month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    return startOfMonth.toISOString();
  }

  return null;
}

/**
 * Fetch member leaderboard with period, category, and active-only filters.
 */
export async function getLeaderboardData(
  period: LeaderboardPeriod = 'all_time',
  activeOnly: boolean = true,
  category: LeaderboardCategory = 'all'
): Promise<LeaderboardResponse> {
  try {
    const currentProfile = await getProfile();
    const supabase = await createClient();

    const periodStart = getPeriodStartDate(period);

    // 1. Query approved song submissions
    let query = supabase
      .from('song_submissions')
      .select(`
        id, submitted_by, mass_part, points_awarded, reviewed_at,
        submitter:submitted_by ( id, full_name, role, avatar_url ),
        point_ref:mass_part ( display_name, sort_order )
      `)
      .eq('status', 'approved');

    if (periodStart) {
      query = query.gte('reviewed_at', periodStart);
    }

    const { data: rows, error: dbErr } = await query;

    if (dbErr) {
      console.error('Error fetching leaderboard submissions:', dbErr);
      return {
        entries: [],
        period,
        category,
        activeOnly,
        totalContributors: 0,
        totalPointsAwarded: 0,
        error: dbErr.message,
      };
    }

    // Filter by Category
    let filteredRows = rows || [];
    if (category === 'recordings') {
      filteredRows = filteredRows.filter((r: any) =>
        r.mass_part === 'audio_recording' ||
        r.mass_part === 'audio_recording_master' ||
        r.mass_part?.startsWith('audio_')
      );
    } else if (category === 'lyrics') {
      filteredRows = filteredRows.filter((r: any) =>
        r.mass_part !== 'audio_recording' &&
        r.mass_part !== 'audio_recording_master' &&
        !r.mass_part?.startsWith('audio_')
      );
    }

    // 2. Aggregate points by member
    const memberMap = new Map<string, {
      member_id: string;
      full_name: string;
      role: string;
      avatar_url: string | null;
      total_points: number;
      approved_count: number;
      most_recent_contribution: string | null;
      partsMap: Map<string, { mass_part: string; display_name: string; count: number; points: number }>;
    }>();

    let totalPoints = 0;

    filteredRows.forEach((r: any) => {
      const member = r.submitter;
      if (!member) return;

      // Filter active members if activeOnly is true
      if (activeOnly && ['pending', 'rejected'].includes(member.role)) {
        return;
      }

      const points = r.points_awarded || 0;
      totalPoints += points;

      if (!memberMap.has(member.id)) {
        memberMap.set(member.id, {
          member_id: member.id,
          full_name: member.full_name || 'Choir Member',
          role: member.role,
          avatar_url: member.avatar_url || null,
          total_points: 0,
          approved_count: 0,
          most_recent_contribution: null,
          partsMap: new Map(),
        });
      }

      const entry = memberMap.get(member.id)!;
      entry.total_points += points;
      entry.approved_count += 1;

      if (!entry.most_recent_contribution || (r.reviewed_at && r.reviewed_at > entry.most_recent_contribution)) {
        entry.most_recent_contribution = r.reviewed_at;
      }

      const partKey = r.mass_part;
      let partName = r.point_ref?.display_name;
      if (!partName) {
        if (partKey === 'audio_recording') partName = '🎵 Audio Practice Track';
        else if (partKey === 'audio_recording_master') partName = '⭐ Official Master Guide';
        else partName = r.mass_part;
      }

      if (!entry.partsMap.has(partKey)) {
        entry.partsMap.set(partKey, {
          mass_part: partKey,
          display_name: partName,
          count: 0,
          points: 0,
        });
      }

      const partData = entry.partsMap.get(partKey)!;
      partData.count += 1;
      partData.points += points;
    });

    // 3. Sort entries: total_points DESC, most_recent_contribution DESC, full_name ASC
    const sortedList = Array.from(memberMap.values()).sort((a, b) => {
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }
      const timeA = a.most_recent_contribution ? new Date(a.most_recent_contribution).getTime() : 0;
      const timeB = b.most_recent_contribution ? new Date(b.most_recent_contribution).getTime() : 0;
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return a.full_name.localeCompare(b.full_name);
    });

    // 4. Calculate standard competition rank (1, 1, 3...)
    let currentRank = 1;
    const entries: LeaderboardEntry[] = sortedList.map((item, index) => {
      if (index > 0 && item.total_points < sortedList[index - 1].total_points) {
        currentRank = index + 1;
      }

      const breakdown = Array.from(item.partsMap.values()).sort((x, y) => y.points - x.points);

      return {
        rank: currentRank,
        member_id: item.member_id,
        full_name: item.full_name,
        role: item.role,
        avatar_url: item.avatar_url,
        total_points: item.total_points,
        approved_count: item.approved_count,
        most_recent_contribution: item.most_recent_contribution,
        breakdown,
      };
    });

    const currentUserId = currentProfile?.id;
    const currentUserEntry = entries.find((e) => e.member_id === currentUserId) || null;

    return {
      entries,
      currentUserEntry,
      currentUserRank: currentUserEntry?.rank || null,
      period,
      category,
      activeOnly,
      totalContributors: entries.length,
      totalPointsAwarded: totalPoints,
    };
  } catch (err: any) {
    console.error('Unexpected error in getLeaderboardData:', err);
    return {
      entries: [],
      period,
      category,
      activeOnly,
      totalContributors: 0,
      totalPointsAwarded: 0,
      error: err.message,
    };
  }
}
