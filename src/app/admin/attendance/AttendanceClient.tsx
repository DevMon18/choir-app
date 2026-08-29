'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Navbar } from '@/components/Navbar';
import { createAttendanceSession, recordAttendance, getOrCreateSessionForDate } from './actions';
import { useToast } from '@/components/Toast';
import gsap from 'gsap';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'super_admin' | 'director' | 'treasurer' | 'secretary' | 'member' | 'pending' | 'rejected';
  voice_part?: string | null;
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

interface AttendanceClientProps {
  currentUserProfile: Profile;
  roster: Profile[];
  initialSessions: AttendanceSession[];
  initialRecords: AttendanceRecord[];
}

const STATUS_ORDER: Array<'present' | 'absent' | 'late' | 'excused'> = ['absent', 'present', 'late', 'excused'];

const STATUS_CONFIG = {
  present: { label: 'Present', color: '#0b4d24', bg: 'rgba(11,77,36,0.1)', dot: '#0b4d24', icon: '✓' },
  absent:  { label: 'Absent',  color: '#9f1c1c', bg: 'rgba(159,28,28,0.07)', dot: '#9f1c1c', icon: '✕' },
  late:    { label: 'Late',    color: '#b45309', bg: 'rgba(197,160,89,0.12)', dot: '#c5a059', icon: '⏱' },
  excused: { label: 'Excused', color: '#5c675e', bg: 'rgba(92,103,94,0.07)', dot: '#9ca3af', icon: '~' },
};

const TYPE_LABELS: Record<string, string> = {
  rehearsal: '🎵 Rehearsal',
  performance: '🎭 Performance',
  mass: '⛪ Mass',
  special_event: '⭐ Special Event',
};

