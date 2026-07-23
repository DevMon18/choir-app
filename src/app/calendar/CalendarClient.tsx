'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { CalendarEvent } from './actions';

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface Props {
  currentUserProfile: Profile;
  events: CalendarEvent[];
}

const TYPE_CONFIG: Record<
  CalendarEvent['type'],
  { label: string; bg: string; color: string; dot: string }
> = {
  mass: {
    label: 'Mass Engagement',
    bg: 'rgba(11, 77, 36, 0.1)',
    color: 'var(--primary)',
    dot: '#0b4d24',
  },
  rehearsal: {
    label: 'Rehearsal',
    bg: 'rgba(197, 160, 89, 0.15)',
    color: '#b08d47',
    dot: '#c5a059',
  },
  performance: {
    label: 'Performance',
    bg: 'rgba(99, 102, 241, 0.1)',
    color: '#6366f1',
    dot: '#6366f1',
  },
  special_event: {
    label: 'Special Event',
    bg: 'rgba(236, 72, 153, 0.1)',
    color: '#ec4899',
    dot: '#ec4899',
  },
  announcement: {
    label: 'Announcement / Alert',
    bg: 'rgba(159, 28, 28, 0.12)',
    color: 'var(--error)',
    dot: '#9f1c1c',
  },
  birthday: {
    label: '🎂 Member Birthday',
    bg: 'rgba(236, 72, 153, 0.15)',
    color: '#db2777',
    dot: '#ec4899',
  },
};

