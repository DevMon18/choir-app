'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Users, Music, Mic, Calendar, X, ListTodo, Check, AlertCircle, Sparkles, UserCheck, Shield, GitMerge, Info } from 'lucide-react';
import { createTaskWithResponsibilities, forwardTaskAssignees, CreateResponsibilityItem } from '../actions';
import { findSimilarTasks } from '../utils/similarity';
import { useToast } from '@/components/Toast';
import type { TaskPriority, CustomGroup, TaskAudienceType, SystemGroupKey, TaskItem } from '@/app/tasks/types';

interface MemberOption {
  id: string;
  full_name: string;
  voice_part?: string | null;
  role?: string;
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
  customGroups: CustomGroup[];
  existingTasks?: TaskItem[];
  onOpenGroupManager?: () => void;
  onSuccess: () => void;
}

export const TaskCreateModal: React.FC<TaskCreateModalProps> = ({
  isOpen,
  onClose,
  members,
  songs,
  sequences,
  customGroups,
  existingTasks = [],
  onOpenGroupManager,
  onSuccess,
}) => {
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [dueDate, setDueDate] = useState('');
  const [relatedSongId, setRelatedSongId] = useState('');
  const [relatedSequenceId, setRelatedSequenceId] = useState('');

  // Duplicate detection state
  const [dismissedDuplicateId, setDismissedDuplicateId] = useState<string | null>(null);

  // Audience targeting mode
  const [audienceType, setAudienceType] = useState<TaskAudienceType>('individual');
  const [systemGroup, setSystemGroup] = useState<SystemGroupKey>('soprano');
  const [customGroupId, setCustomGroupId] = useState<string>('');
  const [commonResponsibility, setCommonResponsibility] = useState('');

  // Individual delegation rows
  const [responsibilities, setResponsibilities] = useState<CreateResponsibilityItem[]>([
    { member_id: '', responsibility: '', due_date: '' },
  ]);

  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (customGroups.length > 0 && !customGroupId) {
      setCustomGroupId(customGroups[0].id);
    }
  }, [customGroups, customGroupId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Real-time fuzzy duplicate detection (95% - 100% similarity on title & description)
  const similarMatches = useMemo(() => {
    return findSimilarTasks({ title, description }, existingTasks, 0.92);
  }, [title, description, existingTasks]);

  const bestMatch = similarMatches.length > 0 ? similarMatches[0] : null;
  const isDuplicatePromptVisible = bestMatch && dismissedDuplicateId !== bestMatch.task.id;

  // Resolve audience preview
  const resolvedTargetMembers = useMemo(() => {
    if (audienceType === 'all') return members;
    if (audienceType === 'system_group') {
      if (systemGroup === 'officers') {
        return members.filter((m) => ['super_admin', 'director', 'secretary', 'treasurer'].includes(m.role || ''));
      }
      return members.filter((m) => (m.voice_part || '').toLowerCase() === systemGroup.toLowerCase());
    }
    if (audienceType === 'custom_group') {
      const g = customGroups.find((cg) => cg.id === customGroupId);
      if (!g || !g.members) return [];
      const memberIds = g.members.map((m) => m.member_id);
      return members.filter((m) => memberIds.includes(m.id));
    }
    return [];
  }, [audienceType, systemGroup, customGroupId, members, customGroups]);

  // Safe early return only after all hooks are declared
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

  // 1-Click Combine into Existing Task
  const handleCombineIntoExisting = async (targetTask: TaskItem) => {
    let newAssignees: { member_id: string; responsibility: string; due_date: string | null }[] = [];

    if (audienceType === 'individual') {
      const validRows = responsibilities.filter((r) => r.member_id && r.responsibility.trim());
      if (validRows.length === 0) {
        addToast({
          type: 'warning',
          title: 'Select Members First',
          message: 'Please fill in at least one member and responsibility below before combining.',
        });
        return;
      }
      newAssignees = validRows.map((r) => ({
        member_id: r.member_id,
        responsibility: r.responsibility.trim(),
        due_date: r.due_date ? new Date(r.due_date).toISOString() : targetTask.due_date || null,
      }));
    } else {
      if (resolvedTargetMembers.length === 0) {
        addToast({
          type: 'warning',
          title: 'No Members in Audience',
          message: 'The selected audience group has no active members.',
        });
        return;
      }
      newAssignees = resolvedTargetMembers.map((m) => ({
        member_id: m.id,
        responsibility: commonResponsibility.trim() || title.trim() || targetTask.title,
        due_date: dueDate ? new Date(dueDate).toISOString() : targetTask.due_date || null,
      }));
    }

    setLoading(true);
    const res = await forwardTaskAssignees(targetTask.id, newAssignees);
    setLoading(false);

    if (res.error) {
      addToast({ type: 'error', title: 'Combine Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Combined into Existing Task',
        message: `Added ${newAssignees.length} assignee(s) directly to "${targetTask.title}".`,
      });
      onSuccess();
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      addToast({ type: 'warning', title: 'Title Required', message: 'Please enter a task title.' });
      return;
    }

    if (audienceType === 'individual') {
      const validRows = responsibilities.filter((r) => r.member_id && r.responsibility.trim());
      if (validRows.length === 0) {
        addToast({
          type: 'warning',
          title: 'Responsibilities Incomplete',
          message: 'Please assign at least one member with a specific responsibility description.',
        });
        return;
      }
    } else {
      if (resolvedTargetMembers.length === 0) {
        addToast({
          type: 'warning',
          title: 'No Members in Audience',
          message: 'The selected audience group has no active members.',
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
      audienceType,
      {
        systemGroup,
        customGroupId,
        commonResponsibilityTitle: commonResponsibility.trim() || title.trim(),
      }
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
          maxHeight: '92vh',
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
        {/* Modal Sticky Header */}
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
                boxShadow: '0 4px 12px rgba(11, 77, 36, 0.2)',
              }}
            >
              <ListTodo size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#111c14' }}>
                Create New Choir Task
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#5c675e', margin: '2px 0 0' }}>
                Target individual delegates, voice sections, or custom committees
              </p>
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
              border: '1px solid rgba(11, 77, 36, 0.12)',
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
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Main Task Information */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#111c14', marginBottom: '6px' }}>
                Task Title <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Easter Vigil Rehearsal Prep, Recollection Materials, Sunday Sound Setup"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDismissedDuplicateId(null);
                }}
                required
                autoFocus
                style={{
                  width: '100%',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontSize: '0.94rem',
                  background: '#ffffff',
                  border: '1.5px solid rgba(11, 77, 36, 0.18)',
                  color: '#111c14',
                }}
              />

              {/* Duplicate Detection Alert Banner */}
              {isDuplicatePromptVisible && bestMatch && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '14px 16px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    border: '1.5px solid rgba(37, 99, 235, 0.3)',
                    boxShadow: '0 4px 16px rgba(37, 99, 235, 0.1)',
                    animation: 'fadeIn 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: '#2563eb',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <GitMerge size={16} />
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.88rem', color: '#1e3a8a', display: 'block' }}>
                          Similar Existing Task Found: &ldquo;{bestMatch.task.title}&rdquo;
                        </strong>
                        <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#3b82f6' }}>
                          This task already exists with <strong>{bestMatch.task.assignments?.length || 0} assignees</strong>.
                          You can combine your members directly into this existing task instead of creating a duplicate.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDismissedDuplicateId(bestMatch.task.id)}
                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                      title="Dismiss & keep as separate task"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleCombineIntoExisting(bestMatch.task)}
                      disabled={loading}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '10px',
                        background: '#2563eb',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                      }}
                    >
                      <GitMerge size={14} /> Combine with &ldquo;{bestMatch.task.title}&rdquo;
                    </button>

                    <button
                      type="button"
                      onClick={() => setDismissedDuplicateId(bestMatch.task.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '10px',
                        background: '#ffffff',
                        border: '1px solid rgba(37, 99, 235, 0.25)',
                        color: '#1e3a8a',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Keep as Separate Task
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#5c675e', marginBottom: '6px' }}>
                Description (Optional)
              </label>
              <textarea
                className="input-field"
                rows={2}
                placeholder="Add general instructions or background notes for the task..."
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#5c675e', marginBottom: '6px' }}>
                  Related Song (Optional)
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
          </div>

          {/* Audience & Delegation Section */}
          <div
            style={{
              borderTop: '1px solid rgba(11, 77, 36, 0.12)',
              paddingTop: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#111c14' }}>
                Task Audience & Delegation
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#5c675e', margin: '2px 0 0' }}>
                Choose who will be assigned to execute this task
              </p>
            </div>

            {/* Audience Mode Segmented Switcher */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setAudienceType('individual')}
                style={{
                  padding: '8px 10px',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: audienceType === 'individual' ? 'var(--primary)' : 'rgba(0,0,0,0.1)',
                  background: audienceType === 'individual' ? 'rgba(11, 77, 36, 0.08)' : '#ffffff',
                  color: audienceType === 'individual' ? 'var(--primary)' : '#5c675e',
                  cursor: 'pointer',
                }}
              >
                Individual Roles
              </button>
              <button
                type="button"
                onClick={() => setAudienceType('system_group')}
                style={{
                  padding: '8px 10px',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: audienceType === 'system_group' ? 'var(--primary)' : 'rgba(0,0,0,0.1)',
                  background: audienceType === 'system_group' ? 'rgba(11, 77, 36, 0.08)' : '#ffffff',
                  color: audienceType === 'system_group' ? 'var(--primary)' : '#5c675e',
                  cursor: 'pointer',
                }}
              >
                System Group
              </button>
              <button
                type="button"
                onClick={() => setAudienceType('custom_group')}
                style={{
                  padding: '8px 10px',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: audienceType === 'custom_group' ? 'var(--primary)' : 'rgba(0,0,0,0.1)',
                  background: audienceType === 'custom_group' ? 'rgba(11, 77, 36, 0.08)' : '#ffffff',
                  color: audienceType === 'custom_group' ? 'var(--primary)' : '#5c675e',
                  cursor: 'pointer',
                }}
              >
                Custom Group
              </button>
              <button
                type="button"
                onClick={() => setAudienceType('all')}
                style={{
                  padding: '8px 10px',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: audienceType === 'all' ? 'var(--primary)' : 'rgba(0,0,0,0.1)',
                  background: audienceType === 'all' ? 'rgba(11, 77, 36, 0.08)' : '#ffffff',
                  color: audienceType === 'all' ? 'var(--primary)' : '#5c675e',
                  cursor: 'pointer',
                }}
              >
                All Members
              </button>
            </div>

            {/* Group Configuration Area */}
            {audienceType !== 'individual' && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  background: '#faf8f3',
                  border: '1px solid rgba(11, 77, 36, 0.14)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {audienceType === 'system_group' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                      Select Fixed System Category
                    </label>
                    <select
                      className="input-field"
                      value={systemGroup}
                      onChange={(e) => setSystemGroup(e.target.value as SystemGroupKey)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: '#ffffff', color: '#111c14' }}
                    >
                      <option value="officers">Officers (Director, Secretary, Treasurer)</option>
                      <option value="soprano">Soprano Section</option>
                      <option value="alto">Alto Section</option>
                      <option value="tenor">Tenor Section</option>
                      <option value="bass">Bass Section</option>
                    </select>
                  </div>
                )}

                {audienceType === 'custom_group' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                        Select Custom Group / Committee
                      </label>
                      {onOpenGroupManager && (
                        <button
                          type="button"
                          onClick={onOpenGroupManager}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          + Manage Groups
                        </button>
                      )}
                    </div>

                    {customGroups.length === 0 ? (
                      <div style={{ padding: '12px', background: '#ffffff', borderRadius: '10px', fontSize: '0.84rem', color: '#5c675e' }}>
                        No custom groups available. Click &quot;Manage Groups&quot; to create one.
                      </div>
                    ) : (
                      <select
                        className="input-field"
                        value={customGroupId}
                        onChange={(e) => setCustomGroupId(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: '#ffffff', color: '#111c14' }}
                      >
                        {customGroups.map((cg) => (
                          <option key={cg.id} value={cg.id}>
                            {cg.name} ({cg.member_count || 0} members)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Common Responsibility Description
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Practice voice parts, Attend uniform fitting session, etc."
                    value={commonResponsibility}
                    onChange={(e) => setCommonResponsibility(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: '#ffffff', color: '#111c14' }}
                  />
                </div>

                {/* Audience Resolution Counter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#111c14' }}>
                  <UserCheck size={16} style={{ color: 'var(--primary)' }} />
                  <span>
                    Will generate <strong style={{ color: 'var(--primary)' }}>{resolvedTargetMembers.length} individual assignment(s)</strong>.
                  </span>
                </div>
              </div>
            )}

            {/* Individual Delegation Builder */}
            {audienceType === 'individual' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {responsibilities.map((row, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '14px',
                      background: '#faf8f3',
                      border: '1.5px solid rgba(11, 77, 36, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Member Select */}
                    <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#5c675e', marginBottom: '4px' }}>
                        Member <span style={{ color: 'var(--error)' }}>*</span>
                      </label>
                      <select
                        className="input-field"
                        value={row.member_id}
                        onChange={(e) => handleUpdateResponsibility(idx, 'member_id', e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px 10px', fontSize: '0.84rem', background: '#ffffff', color: '#111c14' }}
                      >
                        <option value="">-- Choose Member --</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.full_name} {m.voice_part ? `(${m.voice_part})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Specific Responsibility */}
                    <div style={{ flex: '2 1 240px', minWidth: '200px' }}>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#5c675e', marginBottom: '4px' }}>
                        Responsibility / Deliverable <span style={{ color: 'var(--error)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. Design the LOGO, Lead Tenor Section"
                        value={row.responsibility}
                        onChange={(e) => handleUpdateResponsibility(idx, 'responsibility', e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px 10px', fontSize: '0.84rem', background: '#ffffff', color: '#111c14' }}
                      />
                    </div>

                    {/* Due date override */}
                    <div style={{ flex: '1 1 140px', minWidth: '130px' }}>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#5c675e', marginBottom: '4px' }}>
                        Due (Optional)
                      </label>
                      <input
                        type="date"
                        className="input-field"
                        value={row.due_date || ''}
                        onChange={(e) => handleUpdateResponsibility(idx, 'due_date', e.target.value)}
                        style={{ width: '100%', padding: '7px 8px', fontSize: '0.82rem', background: '#ffffff', color: '#111c14' }}
                      />
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveResponsibilityRow(idx)}
                      className="btn btn-secondary"
                      style={{
                        padding: '6px',
                        minHeight: '34px',
                        color: 'var(--error)',
                        alignSelf: 'flex-end',
                      }}
                      title="Remove responsibility"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddResponsibilityRow}
                  className="btn btn-secondary"
                  style={{
                    padding: '8px 14px',
                    fontSize: '0.82rem',
                    alignSelf: 'flex-start',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Plus size={14} /> Add Another Responsibility
                </button>
              </div>
            )}
          </div>

          {/* Sticky Footer Action Bar */}
          <div
            style={{
              paddingTop: '16px',
              borderTop: '1px solid rgba(11, 77, 36, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '10px 20px', fontSize: '0.9rem', borderRadius: '12px' }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                padding: '10px 26px',
                fontSize: '0.92rem',
                borderRadius: '12px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(11, 77, 36, 0.3)',
              }}
              disabled={loading}
            >
              <Plus size={18} />
              <span>{loading ? 'Creating Task...' : 'Delegate & Create Task'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
