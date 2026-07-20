'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { signupWithEmail } from './actions';
import gsap from 'gsap';

const SignupPage = () => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

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
            <input
              className="input-field"
              type="password"
              id="password"
              name="password"
              placeholder="Choose a strong password"
              required
              disabled={loading}
            />
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
