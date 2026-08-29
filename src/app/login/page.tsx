'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { loginWithEmail, loginWithGoogle } from './actions';
import { PasswordInput } from '@/components/PasswordInput';
import gsap from 'gsap';

import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

const LoginPage = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      
      tl.fromTo(cardRef.current, 
        { opacity: 0, y: 16, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.35, clearProps: 'opacity,transform' }
      );

      tl.fromTo(
        '.stagger-item',
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.03, clearProps: 'opacity,transform' },
        '-=0.15'
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

    const tiltX = (y / (rect.height / 2)) * -6;
    const tiltY = (x / (rect.width / 2)) * 6;

    gsap.to(card, {
      rotateX: tiltX,
      rotateY: tiltY,
      y: -6,
      duration: 0.3,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;

    gsap.to(card, {
      rotateX: 0,
      rotateY: 0,
      y: 0,
      duration: 0.5,
      ease: 'power3.out',
      overwrite: 'auto',
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await loginWithEmail(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
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
        <div className="auth-header stagger-item flex flex-col items-center gap-4 text-center mb-6">
          <Image
            src="/collective-logo.png"
            alt="Choir Collective Logo"
            width={84}
            height={84}
            priority
            className="rounded-full object-cover border-2 border-border shadow-md"
          />
          <div>
            <h1 className="auth-title text-2xl font-bold text-foreground">Choir Collective</h1>
            <p className="auth-subtitle text-muted text-xs sm:text-sm mt-1">Sign in to your account to continue</p>
          </div>
        </div>

        {error && (
          <div className="alert alert-error stagger-item mb-4">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} ref={formRef} className="flex flex-col gap-4">
          <div className="input-group stagger-item !mb-0">
            <label className="input-label" htmlFor="email">Email Address</label>
            <input
              className="input-field"
              type="email"
              id="email"
              name="email"
              placeholder="you@choir.org"
              required
              disabled={loading || googleLoading}
            />
          </div>

          <div className="input-group stagger-item !mb-0">
            <PasswordInput
              label="Password"
              id="password"
              name="password"
              placeholder="••••••••"
              required
              disabled={loading || googleLoading}
            />
          </div>

          <button
            type="submit"
            className={`btn btn-primary form-submit-btn stagger-item !p-3 text-base font-semibold ${loading ? 'btn-disabled' : ''}`}
            disabled={loading || googleLoading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="stagger-item my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-glass-border" />
          <span className="text-xs text-muted font-semibold uppercase">or</span>
          <div className="flex-1 h-px bg-glass-border" />
        </div>

        <button
          onClick={handleGoogleLogin}
          className={`btn btn-secondary form-submit-btn stagger-item w-full flex items-center justify-center gap-2.5 !p-3 text-base font-semibold ${googleLoading ? 'btn-disabled' : ''}`}
          disabled={loading || googleLoading}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7v2.24h2.9c1.69-1.55 2.69-3.85 2.69-6.57z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.24c-.8.54-1.84.87-3.06.87-2.35 0-4.34-1.58-5.05-3.71H.95v2.3A9 9 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.95 10.74A5.4 5.4 0 0 1 3.6 9c0-.6.12-1.17.35-1.74V4.96H.95A8.99 8.99 0 0 0 0 9c0 1.48.36 2.9 1 4.14l2.95-2.4z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15 2.3A8.99 8.99 0 0 0 9 0 9 9 0 0 0 .95 4.96l2.95 2.4C4.61 5.16 6.6 3.58 9 3.58z"
            />
          </svg>
          <span>{googleLoading ? 'Connecting...' : 'Continue with Google'}</span>
        </button>

        <div className="auth-footer stagger-item mt-6 text-center text-xs sm:text-sm text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="auth-link text-primary font-semibold hover:underline">
            Request to join
          </Link>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;
