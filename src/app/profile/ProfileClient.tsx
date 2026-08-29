'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '../actions';
import { updatePersonalProfile, changePassword } from './actions';
import { uploadProfilePhotoAction, deleteProfilePhotoAction } from '../directory/[id]/actions';
import { PhotoGallery, PhotoItem } from '@/components/PhotoGallery';
import { createClient } from '@/lib/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Avatar } from '@/components/Avatar';
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
  initialPhotos?: PhotoItem[];
  isAdmin: boolean;
}

const ProfileClient = ({ profile, initialPhotos = [], isAdmin }: ProfileClientProps) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const { addToast } = useToast();

  const [photos, setPhotos] = useState<PhotoItem[]>(initialPhotos);
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

      tl.from('.anim-header', 
        { opacity: 0, y: -12, duration: 0.35 }
      );

      tl.from('.anim-card', 
        { opacity: 0, y: 16, duration: 0.35, stagger: 0.035 },
        '-=0.15'
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
    <div ref={containerRef} className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1 w-[600px] h-[600px]" />
      <div className="bg-orb bg-orb-2 w-[500px] h-[500px]" />

      <Navbar profile={profile as any} />

      <main className="flex-1 py-6 px-4 pb-[120px] max-w-[800px] mx-auto w-full">
        <div className="flex flex-col gap-5">
          
          <div className="glass-container anim-header flex justify-between items-center flex-wrap gap-4 p-5">
            <div>
              <h1 className="text-xl font-bold mb-1 text-primary">
                My Profile
              </h1>
              <p className="text-muted text-xs sm:text-[13px] m-0">
                Update your personal details, profile picture, and directory privacy settings.
              </p>
            </div>
            <form action={logout}>
              <button type="submit" className="btn btn-secondary !py-1.5 !px-3.5 text-xs sm:text-sm">
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

          <form onSubmit={handleSubmit} className="glass-container anim-card flex flex-col gap-5 p-5">
            
            {/* Avatar Section */}
            <div className="flex items-center gap-4 border-b border-glass-border pb-5 flex-wrap">
              <Avatar
                src={avatarUrl}
                name={fullName}
                size="2xl"
                border="2px solid var(--primary)"
                shadow
                priority
              />
              <div className="flex flex-col gap-2">
                <label className="input-label">Profile Picture</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    id="avatar-upload"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                  <label htmlFor="avatar-upload" className="btn btn-secondary cursor-pointer !py-2 !px-4 text-xs sm:text-[0.85rem]">
                    {uploading ? 'Uploading...' : 'Choose Photo'}
                  </label>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl(null)}
                      className="btn btn-secondary !py-2 !px-4 text-xs sm:text-[0.85rem] !text-error !border-error"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-muted text-xs m-0">PNG, JPG or WEBP up to 3MB.</p>
              </div>
            </div>

            {/* Fields Grid */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
              
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
                  className="input-field opacity-65 cursor-not-allowed"
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

            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5 border-t border-glass-border pt-5">
              
              <div className="input-group">
                <div className="flex justify-between items-center mb-2">
                  <label className="input-label" htmlFor="birthdatePrivate">Birthdate Privacy</label>
                  <label className="inline-flex items-center cursor-pointer gap-2">
                    <input
                      id="birthdatePrivate"
                      type="checkbox"
                      checked={isBirthdatePrivate}
                      onChange={(e) => setIsBirthdatePrivate(e.target.checked)}
                      className="w-4.5 h-4.5 cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm text-muted">Keep Private</span>
                  </label>
                </div>
                <p className="text-muted text-xs leading-relaxed m-0">
                  If private, your birthday will not appear on the Choir Calendar or in automatic birthday notifications.
                </p>
              </div>

              <div className="input-group">
                <div className="flex justify-between items-center mb-2">
                  <label className="input-label" htmlFor="phonePrivate">Phone Privacy</label>
                  <label className="inline-flex items-center cursor-pointer gap-2">
                    <input
                      id="phonePrivate"
                      type="checkbox"
                      checked={isPhonePrivate}
                      onChange={(e) => setIsPhonePrivate(e.target.checked)}
                      className="w-4.5 h-4.5 cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm text-muted">Keep Private</span>
                  </label>
                </div>
                <p className="text-muted text-xs leading-relaxed m-0">
                  If private, your contact number will not be listed in the Community Directory.
                </p>
              </div>

              <div className="input-group">
                <div className="flex justify-between items-center mb-2">
                  <label className="input-label" htmlFor="addressPrivate">Address Privacy</label>
                  <label className="inline-flex items-center cursor-pointer gap-2">
                    <input
                      id="addressPrivate"
                      type="checkbox"
                      checked={isAddressPrivate}
                      onChange={(e) => setIsAddressPrivate(e.target.checked)}
                      className="w-4.5 h-4.5 cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm text-muted">Keep Private</span>
                  </label>
                </div>
                <p className="text-muted text-xs leading-relaxed m-0">
                  If private, your home address details will not be listed in the Community Directory.
                </p>
              </div>
            </div>

            <div className="input-group border-t border-glass-border pt-5">
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
              <p className="text-muted text-xs mt-1 m-0">
                * Note: Emergency contacts are always kept completely private and are never visible in the Community Directory.
              </p>
            </div>

            <div className="flex justify-end border-t border-glass-border pt-5">
              <button
                type="submit"
                disabled={loading || uploading}
                className="btn btn-primary min-w-[150px]"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

          </form>

          {/* Change Password Section */}
          <form onSubmit={handleChangePassword} className="glass-container anim-card flex flex-col gap-5 p-5">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-primary mb-1.5">🔒 Change Password</h2>
              <p className="text-muted text-xs sm:text-sm m-0">Update your login password. Must be at least 8 characters.</p>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
              <div className="input-group">
                <label className="input-label" htmlFor="newPassword">New Password</label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showPasswords ? 'text' : 'password'}
                    className="input-field !pr-11"
                    placeholder="Min 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-muted p-1 flex"
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
                  className={`input-field ${
                    confirmPwd && newPassword && confirmPwd !== newPassword ? '!border-error' : ''
                  }`}
                  placeholder="Repeat new password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  required
                />
                {confirmPwd && newPassword && confirmPwd !== newPassword && (
                  <p className="text-[0.78rem] text-error mt-1 m-0">Passwords do not match</p>
                )}
              </div>
            </div>

            <div className="flex justify-end border-t border-glass-border pt-5">
              <button
                type="submit"
                disabled={pwdLoading || !newPassword || !confirmPwd}
                className="btn btn-primary min-w-[180px]"
              >
                {pwdLoading ? 'Updating...' : '🔒 Update Password'}
              </button>
            </div>
          </form>

          {/* Photo Gallery Management Section */}
          <div className="glass-container anim-card p-5">
            <PhotoGallery
              photos={photos}
              isOwner={true}
              isAdmin={isAdmin}
              onUpload={async (file: File) => {
                const formData = new FormData();
                formData.append('file', file);
                const res = await uploadProfilePhotoAction(formData);
                if (res.success) router.refresh();
                return res;
              }}
              onDelete={async (photoId: string, storagePath: string) => {
                const res = await deleteProfilePhotoAction(photoId, storagePath);
                if (res.success) {
                  setPhotos((prev) => prev.filter((p) => p.id !== photoId));
                  router.refresh();
                }
                return res;
              }}
            />
          </div>

        </div>
      </main>
    </div>
  );
};

export default ProfileClient;
