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
      tl.fromTo('.content-anim-item', { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1 });
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
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '500px', height: '500px' }} />
      <div className="bg-orb bg-orb-2" style={{ width: '400px', height: '400px' }} />

      <Navbar profile={currentUserProfile} />

      <main className="admin-content-full">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Header */}
            <div className="content-anim-item" style={{ opacity: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px', color: 'var(--primary)' }}>Attendance Tally</h2>
                <p style={{ color: 'var(--muted)' }}>Tap a member card to cycle their status. Save when done.</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setViewMode('tally')}
                  className={`btn ${viewMode === 'tally' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  📋 Quick Tally
                </button>
                <button
                  onClick={() => setViewMode('history')}
                  className={`btn ${viewMode === 'history' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  📅 All Sessions
                </button>
              </div>
            </div>

            {viewMode === 'tally' ? (
              <>
                {/* Date + Type Picker */}
                <div className="glass-container content-anim-item" style={{ opacity: 0, padding: '24px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '12px' }}>
                    📅 Quick Select Date & Session Type
                  </h3>
                  
                  {/* Quick Dates Badges */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
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
                          className="btn"
                          style={{
                            padding: '6px 14px',
                            fontSize: '0.8rem',
                            borderRadius: '20px',
                            fontWeight: 600,
                            minHeight: '32px',
                            background: isSelected ? 'var(--primary)' : 'rgba(11, 77, 36, 0.05)',
                            color: isSelected ? '#fff' : 'var(--primary)',
                            border: isSelected ? '1px solid var(--primary)' : '1px solid rgba(11, 77, 36, 0.15)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                    <div style={{ flex: '1', minWidth: '160px' }}>
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
                    <div style={{ flex: '1', minWidth: '180px' }}>
                      <label className="input-label" htmlFor="tallyType">Session Type</label>
                      <select
                        id="tallyType"
                        className="input-field"
                        value={selectedType}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setSelectedType(val);
                          loadOrCreateSession(selectedDate, val);
                        }}
                        style={{ background: '#fff' }}
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
                      className="btn btn-primary"
                      style={{ padding: '12px 24px', height: '48px' }}
                    >
                      {loadingSession ? 'Loading...' : activeSession ? 'Switch Session' : 'Start Tally'}
                    </button>
                  </div>

                  {activeSession && (
                    <div style={{
                      marginTop: '16px',
                      padding: '12px 16px',
                      background: 'rgba(11,77,36,0.06)',
                      borderRadius: '10px',
                      border: '1px solid rgba(11,77,36,0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}>
                      <span style={{ color: '#0b4d24', fontSize: '1.1rem' }}>✓</span>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary)' }}>{activeSession.name}</p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{TYPE_LABELS[activeSession.type]} · {new Date(activeSession.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Summary counters */}
                {activeSession && roster.length > 0 && (
                  <div className="content-anim-item" style={{ opacity: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    {[
                      { label: 'Present', count: presentCount, color: '#0b4d24', bg: 'rgba(11,77,36,0.07)' },
                      { label: 'Absent',  count: absentCount,  color: '#9f1c1c', bg: 'rgba(159,28,28,0.06)' },
                      { label: 'Late',    count: lateCount,    color: '#b45309', bg: 'rgba(197,160,89,0.1)' },
                      { label: 'Excused', count: excusedCount, color: '#5c675e', bg: 'rgba(92,103,94,0.06)' },
                    ].map(({ label, count, color, bg }) => (
                      <div key={label} className="glass-container" style={{ padding: '16px', textAlign: 'center', background: bg }}>
                        <p style={{ fontSize: '1.8rem', fontWeight: 700, color }}>{count}</p>
                        <p style={{ fontSize: '0.78rem', fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Member tally cards */}
                {activeSession ? (
                  <div className="glass-container content-anim-item" style={{ opacity: 0, padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--primary)' }}>
                          Member Roll Call
                          <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--muted)', marginLeft: '10px' }}>
                            Tap a card to cycle status
                          </span>
                        </h3>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Search */}
                        <div style={{ position: 'relative' }}>
                          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--muted)" strokeWidth="2" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                            <circle cx="9" cy="9" r="7" /><path strokeLinecap="round" d="m15 15 4 4" />
                          </svg>
                          <input
                            type="text"
                            placeholder="Search member..."
                            className="input-field"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '30px', height: '36px', minHeight: '36px', fontSize: '0.85rem', width: '180px' }}
                          />
                        </div>
                        {/* Quick mark all present */}
                        <button
                          onClick={() => {
                            const all: Record<string, 'present'> = {};
                            roster.forEach((m) => (all[m.id] = 'present'));
                            setAttendance(all);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '6px 14px', fontSize: '0.8rem', color: 'var(--primary)', borderColor: 'var(--primary)' }}
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
                          className="btn btn-secondary"
                          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px', padding: '10px 14px', background: 'rgba(0,0,0,0.02)', borderRadius: '10px' }}>
                      {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
                        <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: cfg.color, fontWeight: 500 }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
                          {cfg.icon} {cfg.label}
                        </div>
                      ))}
                      <span style={{ fontSize: '0.78rem', color: 'var(--muted)', marginLeft: 'auto', alignSelf: 'center' }}>
                        Tap card to change →
                      </span>
                    </div>

                    {/* Card grid */}
                    {filteredRoster.length === 0 ? (
                      <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>No members match your search.</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                        {filteredRoster.map((member) => {
                          const status = attendance[member.id] || 'absent';
                          const cfg = STATUS_CONFIG[status];
                          return (
                            <div
                              key={member.id}
                              className={`attendance-member-card status-${status}`}
                              style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', justifyContent: 'space-between', padding: '16px 12px' }}
                            >
                              {/* Top area — Tap to toggle Present/Absent */}
                              <div
                                onClick={() => handleTapMember(member.id)}
                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer', width: '100%' }}
                                title={`${member.full_name} — Tap to toggle Present/Absent`}
                              >
                                {/* Status indicator dot + icon */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                                  <span style={{ fontSize: '1rem' }}>{cfg.icon}</span>
                                </div>
                                <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--foreground)', lineHeight: 1.25, wordBreak: 'break-word', margin: 0, textAlign: 'center' }}>
                                  {member.full_name}
                                </p>
                                {member.voice_part && (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>
                                    {member.voice_part}
                                  </span>
                                )}
                              </div>

                              {/* Direct Status Selector Buttons */}
                              <div style={{ display: 'flex', gap: '3px', width: '100%', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '8px', marginTop: '4px' }}>
                                {Object.entries(STATUS_CONFIG).map(([key, itemCfg]) => {
                                  const isActive = status === key;
                                  return (
                                    <button
                                      key={key}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAttendance((prev) => ({ ...prev, [member.id]: key as any }));
                                      }}
                                      style={{
                                        flex: 1,
                                        padding: '4px 0',
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        borderRadius: '6px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: isActive ? itemCfg.dot : 'rgba(0,0,0,0.03)',
                                        color: isActive ? '#fff' : '#6b7280',
                                        transition: 'all 0.15s ease',
                                        textAlign: 'center',
                                        minHeight: '24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
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
                    <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
                      <button
                        onClick={handleSaveAttendance}
                        disabled={saving || roster.length === 0}
                        className={`btn btn-primary ${saving ? 'btn-disabled' : ''}`}
                        style={{ padding: '12px 32px', fontSize: '0.95rem', minWidth: '160px' }}
                      >
                        {saving ? 'Saving...' : '💾 Save Attendance'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="glass-container content-anim-item" style={{ opacity: 0, padding: '48px', textAlign: 'center' }}>
                    <p style={{ fontSize: '3rem', marginBottom: '16px' }}>📋</p>
                    <p style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '8px' }}>No session loaded</p>
                    <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Pick a date above and click "Start Tally" to begin recording.</p>
                  </div>
                )}
              </>
            ) : (
              /* History / all sessions view */
              <div className="glass-container content-anim-item" style={{ opacity: 0, padding: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--primary)' }}>Session History</h3>
                  {uniqueSessions.length > 0 && (
                    <select
                      className="input-field"
                      value={selectedSessionId}
                      onChange={(e) => setSelectedSessionId(e.target.value)}
                      style={{ background: '#fff', minWidth: '260px', fontSize: '0.9rem' }}
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
                  <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>No sessions recorded yet.</p>
                ) : roster.length === 0 ? (
                  <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>No active choir members.</p>
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
                              <td data-label="Voice Part">{member.voice_part || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>—</span>}</td>
                              <td data-label="Status">
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem', color: cfg.color }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.dot }} />
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
