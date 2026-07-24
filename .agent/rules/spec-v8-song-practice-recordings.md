# Choir Collective App — Addendum: Song Practice Recordings (Record / Upload Audio)

> Read alongside `AGENTS.md`, `frontend-design-standards.md`,
> `nextjs-performance-skill.md`, and prior `spec-v*.md` / addenda in
> `.agent/rules/` before writing any code. Save this file under
> `.agent/rules/` alongside the others.

**Before writing any code, check what already exists.** The database
already has a `public.practice_tracks` table
(`id, song_id, voice_part, file_url, created_at`) from the original
schema (`supabase/migrations/20260717000000_init.sql`), with RLS
policies `authenticated_view_tracks` (any authenticated user can read)
and `editors_modify_tracks` (currently director/secretary/super_admin
only). As far as this spec's author can tell, **no server actions or UI
were ever built against this table** — grep the codebase for
`practice_tracks` before starting to confirm that's still true. If any
actions/components already exist, extend them rather than duplicating —
do not create a second, parallel table or a second set of actions doing
the same job.

---

## 0. Goal

Choir members currently record themselves singing a song's voicing/part
during rehearsal, but there's nowhere in the app to store or share those
recordings — they end up scattered across phones. We want:

1. A member can **record directly in the browser** (mic button, no
   external app needed) or **upload an existing audio file**, attached
   to a specific song.
2. Any approved member can do this for themselves — they are not
   restricted to admin roles — but the recording is automatically
   tagged with **their own voice part** (from their profile), not a
   voice part they pick arbitrarily.
3. Recordings show as **one combined list per song** (not split into
   separate voice-part tabs) — each entry just displays who recorded it
   and what voice part they sing, so members can tell whose part is
   whose without the list itself being partitioned.
4. This lives on the song's lyrics page (`/repertoire/[id]`) — "the
   repertoire lyrics" — so a member can read the lyrics and immediately
   play back a reference recording for that song.

---

## 1. Database Migration

New timestamp-ordered file under `supabase/migrations/`, e.g.
`20260726000000_practice_track_uploads.sql`. Extend the existing table
rather than replacing it:

```sql
-- 1. Track who uploaded each recording (needed so members can delete their own)
ALTER TABLE public.practice_tracks
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Optional label (e.g. "Verse 1 run-through", "Full song - take 2")
ALTER TABLE public.practice_tracks
  ADD COLUMN IF NOT EXISTS label TEXT;

CREATE INDEX IF NOT EXISTS idx_practice_tracks_song_id ON public.practice_tracks(song_id);
CREATE INDEX IF NOT EXISTS idx_practice_tracks_uploaded_by ON public.practice_tracks(uploaded_by);

-- 3. Replace the existing editors-only write policy: any approved member
--    can insert their OWN recording; director/secretary/super_admin can
--    do anything (including deleting anyone's, for moderation)
DROP POLICY IF EXISTS "editors_modify_tracks" ON public.practice_tracks;

CREATE POLICY "members_insert_own_practice_track" ON public.practice_tracks
  FOR INSERT
  WITH CHECK (
    auth.uid() = uploaded_by
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role NOT IN ('pending', 'rejected')
    )
  );

CREATE POLICY "owner_or_admin_delete_practice_track" ON public.practice_tracks
  FOR DELETE
  USING (
    auth.uid() = uploaded_by
    OR EXISTS (
      SELECT 1 FROM public.profiles a
      WHERE a.id = auth.uid() AND a.role IN ('super_admin', 'director', 'secretary')
    )
  );

CREATE POLICY "admin_update_practice_track" ON public.practice_tracks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles a
      WHERE a.id = auth.uid() AND a.role IN ('super_admin', 'director', 'secretary')
    )
  );

-- authenticated_view_tracks (SELECT policy) already exists from init — leave it as-is.

-- 4. Storage bucket for the actual audio files (mirrors the existing
--    avatars/profile_photos bucket pattern in
--    20260722000001_avatars_storage_bucket.sql / 20260724000000_profile_photos.sql)
INSERT INTO storage.buckets (id, name, public)
VALUES ('practice_tracks', 'practice_tracks', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read access for practice_tracks bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload access for practice_tracks bucket" ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin delete access for practice_tracks bucket" ON storage.objects;

CREATE POLICY "Public read access for practice_tracks bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'practice_tracks');

CREATE POLICY "Authenticated upload access for practice_tracks bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'practice_tracks' AND auth.uid() IS NOT NULL);

CREATE POLICY "Owner or admin delete access for practice_tracks bucket"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'practice_tracks' AND (
      auth.uid() IS NOT NULL
      -- fine-grained per-object ownership is enforced at the DB row level
      -- in practice_tracks; storage-level delete just requires auth
    )
  );
```