export const AttendanceClient = ({
  currentUserProfile,
  roster,
  initialSessions,
  initialRecords,
}: AttendanceClientProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  // Session + record state
  const [sessions, setSessions] = useState<AttendanceSession[]>(initialSessions);
  const [records, setRecords] = useState<AttendanceRecord[]>(initialRecords);

  // Sync state with server-side props on router.refresh()
  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  // Filter out any duplicate sessions to prevent console key errors
  const uniqueSessions = useMemo(() => {
    return Array.from(new Map(sessions.map((s) => [s.id, s])).values());
  }, [sessions]);

  // One-tap date/type picker
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedType, setSelectedType] = useState<'rehearsal' | 'performance' | 'mass' | 'special_event'>('mass');
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(
    initialSessions.length > 0 ? initialSessions[0] : null
  );

  // Per-member attendance map for active session
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'excused' | 'late'>>({});

  // UI
  const [saving, setSaving] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Legacy form state (for "View All Sessions" mode)
  const [viewMode, setViewMode] = useState<'tally' | 'history'>('tally');
  const [selectedSessionId, setSelectedSessionId] = useState(
    initialSessions.length > 0 ? initialSessions[0].id : ''
  );

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.content-anim-item', { opacity: 0, y: 14, duration: 0.35, stagger: 0.035 });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  // Sync attendance when active session or records change
  useEffect(() => {
    if (!activeSession) { setAttendance({}); return; }
    const sessionRecords = records.filter((r) => r.session_id === activeSession.id);
    const map: Record<string, 'present' | 'absent' | 'excused' | 'late'> = {};
    roster.forEach((m) => {
      const rec = sessionRecords.find((r) => r.profile_id === m.id);
      map[m.id] = rec ? rec.status : 'absent';
    });
    setAttendance(map);
  }, [activeSession, records, roster]);

  // Also sync for history view
  useEffect(() => {
    if (viewMode !== 'history' || !selectedSessionId) return;
    const session = sessions.find((s) => s.id === selectedSessionId);
    if (session) setActiveSession(session);
  }, [selectedSessionId, sessions, viewMode]);

  // Helper to compute recent Sunday
  const getRecentSunday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day;
    const sun = new Date(d.setDate(diff));
    return sun.toISOString().split('T')[0];
  };

  // Quick dates selector list
  const quickDates = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const sunday = getRecentSunday();
    
    const items: Array<{
      label: string;
      date: string;
      type: 'rehearsal' | 'performance' | 'mass' | 'special_event';
    }> = [
      { label: 'Today 📅', date: today, type: 'mass' },
      { label: 'Yesterday 📅', date: yesterday, type: 'mass' },
      { label: 'Last Sunday ⛪', date: sunday, type: 'mass' },
    ];

    // Add up to 3 recent actual sessions from existing list
    sessions.slice(0, 3).forEach((s) => {
      if (!items.find((i) => i.date === s.date)) {
        items.push({
          label: `${s.name.split(' - ')[0] || s.name} 🗓`,
          date: s.date,
          type: s.type,
        });
      }
    });

    return items;
  }, [sessions]);

  const loadOrCreateSession = async (date: string, type: 'rehearsal' | 'performance' | 'mass' | 'special_event') => {
    setLoadingSession(true);
    const result = await getOrCreateSessionForDate(date, type);
    setLoadingSession(false);

    if (result?.error) {
      addToast({ type: 'error', title: 'Session Error', message: result.error });
      return;
    }
    if (result?.session) {
      if (result.created) {
        setSessions((prev) => [result.session, ...prev]);
      } else if (!sessions.find((s) => s.id === result.session.id)) {
        setSessions((prev) => [result.session, ...prev]);
      }
      setActiveSession(result.session);
      addToast({
        type: result.created ? 'success' : 'info',
        title: result.created ? 'Session Created' : 'Session Loaded',
        message: result.session.name,
        duration: 3000,
      });
    }
  };

  // Load or create session for selected date+type
  const handleLoadDate = async () => {
    await loadOrCreateSession(selectedDate, selectedType);
  };

  // Toggle present/absent directly on tapping the member card
  const handleTapMember = (memberId: string) => {
    setAttendance((prev) => {
      const current = prev[memberId] || 'absent';
      const next = current === 'present' ? 'absent' : 'present';
      return { ...prev, [memberId]: next };
    });
  };

  const handleSaveAttendance = async () => {
    if (!activeSession) return;
    setSaving(true);

    const upsertRecords = Object.entries(attendance).map(([profileId, status]) => ({ profileId, status }));
    const result = await recordAttendance({ sessionId: activeSession.id, records: upsertRecords });

    setSaving(false);
    if (result?.error) {
      addToast({ type: 'error', title: 'Save Failed', message: result.error });
    } else {
      addToast({ type: 'success', title: 'Attendance Saved!', message: `${presentCount} present · ${absentCount} absent · ${lateCount} late` });
      setRecords((prev) => {
        const other = prev.filter((r) => r.session_id !== activeSession.id);
        const newRecs: AttendanceRecord[] = upsertRecords.map((rec) => ({
          id: Math.random().toString(),
          session_id: activeSession.id,
          profile_id: rec.profileId,
          status: rec.status,
          created_at: new Date().toISOString(),
        }));
        return [...other, ...newRecs];
      });
    }
  };

  const filteredRoster = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return roster.filter(
      (m) => !q || m.full_name.toLowerCase().includes(q) || (m.voice_part || '').toLowerCase().includes(q)
    );
  }, [roster, searchQuery]);

  const presentCount = Object.values(attendance).filter((s) => s === 'present').length;
  const absentCount  = Object.values(attendance).filter((s) => s === 'absent').length;
  const lateCount    = Object.values(attendance).filter((s) => s === 'late').length;
  const excusedCount = Object.values(attendance).filter((s) => s === 'excused').length;

  return (
    <div ref={containerRef} className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1 w-[500px] h-[500px]" />
      <div className="bg-orb bg-orb-2 w-[400px] h-[400px]" />

      <Navbar profile={currentUserProfile} />

      <main className="admin-content-full">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="content-anim-item flex justify-between items-end flex-wrap gap-3">
            <div>
              <h2 className="text-2xl sm:text-[1.75rem] font-bold mb-1.5 text-primary">Attendance Tally</h2>
              <p className="text-muted text-sm sm:text-base">Tap a member card to cycle their status. Save when done.</p>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setViewMode('tally')}
                className={`btn !py-2 !px-4 text-xs sm:text-sm ${viewMode === 'tally' ? 'btn-primary' : 'btn-secondary'}`}
              >
                📋 Quick Tally
              </button>
              <button
                onClick={() => setViewMode('history')}
                className={`btn !py-2 !px-4 text-xs sm:text-sm ${viewMode === 'history' ? 'btn-primary' : 'btn-secondary'}`}
              >
                📅 All Sessions
              </button>
            </div>
          </div>

          {viewMode === 'tally' ? (
            <>
              {/* Date + Type Picker */}
              <div className="glass-container content-anim-item p-6">
                <h3 className="text-base sm:text-[1.05rem] font-semibold text-primary mb-3">
                  📅 Quick Select Date & Session Type
                </h3>
                
                {/* Quick Dates Badges */}
                <div className="flex gap-2 flex-wrap mb-5">
                  {quickDates.map((item) => {
                    const isSelected = selectedDate === item.date && selectedType === item.type;
                    return (
                      <button
                        key={item.date + '-' + item.label}
                        onClick={() => {
                          setSelectedDate(item.date);
                          setSelectedType(item.type);
                          loadOrCreateSession(item.date, item.type);
                        }}
                        className={`btn !py-1.5 !px-3.5 text-xs !rounded-full font-semibold cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-primary text-white border-primary'
                            : 'bg-primary/5 text-primary border-primary/15 hover:bg-primary/10'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-3 flex-wrap items-end border-t border-glass-border pt-4">
                  <div className="flex-1 min-w-[160px]">
                    <label className="input-label" htmlFor="tallyDate">Or Custom Date</label>
                    <input
                      id="tallyDate"
                      type="date"
                      className="input-field"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        if (e.target.value) {
                          loadOrCreateSession(e.target.value, selectedType);
                        }
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="input-label" htmlFor="tallyType">Session Type</label>
                    <select
                      id="tallyType"
                      className="input-field bg-white"
                      value={selectedType}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setSelectedType(val);
                        loadOrCreateSession(selectedDate, val);
                      }}
                    >
                      <option value="mass">⛪ Mass</option>
                      <option value="rehearsal">🎵 Rehearsal</option>
                      <option value="performance">🎭 Performance</option>
                      <option value="special_event">⭐ Special Event</option>
                    </select>
                  </div>
                  <button
                    onClick={handleLoadDate}
                    disabled={loadingSession}
                    className="btn btn-primary !py-3 !px-6 h-12"
                  >
                    {loadingSession ? 'Loading...' : activeSession ? 'Switch Session' : 'Start Tally'}
                  </button>
                </div>

                {activeSession && (
                  <div className="mt-4 p-3 sm:py-3 sm:px-4 bg-primary/6 rounded-xl border border-primary/12 flex items-center gap-2.5">
                    <span className="text-success text-lg">✓</span>
                    <div>
                      <p className="font-semibold text-sm text-primary">{activeSession.name}</p>
                      <p className="text-xs text-muted">
                        {TYPE_LABELS[activeSession.type]} · {new Date(activeSession.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary counters */}
              {activeSession && roster.length > 0 && (
                <div className="content-anim-item attendance-counter-grid grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Present', count: presentCount, color: '#0b4d24', bg: 'rgba(11,77,36,0.07)' },
                    { label: 'Absent',  count: absentCount,  color: '#9f1c1c', bg: 'rgba(159,28,28,0.06)' },
                    { label: 'Late',    count: lateCount,    color: '#b45309', bg: 'rgba(197,160,89,0.1)' },
                    { label: 'Excused', count: excusedCount, color: '#5c675e', bg: 'rgba(92,103,94,0.06)' },
                  ].map(({ label, count, color, bg }) => (
                    <div key={label} className="glass-container p-4 text-center" style={{ background: bg }}>
                      <p className="text-2xl sm:text-[1.8rem] font-bold" style={{ color }}>{count}</p>
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Member tally cards */}
              {activeSession ? (
                <div className="glass-container content-anim-item p-6">
                  <div className="flex justify-between items-center mb-5 gap-3 flex-wrap">
                    <div>
                      <h3 className="text-base sm:text-[1.1rem] font-semibold text-primary">
                        Member Roll Call
                        <span className="text-xs font-normal text-muted ml-2.5">
                          Tap a card to cycle status
                        </span>
                      </h3>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                      {/* Search */}
                      <div className="relative">
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--muted)" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          <circle cx="9" cy="9" r="7" /><path strokeLinecap="round" d="m15 15 4 4" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Search member..."
                          className="input-field pl-7.5 text-xs sm:text-sm w-[180px]"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      {/* Quick mark all present */}
                      <button
                        onClick={() => {
                          const all: Record<string, 'present'> = {};
                          roster.forEach((m) => (all[m.id] = 'present'));
                          setAttendance(all);
                        }}
                        className="btn btn-secondary !py-1.5 !px-3.5 text-xs text-primary border-primary"
                      >
                        ✓ All Present
                      </button>
                      {/* Reset */}
                      <button
                        onClick={() => {
                          const all: Record<string, 'absent'> = {};
                          roster.forEach((m) => (all[m.id] = 'absent'));
                          setAttendance(all);
                        }}
                        className="btn btn-secondary !py-1.5 !px-3.5 text-xs"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex gap-4 flex-wrap mb-5 py-2.5 px-3.5 bg-black/2 rounded-xl">
                    {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
                      <div key={status} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: cfg.color }}>
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: cfg.dot }} />
                        {cfg.icon} {cfg.label}
                      </div>
                    ))}
                    <span className="text-xs text-muted ml-auto self-center">
                      Tap card to change →
                    </span>
                  </div>

                  {/* Card grid */}
                  {filteredRoster.length === 0 ? (
                    <p className="text-muted text-center py-10">No members match your search.</p>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                      {filteredRoster.map((member) => {
                        const status = attendance[member.id] || 'absent';
                        const cfg = STATUS_CONFIG[status];
                        return (
                          <div
                            key={member.id}
                            className={`attendance-member-card status-${status} flex flex-col gap-2 items-center justify-between p-4 sm:py-4 sm:px-3`}
                          >
                            {/* Top area — Tap to toggle Present/Absent */}
                            <div
                              onClick={() => handleTapMember(member.id)}
                              className="flex flex-col items-center gap-1.5 cursor-pointer w-full"
                              title={`${member.full_name} — Tap to toggle Present/Absent`}
                            >
                              {/* Status indicator dot + icon */}
                              <div className="flex items-center gap-1.5 justify-center">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
                                <span className="text-base">{cfg.icon}</span>
                              </div>
                              <p className="font-semibold text-xs sm:text-sm text-foreground leading-tight break-words m-0 text-center">
                                {member.full_name}
                              </p>
                              {member.voice_part && (
                                <span className="text-[0.7rem] text-muted uppercase tracking-wider text-center">
                                  {member.voice_part}
                                </span>
                              )}
                            </div>

                            {/* Direct Status Selector Buttons */}
                            <div className="flex gap-0.75 w-full border-t border-black/6 pt-2 mt-1">
                              {Object.entries(STATUS_CONFIG).map(([key, itemCfg]) => {
                                const isActive = status === key;
                                return (
                                  <button
                                    key={key}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAttendance((prev) => ({ ...prev, [member.id]: key as any }));
                                    }}
                                    className={`flex-1 py-1.5 text-[0.65rem] font-extrabold rounded-md border-0 cursor-pointer transition-all text-center min-h-[36px] flex items-center justify-center ${
                                      isActive ? 'text-white' : 'bg-black/3 text-gray-500'
                                    }`}
                                    style={{
                                      background: isActive ? itemCfg.dot : undefined,
                                    }}
                                    title={itemCfg.label}
                                  >
                                    {key.charAt(0).toUpperCase()}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Save button */}
                  <div className="mt-6 flex justify-end border-t border-glass-border pt-5">
                    <button
                      onClick={handleSaveAttendance}
                      disabled={saving || roster.length === 0}
                      className={`btn btn-primary ${saving ? 'btn-disabled' : ''} !py-3 !px-8 text-sm sm:text-base min-w-[160px]`}
                    >
                      {saving ? 'Saving...' : '💾 Save Attendance'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="glass-container content-anim-item p-12 text-center">
                  <p className="text-4xl sm:text-5xl mb-4">📋</p>
                  <p className="font-semibold text-primary mb-2">No session loaded</p>
                  <p className="text-muted text-sm sm:text-base">Pick a date above and click &quot;Start Tally&quot; to begin recording.</p>
                </div>
              )}
            </>
          ) : (
            /* History / all sessions view */
            <div className="glass-container content-anim-item p-7">
              <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
                <h3 className="text-lg font-semibold text-primary">Session History</h3>
                {uniqueSessions.length > 0 && (
                  <select
                    className="input-field bg-white min-w-[260px] text-sm"
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                  >
                    {uniqueSessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {new Date(s.date + 'T00:00:00').toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {uniqueSessions.length === 0 ? (
                <p className="text-muted text-center py-10">No sessions recorded yet.</p>
              ) : roster.length === 0 ? (
                <p className="text-muted text-center py-10">No active choir members.</p>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Full Name</th>
                        <th>Voice Part</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((member) => {
                        const status = attendance[member.id] || 'absent';
                        const cfg = STATUS_CONFIG[status];
                        return (
                          <tr key={member.id}>
                            <td data-label="Full Name"><strong>{member.full_name}</strong></td>
                            <td data-label="Voice Part">{member.voice_part || <span className="text-muted italic">—</span>}</td>
                            <td data-label="Status">
                              <span className="inline-flex items-center gap-1.5 font-semibold text-xs sm:text-sm" style={{ color: cfg.color }}>
                                <span className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
                                {cfg.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AttendanceClient;
