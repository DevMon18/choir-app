'use client';

import React, { Suspense, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { requestPasswordReset, updatePassword } from './actions';
import { PasswordInput } from '@/components/PasswordInput';
import gsap from 'gsap';

// Stage 1: enter email to receive reset link
const RequestResetForm = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const result = await requestPasswordReset(fd);
    setLoading(false);

    if (result?.error) {
      setError(result.error);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(34,197,94,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width="32" height="32" viewBox="0 0 20 20" fill="var(--success)">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '12px' }}>Check your inbox</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
          If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly.
        </p>
        <Link href="/login" className="btn btn-secondary" style={{ marginTop: '28px', display: 'inline-block' }}>
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="auth-header stagger-item">
        <h1 className="auth-title">Reset Password</h1>
        <p className="auth-subtitle">Enter your email and we'll send a reset link</p>
      </div>

      {error && (
        <div className="alert alert-error stagger-item">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="input-group stagger-item">
          <label className="input-label" htmlFor="email">Email Address</label>
          <input
            className="input-field"
            type="email"
            id="email"
            name="email"
            placeholder="you@choir.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          className={`btn btn-primary form-submit-btn stagger-item ${loading ? 'btn-disabled' : ''}`}
          disabled={loading}
        >
          {loading ? 'Sending link...' : 'Send Reset Link'}
        </button>
      </form>

      <div className="auth-footer stagger-item">
        <Link href="/login" className="auth-link">← Back to Sign In</Link>
      </div>
    </>
  );
};

// Stage 2: set new password (user arrived from the email link)
const UpdatePasswordForm = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const result = await updatePassword(fd);
    setLoading(false);

    if (result?.error) {
      setError(result.error);
    } else {
      setDone(true);
    }
  };

  if (done) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(34,197,94,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width="32" height="32" viewBox="0 0 20 20" fill="var(--success)">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '12px' }}>Password updated!</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>Your password has been changed successfully.</p>
        <Link href="/login" className="btn btn-primary" style={{ marginTop: '28px', display: 'inline-block' }}>
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="auth-header stagger-item">
        <h1 className="auth-title">Choose New Password</h1>
        <p className="auth-subtitle">Pick a strong password for your account</p>
      </div>

      {error && (
        <div className="alert alert-error stagger-item">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="input-group stagger-item">
          <PasswordInput
            label="New Password"
            id="password"
            name="password"
            placeholder="At least 8 characters"
            minLength={8}
            required
            disabled={loading}
          />
        </div>

        <div className="input-group stagger-item">
          <PasswordInput
            label="Confirm New Password"
            id="confirmPassword"
            name="confirmPassword"
            placeholder="••••••••"
            minLength={8}
            required
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          className={`btn btn-primary form-submit-btn stagger-item ${loading ? 'btn-disabled' : ''}`}
          disabled={loading}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </>
  );
};

const ResetPasswordInner = () => {
  const cardRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  // Supabase appends `code` to the URL when redirecting from the reset email
  const hasResetCode = searchParams.has('code');

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo(cardRef.current,
        { opacity: 0, y: 30, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8 }
      );
      tl.fromTo('.stagger-item',
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08 },
        '-=0.4'
      );
    });
    return () => ctx.revert();
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    gsap.to(card, {
      rotateX: (y / (rect.height / 2)) * -6,
      rotateY: (x / (rect.width / 2)) * 6,
      y: -6,
      duration: 0.3,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    gsap.to(card, { rotateX: 0, rotateY: 0, y: 0, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
  };

  return (
    <div
      ref={cardRef}
      className="auth-card glass-container"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ opacity: 0 }}
    >
      {hasResetCode ? <UpdatePasswordForm /> : <RequestResetForm />}
    </div>
  );
};

const ResetPasswordPage = () => {
  return (
    <main className="auth-page">
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>
      <Suspense fallback={
        <div className="auth-card glass-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
          <span style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>Loading...</span>
        </div>
      }>
        <ResetPasswordInner />
      </Suspense>
    </main>
  );
};

export default ResetPasswordPage;

