import { logout } from '../actions';
import { getCachedUser } from '@/lib/supabase/user';
import React from 'react';

const RejectedPage = async () => {
  const user = await getCachedUser();

  return (
    <main className="auth-page min-h-screen flex items-center justify-center p-4">
      <div className="auth-card glass-container max-w-[480px] w-full p-8 text-center rounded-2xl bg-white/80 border border-glass-border shadow-xl">
        <div className="mb-6">
          <div className="inline-flex p-4 rounded-full bg-red-500/10 text-error mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="auth-title text-2xl sm:text-[1.75rem] font-bold text-error">
            Access Request Rejected
          </h1>
          <p className="auth-subtitle text-muted text-xs sm:text-sm mt-2">
            Hi {user?.user_metadata?.full_name || 'there'}, unfortunately, your request to join the Choir Collective has been declined.
          </p>
        </div>

        <form action={logout}>
          <button type="submit" className="btn btn-secondary w-full">
            Log Out
          </button>
        </form>
      </div>
    </main>
  );
};

export default RejectedPage;
