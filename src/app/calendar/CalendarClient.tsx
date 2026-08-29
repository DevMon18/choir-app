'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { CalendarEvent } from './actions';
import { useCalendar } from '@/hooks/useCalendar';

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

export const CalendarClient = ({ currentUserProfile, events: initialEvents }: Props) => {
  const { events } = useCalendar({
    initialEvents: initialEvents as any,
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'auto' | 'grid' | 'agenda'>('auto');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);

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
    let list = events.map((ev) => {
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
    });

    if (selectedTypeFilter) {
      list = list.filter((ev) => ev.type === selectedTypeFilter);
    }

    return list.sort((a, b) => new Date(a.dateTimeISO).getTime() - new Date(b.dateTimeISO).getTime());
  }, [events, year, selectedTypeFilter]);

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
    <div className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1 w-[450px] h-[450px]" />
      <div className="bg-orb bg-orb-2 w-[400px] h-[400px]" />

      <Navbar profile={currentUserProfile} />

      <main className="flex-1 py-10 px-4 pb-[120px] max-w-[1100px] mx-auto w-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary m-0">
              Schedule & Mass Calendar
            </h1>
            <p className="text-muted mt-1 m-0 text-sm sm:text-base">
              Unified schedule for choir rehearsals, Mass singing engagements, and member celebrations.
            </p>
          </div>

          <div className="flex gap-2 bg-black/3 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('auto')}
              className={`btn !py-1.5 !px-3.5 text-xs sm:text-[0.82rem] !min-h-[34px] ${
                viewMode === 'auto'
                  ? 'bg-white !text-primary shadow-sm font-bold'
                  : 'bg-transparent !text-muted font-medium'
              }`}
            >
              Month View
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`btn !py-1.5 !px-3.5 text-xs sm:text-[0.82rem] !min-h-[34px] ${
                viewMode === 'agenda'
                  ? 'bg-white !text-primary shadow-sm font-bold'
                  : 'bg-transparent !text-muted font-medium'
              }`}
            >
              Agenda List
            </button>
          </div>
        </div>

        {/* Legend / Interactive Type Filters */}
        <div className="flex gap-2.5 mb-6 flex-wrap items-center text-xs sm:text-[0.82rem]">
          <span className="font-bold text-muted text-xs uppercase tracking-wider">Filter:</span>
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
            const isSelected = selectedTypeFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedTypeFilter(isSelected ? null : key)}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-full cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? 'font-bold shadow-sm'
                    : 'bg-white/70 border border-glass-border text-foreground font-medium'
                }`}
                style={
                  isSelected
                    ? {
                        background: cfg.bg,
                        borderColor: cfg.dot,
                        borderWidth: '1.5px',
                        borderStyle: 'solid',
                        color: cfg.color,
                      }
                    : undefined
                }
              >
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ background: cfg.dot }}
                />
                <span>{cfg.label}</span>
              </button>
            );
          })}
          {selectedTypeFilter && (
            <button
              type="button"
              onClick={() => setSelectedTypeFilter(null)}
              className="text-xs font-semibold text-muted bg-black/5 border-none py-1 px-2.5 rounded-xl cursor-pointer"
            >
              Clear Filter ✕
            </button>
          )}
        </div>

        {/* MONTH GRID VIEW (Shown in Auto Mode or Grid Mode) */}
        {(viewMode === 'grid' || viewMode === 'auto') && (
          <div className="desktop-grid-block">
            <div className="glass-container p-6 mb-6">
              {/* Month Selector Controls */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl sm:text-[1.35rem] font-bold text-primary m-0">
                  {monthName}
                </h2>
                <div className="flex gap-2">
                  <button onClick={prevMonth} className="btn btn-secondary !py-1.5 !px-3 !min-h-[34px]">
                    ‹ Prev
                  </button>
                  <button onClick={nextMonth} className="btn btn-secondary !py-1.5 !px-3 !min-h-[34px]">
                    Next ›
                  </button>
                </div>
              </div>

              {/* Grid Header Days */}
              <div className="grid grid-cols-7 gap-1.5 text-center font-bold text-xs text-muted mb-2">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
              </div>

              {/* Days Grid — Fixed Cell Height to prevent grid distortion */}
              <div className="grid grid-cols-7 gap-1.5">
                {daysArray.map((item, idx) => {
                  if (!item) {
                    return <div key={`empty_${idx}`} className="h-[92px] bg-black/1 rounded-xl" />;
                  }

                  const dayEvs = eventsByDate[item.dateStr] || [];
                  const isSelected = selectedDateStr === item.dateStr;

                  return (
                    <div
                      key={item.dateStr}
                      onClick={() => setSelectedDateStr(isSelected ? null : item.dateStr)}
                      className={`h-[92px] p-1.5 sm:py-1.5 sm:px-2 rounded-xl cursor-pointer flex flex-col justify-between overflow-hidden transition-all duration-150 ${
                        isSelected
                          ? 'bg-primary/8 border-2 border-primary'
                          : 'bg-white/60 border border-glass-border'
                      }`}
                    >
                      <div className={`font-bold text-xs sm:text-sm ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                        {item.day}
                      </div>

                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        {dayEvs.slice(0, 2).map((ev) => {
                          const cfg = TYPE_CONFIG[ev.type];
                          return (
                            <div
                              key={ev.id}
                              className="text-[0.65rem] py-0.5 px-1 rounded font-semibold whitespace-nowrap overflow-hidden text-ellipsis"
                              style={{
                                background: cfg.bg,
                                color: cfg.color,
                              }}
                            >
                              {ev.type === 'birthday' ? '🎂' : '•'} {ev.title.replace('🎂 ', '').replace("'s Birthday", '')}
                            </div>
                          );
                        })}
                        {dayEvs.length > 2 && (
                          <div className="text-[0.62rem] text-muted font-bold">
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
                <div className="mt-6 pt-5 border-t border-glass-border">
                  <div className="flex justify-between items-center mb-3.5 flex-wrap gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-primary m-0">
                      Selected Date: {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </h3>
                    <button onClick={() => setSelectedDateStr(null)} className="btn btn-secondary !py-1 !px-2.5 text-xs">
                      Close Details ✕
                    </button>
                  </div>

                  {selectedDayEvents.length === 0 ? (
                    <p className="text-muted text-xs sm:text-sm m-0">No events or celebrations scheduled for this day.</p>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {selectedDayEvents.map((ev) => {
                        const cfg = TYPE_CONFIG[ev.type];
                        return (
                          <div
                            key={ev.id}
                            className={`p-3 sm:py-3 sm:px-4 rounded-xl flex justify-between items-center flex-wrap gap-2.5 ${
                              ev.type === 'birthday'
                                ? 'bg-pink-500/8 border border-pink-500/25'
                                : 'bg-white/70 border border-glass-border'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className="badge text-xs"
                                  style={{ background: cfg.bg, color: cfg.color }}
                                >
                                  {cfg.label}
                                </span>
                              </div>
                              <strong className={`text-xs sm:text-sm ${ev.type === 'birthday' ? 'text-pink-600' : 'text-foreground'}`}>
                                {ev.title}
                              </strong>
                              {ev.details && <div className="text-xs text-muted mt-0.5">{ev.details}</div>}
                            </div>
                            {ev.linkHref && (
                              <Link href={ev.linkHref} className="btn btn-secondary !py-1.5 !px-3 text-xs">
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
            <div className="glass-container p-6 mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-primary mb-4 flex items-center gap-2">
                <span>🎵</span> Rehearsals & Mass Engagements ({agendaScheduleEvents.length})
              </h2>

              {agendaScheduleEvents.length === 0 ? (
                <p className="text-muted text-center py-6 m-0 text-xs sm:text-sm">
                  No upcoming rehearsals or Mass engagements scheduled.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {agendaScheduleEvents.map((ev) => {
                    const cfg = TYPE_CONFIG[ev.type];
                    const dateObj = new Date(ev.dateTimeISO);
                    return (
                      <div
                        key={ev.id}
                        className="p-4 rounded-2xl bg-white/70 border border-glass-border flex items-start justify-between flex-wrap gap-3"
                      >
                        <div className="flex gap-3.5 items-start">
                          <div
                            className="py-2 px-3 rounded-xl text-center min-w-[60px]"
                            style={{
                              background: cfg.bg,
                              color: cfg.color,
                            }}
                          >
                            <div className="text-xs uppercase font-bold">
                              {dateObj.toLocaleString('default', { month: 'short' })}
                            </div>
                            <div className="text-xl font-bold leading-none">
                              {dateObj.getDate()}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="badge text-xs"
                                style={{ background: cfg.bg, color: cfg.color }}
                              >
                                {cfg.label}
                              </span>
                              <span className="text-xs text-muted">
                                {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <h3 className="text-sm sm:text-base font-bold text-foreground m-0 mb-1">
                              {ev.title}
                            </h3>
                            {ev.details && (
                              <p className="m-0 text-xs sm:text-sm text-muted">
                                {ev.details}
                              </p>
                            )}
                          </div>
                        </div>

                        {ev.linkHref && (
                          <Link href={ev.linkHref} className="btn btn-secondary !py-1.5 !px-3 text-xs">
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
            <div className="glass-container p-6 bg-pink-50/85">
              <h2 className="text-lg sm:text-xl font-bold text-pink-600 mb-4 flex items-center gap-2">
                <span>🎂</span> Member Birthday Calendar ({agendaBirthdayEvents.length})
              </h2>

              {agendaBirthdayEvents.length === 0 ? (
                <p className="text-muted text-center py-6 m-0 text-xs sm:text-sm">
                  No upcoming public member birthdays recorded.
                </p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
                  {agendaBirthdayEvents.map((ev) => {
                    const dateObj = new Date(ev.dateTimeISO);
                    return (
                      <div
                        key={ev.id}
                        className="p-3.5 sm:py-3.5 sm:px-4 rounded-2xl bg-pink-500/6 border border-pink-500/20 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-pink-100 text-pink-600 py-1.5 px-2.5 rounded-xl text-center min-w-[50px]">
                            <div className="text-[0.7rem] uppercase font-bold">
                              {dateObj.toLocaleString('default', { month: 'short' })}
                            </div>
                            <div className="text-lg font-bold leading-none">
                              {dateObj.getDate()}
                            </div>
                          </div>

                          <div>
                            <strong className="block text-xs sm:text-sm text-pink-950">
                              {ev.title}
                            </strong>
                            <span className="text-xs text-muted">
                              🎉 Annual Member Celebration
                            </span>
                          </div>
                        </div>

                        {ev.linkHref && (
                          <Link
                            href={ev.linkHref}
                            className="btn btn-secondary !py-1.5 !px-3 text-xs !text-pink-600 !border-pink-500/40 bg-white"
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

