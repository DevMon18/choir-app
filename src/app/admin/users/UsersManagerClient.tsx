'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { 
  createUserDirectly, 
  updateProfileRole, 
  approveJoinRequest, 
  rejectJoinRequest,
  updateUserProfile,
  deleteUserDirectly
} from './actions';
import { PendingUsersTable } from './PendingUsersTable';
import { ProvisioningForm } from './ProvisioningForm';
import { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import gsap from 'gsap';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'super_admin' | 'director' | 'treasurer' | 'secretary' | 'member' | 'pending' | 'rejected';
  created_at: string;
  voice_part?: string | null;
}

interface PendingUser {
  profile_id: string;
  full_name: string;
  email: string;
  email_confirmed: boolean;
  created_at: string;
}

interface JoinRequest {
  id: string;
  email: string;
  full_name: string;
  voice_part: string;
  address: string;
  contact_number: string;
  choir_experience: string;
  availability: string;
  reason_for_joining: string;
  status: string;
  created_at: string;
}

interface UsersManagerClientProps {
  currentUserProfile: Profile;
  initialPendingUsers: PendingUser[];
  initialJoinRequests: JoinRequest[];
  initialAllUsers?: Profile[];
}

export const UsersManagerClient = ({
  currentUserProfile,
  initialPendingUsers,
  initialJoinRequests,
  initialAllUsers = [],
}: UsersManagerClientProps) => {
  const router = useRouter();
  const { addToast } = useToast();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>(initialPendingUsers);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>(initialJoinRequests);
  const [allUsers, setAllUsers] = useState<Profile[]>(initialAllUsers);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ userId: string; fullName: string } | null>(null);

  // Search & Edit state for Super Admin CRUD
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'super_admin' | 'director' | 'treasurer' | 'secretary' | 'member' | 'pending' | 'rejected'>('member');
  const [editVoicePart, setEditVoicePart] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Recruitment modal/review state
  const [activeRequest, setActiveRequest] = useState<JoinRequest | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo('.content-anim-item',
        { opacity: 0, y: 25 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.1 }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Sync state with server-side props on router.refresh()
  useEffect(() => {
    setAllUsers(initialAllUsers);
  }, [initialAllUsers]);

  useEffect(() => {
    setPendingUsers(initialPendingUsers);
  }, [initialPendingUsers]);

  useEffect(() => {
    setJoinRequests(initialJoinRequests);
  }, [initialJoinRequests]);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    setLoadingId(userId);
    const result = await updateProfileRole(userId, newRole);
    setLoadingId(null);
    if (result?.error) {
      addToast({ type: 'error', title: 'Update Failed', message: result.error });
    } else {
      addToast({ type: 'success', title: 'Role Updated', message: `User successfully set to ${newRole}` });
      setPendingUsers(pendingUsers.filter((u) => u.profile_id !== userId));
      router.refresh();
    }
  };

  const handleCreateUser = async (input: {
    email: string;
    fullName: string;
    role: 'director' | 'treasurer' | 'secretary' | 'member';
  }) => {
    setTempPassword(null);
    setCreateLoading(true);
    const result = await createUserDirectly(input);
    setCreateLoading(false);
    if (result?.error) {
      addToast({ type: 'error', title: 'Create Failed', message: result.error });
    } else if (result?.success) {
      const tmp = result.tempPassword || null;
      setTempPassword(tmp);
      addToast({
        type: 'success',
        title: 'Account Created!',
        message: tmp ? `Temp password: ${tmp}` : `Account created for ${input.fullName}`,
        duration: 8000,
      });
      router.refresh();
    }
  };

  const handleApproveJoinRequest = async (requestId: string) => {
    setTempPassword(null);
    setLoadingId(requestId);
    const result = await approveJoinRequest(requestId);
    setLoadingId(null);
    if (result?.error) {
      addToast({ type: 'error', title: 'Approval Failed', message: result.error });
    } else if (result?.success) {
      const tmp = result.tempPassword || null;
      setTempPassword(tmp);
      addToast({
        type: 'success',
        title: 'Application Approved!',
        message: tmp ? `Account created. Temp password: ${tmp}` : `Account created for ${result.fullName}`,
        duration: 8000,
      });
      setJoinRequests(joinRequests.filter((r) => r.id !== requestId));
      setActiveRequest(null);
      router.refresh();
    }
  };

  const handleRejectJoinRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRequest) return;
    setLoadingId(activeRequest.id);
    const result = await rejectJoinRequest(activeRequest.id, rejectionReason);
    setLoadingId(null);
    if (result?.error) {
      addToast({ type: 'error', title: 'Rejection Failed', message: result.error });
    } else if (result?.success) {
      addToast({ type: 'warning', title: 'Application Rejected', message: `${activeRequest.full_name}'s application has been rejected.` });
      setJoinRequests(joinRequests.filter((r) => r.id !== activeRequest.id));
      setActiveRequest(null);
      setShowRejectForm(false);
      setRejectionReason('');
      router.refresh();
    }
  };

  const handleOpenEditModal = (user: Profile) => {
    setEditingUser(user);
    setEditFullName(user.full_name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditVoicePart(user.voice_part || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditLoading(true);
    const result = await updateUserProfile(editingUser.id, {
      fullName: editFullName,
      email: editEmail,
      role: editRole,
      voicePart: editVoicePart,
    });
    setEditLoading(false);
    if (result?.error) {
      addToast({ type: 'error', title: 'Update Failed', message: result.error });
    } else {
      addToast({ type: 'success', title: 'Profile Updated', message: `${editFullName}'s details saved successfully.` });
      setAllUsers(allUsers.map(u => u.id === editingUser.id ? {
        ...u,
        full_name: editFullName,
        email: editEmail,
        role: editRole,
        voice_part: editVoicePart as any
      } : u));
      setEditingUser(null);
      router.refresh();
    }
  };

  const handleDeleteUser = (userId: string, fullName: string) => {
    setConfirmDelete({ userId, fullName });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { userId, fullName } = confirmDelete;
    setConfirmDelete(null);
    setLoadingId(userId);
    const result = await deleteUserDirectly(userId);
    setLoadingId(null);
    if (result?.error) {
      addToast({ type: 'error', title: 'Delete Failed', message: result.error });
    } else {
      addToast({ type: 'success', title: 'User Deleted', message: `${fullName}'s account has been permanently removed.` });
      setAllUsers(allUsers.filter(u => u.id !== userId));
      setPendingUsers(pendingUsers.filter(u => u.profile_id !== userId));
      router.refresh();
    }
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '500px', height: '500px' }}></div>
      <div className="bg-orb bg-orb-2" style={{ width: '400px', height: '400px' }}></div>

      <Navbar profile={currentUserProfile} />

      <main className="admin-content-full">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div className="content-anim-item" style={{ opacity: 0 }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px', color: 'var(--primary)' }}>User Operations Dashboard</h2>
              <p style={{ color: 'var(--muted)' }}>Approve pending signups and manage system accounts</p>
            </div>

            {tempPassword && (
              <div className="alert alert-success content-anim-item">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p style={{ fontWeight: 600 }}>New account created — share this temporary password with the user:</p>
                  <p style={{ fontSize: '0.9rem', marginTop: '6px' }}>
                    Temporary Password: <strong style={{ color: 'var(--primary)', background: 'rgba(11,77,36,0.08)', padding: '3px 10px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '1rem' }}>{tempPassword}</strong>
                  </p>
                </div>
              </div>
            )}

            {/* Recruitment section (Join Requests) */}
            <div className="glass-container content-anim-item" style={{ padding: '30px', opacity: 0 }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '16px', color: 'var(--primary)' }}>Recruitment Applications</h3>
              
              {joinRequests.length === 0 ? (
                <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>
                  No pending recruitment requests. All caught up!
                </p>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Full Name</th>
                        <th>Email</th>
                        <th>Voice Type</th>
                        <th>Contact Number</th>
                        <th>Request Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {joinRequests.map((req) => (
                        <tr key={req.id}>
                          <td><strong>{req.full_name}</strong></td>
                          <td>{req.email}</td>
                          <td>
                            <span className="badge badge-pending" style={{ background: 'rgba(180,83,9,0.06)', color: 'var(--accent)' }}>
                              {req.voice_part}
                            </span>
                          </td>
                          <td>{req.contact_number}</td>
                          <td>{new Date(req.created_at).toLocaleDateString()}</td>
                          <td>
                            <button
                              onClick={() => {
                                setActiveRequest(req);
                                setShowRejectForm(false);
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            >
                              Review Application
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Account Signups (profiles) */}
            <div className="glass-container content-anim-item" style={{ padding: '30px', opacity: 0 }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '16px', color: 'var(--primary)' }}>Pending Direct Account Signups</h3>
              <PendingUsersTable
                pendingUsers={pendingUsers}
                loadingId={loadingId}
                onUpdateRole={handleUpdateRole}
              />
            </div>

            {currentUserProfile.role === 'super_admin' && (
              <div className="glass-container content-anim-item" style={{ padding: '30px', opacity: 0 }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px', color: 'var(--primary)' }}>Direct User Provisioning</h3>
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
                  Directly register accounts bypassing signups. Email verification will be skipped automatically.
                </p>
                <ProvisioningForm
                  createLoading={createLoading}
                  onCreateUser={handleCreateUser}
                />
              </div>
            )}

            {currentUserProfile.role === 'super_admin' && (
              <div className="glass-container content-anim-item" style={{ padding: '30px', opacity: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--primary)' }}>System User Directory</h3>
                  
                  {/* Search bar */}
                  <div style={{ position: 'relative', width: '280px' }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--muted)" strokeWidth="2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                      <circle cx="9" cy="9" r="7" /><path strokeLinecap="round" d="m15 15 4 4" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search users..."
                      className="input-field"
                      style={{ paddingLeft: '36px', height: '38px', minHeight: '38px', fontSize: '0.9rem', width: '100%' }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Voice Part</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allUsers
                        .filter(u => {
                          const q = searchQuery.toLowerCase();
                          return !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                        })
                        .map((u) => (
                          <tr key={u.id}>
                            <td data-label="Name">
                              <strong>{u.full_name}</strong> {u.id === currentUserProfile.id && <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic' }}>(You)</span>}
                            </td>
                            <td data-label="Email">{u.email}</td>
                            <td data-label="Role">
                              <span className="badge" style={{
                                background: u.role === 'super_admin' ? 'rgba(30,58,138,0.06)' : u.role === 'director' ? 'rgba(180,83,9,0.06)' : 'rgba(0,0,0,0.03)',
                                color: u.role === 'super_admin' ? 'var(--primary)' : u.role === 'director' ? 'var(--accent)' : 'var(--foreground)'
                              }}>
                                {u.role}
                              </span>
                            </td>
                            <td data-label="Voice Part">{u.voice_part || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>None</span>}</td>
                            <td data-label="Actions">
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={() => handleOpenEditModal(u)}
                                  className="btn btn-secondary"
                                  style={{ padding: '6px 12px', fontSize: '0.8rem', minHeight: '32px' }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.full_name)}
                                  className="btn btn-secondary"
                                  style={{ padding: '6px 12px', fontSize: '0.8rem', minHeight: '32px', color: 'var(--error)', borderColor: 'var(--error)' }}
                                  disabled={u.id === currentUserProfile.id || loadingId === u.id}
                                >
                                  {loadingId === u.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>

      {/* Detailed Join Request Review Modal */}
      {activeRequest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(30, 58, 138, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div className="glass-container" style={{
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '30px',
            position: 'relative',
          }}>
            <button
              onClick={() => setActiveRequest(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: 'var(--muted)',
              }}
            >
              &times;
            </button>

            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '20px', color: 'var(--primary)' }}>
              Review Application
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Full Name</p>
                <p style={{ fontWeight: 600 }}>{activeRequest.full_name}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Email</p>
                <p>{activeRequest.email}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Contact Number</p>
                <p>{activeRequest.contact_number}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Voice Type</p>
                <p style={{ fontWeight: 600 }}>{activeRequest.voice_part}</p>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Address</p>
              <p>{activeRequest.address}</p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Availability</p>
              <p style={{ whiteSpace: 'pre-wrap' }}>{activeRequest.availability}</p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Choir Experience</p>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', lineHeight: 1.5, background: 'rgba(255,255,255,0.4)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>{activeRequest.choir_experience}</p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Reason for Joining</p>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', lineHeight: 1.5, background: 'rgba(255,255,255,0.4)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>{activeRequest.reason_for_joining}</p>
            </div>

            {showRejectForm ? (
              <form onSubmit={handleRejectJoinRequest} style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '20px', marginTop: '20px' }}>
                <div className="input-group" style={{ marginBottom: '16px' }}>
                  <label className="input-label" htmlFor="rejectReason">Rejection Reason</label>
                  <textarea
                    id="rejectReason"
                    className="input-field"
                    required
                    placeholder="Provide a brief explanation for rejection (e.g. unavailable voice slot, schedule conflicts)..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ backgroundColor: 'var(--error)', borderColor: 'var(--error)' }}
                    disabled={loadingId === activeRequest.id}
                  >
                    {loadingId === activeRequest.id ? 'Submitting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowRejectForm(true)}
                  className="btn btn-secondary"
                  style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
                >
                  Reject Application
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveJoinRequest(activeRequest.id)}
                  className="btn btn-primary"
                  disabled={loadingId === activeRequest.id}
                >
                  {loadingId === activeRequest.id ? 'Approving...' : 'Approve & Create Account'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Edit User Modal */}
      {editingUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(30, 58, 138, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div className="glass-container" style={{
            width: '100%',
            maxWidth: '500px',
            padding: '30px',
            position: 'relative',
          }}>
            <button
              onClick={() => setEditingUser(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: 'var(--muted)',
              }}
            >
              &times;
            </button>

            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '20px', color: 'var(--primary)' }}>
              Edit User Profile
            </h3>

            <form onSubmit={handleSaveEdit}>
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <label className="input-label" htmlFor="editFullName">Full Name</label>
                <input
                  id="editFullName"
                  type="text"
                  required
                  className="input-field"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                />
              </div>

              <div className="input-group" style={{ marginBottom: '16px' }}>
                <label className="input-label" htmlFor="editEmail">Email Address</label>
                <input
                  id="editEmail"
                  type="email"
                  required
                  className="input-field"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>

              <div className="input-group" style={{ marginBottom: '16px' }}>
                <label className="input-label" htmlFor="editRole">System Role</label>
                <select
                  id="editRole"
                  className="input-field"
                  style={{ background: '#fff' }}
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                >
                  <option value="super_admin">Super Admin</option>
                  <option value="director">Director</option>
                  <option value="treasurer">Treasurer</option>
                  <option value="secretary">Secretary</option>
                  <option value="member">Member</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: '24px' }}>
                <label className="input-label" htmlFor="editVoicePart">Voice Part</label>
                <input
                  id="editVoicePart"
                  type="text"
                  placeholder="e.g. Soprano, Alto, Tenor, Bass (or blank)"
                  className="input-field"
                  value={editVoicePart}
                  onChange={(e) => setEditVoicePart(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editLoading}
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete User Account"
          message={`Are you sure you want to permanently delete the account for ${confirmDelete.fullName}? This will remove all their profile data, attendance records, and dues history. This action CANNOT be undone.`}
          confirmLabel="Yes, Delete"
          isDanger
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

export default UsersManagerClient;
