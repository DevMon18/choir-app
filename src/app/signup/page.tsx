'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { signupWithEmail } from './actions';
import { loginWithGoogle } from '../login/actions';
import gsap from 'gsap';

import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

const SignupPage = () => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);

  const [showPassword, setShowPassword] = useState<boolean>(false);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      
      tl.fromTo(cardRef.current, 
        { opacity: 0, y: 30, scale: 0.98 }, 
        { opacity: 1, y: 0, scale: 1, duration: 0.8 }
      );

      tl.fromTo(
        '.stagger-item',
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
    <main className="auth-page">
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>

      <div
        ref={cardRef}
        className="auth-card glass-container"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ opacity: 0 }}
      >
        <div className="auth-header stagger-item">
          <h1 className="auth-title">Join the Choir</h1>
          <p className="auth-subtitle">Request access to the Choir Collective platform</p>
        </div>

        {error && (
          <div className="alert alert-error stagger-item">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success stagger-item">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        <div className="stagger-item" style={{ marginBottom: '1.25rem' }}>
          <button
            type="button"
            className={`btn btn-secondary form-submit-btn ${googleLoading ? 'btn-disabled' : ''}`}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
            }}
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
            {googleLoading ? 'Connecting to Google...' : 'Sign up with Google'}
          </button>
        </div>

        <div
          className="divider stagger-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            textAlign: 'center',
            margin: '1.25rem 0',
            color: 'var(--muted)',
            fontSize: '0.8rem',
            fontWeight: '600'
          }}
        >
          <div style={{ flex: 1, borderBottom: '1px solid var(--glass-border)' }}></div>
          <span style={{ padding: '0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>OR</span>
          <div style={{ flex: 1, borderBottom: '1px solid var(--glass-border)' }}></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group stagger-item">
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

          <div className="input-group stagger-item">
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

          <div className="input-group stagger-item">
            <label className="input-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input-field"
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                placeholder="Choose a strong password"
                required
                disabled={loading}
                style={{ paddingRight: '48px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: '12px',
                  minWidth: '48px',
                  minHeight: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={`btn btn-primary form-submit-btn stagger-item ${loading ? 'btn-disabled' : ''}`}
            disabled={loading}
          >
            {loading ? 'Submitting request...' : 'Submit Request'}
          </button>
        </form>

        <div className="auth-footer stagger-item">
          Already have an account?{' '}
          <Link href="/login" className="auth-link">
            Sign in instead
          </Link>
        </div>
      </div>
    </main>
  );
};

export default SignupPage;
