# Choir Collective App — Addendum: Song Categories / Tags System

> Read alongside `AGENTS.md`, `frontend-design-standards.md`,
> `nextjs-performance-skill.md`, and prior `spec-v*.md` addenda in
> `.agent/rules/` before writing any code. This addendum replaces the
> hardcoded `CATEGORIES` array in `SongForm.tsx` and the single free-text
> `songs.category` column with an admin-managed, multi-select tagging
> system.

---

## 0. Goal

Replace single free-text `songs.category` column and hardcoded `CATEGORIES` array with:
1. Admin-managed `song_categories` controlled vocabulary table.
2. Many-to-many `song_category_links` join table allowing multiple category tags per song.
3. Multi-select tag picker in `SongForm.tsx` with inline category creation.
4. Category manager tab in `/admin/songs`.
5. Multi-tag badge rendering and filtering in Repertoire, Live Session, and Mass Sequences.
