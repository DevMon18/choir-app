-- Migration: 20260722000002_performance_indexes.sql
-- Description: Create B-Tree indexes on foreign keys, composite filters, and lookup fields to optimize PostgREST query execution time.

-- 1. Sequence Items indexes for fast sequence loading & song lookups
CREATE INDEX IF NOT EXISTS idx_sequence_items_seq_pos ON public.sequence_items(sequence_id, position);
CREATE INDEX IF NOT EXISTS idx_sequence_items_song_id ON public.sequence_items(song_id);

-- 2. Practice Tracks index for voice part filter
CREATE INDEX IF NOT EXISTS idx_practice_tracks_song_voice ON public.practice_tracks(song_id, voice_part);

-- 3. Member Dues index for user status & due date filtering
CREATE INDEX IF NOT EXISTS idx_member_dues_user_status ON public.member_dues(user_id, status, due_date);

-- 4. Announcements index for active & priority filtering
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements(starts_at, ends_at, priority);

-- 5. Attendance Sessions index for calendar & roster lookup
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date_type ON public.attendance_sessions(date, type);

-- 6. Profiles index for role-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 7. Push Subscriptions index for fast endpoint lookup
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);
