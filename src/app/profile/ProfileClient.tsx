'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '../actions';
import { updatePersonalProfile, changePassword } from './actions';
import { createClient } from '@/lib/supabase/client';
import { Navbar } from '@/components/Navbar';
import { useToast } from '@/components/Toast';
import gsap from 'gsap';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  birthdate: string | null;
  address: string;
  phone: string;
  emergency_contact: string;
  voice_part: string;
  is_phone_private: boolean;
  is_address_private: boolean;
  is_birthdate_private?: boolean;
  avatar_url: string | null;
  created_at: string;
}

interface ProfileClientProps {
  profile: Profile;
  isAdmin: boolean;
}

const ProfileClient = ({ profile, isAdmin }: ProfileClientProps) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const { addToast } = useToast();

  const [fullName, setFullName] = useState(profile.full_name);
  const [birthdate, setBirthdate] = useState(profile.birthdate || '');
  const [phone, setPhone] = useState(profile.phone);
  const [address, setAddress] = useState(profile.address);
  const [emergencyContact, setEmergencyContact] = useState(profile.emergency_contact);
  const [isPhonePrivate, setIsPhonePrivate] = useState(profile.is_phone_private);
  const [isAddressPrivate, setIsAddressPrivate] = useState(profile.is_address_private);
  const [isBirthdatePrivate, setIsBirthdatePrivate] = useState(profile.is_birthdate_private ?? true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hamburgerOpen, setHamburgerOpen] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo('.anim-header', 
        { opacity: 0, y: -20 }, 
        { opacity: 1, y: 0, duration: 0.7 }
      );

      tl.fromTo('.anim-card', 
        { opacity: 0, y: 30 }, 
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.1 },
        '-=0.3'
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 3MB)
    if (file.size > 3 * 1024 * 1024) {
      setError('Profile picture must be under 3MB.');
      return;
    }

    setError(null);
    setSuccess(null);
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);

      // Persist avatar URL immediately to database
      const saveRes = await updatePersonalProfile({
        fullName,
        birthdate: birthdate || null,
        phone,
        emergencyContact,
        address,
        isPhonePrivate,
        isAddressPrivate,
        isBirthdatePrivate,
        avatarUrl: publicUrl,
      });

      if (saveRes.error) {
        throw new Error(saveRes.error);
      }

      setSuccess('Profile picture uploaded and saved successfully!');
      addToast({ type: 'success', title: 'Avatar Saved!', message: 'Your profile picture has been updated.' });
      router.refresh();
    } catch (err: any) {
      const msg = err.message || 'Failed to upload image.';
      setError(msg);
      addToast({ type: 'error', title: 'Upload Failed', message: msg });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    const result = await updatePersonalProfile({
      fullName,
      birthdate: birthdate || null,
      phone,
      emergencyContact,
      address,
      isPhonePrivate,
      isAddressPrivate,
      isBirthdatePrivate,
      avatarUrl,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      addToast({ type: 'error', title: 'Update Failed', message: result.error });
    } else {
      setSuccess('Profile updated successfully!');
      addToast({ type: 'success', title: 'Profile Saved!', message: 'Your personal details have been updated.' });
      router.refresh();
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      addToast({ type: 'error', title: 'Invalid Password', message: 'Password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPwd) {
      addToast({ type: 'error', title: 'Passwords Do Not Match', message: 'Please make sure both password fields match.' });
      return;
    }
    setPwdLoading(true);
    const result = await changePassword({ newPassword });
    setPwdLoading(false);
    if (result.error) {
      addToast({ type: 'error', title: 'Password Change Failed', message: result.error });
    } else {
      addToast({ type: 'success', title: 'Password Changed!', message: 'Your password has been updated successfully.' });
      setNewPassword('');
      setConfirmPwd('');
    }
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '600px', height: '600px' }}></div>
      <div className="bg-orb bg-orb-2" style={{ width: '500px', height: '500px' }}></div>

      <Navbar profile={profile as any} />

      <main style={{ flex: 1, padding: '24px 16px 120px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="glass-container anim-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', padding: '20px' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px', color: 'var(--primary)' }}>
                My Profile
              </h1>
              <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>
                Update your personal details, profile picture, and directory privacy settings.
              </p>
            </div>
            <form action={logout}>
              <button type="submit" className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '14px' }}>
                🚪 Log Out
              </button>
            </form>
          </div>

          {error && (
            <div className="alert alert-error anim-card">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert alert-success anim-card">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1-1.414L9 10.586 7.707 9.293a1 1 0 00-1-1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="glass-container anim-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
            
            {/* Avatar Section — 88px circle matching IG/FB profile header standards */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '88px', height: '88px', borderRadius: '50%', background: 'rgba(30,58,138,0.06)', overflow: 'hidden', border: '2px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--primary)' }}>
                    {fullName ? fullName.charAt(0).toUpperCase() : '?'}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label className="input-label">Profile Picture</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="file"
                    accept="image/*"
                    id="avatar-upload"
                    style={{ display: 'none' }}
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                  <label htmlFor="avatar-upload" className="btn btn-secondary" style={{ cursor: 'pointer', padding: '8px 16px', fontSize: '0.85rem' }}>
                    {uploading ? 'Uploading...' : 'Choose Photo'}
                  </label>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl(null)}
                      className="btn btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '0.85rem', color: 'var(--error)', borderColor: 'var(--error)' }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>PNG, JPG or WEBP up to 3MB.</p>
              </div>
            </div>

            {/* Fields Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              
              <div className="input-group">
                <label className="input-label" htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  required
                  className="input-field"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="emailAddress">Email Address</label>
                <input
                  id="emailAddress"
                  type="email"
                  disabled
                  className="input-field"
                  style={{ opacity: 0.65, cursor: 'not-allowed' }}
                  value={profile.email}
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="birthdate">Birthdate</label>
                <input
                  id="birthdate"
                  type="date"
                  className="input-field"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  type="tel"
                  className="input-field"
                  placeholder="e.g. +63 917 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
              
              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="input-label" htmlFor="birthdatePrivate">Birthdate Privacy</label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                    <input
                      id="birthdatePrivate"
                      type="checkbox"
                      checked={isBirthdatePrivate}
                      onChange={(e) => setIsBirthdatePrivate(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Keep Private</span>
                  </label>
                </div>
                <p style={{ color: 'var(--muted)', fontSize: '0.8rem', lineHeight: 1.4 }}>
                  If private, your birthday will not appear on the Choir Calendar or in automatic birthday notifications.
                </p>
              </div>

              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="input-label" htmlFor="phonePrivate">Phone Privacy</label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                    <input
                      id="phonePrivate"
                      type="checkbox"
                      checked={isPhonePrivate}
                      onChange={(e) => setIsPhonePrivate(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Keep Private</span>
                  </label>
                </div>
                <p style={{ color: 'var(--muted)', fontSize: '0.8rem', lineHeight: 1.4 }}>
                  If private, your contact number will not be listed in the Community Directory.
                </p>
              </div>

              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="input-label" htmlFor="addressPrivate">Address Privacy</label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                    <input
                      id="addressPrivate"
                      type="checkbox"
                      checked={isAddressPrivate}
                      onChange={(e) => setIsAddressPrivate(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Keep Private</span>
                  </label>
                </div>
                <p style={{ color: 'var(--muted)', fontSize: '0.8rem', lineHeight: 1.4 }}>
                  If private, your home address details will not be listed in the Community Directory.
                </p>
              </div>
            </div>

            <div className="input-group" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
              <label className="input-label" htmlFor="address">Home Address</label>
              <textarea
                id="address"
                className="input-field"
                placeholder="Enter your current residential address..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
              />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="emergencyContact">Emergency Contact Details</label>
              <textarea
                id="emergencyContact"
                className="input-field"
                placeholder="Name, relationship, and contact number for emergencies (e.g. Jane Doe - Mother: 0917-111-2222)"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                rows={2}
              />
              <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                * Note: Emergency contacts are always kept completely private and are never visible in the Community Directory.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
              <button
                type="submit"
                disabled={loading || uploading}
                className="btn btn-primary"
                style={{ minWidth: '150px' }}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

          </form>

          {/* Change Password Section */}
          <form onSubmit={handleChangePassword} className="glass-container anim-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '6px' }}>🔒 Change Password</h2>
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Update your login password. Must be at least 8 characters.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
              <div className="input-group">
                <label className="input-label" htmlFor="newPassword">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="newPassword"
                    type={showPasswords ? 'text' : 'password'}
                    className="input-field"
                    placeholder="Min 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    style={{ paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px', display: 'flex' }}
                    aria-label={showPasswords ? 'Hide password' : 'Show password'}
                  >
                    {showPasswords ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  type={showPasswords ? 'text' : 'password'}
                  className="input-field"
                  placeholder="Repeat new password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  required
                  style={{
                    borderColor: confirmPwd && newPassword && confirmPwd !== newPassword ? 'var(--error)' : undefined,
                  }}
                />
                {confirmPwd && newPassword && confirmPwd !== newPassword && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--error)', marginTop: '4px' }}>Passwords do not match</p>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
              <button
                type="submit"
                disabled={pwdLoading || !newPassword || !confirmPwd}
                className="btn btn-primary"
                style={{ minWidth: '180px' }}
              >
                {pwdLoading ? 'Updating...' : '🔒 Update Password'}
              </button>
            </div>
          </form>

        </div>
      </main>
    </div>
  );
};

export default ProfileClient;