---

## 2. Server Actions

New file `src/app/repertoire/[id]/recordings-actions.ts` (or extend
`src/app/admin/songs/actions.ts` if the team prefers — pick one and be
consistent). Mirror the existing upload pattern in
`src/app/directory/[id]/actions.ts`'s `uploadProfilePhotoAction`
(Buffer conversion, admin client for storage + DB insert, cleanup on
partial failure).

- `listPracticeRecordings(songId: string)` — returns all recordings for
  a song joined with uploader's `full_name` and `voice_part` from
  `profiles`, newest first. Any authenticated non-pending/rejected role.
- `uploadPracticeRecording(songId: string, formData: FormData)`:
  1. Get current user; reject if not authenticated or `pending`/`rejected`.
  2. Read the uploader's own `voice_part` from their profile — **do not**
     accept a voice part from the client; the row's `voice_part` is
     always the uploader's own, server-side, matching the "only their
     own voice part" rule.
  3. Validate file: audio mime type only (`audio/webm`, `audio/mp4`,
     `audio/mpeg`, `audio/wav`, etc.), reasonable size cap (e.g. 15MB —
     confirm with the team, but don't leave it unbounded).
  4. Upload to the `practice_tracks` storage bucket at a path like
     `${songId}/${userId}_${Date.now()}.<ext>`.
  5. Insert the `practice_tracks` row (`song_id`, `uploaded_by`,
     `voice_part` from step 2, `file_url`, optional `label`).
  6. **Confirm the insert with `.select()`** and treat an empty result
     as failure — don't report success on an unconfirmed write (per this
     repo's standing "no silent failures" rule).
  7. On DB insert failure after a successful storage upload, delete the
     uploaded storage object to avoid orphaned files (mirrors
     `uploadProfilePhotoAction`'s cleanup pattern).
  8. `revalidatePath('/repertoire/${songId}')`.
- `deletePracticeRecording(recordingId: string)`:
  1. Verify the caller is either the `uploaded_by` owner or has an admin
     role (RLS also enforces this, but check server-side too so the
     error message can be specific).
  2. Delete the storage object, then the DB row; confirm both.
  3. `revalidatePath`.

---

## 3. UI — Recording Panel on the Song Lyrics Page

Add a new component, e.g. `src/app/repertoire/[id]/PracticeRecordings.tsx`,
rendered inside `SongViewerClient.tsx` below (or beside, on larger
screens) the lyrics pane. Follow `frontend-design-standards.md` exactly
— `glass-container`, existing button classes, `useToast` for every
success/failure, `ConfirmModal` before delete, loading/pending states.

### 3.1 Record button (in-browser recording)
- Use the browser `MediaRecorder` API (`navigator.mediaDevices.getUserMedia({ audio: true })`).
- States: idle → requesting mic permission → recording (show elapsed
  time + a stop button, red recording indicator per existing `.badge`
  color conventions) → recorded/preview (playback the take with a native
  `<audio>` element, "Save" / "Discard & Re-record" buttons) → uploading
  → success.
- Handle mic-permission-denied explicitly with a clear inline message
  (not a silent failure) — this is a common real-world failure mode.
- On "Save", pass the recorded `Blob` into `uploadPracticeRecording` as
  part of a `FormData`.

### 3.2 Upload button (file picker alternative)
- Standard `<input type="file" accept="audio/*">`, same size/type
  validation as the record flow, same upload action.
- Follow the existing `PhotoGallery.tsx` upload-button styling pattern
  (label-wrapped hidden input, `.btn-secondary`, disabled + "Uploading…"
  state while in flight).

### 3.3 Recordings list
- One flat, chronological list per song (no voice-part tabs, per the
  team's decision) — each row shows:
  - Uploader's `full_name`
  - A small voice-part badge (reuse the accent-colored badge look
    already used elsewhere, e.g. `DirectoryClient.tsx`'s
    `VOICE_COLORS` mapping) so members can visually tell whose part a
    recording is without the list being split
  - Relative/short date (`created_at`)
  - Optional `label` if provided
  - Native `<audio controls>` player (works on both web and the
    Capacitor WebView — no special native plugin needed for playback)
  - A delete icon button, shown only if `currentUser.id === uploaded_by`
    or `currentUser.role` is director/secretary/super_admin (matches
    `deletePracticeRecording`'s permission), wrapped in `ConfirmModal`
- Empty state: friendly prompt ("No recordings yet — be the first to
  record this song's voicing!") with the record/upload controls
  prominent, per the component-states checklist in
  `frontend-design-standards.md` §3.
- Loading state via `loading.tsx` + a matching skeleton, following
  `src/app/repertoire/[id]/loading.tsx`'s existing pattern.

---

## 4. Data Fetching

Update `src/app/repertoire/[id]/page.tsx` to fetch the song's recordings
server-side (via `listPracticeRecordings`) alongside the existing song
query (`Promise.all` them — they're independent), and pass down to
`SongViewerClient` → `PracticeRecordings`.

---

## 5. Native / Capacitor Considerations

Recording audio in-browser inside the Capacitor Android WebView requires
the `RECORD_AUDIO` permission:
- Add `<uses-permission android:name="android.permission.RECORD_AUDIO" />`
  to `android/app/src/main/AndroidManifest.xml` if not already present.
- `getUserMedia({ audio: true })` inside a WebView should trigger the
  native Android permission prompt automatically once that manifest
  permission exists — verify this on a real device/emulator, not just
  assumed, per this repo's Capacitor-parity standing rule.
- Playback via native `<audio>` requires no extra plugin.
- If recording doesn't work reliably inside the WebView on real devices,
  the fallback is: keep the upload-a-file path fully functional
  regardless (a member can always record with their phone's native
  camera/voice app and upload the resulting file), so the feature isn't
  fully blocked by any WebView recording quirk.

---

## 6. Permissions Summary

| Action | Allowed |
|---|---|
| View / play recordings for a song | Any authenticated, non-pending/rejected role |
| Record or upload a recording | Any authenticated, non-pending/rejected role — tagged with their own `voice_part` automatically, not user-selectable |
| Delete a recording | The uploader themselves, or `director` / `secretary` / `super_admin` (moderation) |
| Rename/edit a recording's label | Same as delete, if this is included |

This intentionally **loosens** the old `editors_modify_tracks` policy
(which was director/secretary/super_admin-only) to let any approved
member upload their own — confirm this is the intended direction before
applying the migration, since it changes existing access behavior for a
table that (per §0) may have been admin-only by original design intent
even if unused so far.

---

## 7. Definition of Done

1. `practice_tracks` table extended (not replaced) with `uploaded_by`
   and `label`; new RLS policies applied; storage bucket created.
2. Any approved member can record in-browser or upload a file for a
   song, and the resulting row is tagged with their own voice part
   automatically (verified by testing as a non-admin `member` role, not
   just `super_admin`).
3. Recordings appear as one combined, chronological list per song on
   `/repertoire/[id]`, each showing uploader name + voice-part badge +
   playable audio + delete (if owner/admin).
4. Mic-permission-denied and upload-failure paths show a clear message
   via `useToast`/inline alert — never a silent failure.
5. Deleting a recording removes both the storage object and the DB row,
   confirmed via `.select()`, not assumed from a lack of thrown error.
6. Verified on both the web deployment and the Capacitor Android build
   (record + upload + playback), with `RECORD_AUDIO` permission present
   in the manifest.
