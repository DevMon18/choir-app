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
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/12 flex items-center justify-center mx-auto mb-5 text-success">
          <svg width="32" height="32" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-xl sm:text-[1.35rem] font-bold text-primary mb-3">Check your inbox</h2>
        <p className="text-muted text-xs sm:text-sm leading-relaxed m-0">
          If an account exists for <strong>{email}</strong>, you&apos;ll receive a password reset link shortly.
        </p>
        <Link href="/login" className="btn btn-secondary mt-7 inline-block">
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="auth-header stagger-item text-center mb-6">
        <h1 className="auth-title text-2xl sm:text-3xl font-bold text-foreground">Reset Password</h1>
        <p className="auth-subtitle text-muted text-xs sm:text-sm mt-1">Enter your email and we&apos;ll send a reset link</p>
      </div>

      {error && (
        <div className="alert alert-error stagger-item mb-4">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="input-group stagger-item !mb-0">
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
          className={`btn btn-primary form-submit-btn stagger-item !p-3 text-base font-semibold ${loading ? 'btn-disabled' : ''}`}
          disabled={loading}
        >
          {loading ? 'Sending link...' : 'Send Reset Link'}
        </button>
      </form>

      <div className="auth-footer stagger-item mt-6 text-center text-xs sm:text-sm text-muted">
        <Link href="/login" className="auth-link text-primary font-semibold hover:underline">← Back to Sign In</Link>
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
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/12 flex items-center justify-center mx-auto mb-5 text-success">
          <svg width="32" height="32" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-xl sm:text-[1.35rem] font-bold text-primary mb-3">Password updated!</h2>
        <p className="text-muted text-xs sm:text-sm m-0">Your password has been changed successfully.</p>
        <Link href="/login" className="btn btn-primary mt-7 inline-block">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="auth-header stagger-item text-center mb-6">
        <h1 className="auth-title text-2xl sm:text-3xl font-bold text-foreground">Choose New Password</h1>
        <p className="auth-subtitle text-muted text-xs sm:text-sm mt-1">Pick a strong password for your account</p>
      </div>

      {error && (
        <div className="alert alert-error stagger-item mb-4">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="input-group stagger-item !mb-0">
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

        <div className="input-group stagger-item !mb-0">
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
          className={`btn btn-primary form-submit-btn stagger-item !p-3 text-base font-semibold ${loading ? 'btn-disabled' : ''}`}
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
        { opacity: 1, y: 0, scale: 1, duration: 0.6, clearProps: 'opacity,transform' }
      );
      tl.fromTo('.stagger-item',
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, clearProps: 'opacity,transform' },
        '-=0.3'
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
      className="auth-card glass-container max-w-[440px] w-full p-8 sm:p-10 rounded-2xl bg-white/80 border border-glass-border shadow-xl"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {hasResetCode ? <UpdatePasswordForm /> : <RequestResetForm />}
    </div>
  );
};

const ResetPasswordPage = () => {
  return (
    <main className="auth-page min-h-screen flex items-center justify-center p-4 relative">
      <div className="bg-orb bg-orb-1 w-[450px] h-[450px]" />
      <div className="bg-orb bg-orb-2 w-[400px] h-[400px]" />
      <Suspense fallback={
        <div className="auth-card glass-container max-w-[440px] w-full p-8 sm:p-10 rounded-2xl bg-white/80 border border-glass-border shadow-xl flex items-center justify-center min-h-[200px]">
          <span className="text-muted text-sm">Loading...</span>
        </div>
      }>
        <ResetPasswordInner />
      </Suspense>
    </main>
  );
};

export default ResetPasswordPage;

