'use server';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  dateTimeISO: string;
  type: 'mass' | 'rehearsal' | 'performance' | 'special_event' | 'announcement' | 'birthday';
  source: 'mass_sequence' | 'attendance_session' | 'announcement' | 'birthday';
  details?: string;
  linkHref?: string;
  isUrgent?: boolean;
  birthMonthDay?: string; // MM-DD format for annual recurring birthday mapping
}

export const getCalendarEvents = cache(async (): Promise<CalendarEvent[]> => {
  try {
    const supabase = await createClient();
    const events: CalendarEvent[] = [];

    // Fire all 4 independent database queries concurrently via Promise.all
    const [
      { data: massData, error: massError },
      { data: sessionData, error: sessionError },
      { data: annData, error: annError },
      { data: bdayData, error: bdayError },
    ] = await Promise.all([
      supabase
        .from('mass_sequences')
        .select('id, title, scheduled_at, description')
        .not('scheduled_at', 'is', null)
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('attendance_sessions')
        .select('id, date, type, title, notes')
        .order('date', { ascending: true }),
      supabase
        .from('announcements')
        .select('id, title, body, priority, starts_at, is_pinned')
        .order('starts_at', { ascending: true }),
      supabase
        .from('profiles')
        .select('id, full_name, birthdate')
        .not('birthdate', 'is', null)
        .eq('is_birthdate_private', false)
        .not('role', 'in', '("pending","rejected")'),
    ]);

    // 1. Process Scheduled Mass Sequences
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

    // 2. Process Attendance Sessions
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

    // 3. Process Announcements
    if (!annError && annData) {
      annData.forEach((ann) => {
        const d = new Date(ann.starts_at);
        events.push({
          id: `ann_${ann.id}`,
          title: ann.title || 'Announcement',
          date: d.toISOString().split('T')[0],
          dateTimeISO: ann.starts_at,
          type: 'announcement',
          source: 'announcement',
          details: ann.body,
          linkHref: '/dashboard',
          isUrgent: ann.priority === 'urgent',
        });
      });
    }

    // 4. Process Member Birthdays
    if (!bdayError && bdayData) {
      bdayData.forEach((profile) => {
        if (!profile.birthdate) return;
        const parts = profile.birthdate.split('-');
        if (parts.length >= 3) {
          const monthStr = parts[1];
          const dayStr = parts[2];
          const birthMonthDay = `${monthStr}-${dayStr}`;

          events.push({
            id: `bday_${profile.id}`,
            title: `🎂 ${profile.full_name}'s Birthday`,
            date: profile.birthdate,
            dateTimeISO: `${new Date().getFullYear()}-${monthStr}-${dayStr}T00:00:00.000Z`,
            type: 'birthday',
            source: 'birthday',
            birthMonthDay,
            details: `Celebrate ${profile.full_name}'s birthday!`,
            linkHref: '/directory',
          });
        }
      });
    }

    // Sort combined events by dateTimeISO ascending
    events.sort((a, b) => new Date(a.dateTimeISO).getTime() - new Date(b.dateTimeISO).getTime());

    return events;
  } catch (err) {
    console.error('getCalendarEvents failed:', err);
    return [];
  }
});
