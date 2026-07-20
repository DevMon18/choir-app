import { logout } from '../actions';
import { getCachedUser } from '@/lib/supabase/user';
import React from 'react';

const PendingApprovalPage = async () => {
  const user = await getCachedUser();

  const isConfirmed = !!user?.email_confirmed_at;

  return (
    <main className="auth-page">
      <div className="auth-card glass-container" style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '16px',
              borderRadius: '50%',
              background: isConfirmed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              color: isConfirmed ? 'var(--success)' : 'var(--warning)',
              marginBottom: '16px',
            }}
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
          <h1 className="auth-title" style={{ fontSize: '1.75rem' }}>
            {isConfirmed ? 'Awaiting Approval' : 'Confirm Your Email'}
          </h1>
          <p className="auth-subtitle" style={{ marginTop: '8px' }}>
            {isConfirmed
              ? `Hi ${user?.user_metadata?.full_name || 'there'}, your email is confirmed. A director or secretary will review and approve your access soon.`
              : 'Before our directors can approve your access, you must confirm your email. We sent a verification link to your email address.'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!isConfirmed && (
            <div className="alert alert-warning" style={{ margin: '0 0 12px 0', textAlign: 'left' }}>
              <span>Awaiting email confirmation. Please check your inbox (and spam folder) for the verification link.</span>
            </div>
          )}

          <form action={logout}>
            <button type="submit" className="btn btn-secondary" style={{ width: '100%' }}>
              Log Out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
};

export default PendingApprovalPage;