export const CalendarClient = ({ currentUserProfile, events }: Props) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'auto' | 'grid' | 'agenda'>('auto');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Grid dates calculation
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

  // Map events to currently displayed year and group by dateStr
  const displayEvents = useMemo(() => {
    return events.map((ev) => {
      if (ev.type === 'birthday' && ev.birthMonthDay) {
        const mappedDateStr = `${year}-${ev.birthMonthDay}`;
        const mappedISO = `${year}-${ev.birthMonthDay}T00:00:00.000Z`;
        return {
          ...ev,
          date: mappedDateStr,
          dateTimeISO: mappedISO,
        };
      }
      return ev;
    }).sort((a, b) => new Date(a.dateTimeISO).getTime() - new Date(b.dateTimeISO).getTime());
  }, [events, year]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    displayEvents.forEach((ev) => {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });
    return map;
  }, [displayEvents]);

  const selectedDayEvents = selectedDateStr ? eventsByDate[selectedDateStr] || [] : [];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Separate events into Repertoire/Schedule and Birthdays
  const agendaScheduleEvents = useMemo(
    () => displayEvents.filter((ev) => ev.type !== 'birthday'),
    [displayEvents]
  );

  const agendaBirthdayEvents = useMemo(
    () => displayEvents.filter((ev) => ev.type === 'birthday'),
    [displayEvents]
  );

  const getEventActionLabel = (ev: CalendarEvent) => {
    if (ev.type === 'birthday') return 'View Member Profile →';
    if (ev.type === 'announcement') return 'View Notice →';
    return 'View Repertoire Sequence →';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '450px', height: '450px' }} />
      <div className="bg-orb bg-orb-2" style={{ width: '400px', height: '400px' }} />

      <Navbar profile={currentUserProfile} />

      <main style={{ flex: 1, padding: '40px 16px 120px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
              Schedule & Mass Calendar
            </h1>
            <p style={{ color: 'var(--muted)', margin: '4px 0 0 0', fontSize: '0.95rem' }}>
              Unified schedule for choir rehearsals, Mass singing engagements, and member celebrations.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.03)', padding: '4px', borderRadius: '12px' }}>
            <button
              onClick={() => setViewMode('auto')}
              className="btn"
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                minHeight: '34px',
                background: viewMode === 'auto' ? '#fff' : 'transparent',
                color: viewMode === 'auto' ? 'var(--primary)' : 'var(--muted)',
                boxShadow: viewMode === 'auto' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                fontWeight: viewMode === 'auto' ? 700 : 500,
              }}
            >
              Month View
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className="btn"
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                minHeight: '34px',
                background: viewMode === 'agenda' ? '#fff' : 'transparent',
                color: viewMode === 'agenda' ? 'var(--primary)' : 'var(--muted)',
                boxShadow: viewMode === 'agenda' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                fontWeight: viewMode === 'agenda' ? 700 : 500,
              }}
            >
              Agenda List
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: cfg.dot }} />
              <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{cfg.label}</span>
            </div>
          ))}
        </div>

        {/* MONTH GRID VIEW (Shown in Auto Mode or Grid Mode) */}
        {(viewMode === 'grid' || viewMode === 'auto') && (
          <div className="desktop-grid-block">
            <div className="glass-container" style={{ padding: '24px', marginBottom: '24px' }}>
              {/* Month Selector Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                  {monthName}
                </h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={prevMonth} className="btn btn-secondary" style={{ padding: '6px 12px', minHeight: '34px' }}>
                    ‹ Prev
                  </button>
                  <button onClick={nextMonth} className="btn btn-secondary" style={{ padding: '6px 12px', minHeight: '34px' }}>
                    Next ›
                  </button>
                </div>
              </div>

              {/* Grid Header Days */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '8px' }}>
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
              </div>

              {/* Days Grid — Fixed Cell Height to prevent grid distortion */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                {daysArray.map((item, idx) => {
                  if (!item) {
                    return <div key={`empty_${idx}`} style={{ height: '92px', background: 'rgba(0,0,0,0.01)', borderRadius: '10px' }} />;
                  }

                  const dayEvs = eventsByDate[item.dateStr] || [];
                  const isSelected = selectedDateStr === item.dateStr;

                  return (
                    <div
                      key={item.dateStr}
                      onClick={() => setSelectedDateStr(isSelected ? null : item.dateStr)}
                      style={{
                        height: '92px',
                        padding: '6px 8px',
                        borderRadius: '10px',
                        background: isSelected ? 'rgba(11, 77, 36, 0.08)' : 'rgba(255,255,255,0.6)',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        overflow: 'hidden',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isSelected ? 'var(--primary)' : 'var(--foreground)' }}>
                        {item.day}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                        {dayEvs.slice(0, 2).map((ev) => {
                          const cfg = TYPE_CONFIG[ev.type];
                          return (
                            <div
                              key={ev.id}
                              style={{
                                fontSize: '0.65rem',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                background: cfg.bg,
                                color: cfg.color,
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {ev.type === 'birthday' ? '🎂' : '•'} {ev.title.replace('🎂 ', '').replace("'s Birthday", '')}
                            </div>
                          );
                        })}
                        {dayEvs.length > 2 && (
                          <div style={{ fontSize: '0.62rem', color: 'var(--muted)', fontWeight: 700 }}>
                            +{dayEvs.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Day Filter Details Drawer */}
              {selectedDateStr && (
                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                      Selected Date: {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </h3>
                    <button onClick={() => setSelectedDateStr(null)} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                      Close Details ✕
                    </button>
                  </div>

                  {selectedDayEvents.length === 0 ? (
                    <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No events or celebrations scheduled for this day.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {selectedDayEvents.map((ev) => {
                        const cfg = TYPE_CONFIG[ev.type];
                        return (
                          <div
                            key={ev.id}
                            style={{
                              padding: '12px 16px',
                              borderRadius: '12px',
                              background: ev.type === 'birthday' ? 'rgba(236, 72, 153, 0.08)' : 'rgba(255,255,255,0.7)',
                              border: ev.type === 'birthday' ? '1px solid rgba(236, 72, 153, 0.25)' : '1px solid var(--glass-border)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '10px',
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span className="badge" style={{ background: cfg.bg, color: cfg.color, fontSize: '0.72rem' }}>
                                  {cfg.label}
                                </span>
                              </div>
                              <strong style={{ color: ev.type === 'birthday' ? '#db2777' : 'var(--foreground)', fontSize: '0.95rem' }}>
                                {ev.title}
                              </strong>
                              {ev.details && <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '2px' }}>{ev.details}</div>}
                            </div>
                            {ev.linkHref && (
                              <Link href={ev.linkHref} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                                {getEventActionLabel(ev)}
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AGENDA VIEW (Shown when Agenda Mode selected or at bottom of auto mode) */}
        {(viewMode === 'agenda' || (viewMode === 'auto' && !selectedDateStr)) && (
          <div className="agenda-block">
            {/* Section 1: Rehearsals & Mass Engagements */}
            <div className="glass-container" style={{ padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🎵</span> Rehearsals & Mass Engagements ({agendaScheduleEvents.length})
              </h2>

              {agendaScheduleEvents.length === 0 ? (
                <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '24px 0', margin: 0 }}>
                  No upcoming rehearsals or Mass engagements scheduled.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {agendaScheduleEvents.map((ev) => {
                    const cfg = TYPE_CONFIG[ev.type];
                    const dateObj = new Date(ev.dateTimeISO);
                    return (
                      <div
                        key={ev.id}
                        style={{
                          padding: '16px',
                          borderRadius: '14px',
                          background: 'rgba(255,255,255,0.7)',
                          border: '1px solid var(--glass-border)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                          <div
                            style={{
                              background: cfg.bg,
                              color: cfg.color,
                              padding: '8px 12px',
                              borderRadius: '10px',
                              textAlign: 'center',
                              minWidth: '60px',
                            }}
                          >
                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>
                              {dateObj.toLocaleString('default', { month: 'short' })}
                            </div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 700, lineHeight: 1 }}>
                              {dateObj.getDate()}
                            </div>
                          </div>

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span className="badge" style={{ background: cfg.bg, color: cfg.color, fontSize: '0.72rem' }}>
                                {cfg.label}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                                {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--foreground)', margin: '0 0 4px 0' }}>
                              {ev.title}
                            </h3>
                            {ev.details && (
                              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--muted)' }}>
                                {ev.details}
                              </p>
                            )}
                          </div>
                        </div>

                        {ev.linkHref && (
                          <Link href={ev.linkHref} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                            {getEventActionLabel(ev)}
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 2: Choir Member Birthdays */}
            <div className="glass-container" style={{ padding: '24px', background: 'rgba(255, 254, 252, 0.85)' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#db2777', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🎂</span> Member Birthday Calendar ({agendaBirthdayEvents.length})
              </h2>

              {agendaBirthdayEvents.length === 0 ? (
                <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '24px 0', margin: 0 }}>
                  No upcoming public member birthdays recorded.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                  {agendaBirthdayEvents.map((ev) => {
                    const dateObj = new Date(ev.dateTimeISO);
                    return (
                      <div
                        key={ev.id}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '14px',
                          background: 'rgba(236, 72, 153, 0.06)',
                          border: '1px solid rgba(236, 72, 153, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              background: '#fce7f3',
                              color: '#db2777',
                              padding: '6px 10px',
                              borderRadius: '10px',
                              textAlign: 'center',
                              minWidth: '50px',
                            }}
                          >
                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>
                              {dateObj.toLocaleString('default', { month: 'short' })}
                            </div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 700, lineHeight: 1 }}>
                              {dateObj.getDate()}
                            </div>
                          </div>

                          <div>
                            <strong style={{ display: 'block', fontSize: '0.95rem', color: '#831843' }}>
                              {ev.title}
                            </strong>
                            <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                              🎉 Annual Member Celebration
                            </span>
                          </div>
                        </div>

                        {ev.linkHref && (
                          <Link
                            href={ev.linkHref}
                            className="btn btn-secondary"
                            style={{
                              padding: '6px 12px',
                              fontSize: '0.78rem',
                              color: '#db2777',
                              borderColor: 'rgba(236, 72, 153, 0.4)',
                              background: '#fff',
                            }}
                          >
                            Profile →
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

