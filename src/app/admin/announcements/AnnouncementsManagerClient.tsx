'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  AnnouncementInput,
} from './actions';

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  priority: 'normal' | 'urgent';
  is_pinned: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
}

interface Props {
  currentUserProfile: Profile;
  initialAnnouncements: AnnouncementItem[];
}

export const AnnouncementsManagerClient = ({
  currentUserProfile,
  initialAnnouncements,
}: Props) => {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(initialAnnouncements);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [isPinned, setIsPinned] = useState(false);
  const [endsAt, setEndsAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleOpenCreate = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setPriority('normal');
    setIsPinned(false);
    setEndsAt('');
    setErrorMsg('');
    setShowModal(true);
  };

  const handleOpenEdit = (item: AnnouncementItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body);
    setPriority(item.priority);
    setIsPinned(item.is_pinned);
    setEndsAt(item.ends_at ? new Date(item.ends_at).toISOString().slice(0, 16) : '');
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setErrorMsg('Title and body are required.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const input: AnnouncementInput = {
      title,
      body,
      priority,
      is_pinned: isPinned,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    };

    if (editingId) {
      const res = await updateAnnouncement(editingId, input);
      setLoading(false);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setAnnouncements(
          announcements.map((a) =>
            a.id === editingId
              ? { ...a, ...input, ends_at: input.ends_at || null }
              : a
          )
        );
        setShowModal(false);
      }
    } else {
      const res = await createAnnouncement(input);
      setLoading(false);
      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.announcement) {
        setAnnouncements([res.announcement as AnnouncementItem, ...announcements]);
        setShowModal(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;

    setAnnouncements(announcements.filter((a) => a.id !== id));
    const res = await deleteAnnouncement(id);
    if (res.error) {
      alert(`Delete failed: ${res.error}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '450px', height: '450px' }} />
      <div className="bg-orb bg-orb-2" style={{ width: '400px', height: '400px' }} />

      <Navbar profile={currentUserProfile} />

      <main className="admin-content-full" style={{ flex: 1, maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
              Announcements Manager
            </h1>
            <p style={{ color: 'var(--muted)', margin: '4px 0 0 0', fontSize: '0.95rem' }}>
              Broadcast choir news, rehearsal alerts, and mass updates. Urgent announcements send instant push alerts.
            </p>
          </div>
          <button onClick={handleOpenCreate} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>+ Create Announcement</span>
          </button>
        </div>

        {announcements.length === 0 ? (
          <div className="glass-container" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
            No announcements created yet. Click <strong>+ Create Announcement</strong> to post news.
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Priority / Status</th>
                  <th>Title & Content</th>
                  <th>Created By</th>
                  <th>Expiry Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {announcements.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Priority / Status">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {item.priority === 'urgent' ? (
                          <span className="badge" style={{ background: 'rgba(159,28,28,0.12)', color: 'var(--error)', fontWeight: 700 }}>
                            🚨 Urgent
                          </span>
                        ) : (
                          <span className="badge" style={{ background: 'rgba(11,77,36,0.08)', color: 'var(--primary)' }}>
                            📢 Normal
                          </span>
                        )}
                        {item.is_pinned && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
                            📌 Pinned
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Title & Content">
                      <div>
                        <strong style={{ fontSize: '1rem', color: 'var(--foreground)' }}>{item.title}</strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>
                          {item.body.length > 120 ? item.body.substring(0, 120) + '…' : item.body}
                        </p>
                      </div>
                    </td>
                    <td data-label="Created By">
                      <span style={{ fontSize: '0.88rem' }}>{item.profiles?.full_name || 'Admin'}</span>
                    </td>
                    <td data-label="Expiry Date">
                      <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                        {item.ends_at ? new Date(item.ends_at).toLocaleDateString() : 'No expiry'}
                      </span>
                    </td>
                    <td data-label="Actions">
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleOpenEdit(item)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', minHeight: '32px' }}>
                          Edit
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', minHeight: '32px', color: 'var(--error)', borderColor: 'var(--error)' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal Dialog */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-container" style={{ width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', padding: '30px' }}>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '20px' }}>
              {editingId ? 'Edit Announcement' : 'Create New Announcement'}
            </h3>

            {errorMsg && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(159,28,28,0.1)', color: 'var(--error)', fontSize: '0.85rem', marginBottom: '16px' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
                  Title *
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Mandatory Rehearsal on Saturday"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
                  Announcement Body *
                </label>
                <textarea
                  className="input-field"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Enter detailed message…"
                  rows={4}
                  required
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
                    Priority
                  </label>
                  <select
                    className="input-field"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                  >
                    <option value="normal">Normal (Banner only)</option>
                    <option value="urgent">Urgent (Triggers Mobile Push)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
                    Expiry Date (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="isPinned"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                />
                <label htmlFor="isPinned" style={{ fontSize: '0.9rem', color: 'var(--foreground)', cursor: 'pointer' }}>
                  Pin announcement to top of dashboard
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? 'Saving…' : editingId ? 'Update Announcement' : 'Post & Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
