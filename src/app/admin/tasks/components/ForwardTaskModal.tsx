'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Users, Search, Check, Calendar, ArrowRight } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { useToast } from '@/components/Toast';
import { forwardTaskAssignees } from '../actions';
import type { TaskItem, CustomGroup, SystemGroupKey } from '@/app/tasks/types';

interface MemberOption {
  id: string;
  full_name: string;
  voice_part?: string | null;
  avatar_url?: string | null;
  role?: string;
}

interface ForwardTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskItem | null;
  members: MemberOption[];
  customGroups: CustomGroup[];
  onSuccess: () => void;
}

export const ForwardTaskModal: React.FC<ForwardTaskModalProps> = ({
  isOpen,
  onClose,
  task,
  members,
  customGroups,
  onSuccess,
}) => {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'individual' | 'system_group' | 'custom_group'>('individual');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedSystemGroup, setSelectedSystemGroup] = useState<SystemGroupKey>('soprano');
  const [selectedCustomGroupId, setSelectedCustomGroupId] = useState<string>('');
  const [responsibilityTitle, setResponsibilityTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (task) {
      setResponsibilityTitle(task.title);
      setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
      setSelectedMemberIds([]);
      if (customGroups.length > 0) setSelectedCustomGroupId(customGroups[0].id);
    }
  }, [task, customGroups]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted || !task) return null;

  // Existing assigned member IDs
  const alreadyAssignedMemberIds = (task.assignments || []).map((a) => a.member_id);

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((mid) => mid !== id) : [...prev, id]
    );
  };

  const getResolvedMemberIds = (): string[] => {
    if (mode === 'individual') return selectedMemberIds;
    if (mode === 'system_group') {
      if (selectedSystemGroup === 'officers') {
        return members
          .filter((m) => ['super_admin', 'director', 'secretary', 'treasurer'].includes(m.role || ''))
          .map((m) => m.id);
      }
      return members
        .filter((m) => (m.voice_part || '').toLowerCase() === selectedSystemGroup.toLowerCase())
        .map((m) => m.id);
    }
    if (mode === 'custom_group') {
      const g = customGroups.find((cg) => cg.id === selectedCustomGroupId);
      return (g?.members || []).map((m) => m.member_id);
    }
    return [];
  };

  const resolvedIds = getResolvedMemberIds();
  const newMemberIds = resolvedIds.filter((id) => !alreadyAssignedMemberIds.includes(id));

  const handleForward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMemberIds.length === 0) {
      addToast({
        type: 'warning',
        title: 'No New Members',
        message: 'All selected members are already assigned to this task.',
      });
      return;
    }

    setLoading(true);
    const newAssignees = newMemberIds.map((mid) => ({
      member_id: mid,
      responsibility: responsibilityTitle.trim() || task.title,
      due_date: dueDate ? new Date(dueDate).toISOString() : task.due_date || null,
    }));

    const res = await forwardTaskAssignees(task.id, newAssignees);
    setLoading(false);

    if (res.error) {
      addToast({ type: 'error', title: 'Forwarding Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Task Forwarded',
        message: `Added ${newMemberIds.length} new assignee(s) to "${task.title}".`,
      });
      onSuccess();
      onClose();
    }
  };

  const filteredMembers = members.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return m.full_name.toLowerCase().includes(q) || (m.voice_part && m.voice_part.toLowerCase().includes(q));
  });

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
          maxWidth: '620px',
          maxHeight: '88vh',
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
            padding: '18px 24px',
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
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--primary) 0%, #15803d 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserPlus size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#111c14' }}>
                Forward / Add Assignee
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#5c675e', margin: '2px 0 0' }}>
                Task: &ldquo;{task.title}&rdquo;
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              width: '34px',
              height: '34px',
              padding: 0,
              borderRadius: '50%',
              minHeight: 'auto',
              border: '1px solid rgba(11, 77, 36, 0.12)',
              background: '#ffffff',
              color: '#5c675e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleForward} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
              Responsibility / Role Title
            </label>
            <input
              type="text"
              className="input-field"
              value={responsibilityTitle}
              onChange={(e) => setResponsibilityTitle(e.target.value)}
              placeholder="e.g. Stage Decoration, Alto Lead, Soprano Solo"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: '#ffffff', color: '#111c14' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
              Due Date (Optional)
            </label>
            <input
              type="date"
              className="input-field"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: '#ffffff', color: '#111c14' }}
            />
          </div>

          {/* Mode Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
              Select Audience to Add
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setMode('individual')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: mode === 'individual' ? 'var(--primary)' : 'rgba(0,0,0,0.1)',
                  background: mode === 'individual' ? 'rgba(11, 77, 36, 0.08)' : '#ffffff',
                  color: mode === 'individual' ? 'var(--primary)' : '#5c675e',
                  cursor: 'pointer',
                }}
              >
                Individual Members
              </button>
              <button
                type="button"
                onClick={() => setMode('system_group')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: mode === 'system_group' ? 'var(--primary)' : 'rgba(0,0,0,0.1)',
                  background: mode === 'system_group' ? 'rgba(11, 77, 36, 0.08)' : '#ffffff',
                  color: mode === 'system_group' ? 'var(--primary)' : '#5c675e',
                  cursor: 'pointer',
                }}
              >
                System Group
              </button>
              <button
                type="button"
                onClick={() => setMode('custom_group')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: mode === 'custom_group' ? 'var(--primary)' : 'rgba(0,0,0,0.1)',
                  background: mode === 'custom_group' ? 'rgba(11, 77, 36, 0.08)' : '#ffffff',
                  color: mode === 'custom_group' ? 'var(--primary)' : '#5c675e',
                  cursor: 'pointer',
                }}
              >
                Custom Group
              </button>
            </div>

            {mode === 'system_group' && (
              <select
                className="input-field"
                value={selectedSystemGroup}
                onChange={(e) => setSelectedSystemGroup(e.target.value as any)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: '#ffffff', color: '#111c14' }}
              >
                <option value="officers">All Officers (Director, Secretary, Treasurer)</option>
                <option value="soprano">Soprano Section</option>
                <option value="alto">Alto Section</option>
                <option value="tenor">Tenor Section</option>
                <option value="bass">Bass Section</option>
              </select>
            )}

            {mode === 'custom_group' && (
              customGroups.length === 0 ? (
                <p style={{ fontSize: '0.84rem', color: '#5c675e', margin: 0 }}>
                  No custom groups created yet.
                </p>
              ) : (
                <select
                  className="input-field"
                  value={selectedCustomGroupId}
                  onChange={(e) => setSelectedCustomGroupId(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: '#ffffff', color: '#111c14' }}
                >
                  {customGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.member_count || 0} members)
                    </option>
                  ))}
                </select>
              )
            )}

            {mode === 'individual' && (
              <div>
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#5c675e' }} />
                  <input
                    type="text"
                    placeholder="Search member to add..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 32px',
                      fontSize: '0.82rem',
                      borderRadius: '10px',
                      border: '1px solid rgba(0,0,0,0.12)',
                      background: '#ffffff',
                      color: '#111c14',
                    }}
                  />
                </div>

                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    border: '1px solid rgba(11, 77, 36, 0.12)',
                    borderRadius: '12px',
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    background: '#faf8f3',
                  }}
                >
                  {filteredMembers.map((m) => {
                    const isAlreadyAssigned = alreadyAssignedMemberIds.includes(m.id);
                    const isSelected = selectedMemberIds.includes(m.id);

                    return (
                      <div
                        key={m.id}
                        onClick={() => !isAlreadyAssigned && toggleMember(m.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: isAlreadyAssigned ? 'rgba(0,0,0,0.03)' : isSelected ? 'rgba(11, 77, 36, 0.08)' : '#ffffff',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid rgba(0,0,0,0.06)',
                          opacity: isAlreadyAssigned ? 0.6 : 1,
                          cursor: isAlreadyAssigned ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar src={m.avatar_url} name={m.full_name} size="sm" border />
                          <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#111c14' }}>{m.full_name}</span>
                          {m.voice_part && <span style={{ fontSize: '0.72rem', color: 'var(--primary)' }}>({m.voice_part})</span>}
                        </div>

                        {isAlreadyAssigned ? (
                          <span style={{ fontSize: '0.7rem', color: '#5c675e', fontStyle: 'italic' }}>Already Assigned</span>
                        ) : (
                          <div
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '4px',
                              border: isSelected ? 'none' : '1.5px solid rgba(0,0,0,0.2)',
                              background: isSelected ? 'var(--primary)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                            }}
                          >
                            {isSelected && <Check size={13} />}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Summary / Preview */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '12px',
              background: '#faf8f3',
              border: '1px solid rgba(11, 77, 36, 0.1)',
              fontSize: '0.82rem',
              color: '#111c14',
            }}
          >
            <strong>Preview: </strong>
            {newMemberIds.length === 0 ? (
              <span style={{ color: 'var(--muted)' }}>Select members to add to this task.</span>
            ) : (
              <span>
                Adding <strong style={{ color: 'var(--primary)' }}>{newMemberIds.length} member(s)</strong> to ongoing task.
              </span>
            )}
          </div>

          {/* Footer buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '8px 16px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || newMemberIds.length === 0}
              className="btn btn-primary"
              style={{ padding: '8px 20px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <UserPlus size={16} />
              <span>{loading ? 'Adding...' : 'Add Assignee(s)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
