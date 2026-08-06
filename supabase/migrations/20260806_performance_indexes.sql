-- ============================================================
-- PERFORMANCE OPTIMIZATION: B-TREE INDEXES FOR SUPABASE
-- ============================================================

-- 1. Profiles Table Indexes (Directory, Voice Part Filtering, Roles)
CREATE INDEX IF NOT EXISTS idx_profiles_voice_part ON profiles(voice_part);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);

-- 2. Songs & Category Links Indexes (Repertoire & Songs Manager)
CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
CREATE INDEX IF NOT EXISTS idx_songs_category ON songs(category);
CREATE INDEX IF NOT EXISTS idx_songs_archived ON songs(is_archived);
CREATE INDEX IF NOT EXISTS idx_song_category_links_song_id ON song_category_links(song_id);
CREATE INDEX IF NOT EXISTS idx_song_category_links_category_id ON song_category_links(category_id);

-- 3. Attendance Sessions & Records Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON attendance_sessions(date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session_id ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_profile_id ON attendance_records(profile_id);

-- 4. Messages & Conversations Indexes (Direct Messaging)
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(participant_one, participant_two);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at ASC);

-- 5. Member Dues & Finances Indexes
CREATE INDEX IF NOT EXISTS idx_member_dues_status ON member_dues(status);
