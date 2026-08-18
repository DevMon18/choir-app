'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Users, Music, Mic, Calendar, X, ListTodo, Check, AlertCircle } from 'lucide-react';
import { createTaskWithResponsibilities, CreateResponsibilityItem } from '../actions';
import { useToast } from '@/components/Toast';
import type { TaskPriority } from '@/app/tasks/types';

interface MemberOption {
  id: string;
  full_name: string;
  voice_part?: string | null;
}

interface SongOption {
  id: string;
  title: string;
}

interface SequenceOption {
  id: string;
  title: string;
}

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: MemberOption[];
  songs: SongOption[];
  sequences: SequenceOption[];
  onSuccess: () => void;
}

export const TaskCreateModal: React.FC<TaskCreateModalProps> = ({
  isOpen,
  onClose,
  members,
  songs,
  sequences,
  onSuccess,
}) => {
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [dueDate, setDueDate] = useState('');
  const [relatedSongId, setRelatedSongId] = useState('');
  const [relatedSequenceId, setRelatedSequenceId] = useState('');

  // Delegation builder
  const [assignToAll, setAssignToAll] = useState(false);
  const [commonResponsibility, setCommonResponsibility] = useState('');
  const [responsibilities, setResponsibilities] = useState<CreateResponsibilityItem[]>([
    { member_id: '', responsibility: '', due_date: '' },
  ]);

  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handleAddResponsibilityRow = () => {
    setResponsibilities((prev) => [
      ...prev,
      { member_id: '', responsibility: '', due_date: dueDate || '' },
    ]);
  };

  const handleRemoveResponsibilityRow = (index: number) => {
    if (responsibilities.length <= 1) {
      addToast({ type: 'warning', title: 'Minimum 1 Required', message: 'At least one responsibility is required.' });
      return;
    }
    setResponsibilities((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateResponsibility = (
    index: number,
    field: keyof CreateResponsibilityItem,
    value: string
  ) => {
    setResponsibilities((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      addToast({ type: 'warning', title: 'Title Required', message: 'Please enter a task title.' });
      return;
    }

    if (!assignToAll) {
      const validRows = responsibilities.filter((r) => r.member_id && r.responsibility.trim());
      if (validRows.length === 0) {
        addToast({
          type: 'warning',
          title: 'Responsibilities Incomplete',
          message: 'Please assign at least one member with a specific responsibility description.',
        });
        return;
      }
    }

    setLoading(true);
    const res = await createTaskWithResponsibilities(
      {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
        related_song_id: relatedSongId || null,
        related_sequence_id: relatedSequenceId || null,
      },
      responsibilities.filter((r) => r.member_id && r.responsibility.trim()),
      assignToAll,
      commonResponsibility
    );
    setLoading(false);

    if (res.error) {
      addToast({ type: 'error', title: 'Creation Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Task Created',
        message: 'Task and member responsibilities were successfully delegated.',
      });
      onSuccess();
      onClose();
    }
  };

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '740px',
          maxHeight: '90vh',
          background: '#ffffff',
          borderRadius: '24px',
          border: '1px solid rgba(11, 77, 36, 0.16)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUpModal 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 26px',
            borderBottom: '1px solid rgba(11, 77, 36, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #fbfaf6 0%, #f4efe4 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--primary) 0%, #15803d 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(11, 77, 36, 0.25)',
              }}
            >
              <ListTodo size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#111c14' }}>
                Create New Task
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#5c675e', fontWeight: 500 }}>
                Define the overall task and delegate specific responsibilities to members
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              width: '36px',
              height: '36px',
              padding: 0,
              borderRadius: '50%',
              minHeight: 'auto',
              border: '1px solid rgba(11, 77, 36, 0.1)',
              background: '#ffffff',
              color: '#5c675e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 26px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              background: '#ffffff',
            }}
          >
            {/* Main Task Title */}
            <div>
              <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, color: '#111c14', marginBottom: '6px' }}>
                Task Title <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Choir Uniform Preparation, Easter Concert Setup, Rehearsal Material Prep"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
                style={{
                  width: '100%',
                  borderRadius: '12px',
                  padding: '11px 14px',
                  fontSize: '0.95rem',
                  background: '#ffffff',
                  border: '1.5px solid rgba(11, 77, 36, 0.18)',
                  color: '#111c14',
                }}
              />
            </div>

            {/* Description */}
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#111c14', marginBottom: '6px' }}>
                Description & Context (Optional)
              </label>
              <textarea
                className="input-field"
                rows={2}
                placeholder="Provide background, guidelines, or objectives for this task..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: '100%',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  fontSize: '0.88rem',
                  background: '#ffffff',
                  border: '1.5px solid rgba(11, 77, 36, 0.18)',
                  color: '#111c14',
                  lineHeight: 1.4,
                }}
              />
            </div>

            {/* Priority & Deadline Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#111c14', marginBottom: '6px' }}>
                  Priority
                </label>
                <select
                  className="input-field"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  style={{
                    width: '100%',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    fontSize: '0.88rem',
                    background: '#ffffff',
                    border: '1.5px solid rgba(11, 77, 36, 0.18)',
                    color: '#111c14',
                    cursor: 'pointer',
                  }}
                >
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#111c14', marginBottom: '6px' }}>
                  Overall Due Date
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{
                    width: '100%',
                    borderRadius: '12px',
                    padding: '9px 14px',
                    fontSize: '0.88rem',
                    background: '#ffffff',
                    border: '1.5px solid rgba(11, 77, 36, 0.18)',
                    color: '#111c14',
                  }}
                />
              </div>
            </div>

            {/* Related Entities (Song / Sequence) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#5c675e', marginBottom: '6px' }}>
                  Related Repertoire Song (Optional)
                </label>
                <select
                  className="input-field"
                  value={relatedSongId}
                  onChange={(e) => setRelatedSongId(e.target.value)}
                  style={{
                    width: '100%',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    fontSize: '0.88rem',
                    background: '#ffffff',
                    border: '1.5px solid rgba(11, 77, 36, 0.18)',
                    color: '#111c14',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">-- None --</option>
                  {songs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#5c675e', marginBottom: '6px' }}>
                  Related Mass Sequence (Optional)
                </label>
                <select
                  className="input-field"
                  value={relatedSequenceId}
                  onChange={(e) => setRelatedSequenceId(e.target.value)}
                  style={{
                    width: '100%',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    fontSize: '0.88rem',
                    background: '#ffffff',
                    border: '1.5px solid rgba(11, 77, 36, 0.18)',
                    color: '#111c14',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">-- None --</option>
                  {sequences.map((sq) => (
                    <option key={sq.id} value={sq.id}>
                      {sq.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Delegation Section Divider */}
            <div
              style={{
                borderTop: '1px solid rgba(11, 77, 36, 0.12)',
                paddingTop: '18px',
                marginTop: '4px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '14px',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#111c14' }}>
                    Member Responsibilities
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#5c675e' }}>
                    Delegate distinct responsibilities to individual choir members
                  </span>
                </div>

                {/* Assign to all switch */}
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    color: 'var(--primary)',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: 'rgba(11, 77, 36, 0.06)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={assignToAll}
                    onChange={(e) => setAssignToAll(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  Assign to All Active Members
                </label>
              </div>

              {assignToAll ? (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '16px',
                    background: 'rgba(11, 77, 36, 0.04)',
                    border: '1.5px solid rgba(11, 77, 36, 0.14)',
                  }}
                >
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#111c14', marginBottom: '6px' }}>
                    Common Responsibility Text for Everyone
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Practice your voice part for Sunday mass"
                    value={commonResponsibility}
                    onChange={(e) => setCommonResponsibility(e.target.value)}
                    style={{
                      width: '100%',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      fontSize: '0.9rem',
                      background: '#ffffff',
                      border: '1.5px solid rgba(11, 77, 36, 0.18)',
                      color: '#111c14',
                    }}
                  />
                  <span style={{ display: 'block', fontSize: '0.76rem', color: '#5c675e', marginTop: '6px', fontWeight: 500 }}>
                    An individual task assignment will automatically be created for all {members.length} choir members.
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {responsibilities.map((row, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.4fr 2.2fr 1.1fr auto',
                        gap: '8px',
                        alignItems: 'center',
                        background: '#faf8f3',
                        padding: '10px 12px',
                        borderRadius: '14px',
                        border: '1px solid rgba(11, 77, 36, 0.12)',
                      }}
                    >
                      {/* Member Dropdown */}
                      <select
                        className="input-field"
                        value={row.member_id}
                        onChange={(e) => handleUpdateResponsibility(idx, 'member_id', e.target.value)}
                        required
                        style={{
                          padding: '8px 10px',
                          fontSize: '0.85rem',
                          borderRadius: '8px',
                          background: '#ffffff',
                          border: '1px solid rgba(11, 77, 36, 0.16)',
                          color: '#111c14',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="">-- Select Member --</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.full_name} {m.voice_part ? `(${m.voice_part})` : ''}
                          </option>
                        ))}
                      </select>

                      {/* Responsibility description */}
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Specific responsibility (e.g. Canvas linen, Design uniform)..."
                        value={row.responsibility}
                        onChange={(e) => handleUpdateResponsibility(idx, 'responsibility', e.target.value)}
                        required
                        style={{
                          padding: '8px 12px',
                          fontSize: '0.85rem',
                          borderRadius: '8px',
                          background: '#ffffff',
                          border: '1px solid rgba(11, 77, 36, 0.16)',
                          color: '#111c14',
                        }}
                      />

                      {/* Custom deadline */}
                      <input
                        type="date"
                        className="input-field"
                        value={row.due_date || ''}
                        onChange={(e) => handleUpdateResponsibility(idx, 'due_date', e.target.value)}
                        style={{
                          padding: '7px 8px',
                          fontSize: '0.82rem',
                          borderRadius: '8px',
                          background: '#ffffff',
                          border: '1px solid rgba(11, 77, 36, 0.16)',
                          color: '#111c14',
                        }}
                      />

                      {/* Delete row */}
                      <button
                        type="button"
                        onClick={() => handleRemoveResponsibilityRow(idx)}
                        className="btn btn-secondary"
                        style={{
                          width: '32px',
                          height: '32px',
                          padding: 0,
                          borderRadius: '8px',
                          color: 'var(--error)',
                          border: '1px solid rgba(220, 38, 38, 0.18)',
                          background: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        title="Remove responsibility"
                        aria-label="Remove responsibility row"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddResponsibilityRow}
                    className="btn btn-secondary"
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.84rem',
                      borderRadius: '10px',
                      alignSelf: 'flex-start',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '4px',
                      background: '#ffffff',
                      border: '1.5px solid rgba(11, 77, 36, 0.18)',
                      color: 'var(--primary)',
                      fontWeight: 600,
                    }}
                  >
                    <Plus size={15} /> Add Another Responsibility
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Clean Sticky Footer */}
          <div
            style={{
              padding: '16px 26px',
              borderTop: '1px solid rgba(11, 77, 36, 0.1)',
              background: 'linear-gradient(135deg, #fbfaf6 0%, #f4efe4 100%)',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{
                padding: '9px 18px',
                fontSize: '0.88rem',
                borderRadius: '10px',
                background: '#ffffff',
                border: '1px solid rgba(11, 77, 36, 0.16)',
                fontWeight: 600,
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                padding: '9px 22px',
                fontSize: '0.88rem',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 700,
                boxShadow: '0 4px 14px rgba(11, 77, 36, 0.3)',
              }}
              disabled={loading}
            >
              <Check size={16} /> {loading ? 'Creating Task...' : 'Create & Delegate Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
