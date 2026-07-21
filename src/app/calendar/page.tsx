import dynamicImport from 'next/dynamic';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { getCalendarEvents } from './actions';

const CalendarClient = dynamicImport(
  () => import('./CalendarClient').then((m) => m.CalendarClient),
  { ssr: true }
);

export default async function CalendarPage() {
  const profile = await getProfile();

  if (!profile || profile.role === 'pending' || profile.role === 'rejected') {
    redirect('/login');
  }

  const events = await getCalendarEvents();

  return <CalendarClient currentUserProfile={profile} events={events} />;
}
