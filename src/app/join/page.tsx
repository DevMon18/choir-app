'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { submitJoinRequest } from './actions';
import gsap from 'gsap';

export const JoinPage = () => {
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
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.06 },
        '-=0.4'
      );
    });

    return () => ctx.revert();
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only run hover tilt effects on screen widths larger than mobile (768px)
    if (window.innerWidth < 768) return;
    
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    const tiltX = (y / (rect.height / 2)) * -4;
    const tiltY = (x / (rect.width / 2)) * 4;

    gsap.to(card, {
      rotateX: tiltX,
      rotateY: tiltY,
      y: -4,
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

    const formData = new FormData(e.currentTarget);
    const result = await submitJoinRequest(formData);

    setLoading(false);
    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setSuccess(result.success);
      e.currentTarget.reset();
    }
  };

  return (
    <main className="auth-page" style={{ padding: '40px 16px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '400px', height: '400px' }}></div>
      <div className="bg-orb bg-orb-2" style={{ width: '350px', height: '350px' }}></div>

      <div
        ref={cardRef}
        className="auth-card glass-container"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ opacity: 0, width: '100%', maxWidth: '640px', padding: '40px' }}
      >
        <div className="auth-header stagger-item">
          <h1 className="auth-title" style={{ fontSize: '2rem' }}>Join Choir Collective</h1>
          <p className="auth-subtitle">Submit your interest request to join the choir</p>
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section 1: Basic Info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }} className="stagger-item">
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" htmlFor="fullName">Full Name</label>
              <input
                className="input-field"
                type="text"
                id="fullName"
                name="fullName"
                placeholder="Jane Doe"
                required
                disabled={loading}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" htmlFor="email">Email Address</label>
              <input
                className="input-field"
                type="email"
                id="email"
                name="email"
                placeholder="jane.doe@example.com"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Section 2: Contact Info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }} className="stagger-item">
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" htmlFor="contactNumber">Contact Number</label>
              <input
                className="input-field"
                type="tel"
                id="contactNumber"
                name="contactNumber"
                placeholder="+63 917 123 4567"
                required
                disabled={loading}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" htmlFor="voicePart">Voice Type (Voice Part)</label>
              <select
                className="input-field"
                id="voicePart"
                name="voicePart"
                required
                disabled={loading}
                style={{ background: '#ffffff', cursor: 'pointer' }}
              >
                <option value="">Select your voice type</option>
                <option value="Soprano">Soprano</option>
                <option value="Alto">Alto</option>
                <option value="Tenor">Tenor</option>
                <option value="Bass">Bass</option>
              </select>
            </div>
          </div>

          {/* Section 3: Address */}
          <div className="input-group stagger-item" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="address">Address</label>
            <input
              className="input-field"
              type="text"
              id="address"
              name="address"
              placeholder="Unit 123, Maple Building, Oak Street, Metro Manila"
              required
              disabled={loading}
            />
          </div>

          {/* Section 4: Availabilities & Experience */}
          <div className="input-group stagger-item" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="availability">Weekly Availability (Rehearsals & Masses)</label>
            <input
              className="input-field"
              type="text"
              id="availability"
              name="availability"
              placeholder="e.g. Saturdays 2 PM onwards, Sunday Morning Mass"
              required
              disabled={loading}
            />
          </div>

          <div className="input-group stagger-item" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="choirExperience">Choir & Musical Experience</label>
            <textarea
              className="input-field"
              id="choirExperience"
              name="choirExperience"
              placeholder="Detail your vocal or instrumental background, previous choirs, or training."
              rows={3}
              required
              disabled={loading}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="input-group stagger-item" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="reasonForJoining">Reason for Joining the Choir</label>
            <textarea
              className="input-field"
              id="reasonForJoining"
              name="reasonForJoining"
              placeholder="Why do you wish to join our ministry?"
              rows={3}
              required
              disabled={loading}
              style={{ resize: 'vertical' }}
            />
          </div>

          <button
            type="submit"
            className={`btn btn-primary form-submit-btn stagger-item ${loading ? 'btn-disabled' : ''}`}
            disabled={loading}
            style={{ padding: '12px', fontSize: '1rem', fontWeight: 600 }}
          >
            {loading ? 'Submitting Application...' : 'Submit Application'}
          </button>
        </form>

        <div className="auth-footer stagger-item" style={{ marginTop: '24px' }}>
          Already registered?{' '}
          <Link href="/login" className="auth-link">
            Sign in instead
          </Link>
        </div>
      </div>
    </main>
  );
};

export default JoinPage;
