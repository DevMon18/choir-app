'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { signupWithEmail } from './actions';
import { loginWithGoogle } from '../login/actions';
import { PasswordInput } from '@/components/PasswordInput';
import gsap from 'gsap';

import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

const SignupPage = () => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      
      tl.fromTo(cardRef.current, 
        { opacity: 0, y: 30, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.6, clearProps: 'opacity,transform' }
      );

      tl.fromTo(
        '.stagger-item',
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, clearProps: 'opacity,transform' },
        '-=0.3'
      );
    });

    return () => ctx.revert();
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.removeProperty('--mouse-x');
    cardRef.current.style.removeProperty('--mouse-y');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const form = e.currentTarget; // capture before await clears it
    const formData = new FormData(form);
    const result = await signupWithEmail(formData);

    setLoading(false);
    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setSuccess(result.success);
      form.reset();
    }
  };

  const handleGoogleSignup = async () => {
    setError(null);
    setGoogleLoading(true);

    if (Capacitor.isNativePlatform()) {
      const result = await loginWithGoogle(true);
      if (result?.error) {
        setError(result.error);
        setGoogleLoading(false);
      } else if (result?.url) {
        await Browser.open({ url: result.url });
        setGoogleLoading(false);
      }
    } else {
      const result = await loginWithGoogle(false);
      if (result?.error) {
        setError(result.error);
        setGoogleLoading(false);
      }
    }
  };

  return (
    <main className="auth-page min-h-screen flex items-center justify-center p-4 relative">
      <div className="bg-orb bg-orb-1 w-[450px] h-[450px]" />
      <div className="bg-orb bg-orb-2 w-[400px] h-[400px]" />

      <div
        ref={cardRef}
        className="auth-card glass-container max-w-[440px] w-full p-8 sm:p-10 rounded-2xl bg-white/80 border border-glass-border shadow-xl"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="auth-header stagger-item text-center mb-6">
          <h1 className="auth-title text-2xl sm:text-3xl font-bold text-foreground">Join the Choir</h1>
          <p className="auth-subtitle text-muted text-xs sm:text-sm mt-1">Request access to the Choir Collective platform</p>
        </div>

        {error && (
          <div className="alert alert-error stagger-item mb-4">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success stagger-item mb-4">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        <div className="stagger-item mb-5">
          <button
            type="button"
            className={`btn btn-secondary form-submit-btn w-full flex items-center justify-center gap-2.5 !p-3 text-base font-semibold ${googleLoading ? 'btn-disabled' : ''}`}
            onClick={handleGoogleSignup}
            disabled={googleLoading || loading}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.3-1.78L.97 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.97 4.04l2.91-2.26z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.45 2.02.97 4.96l2.91 2.26C4.6 5.05 6.62 3.58 9 3.58z"
              />
            </svg>
            <span>{googleLoading ? 'Connecting to Google...' : 'Sign up with Google'}</span>
          </button>
        </div>

        <div className="divider stagger-item flex items-center text-center my-5 text-muted text-xs font-semibold">
          <div className="flex-1 border-b border-glass-border" />
          <span className="px-2.5 uppercase tracking-wider">OR</span>
          <div className="flex-1 border-b border-glass-border" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="input-group stagger-item !mb-0">
            <label className="input-label" htmlFor="fullName">Full Name</label>
            <input
              className="input-field"
              type="text"
              id="fullName"
              name="fullName"
              placeholder="E.g., Jane Doe"
              required
              disabled={loading}
            />
          </div>

          <div className="input-group stagger-item !mb-0">
            <label className="input-label" htmlFor="email">Email Address</label>
            <input
              className="input-field"
              type="email"
              id="email"
              name="email"
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="input-group stagger-item !mb-0">
            <PasswordInput
              label="Password"
              id="password"
              name="password"
              placeholder="Choose a strong password"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className={`btn btn-primary form-submit-btn stagger-item !p-3 text-base font-semibold ${loading ? 'btn-disabled' : ''}`}
            disabled={loading}
          >
            {loading ? 'Submitting request...' : 'Submit Request'}
          </button>
        </form>

        <div className="auth-footer stagger-item mt-6 text-center text-xs sm:text-sm text-muted">
          Already have an account?{' '}
          <Link href="/login" className="auth-link text-primary font-semibold hover:underline">
            Sign in instead
          </Link>
        </div>
      </div>
    </main>
  );
};

export default SignupPage;
