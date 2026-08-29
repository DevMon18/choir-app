'use client';

import React, { useState } from 'react';
import { Plus, Megaphone } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
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
  const { addToast } = useToast();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(initialAnnouncements);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [isPinned, setIsPinned] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleOpenCreate = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setPriority('normal');
    setIsPinned(false);
    setStartsAt(new Date().toISOString().slice(0, 16));
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
    setStartsAt(item.starts_at ? new Date(item.starts_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16));
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
      starts_at: startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
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

        if (res.warning) {
          addToast({ type: 'warning', title: 'Push Notice', message: res.warning });
        } else {
          addToast({ type: 'success', title: 'Announcement Posted', message: 'Successfully broadcasted announcement.' });
        }

        // Schedule native mobile pop-up banner notification if running on native Capacitor Android
        try {
          const { LocalNotifications } = await import('@capacitor/local-notifications');
          await LocalNotifications.schedule({
            notifications: [
              {
                title: input.priority === 'urgent' ? `🚨 Urgent: ${title}` : `📢 ${title}`,
                body: body.substring(0, 120),
                id: Math.floor(Math.random() * 100000),
                schedule: { at: new Date(Date.now() + 500) },
                channelId: 'choir_alerts',
                actionTypeId: '',
                extra: null,
              },
            ],
          });
        } catch (e) {
          // Fall back gracefully if on web browser
        }
      }
    }
  };

  const handleDeleteClick = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);

    setAnnouncements(announcements.filter((a) => a.id !== id));
    const res = await deleteAnnouncement(id);
    if (res.error) {
      addToast({ type: 'error', title: 'Delete Failed', message: res.error });
    } else {
      addToast({ type: 'success', title: 'Announcement Deleted', message: 'Announcement removed.' });
    }
  };

  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1 w-[450px] h-[450px]" />
      <div className="bg-orb bg-orb-2 w-[400px] h-[400px]" />

      <Navbar profile={currentUserProfile} />

      <main className="admin-content-full flex-1 max-w-[1100px] mx-auto w-full">
        <div className="flex justify-between items-center mb-7 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-[1.75rem] font-bold text-primary m-0">
              Announcements Manager
            </h1>
            <p className="text-muted mt-1 m-0 text-sm sm:text-base">
              Broadcast choir news, rehearsal alerts, and mass updates. Urgent announcements send instant push alerts.
            </p>
          </div>
          {/* Desktop-only primary action — hidden on mobile, replaced by sticky FAB below */}
          <button
            onClick={handleOpenCreate}
            className="btn btn-primary ann-desktop-create inline-flex items-center gap-2"
          >
            <Plus size={16} /> Create Announcement
          </button>
        </div>

        {announcements.length === 0 ? (
          <div className="glass-container text-center py-15 px-5 text-muted">
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
                      <div className="flex flex-col gap-1">
                        {item.priority === 'urgent' ? (
                          <span className="badge !bg-red-700/12 !text-error !font-bold">
                            🚨 Urgent
                          </span>
                        ) : (
                          <span className="badge !bg-primary/8 !text-primary">
                            📢 Normal
                          </span>
                        )}
                        {item.is_pinned && (
                          <span className="text-xs text-accent font-semibold">
                            📌 Pinned
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Title & Content">
                      <div>
                        <strong className="text-base font-bold text-foreground">{item.title}</strong>
                        <p className="mt-1 m-0 text-sm text-muted whitespace-pre-wrap">
                          {item.body.length > 120 ? item.body.substring(0, 120) + '…' : item.body}
                        </p>
                      </div>
                    </td>
                    <td data-label="Created By">
                      <span className="text-sm">{item.profiles?.full_name || 'Admin'}</span>
                    </td>
                    <td data-label="Expiry Date">
                      <span className="text-xs sm:text-sm text-muted">
                        {item.ends_at ? new Date(item.ends_at).toLocaleDateString() : 'No expiry'}
                      </span>
                    </td>
                    <td data-label="Actions">
                      <div className="flex gap-2">
                        <button onClick={() => handleOpenEdit(item)} className="btn btn-secondary !py-1.5 !px-3 text-xs">
                          Edit
                        </button>
                        <button onClick={() => handleDeleteClick(item.id)} className="btn btn-secondary !py-1.5 !px-3 text-xs !text-error !border-error">
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
        <div className="fixed inset-0 z-[1000] bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-5">
          <div className="glass-container w-full max-w-[550px] max-h-[90vh] overflow-y-auto p-7.5">
            <h3 className="text-xl sm:text-[1.4rem] font-bold text-primary mb-5">
              {editingId ? 'Edit Announcement' : 'Create New Announcement'}
            </h3>

            {errorMsg && (
              <div className="py-2.5 px-3.5 rounded-lg bg-red-700/10 text-error text-sm mb-4">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-muted mb-1.5">
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
                <label className="block text-sm font-semibold text-muted mb-1.5">
                  Announcement Body *
                </label>
                <textarea
                  className="input-field resize-y"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Enter detailed message…"
                  rows={4}
                  required
                />
              </div>

              <div className="ann-modal-grid grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-muted mb-1.5">
                    Event Date & Time (for Calendar) *
                  </label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-muted mb-1.5">
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
              </div>

              <div>
                <label className="block text-sm font-semibold text-muted mb-1.5">
                  Expiry Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="isPinned"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4.5 h-4.5 accent-primary cursor-pointer"
                />
                <label htmlFor="isPinned" className="text-sm sm:text-[0.9rem] text-foreground cursor-pointer">
                  Pin announcement to top of dashboard
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-3">
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
      {confirmDeleteId && (
        <ConfirmModal
          title="Delete Announcement"
          message="Are you sure you want to delete this announcement? This action cannot be undone."
          confirmLabel="Yes, Delete"
          isDanger
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {/* Mobile sticky bottom FAB — thumb-reachable primary action on ≤768px */}
      <button
        onClick={handleOpenCreate}
        className="btn btn-primary ann-mobile-fab"
        aria-label="Create new announcement"
      >
        + Create Announcement
      </button>
    </div>
  );
};
