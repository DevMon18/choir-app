'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '@/app/actions';
import { updatePersonalProfile, changePassword } from '../actions';
import { uploadProfilePhotoAction, deleteProfilePhotoAction } from '@/app/directory/[id]/actions';
import { PhotoGallery, PhotoItem } from '@/components/PhotoGallery';
import { createClient } from '@/lib/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Avatar } from '@/components/Avatar';
import { useToast } from '@/components/Toast';
import { ArrowLeft, User, Shield, Camera, Lock } from 'lucide-react';
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

interface ProfileSettingsClientProps {
  profile: Profile;
  initialPhotos?: PhotoItem[];
  isAdmin: boolean;
}

const ProfileSettingsClient = ({ profile, initialPhotos = [], isAdmin }: ProfileSettingsClientProps) => {
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

  // Password Change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current.querySelectorAll('.anim-card'),
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out' }
      );
    }
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      addToast({ title: 'Upload Failed', type: 'error', message: 'Image size must be less than 2MB' });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const res = await updatePersonalProfile({
        fullName: profile.full_name,
        isPhonePrivate: profile.is_phone_private,
        isAddressPrivate: profile.is_address_private,
        avatarUrl: publicUrl,
      });

      if (res.error) {
        addToast({ title: 'Error', type: 'error', message: res.error });
      } else {
        setAvatarUrl(publicUrl);
        addToast({ title: 'Avatar Updated', type: 'success', message: 'Your profile picture has been updated!' });
        router.refresh();
      }
    } catch (err: any) {
      addToast({ title: 'Upload Error', type: 'error', message: err.message || 'Failed to upload photo' });
    } finally {
      setUploading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    const res = await updatePersonalProfile({
      fullName,
      birthdate: birthdate || null,
      address,
      phone,
      emergencyContact,
      isPhonePrivate,
      isAddressPrivate,
      isBirthdatePrivate,
    });

    setLoading(false);
    if (res.error) {
      setError(res.error);
      addToast({ title: 'Update Failed', type: 'error', message: res.error });
    } else {
      setSuccess('Profile updated successfully!');
      addToast({ title: 'Profile Updated', type: 'success', message: 'Your profile details have been saved.' });
      router.refresh();
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPwd) {
      addToast({ title: 'Validation Error', type: 'error', message: 'New passwords do not match' });
      return;
    }

    setPwdLoading(true);
    const res = await changePassword({ newPassword });
    setPwdLoading(false);

    if (res.error) {
      addToast({ title: 'Password Error', type: 'error', message: res.error });
    } else {
      addToast({ title: 'Password Changed', type: 'success', message: 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPwd('');
    }
  };

  return (
    <div className="page-shell">
      <Navbar profile={profile} />

      <main className="page-container" ref={containerRef}>
        <div className="max-w-[760px] mx-auto flex flex-col gap-6">

          {/* Top Breadcrumb Header */}
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-primary hover:text-primary-hover transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Back to Profile Overview</span>
            </Link>

            <span className="text-xs font-mono text-slate-400">
              Joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </span>
          </div>

          {/* Header Card */}
          <div className="glass-container anim-card p-6 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left relative overflow-hidden">
            <div className="relative group">
              <Avatar
                src={avatarUrl}
                name={profile.full_name}
                size={88}
                className="border-2 border-primary/20 shadow-md"
              />
              <label
                htmlFor="avatar-upload"
                className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-white text-xs font-bold"
              >
                {uploading ? '...' : <Camera size={20} />}
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
            </div>

            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Profile &amp; Account Settings
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                {profile.email} • <span className="font-semibold text-primary capitalize">{profile.role.replace('_', ' ')}</span>
              </p>
              <div className="flex items-center gap-2 mt-3 justify-center sm:justify-start">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                  {profile.voice_part || 'Member'}
                </span>
                {isAdmin && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                    Officer Access
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Personal Info Form */}
          <form onSubmit={handleProfileSubmit} className="glass-container anim-card p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <User size={18} className="text-primary" />
                <span>Personal Information</span>
              </h2>
            </div>

            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium">
                {success}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="input-group">
                <label className="input-label" htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  className="input-field"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
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
                <label className="flex items-center gap-2 text-xs text-slate-500 mt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isBirthdatePrivate}
                    onChange={(e) => setIsBirthdatePrivate(e.target.checked)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span>Keep birthdate private from other members</span>
                </label>
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  type="tel"
                  className="input-field"
                  placeholder="+63 900 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <label className="flex items-center gap-2 text-xs text-slate-500 mt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPhonePrivate}
                    onChange={(e) => setIsPhonePrivate(e.target.checked)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span>Keep phone private</span>
                </label>
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="emergencyContact">Emergency Contact</label>
                <input
                  id="emergencyContact"
                  type="text"
                  className="input-field"
                  placeholder="Name &amp; Phone (e.g. Maria - 0917...)"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                />
              </div>

              <div className="input-group sm:col-span-2">
                <label className="input-label" htmlFor="address">Address / City</label>
                <input
                  id="address"
                  type="text"
                  className="input-field"
                  placeholder="e.g. Barangay Central, Quezon City"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
                <label className="flex items-center gap-2 text-xs text-slate-500 mt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAddressPrivate}
                    onChange={(e) => setIsAddressPrivate(e.target.checked)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span>Keep address private from regular directory view</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary min-w-[140px] text-xs sm:text-sm font-bold shadow-sm"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>

          {/* Security & Password */}
          <form onSubmit={handlePasswordSubmit} className="glass-container anim-card p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Lock size={18} className="text-primary" />
                <span>Security &amp; Password</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="input-group sm:col-span-2">
                <label className="input-label" htmlFor="currentPassword">Current Password</label>
                <input
                  id="currentPassword"
                  type={showPasswords ? 'text' : 'password'}
                  className="input-field"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  type={showPasswords ? 'text' : 'password'}
                  className="input-field"
                  placeholder="Min 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
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
                />
                {confirmPwd && newPassword && confirmPwd !== newPassword && (
                  <p className="text-[0.78rem] text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
              >
                {showPasswords ? 'Hide password characters' : 'Show password characters'}
              </button>

              <button
                type="submit"
                disabled={pwdLoading || !newPassword || !confirmPwd || newPassword !== confirmPwd}
                className="btn btn-secondary text-xs sm:text-sm font-bold min-w-[140px]"
              >
                {pwdLoading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>

          {/* Photo Gallery Section */}
          <div className="glass-container anim-card p-6">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Camera size={18} className="text-primary" />
                <span>Personal Photo Gallery</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage personal choir photos displayed on your directory profile.
              </p>
            </div>

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

export default ProfileSettingsClient;
