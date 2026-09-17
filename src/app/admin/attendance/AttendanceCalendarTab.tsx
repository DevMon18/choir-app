'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  UserX,
  UserCheck,
  Clock,
  FileText,
  Copy,
  Check,
  Sparkles,
  Search,
  Filter,
  AlertTriangle,
  Users,
  Edit3,
  Plus,
} from 'lucide-react';
import { useToast } from '@/components/Toast';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'super_admin' | 'director' | 'treasurer' | 'secretary' | 'member' | 'pending' | 'rejected';
  voice_part?: string | null;
  avatar_url?: string | null;
  created_at: string;
}

interface AttendanceSession {
  id: string;
  name: string;
  date: string;
  type: 'rehearsal' | 'performance' | 'mass' | 'special_event';
  created_at: string;
}

interface AttendanceRecord {
  id: string;
  session_id: string;
  profile_id: string;
  status: 'present' | 'absent' | 'excused' | 'late';
  created_at: string;
}

interface AttendanceCalendarTabProps {
  roster: Profile[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  onSelectSessionForTally: (session: AttendanceSession) => void;
  onCreateSessionForDate: (date: string, type: 'rehearsal' | 'performance' | 'mass' | 'special_event') => void;
}

const TYPE_CONFIG = {
  mass: { label: 'Mass', icon: '⛪', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: '#059669' },
  rehearsal: { label: 'Rehearsal', icon: '🎵', bg: 'bg-amber-50 text-amber-800 border-amber-200', dot: '#d97706' },
  performance: { label: 'Performance', icon: '🎭', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200', dot: '#6366f1' },
  special_event: { label: 'Special Event', icon: '⭐', bg: 'bg-rose-50 text-rose-800 border-rose-200', dot: '#e11d48' },
};

const VOICE_ORDER = ['Soprano', 'Alto', 'Tenor', 'Bass', 'Unassigned'];

export const AttendanceCalendarTab: React.FC<AttendanceCalendarTabProps> = ({
  roster,
  sessions,
  records,
  onSelectSessionForTally,
  onCreateSessionForDate,
}) => {
  const { addToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'absent' | 'present' | 'late' | 'excused' | 'all'>('absent');
  const [searchQuery, setSearchQuery] = useState('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Compute days for the month grid
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun

  const daysArray = useMemo(() => {
    const arr = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      arr.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      arr.push({ day, dateStr });
    }
    return arr;
  }, [year, month, daysInMonth, firstDayOfWeek]);

  // Group sessions by date
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, AttendanceSession[]>();
    sessions.forEach((s) => {
      const existing = map.get(s.date) || [];
      existing.push(s);
      map.set(s.date, existing);
    });
    return map;
  }, [sessions]);

  // Group records by session_id
  const recordsBySession = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    records.forEach((r) => {
      const existing = map.get(r.session_id) || [];
      existing.push(r);
      map.set(r.session_id, existing);
    });
    return map;
  }, [records]);

  // Sessions on the currently selected date
  const daySessions = useMemo(() => {
    return sessionsByDate.get(selectedDateStr) || [];
  }, [sessionsByDate, selectedDateStr]);

  // Currently active session on selected date
  const activeSession = useMemo(() => {
    if (daySessions.length === 0) return null;
    if (selectedSessionId) {
      const found = daySessions.find((s) => s.id === selectedSessionId);
      if (found) return found;
    }
    return daySessions[0];
  }, [daySessions, selectedSessionId]);

  // Records for the active session
  const activeSessionRecords = useMemo(() => {
    if (!activeSession) return [];
    return recordsBySession.get(activeSession.id) || [];
  }, [activeSession, recordsBySession]);

  // Calculate stats for active session
  const sessionStats = useMemo(() => {
    if (!activeSession) return null;

    const recordMap = new Map<string, 'present' | 'absent' | 'excused' | 'late'>();
    activeSessionRecords.forEach((r) => {
      recordMap.set(r.profile_id, r.status);
    });

    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    const membersWithStatus = roster.map((member) => {
      const status = recordMap.get(member.id) || 'absent';
      if (status === 'present') present++;
      else if (status === 'absent') absent++;
      else if (status === 'late') late++;
      else if (status === 'excused') excused++;

      return {
        ...member,
        status,
      };
    });

    const total = roster.length;
    const attendedCount = present + late;
    const rate = total > 0 ? Math.round((attendedCount / total) * 100) : 0;

    // Group absentees by voice part
    const voiceGroups: Record<string, typeof membersWithStatus> = {
      Soprano: [],
      Alto: [],
      Tenor: [],
      Bass: [],
      Unassigned: [],
    };

    membersWithStatus.forEach((m) => {
      const part = m.voice_part && VOICE_ORDER.includes(m.voice_part) ? m.voice_part : 'Unassigned';
      if (!voiceGroups[part]) voiceGroups[part] = [];
      voiceGroups[part].push(m);
    });

    const voiceSummary = VOICE_ORDER.map((voice) => {
      const group = voiceGroups[voice] || [];
      const vPresent = group.filter((m) => m.status === 'present' || m.status === 'late').length;
      const vAbsent = group.filter((m) => m.status === 'absent').length;
      const vTotal = group.length;
      return {
        voice,
        present: vPresent,
        absent: vAbsent,
        total: vTotal,
        rate: vTotal > 0 ? Math.round((vPresent / vTotal) * 100) : 0,
      };
    }).filter((v) => v.total > 0);

    return {
      total,
      present,
      absent,
      late,
      excused,
      rate,
      membersWithStatus,
      voiceSummary,
      voiceGroups,
    };
  }, [activeSession, activeSessionRecords, roster]);

  // Consecutive absence tracking across recent 4 sessions
  const consecutiveAbsencesMap = useMemo(() => {
    const map = new Map<string, number>();
    const sortedSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
    const recentSessions = sortedSessions.slice(0, 5);

    if (recentSessions.length === 0) return map;

    roster.forEach((member) => {
      let streak = 0;
      for (const s of recentSessions) {
        const sRecs = recordsBySession.get(s.id) || [];
        const mRec = sRecs.find((r) => r.profile_id === member.id);
        const status = mRec ? mRec.status : 'absent';
        if (status === 'absent') {
          streak++;
        } else {
          break;
        }
      }
      if (streak >= 2) {
        map.set(member.id, streak);
      }
    });

    return map;
  }, [sessions, recordsBySession, roster]);

  // Filtered members list for day inspector
  const filteredMembers = useMemo(() => {
    if (!sessionStats) return [];
    let list = sessionStats.membersWithStatus;

    if (statusFilter !== 'all') {
      list = list.filter((m) => m.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.full_name.toLowerCase().includes(q) ||
          (m.voice_part || '').toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q)
      );
    }

    // Sort by voice part, then name
    return list.sort((a, b) => {
      const aIdx = VOICE_ORDER.indexOf(a.voice_part || 'Unassigned');
      const bIdx = VOICE_ORDER.indexOf(b.voice_part || 'Unassigned');
      if (aIdx !== bIdx) return aIdx - bIdx;
      return a.full_name.localeCompare(b.full_name);
    });
  }, [sessionStats, statusFilter, searchQuery]);

  // Copy formatted absentee summary for group chats
  const handleCopySummary = () => {
    if (!activeSession || !sessionStats) return;

    const absentees = sessionStats.membersWithStatus.filter((m) => m.status === 'absent');
    const lates = sessionStats.membersWithStatus.filter((m) => m.status === 'late');
    const dateFormatted = new Date(activeSession.date + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    let text = `📅 *CHOIR ATTENDANCE REPORT*\n`;
    text += `📌 *Session:* ${activeSession.name}\n`;
    text += `🗓️ *Date:* ${dateFormatted}\n`;
    text += `📊 *Summary:* ${sessionStats.present + sessionStats.late}/${sessionStats.total} Present (${sessionStats.rate}%) · 🚨 ${sessionStats.absent} Absent\n\n`;

    text += `👥 *VOICE SECTION BREAKDOWN:*\n`;
    sessionStats.voiceSummary.forEach((v) => {
      text += `• ${v.voice}: ${v.present}/${v.total} (${v.absent > 0 ? `🚨 ${v.absent} absent` : '✅ Complete'})\n`;
    });

    if (absentees.length > 0) {
      text += `\n🚨 *ABSENT MEMBERS (${absentees.length}):*\n`;
      absentees.forEach((m) => {
        text += `- ${m.full_name} (${m.voice_part || 'Choir Member'})\n`;
      });
    } else {
      text += `\n🎉 *Perfect Attendance! No Absences.*\n`;
    }

    if (lates.length > 0) {
      text += `\n⏱️ *LATE (${lates.length}):*\n`;
      lates.forEach((m) => {
        text += `- ${m.full_name} (${m.voice_part || 'Choir Member'})\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    addToast({
      type: 'success',
      title: 'Report Copied to Clipboard!',
      message: 'Ready to paste into Choir Group Chat / Messenger.',
      duration: 3500,
    });
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDateStr(now.toISOString().split('T')[0]);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col gap-6">
      {/* Calendar Top Navigation Header */}
      <div className="glass-container p-4 sm:p-5 flex items-center justify-between flex-wrap gap-4 border border-glass-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shadow-sm">
            <CalendarIcon size={20} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-primary m-0 tracking-tight flex items-center gap-2">
              <span>{monthName}</span>
            </h2>
            <p className="text-xs text-muted m-0 mt-0.5">
              Select any date to view absent members, section tallies, and copy group chat reports.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 rounded-xl bg-white border border-border hover:bg-black/5 text-muted hover:text-foreground transition-all cursor-pointer"
            aria-label="Previous Month"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            type="button"
            onClick={handleToday}
            className="py-1.5 px-3.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20 text-xs font-bold transition-all cursor-pointer"
          >
            Today
          </button>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 rounded-xl bg-white border border-border hover:bg-black/5 text-muted hover:text-foreground transition-all cursor-pointer"
            aria-label="Next Month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Main Grid + Inspector Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Monthly Calendar Grid (Left / Top) */}
        <div className="lg:col-span-7 xl:col-span-7 flex flex-col gap-3">
          <div className="glass-container !p-3 sm:!p-5 border border-glass-border shadow-card overflow-hidden">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                <div
                  key={day}
                  className={`text-[0.72rem] sm:text-xs font-bold uppercase tracking-wider py-1.5 ${
                    idx === 0 ? 'text-amber-600' : 'text-muted'
                  }`}
                >
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.charAt(0)}</span>
                </div>
              ))}
            </div>

            {/* Calendar Days Matrix */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {daysArray.map((item, index) => {
                if (!item) {
                  return <div key={`empty-${index}`} className="min-h-[64px] sm:min-h-[88px] rounded-xl bg-black/[0.015]" />;
                }

                const { day, dateStr } = item;
                const isSelected = selectedDateStr === dateStr;
                const isToday = todayStr === dateStr;
                const daySessionsList = sessionsByDate.get(dateStr) || [];
                const hasSession = daySessionsList.length > 0;

                // Compute quick day attendance stats
                let totalAbsentInDay = 0;
                let avgRateInDay = 0;

                if (hasSession) {
                  const dayRecs = recordsBySession.get(daySessionsList[0].id) || [];
                  const presentCount = dayRecs.filter((r) => r.status === 'present' || r.status === 'late').length;
                  totalAbsentInDay = dayRecs.filter((r) => r.status === 'absent').length;
                  if (dayRecs.length === 0) {
                    totalAbsentInDay = roster.length;
                  }
                  avgRateInDay = roster.length > 0 ? Math.round((presentCount / roster.length) * 100) : 0;
                }

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => {
                      setSelectedDateStr(dateStr);
                      if (daySessionsList.length > 0) {
                        setSelectedSessionId(daySessionsList[0].id);
                      } else {
                        setSelectedSessionId(null);
                      }
                    }}
                    className={`min-h-[68px] sm:min-h-[92px] p-1.5 sm:p-2 rounded-xl text-left transition-all border flex flex-col justify-between cursor-pointer relative ${
                      isSelected
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-md z-10'
                        : hasSession
                        ? 'border-border/80 bg-white/90 hover:bg-white hover:border-primary/40 shadow-xs'
                        : 'border-border/40 bg-white/40 hover:bg-white/70 text-muted'
                    }`}
                  >
                    {/* Day Number + Today Marker */}
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs sm:text-sm font-black w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday
                            ? 'bg-primary text-white shadow-xs'
                            : isSelected
                            ? 'text-primary font-black'
                            : 'text-foreground font-semibold'
                        }`}
                      >
                        {day}
                      </span>

                      {hasSession && (
                        <span
                          className={`w-2 h-2 rounded-full hidden sm:inline-block ${
                            avgRateInDay >= 90
                              ? 'bg-emerald-500'
                              : avgRateInDay >= 75
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                        />
                      )}
                    </div>

                    {/* Session Indicators */}
                    {hasSession ? (
                      <div className="flex flex-col gap-1 w-full mt-1">
                        {daySessionsList.slice(0, 2).map((s) => {
                          const conf = TYPE_CONFIG[s.type] || TYPE_CONFIG.mass;
                          return (
                            <div
                              key={s.id}
                              className={`text-[0.65rem] sm:text-[0.7rem] font-bold px-1.5 py-0.5 rounded-md border truncate flex items-center gap-1 ${conf.bg}`}
                            >
                              <span className="text-[0.68rem]">{conf.icon}</span>
                              <span className="truncate hidden sm:inline">{s.name.split(' — ')[0] || s.name}</span>
                              <span className="sm:hidden font-extrabold">{conf.label.charAt(0)}</span>
                            </div>
                          );
                        })}

                        {/* Absentee Count Warning Badge */}
                        {totalAbsentInDay > 0 ? (
                          <div className="text-[0.62rem] sm:text-[0.68rem] font-black text-rose-700 bg-rose-100/90 py-0.5 px-1.5 rounded-md flex items-center justify-between">
                            <span className="flex items-center gap-0.5">
                              <span>🚨</span>
                              <span className="hidden sm:inline">Absent:</span>
                            </span>
                            <span>{totalAbsentInDay}</span>
                          </div>
                        ) : (
                          <div className="text-[0.62rem] sm:text-[0.68rem] font-bold text-emerald-700 bg-emerald-100/90 py-0.5 px-1.5 rounded-md text-center">
                            <span>100% ✓</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full flex justify-end">
                        <span className="text-[0.65rem] text-muted/50 font-medium sm:block hidden">No session</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Legend Bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-muted px-2 py-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>90%+ Present</span>
              </span>
              <span className="flex items-center gap-1 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>75-89% Present</span>
              </span>
              <span className="flex items-center gap-1 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>&lt;75% Attendance</span>
              </span>
            </div>
            <span className="text-[0.7rem] text-muted italic">Click any day to inspect absentees</span>
          </div>
        </div>

        {/* Interactive Day Inspector & Absentee Spotlight (Right / Bottom) */}
        <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-4">
          {activeSession && sessionStats ? (
            <div className="glass-container !p-5 border border-primary/20 shadow-card bg-white/95 flex flex-col gap-4">
              {/* Selected Day Header */}
              <div className="flex items-start justify-between flex-wrap gap-3 pb-3 border-b border-border/70">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary mb-1">
                    <CalendarIcon size={14} />
                    <span>
                      {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-foreground m-0 leading-tight">
                    {activeSession.name}
                  </h3>
                  <span className="text-xs text-muted font-medium capitalize mt-0.5 block">
                    Type: {activeSession.type.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="btn btn-secondary !py-1.5 !px-3 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    title="Copy formatted attendance & absence list for Group Chat"
                  >
                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{copied ? 'Copied!' : 'Copy Report'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectSessionForTally(activeSession)}
                    className="btn btn-primary !py-1.5 !px-3.5 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <Edit3 size={14} />
                    <span>Edit Tally</span>
                  </button>
                </div>
              </div>

              {/* Multiple Sessions Tab Switcher on Same Day */}
              {daySessions.length > 1 && (
                <div className="flex gap-1.5 bg-black/5 p-1 rounded-xl overflow-x-auto">
                  {daySessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSessionId(s.id)}
                      className={`py-1 px-3 rounded-lg text-xs font-bold border-0 cursor-pointer whitespace-nowrap transition-all ${
                        activeSession.id === s.id
                          ? 'bg-white text-primary shadow-xs'
                          : 'bg-transparent text-muted hover:text-foreground'
                      }`}
                    >
                      {s.name.split(' — ')[0] || s.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Day Attendance Overview Counters */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/60">
                  <span className="text-lg sm:text-xl font-black text-emerald-700 block">
                    {sessionStats.present}
                  </span>
                  <span className="text-[0.65rem] font-bold text-emerald-800 uppercase tracking-wider">
                    Present
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 shadow-xs">
                  <span className="text-lg sm:text-xl font-black text-rose-700 block">
                    {sessionStats.absent}
                  </span>
                  <span className="text-[0.65rem] font-black text-rose-900 uppercase tracking-wider">
                    🚨 Absent
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/60">
                  <span className="text-lg sm:text-xl font-black text-amber-700 block">
                    {sessionStats.late}
                  </span>
                  <span className="text-[0.65rem] font-bold text-amber-800 uppercase tracking-wider">
                    Late
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200/70">
                  <span className="text-lg sm:text-xl font-black text-slate-700 block">
                    {sessionStats.rate}%
                  </span>
                  <span className="text-[0.65rem] font-bold text-slate-800 uppercase tracking-wider">
                    Turnout
                  </span>
                </div>
              </div>

              {/* Voice Section Balance Matrix */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-border/80 flex flex-col gap-2">
                <span className="text-xs font-bold text-muted uppercase tracking-wider flex items-center justify-between">
                  <span>Voice Section Attendance</span>
                  <span className="text-[0.68rem] text-primary font-semibold">
                    {sessionStats.present + sessionStats.late} / {sessionStats.total} total members
                  </span>
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {sessionStats.voiceSummary.map((v) => {
                    const isAllPresent = v.absent === 0;
                    return (
                      <div
                        key={v.voice}
                        className={`p-2 rounded-lg border text-xs flex flex-col gap-0.5 ${
                          isAllPresent
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                            : 'bg-white border-border text-foreground'
                        }`}
                      >
                        <span className="font-extrabold text-[0.72rem] text-muted">{v.voice}</span>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="font-black text-sm">
                            {v.present}/{v.total}
                          </span>
                          {v.absent > 0 ? (
                            <span className="text-[0.65rem] font-bold text-rose-700 bg-rose-100 py-0.2 px-1.5 rounded-full">
                              -{v.absent}
                            </span>
                          ) : (
                            <span className="text-[0.65rem] font-bold text-emerald-700 bg-emerald-100 py-0.2 px-1.5 rounded-full">
                              ✓ All
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Filter Tabs & Search for Day Roll Call */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {/* Status Toggle Pills */}
                  <div className="flex bg-black/6 p-1 rounded-xl gap-1">
                    {(
                      [
                        { id: 'absent', label: `🚨 Absent (${sessionStats.absent})` },
                        { id: 'present', label: `✓ Present (${sessionStats.present})` },
                        { id: 'late', label: `⏱️ Late (${sessionStats.late})` },
                        { id: 'all', label: `All (${sessionStats.total})` },
                      ] as const
                    ).map((tab) => {
                      const active = statusFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setStatusFilter(tab.id)}
                          className={`py-1 px-2.5 rounded-lg text-[0.68rem] sm:text-xs font-bold border-0 cursor-pointer transition-all ${
                            active
                              ? 'bg-white text-primary shadow-xs'
                              : 'bg-transparent text-muted hover:text-foreground'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Member Search */}
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                  />
                  <input
                    type="text"
                    placeholder="Search member in this session..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field !py-1.5 !pl-8 text-xs bg-white w-full"
                  />
                </div>
              </div>

              {/* Members Roll Call List */}
              <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
                {filteredMembers.length === 0 ? (
                  <div className="py-8 text-center text-muted">
                    {statusFilter === 'absent' ? (
                      <div>
                        <span className="text-2xl mb-1 block">🎉</span>
                        <p className="text-xs font-bold text-foreground mb-0.5">No Absentees!</p>
                        <p className="text-[0.7rem] m-0">Everyone was present or excused for this session.</p>
                      </div>
                    ) : (
                      <p className="text-xs m-0">No members match the current filter.</p>
                    )}
                  </div>
                ) : (
                  filteredMembers.map((member) => {
                    const isAbsent = member.status === 'absent';
                    const isPresent = member.status === 'present';
                    const isLate = member.status === 'late';
                    const isExcused = member.status === 'excused';
                    const missedStreak = consecutiveAbsencesMap.get(member.id);

                    return (
                      <div
                        key={member.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                          isAbsent
                            ? 'bg-rose-50/70 border-rose-200'
                            : isPresent
                            ? 'bg-white border-border/70'
                            : isLate
                            ? 'bg-amber-50/50 border-amber-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Avatar */}
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden border ${
                              isAbsent
                                ? 'bg-rose-200 text-rose-800 border-rose-300'
                                : 'bg-primary/10 text-primary border-border'
                            }`}
                          >
                            {member.avatar_url ? (
                              <Image
                                src={member.avatar_url}
                                alt={member.full_name}
                                width={32}
                                height={32}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>{member.full_name.charAt(0).toUpperCase()}</span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-foreground truncate">
                                {member.full_name}
                              </span>

                              {/* Consecutive Absences Warning Badge */}
                              {isAbsent && missedStreak && missedStreak >= 2 && (
                                <span className="text-[0.62rem] font-black text-rose-800 bg-rose-200/90 py-0.2 px-1.5 rounded-full border border-rose-300 flex items-center gap-0.5">
                                  <AlertTriangle size={10} />
                                  <span>{missedStreak} missed in a row</span>
                                </span>
                              )}
                            </div>

                            <span className="text-[0.68rem] text-muted block capitalize">
                              {member.voice_part || 'Choir Member'} · {member.role.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        {/* Status Chip */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isAbsent ? (
                            <span className="text-xs font-black text-rose-800 bg-rose-100 py-1 px-2.5 rounded-full border border-rose-300 flex items-center gap-1">
                              <UserX size={12} />
                              <span>Absent</span>
                            </span>
                          ) : isPresent ? (
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 py-1 px-2.5 rounded-full border border-emerald-300 flex items-center gap-1">
                              <UserCheck size={12} />
                              <span>Present</span>
                            </span>
                          ) : isLate ? (
                            <span className="text-xs font-bold text-amber-800 bg-amber-100 py-1 px-2.5 rounded-full border border-amber-300 flex items-center gap-1">
                              <Clock size={12} />
                              <span>Late</span>
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-slate-800 bg-slate-200 py-1 px-2.5 rounded-full border border-slate-300 flex items-center gap-1">
                              <FileText size={12} />
                              <span>Excused</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* No session on selected date */
            <div className="glass-container !p-8 text-center border border-border/80 flex flex-col items-center justify-center min-h-[320px]">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl mb-3 shadow-xs">
                📅
              </div>
              <h3 className="text-base font-bold text-foreground mb-1">
                No Attendance Session on{' '}
                {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h3>
              <p className="text-xs text-muted max-w-xs mx-auto mb-5">
                There are no recorded sessions for this date. You can start a new roll call now.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
                <button
                  type="button"
                  onClick={() => onCreateSessionForDate(selectedDateStr, 'mass')}
                  className="btn btn-primary !py-2 !px-4 text-xs font-bold flex-1 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus size={14} />
                  <span>+ Start Mass Session</span>
                </button>
                <button
                  type="button"
                  onClick={() => onCreateSessionForDate(selectedDateStr, 'rehearsal')}
                  className="btn btn-secondary !py-2 !px-4 text-xs font-bold flex-1 flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>+ Rehearsal</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
