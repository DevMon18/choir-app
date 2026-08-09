# Choir Collective — Engineering Architecture Blueprint

## System Overview

Choir Collective (`DevMon18/choir-app`) is a Next.js 16 (App Router + Turbopack) application integrated with Supabase (PostgreSQL, Authentication, Realtime, Storage), Upstash Redis (rate limiting & data caching), and Capacitor 8 (native Android mobile integration).

```
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js 16 App Router                        │
│ ┌──────────────────────┐  ┌───────────────────────────────────┐ │
│ │  Server Components   │  │        Client Components          │ │
│ │  (RSC Layouts/Pages) │  │ (Forms, Realtime, SWR Navigation) │ │
│ └──────────┬───────────┘  └─────────────────┬─────────────────┘ │
└────────────┼────────────────────────────────┼───────────────────┘
             │                                │
             ▼                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Proxy Middleware & Security                     │
│ ┌──────────────────────┐  ┌───────────────────────────────────┐ │
│ │   src/proxy.ts       │  │   Upstash Distributed Rate Limit  │ │
│ └──────────┬───────────┘  └─────────────────┬─────────────────┘ │
└────────────┼────────────────────────────────┼───────────────────┘
             │                                │
             ▼                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Supabase & Storage Platform                   │
│ ┌──────────────────────┐  ┌───────────────────────────────────┐ │
│ │ PostgreSQL + RLS     │  │ Supabase Realtime & Web Push      │ │
│ └──────────────────────┘  └───────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architectural Layers

### 1. Presentation Layer (React Server Components + Client Boundaries)
- **Server Components (RSC):** Utilized by default for all page entry points (`/dashboard`, `/directory`, `/repertoire`, `/calendar`, `/admin/*`). Pre-fetches server data with zero bundle overhead.
- **Client Components (`"use client"`):** Restricted strictly to interactive boundaries requiring React hooks, DOM event listeners, media players, or realtime channels.

### 2. State & Client Cache Layer (`ClientCacheContext.tsx`)
- Facebook-style SWR client cache supporting **Instant 0ms Client Navigation**.
- Uses version-counter change detection instead of `JSON.stringify` serialization, preventing garbage collection spikes on large lists.

### 3. Middleware & Proxy Layer (`src/proxy.ts`)
- Edge proxy handling authentication session renewal, 1-year maxAge cookie persistence for native app logins, and IP-based rate limiting.
- Zero-database-query JWT role extraction via `user.app_metadata.role`.

### 4. Database & Row Level Security (RLS) Layer
- PostgreSQL tables with strict Row Level Security policies.
- Database trigger (`sync_role_to_metadata`) automatically propagates `profiles.role` mutations into `auth.users.app_metadata`.

---

## Folder Structure Blueprint

```
f:/Choir-App/
├── src/
│   ├── app/                    # Next.js App Router routes & Server Actions
│   │   ├── (auth)/             # Auth routes (login, signup, reset-password)
│   │   ├── admin/              # Administrative modules (users, roster, songs, etc.)
│   │   ├── calendar/           # Calendar & rehearsal events
│   │   ├── dashboard/          # Central dashboard
│   │   ├── directory/          # Member directory
│   │   ├── dues/               # Choir financial dues tracking
│   │   ├── live/               # Live session Director sync
│   │   ├── messages/           # Direct & group messaging
│   │   ├── repertoire/         # Song Repertoire & Mass Parts
│   │   └── manifest.ts         # PWA Web App Manifest
│   │
│   ├── components/             # Reusable UI & Layout components
│   │   ├── Navbar.tsx          # Responsive navbar & bottom mobile menu
│   │   ├── ChordProRenderer.tsx# Interactive sheet music renderer
│   │   ├── Toast.tsx           # Global notification toast system
│   │   └── CapacitorManager.tsx# Native Android push notification listener
│   │
│   ├── context/
│   │   └── ClientCacheContext.tsx # SWR instant navigation cache
│   │
│   ├── lib/                    # Infrastructure, security & utility modules
│   │   ├── auth/               # Permission-based RBAC authorization
│   │   ├── errors.ts           # Application error classes & result wrappers
│   │   ├── logging.ts          # Structured logger with sanitization
│   │   ├── audit.ts            # Admin audit log recorder
│   │   ├── ratelimit.ts        # Upstash Redis rate limiters
│   │   ├── cache.ts            # Server-side Redis cache helper
│   │   └── push.ts             # Web-Push & FCM notification dispatcher
│   │
│   └── proxy.ts                # Next.js 16 Proxy Middleware
│
├── supabase/
│   └── migrations/             # Versioned SQL migrations & RLS policies
│
├── docs/                       # Technical architecture & security documentation
└── android/                    # Capacitor Android native project files
```
