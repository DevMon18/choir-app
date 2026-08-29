import { logout } from '../actions';
import { getCachedUser } from '@/lib/supabase/user';
import React from 'react';

const PendingApprovalPage = async () => {
  const user = await getCachedUser();

  const isConfirmed = !!user?.email_confirmed_at;

  return (
    <main className="auth-page min-h-screen flex items-center justify-center p-4">
      <div className="auth-card glass-container max-w-[480px] w-full p-8 text-center rounded-2xl bg-white/80 border border-glass-border shadow-xl">
        <div className="mb-6">
          <div
            className={`inline-flex p-4 rounded-full mb-4 ${
              isConfirmed ? 'bg-emerald-500/10 text-success' : 'bg-amber-500/10 text-warning'
            }`}
          >
            {isConfirmed ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            )}
          </div>
          <h1 className="auth-title text-2xl sm:text-[1.75rem] font-bold text-foreground">
            {isConfirmed ? 'Awaiting Approval' : 'Confirm Your Email'}
          </h1>
          <p className="auth-subtitle text-muted text-xs sm:text-sm mt-2">
            {isConfirmed
              ? `Hi ${user?.user_metadata?.full_name || 'there'}, your email is confirmed. A director or secretary will review and approve your access soon.`
              : 'Before our directors can approve your access, you must confirm your email. We sent a verification link to your email address.'}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {!isConfirmed && (
            <div className="alert alert-warning m-0 mb-3 text-left">
              <span>Awaiting email confirmation. Please check your inbox (and spam folder) for the verification link.</span>
            </div>
          )}

          <form action={logout}>
            <button type="submit" className="btn btn-secondary w-full">
              Log Out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
};

export default PendingApprovalPage;
