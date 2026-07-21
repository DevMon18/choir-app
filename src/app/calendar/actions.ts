'use server';

import { createClient } from '@/lib/supabase/server';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  dateTimeISO: string;
  type: 'mass' | 'rehearsal' | 'performance' | 'special_event';
  source: 'mass_sequence' | 'attendance_session';
  details?: string;
  linkHref?: string;
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    const supabase = await createClient();
    const events: CalendarEvent[] = [];

    // 1. Fetch Scheduled Mass Sequences
    const { data: massData, error: massError } = await supabase
      .from('mass_sequences')
      .select('id, title, scheduled_at, description')
      .not('scheduled_at', 'is', null)
      .order('scheduled_at', { ascending: true });

    if (!massError && massData) {
      massData.forEach((seq) => {
        const d = new Date(seq.scheduled_at);
        events.push({
          id: `mass_${seq.id}`,
          title: seq.title || 'Scheduled Mass Sequence',
          date: d.toISOString().split('T')[0],
          dateTimeISO: seq.scheduled_at,
          type: 'mass',
          source: 'mass_sequence',
          details: seq.description || 'Mass singing engagement & sequence',
          linkHref: `/repertoire/${seq.id}`,
        });
      });
    }

    // 2. Fetch Attendance Sessions (Rehearsal, Mass, Performance, Special Event)
    const { data: sessionData, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select('id, date, type, title, notes')
      .order('date', { ascending: true });

    if (!sessionError && sessionData) {
      sessionData.forEach((sess) => {
        const d = new Date(sess.date);
        let eventType: CalendarEvent['type'] = 'rehearsal';
        if (sess.type === 'performance') eventType = 'performance';
        if (sess.type === 'mass') eventType = 'mass';
        if (sess.type === 'special_event') eventType = 'special_event';

        events.push({
          id: `session_${sess.id}`,
          title: sess.title || `${sess.type.charAt(0).toUpperCase() + sess.type.slice(1)} Session`,
          date: d.toISOString().split('T')[0],
          dateTimeISO: sess.date,
          type: eventType,
          source: 'attendance_session',
          details: sess.notes || undefined,
        });
      });
    }

    // Sort combined events by dateTimeISO ascending
    events.sort((a, b) => new Date(a.dateTimeISO).getTime() - new Date(b.dateTimeISO).getTime());

    return events;
  } catch (err) {
    console.error('getCalendarEvents failed:', err);
    return [];
  }
}
