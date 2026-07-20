-- Create indexes for performance optimization

-- 1. Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 2. Member Dues indexes
CREATE INDEX IF NOT EXISTS idx_member_dues_member_id ON public.member_dues(member_id);
CREATE INDEX IF NOT EXISTS idx_member_dues_user_id ON public.member_dues(user_id);
CREATE INDEX IF NOT EXISTS idx_member_dues_due_date ON public.member_dues(due_date DESC);
CREATE INDEX IF NOT EXISTS idx_member_dues_period_label ON public.member_dues(period_label);

-- 3. Attendance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_records_session_id ON public.attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_profile_id ON public.attendance_records(profile_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON public.attendance_sessions(date DESC);

-- 4. Join Requests indexes
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON public.join_requests(status);
