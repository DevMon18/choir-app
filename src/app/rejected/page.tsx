import { createClient } from '@/lib/supabase/server';
import { logout } from '../actions';
import React from 'react';

const RejectedPage = async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="auth-page">
      <div className="auth-card glass-container" style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '16px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--error)',
              marginBottom: '16px',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="auth-title" style={{ fontSize: '1.75rem', color: 'var(--error)' }}>
            Access Request Rejected
          </h1>
          <p className="auth-subtitle" style={{ marginTop: '8px' }}>
            Hi {user?.user_metadata?.full_name || 'there'}, unfortunately, your request to join the Choir Collective has been declined.
          </p>
        </div>

        <form action={logout}>
          <button type="submit" className="btn btn-secondary" style={{ width: '100%' }}>
            Log Out
          </button>
        </form>
      </div>
    </main>
  );
};

export default RejectedPage;
