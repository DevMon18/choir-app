-- 1. Extend Recruitment Requests Table
ALTER TABLE public.join_requests
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS contact_number TEXT,
  ADD COLUMN IF NOT EXISTS choir_experience TEXT,
  ADD COLUMN IF NOT EXISTS availability TEXT,
  ADD COLUMN IF NOT EXISTS reason_for_joining TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. Extend Profiles Table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birthdate DATE,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
  ADD COLUMN IF NOT EXISTS voice_part TEXT,
  ADD COLUMN IF NOT EXISTS join_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS is_phone_private BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_address_private BOOLEAN DEFAULT TRUE;

-- 3. Extend Songs Table
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS liturgical_usage TEXT,
  ADD COLUMN IF NOT EXISTS sheet_music_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- 4. Update Attendance Check Constraints to allow masses, special events and late status
ALTER TABLE public.attendance_sessions
  DROP CONSTRAINT IF EXISTS attendance_sessions_type_check;
ALTER TABLE public.attendance_sessions
  ADD CONSTRAINT attendance_sessions_type_check 
  CHECK (type IN ('rehearsal', 'performance', 'mass', 'special_event'));

ALTER TABLE public.attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_status_check;
ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_status_check 
  CHECK (status IN ('present', 'absent', 'excused', 'late'));
