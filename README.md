# 🎵 Choir Collective (`DevMon18/choir-app`)

> **St. Joseph the Worker Parish Choir Collective Management System**  
> An enterprise-grade, performance-optimized management platform for choir members, directors, secretaries, and treasurers.

---

## 🚀 Key Features

- **Dashboard & Activity Feed**: Centralized announcement hub, upcoming calendar events, birthday highlights, and choir notifications.
- **Song Repertoire & Mass Parts**: Organized catalog of choir songs sectioned by Liturgical Mass Parts (Entrance, Kyrie, Gloria, Psalm, Gospel Acclamation, Offertory, Sanctus, Memorial Acclamation, Amen, Lord's Prayer, Lamb of God, Communion, Recessional).
- **Interactive Sheet Music**: ChordPro lyrics renderer with instant transposition, auto-scroll control, and printable formatting.
- **Live Sync Engine**: Realtime synchronization between Choir Director and members during Mass services.
- **Member Directory & Roster**: Voice part filtering (Soprano, Alto, Tenor, Bass), birthday tracking, and profile management.
- **Attendance & Finances**: Administrative attendance recording, monthly dues tracking, and financial analytics.
- **Messaging & Notifications**: Direct messaging, group chats, Web-Push & Capacitor FCM push notifications.
- **Mobile Native Ready**: Capacitor 8 native integration for Android devices.

---

## 🛠️ Technology Stack

- **Core**: Next.js 16.2 (App Router + Turbopack), React 19, TypeScript 5
- **Backend & Database**: Supabase (PostgreSQL 15+, Row Level Security, Realtime, Auth, Storage)
- **Caching & Infrastructure**: Upstash Redis (rate limiting & data caching), `@upstash/ratelimit`
- **Mobile**: Capacitor 8 (`@capacitor/core`, `@capacitor/push-notifications`, `@capacitor/local-notifications`)
- **Styling & UI**: Vanilla CSS design system, Glassmorphism, Lucide icons, GSAP animations

---

## 🔐 Security & Permission Model

Enforces a 3-tier security model (UI -> Server Actions -> Database RLS).

### Roles & Permissions
- `super_admin` — Full platform management & audit access.
- `director` — Music repertoire, sequences, live sync, announcements, and member approval.
- `secretary` — Member management, attendance, roster, announcements, and songs.
- `treasurer` — Dues tracking, financial records, and financial analytics.
- `member` — Repertoire viewing, live sync participation, directory, messaging, dues viewing.

See detailed documentation in [`docs/security.md`](file:///f:/Choir-App/docs/security.md).

---

## 📚 Technical Documentation

Detailed architecture blueprints and technical guides:

- 📐 **[Architecture Overview](file:///f:/Choir-App/docs/architecture.md)** — App Router design, RSC boundaries, middleware proxy, SWR cache.
- 🔒 **[Security & Authorization](file:///f:/Choir-App/docs/security.md)** — RBAC permission matrix, RLS policies, audit logging.

---

## 💻 Local Development Setup

### Prerequisites
- Node.js 20+
- npm 10+
- Supabase Project & Credentials

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/DevMon18/choir-app.git
   cd choir-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Copy `.env.example` to `.env.local` and populate required keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-redis-token
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Navigate to [http://localhost:3000](http://localhost:3000).

5. **Typecheck & Build Verification:**
   ```bash
   npx tsc --noEmit
   npm run build
   ```
