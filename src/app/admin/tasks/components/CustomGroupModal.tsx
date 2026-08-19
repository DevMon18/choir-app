'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, Plus, Trash2, Edit2, Check, Search, Shield } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { useToast } from '@/components/Toast';
import { createCustomGroup, updateCustomGroup, deleteCustomGroup } from '../actions';
import type { CustomGroup } from '@/app/tasks/types';

interface MemberOption {
  id: string;
  full_name: string;
  voice_part?: string | null;
  avatar_url?: string | null;
}

interface CustomGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: CustomGroup[];
  members: MemberOption[];
  onRefresh: () => void;
}

export const CustomGroupModal: React.FC<CustomGroupModalProps> = ({
  isOpen,
  onClose,
  groups,
  members,
  onRefresh,
}) => {
  const [mounted, setMounted] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
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

  const startCreate = () => {
    setIsCreating(true);
    setEditingGroupId(null);
    setGroupName('');
    setGroupDesc('');
    setSelectedMemberIds([]);
    setMemberSearch('');
  };

  const startEdit = (g: CustomGroup) => {
    setIsCreating(false);
    setEditingGroupId(g.id);
    setGroupName(g.name);
    setGroupDesc(g.description || '');
    setSelectedMemberIds((g.members || []).map((m) => m.member_id));
    setMemberSearch('');
  };

  const cancelForm = () => {
    setIsCreating(false);
    setEditingGroupId(null);
  };

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      addToast({ type: 'warning', title: 'Name Required', message: 'Please enter a group name.' });
      return;
    }

    setLoading(true);
    if (isCreating) {
      const res = await createCustomGroup(groupName.trim(), groupDesc.trim(), selectedMemberIds);
      setLoading(false);
      if (res.error) {
        addToast({ type: 'error', title: 'Creation Failed', message: res.error });
      } else {
        addToast({ type: 'success', title: 'Group Created', message: `"${groupName}" has been created.` });
        setIsCreating(false);
        onRefresh();
      }
    } else if (editingGroupId) {
      const res = await updateCustomGroup(editingGroupId, groupName.trim(), groupDesc.trim(), selectedMemberIds);
      setLoading(false);
      if (res.error) {
        addToast({ type: 'error', title: 'Update Failed', message: res.error });
      } else {
        addToast({ type: 'success', title: 'Group Updated', message: 'Changes saved successfully.' });
        setEditingGroupId(null);
        onRefresh();
      }
    }
  };

  const handleDelete = async (g: CustomGroup) => {
    if (!confirm(`Are you sure you want to delete custom group "${g.name}"?`)) return;

    setLoading(true);
    const res = await deleteCustomGroup(g.id);
    setLoading(false);
    if (res.error) {
      addToast({ type: 'error', title: 'Delete Failed', message: res.error });
    } else {
      addToast({ type: 'success', title: 'Group Deleted', message: `"${g.name}" was removed.` });
      if (editingGroupId === g.id) cancelForm();
      onRefresh();
    }
  };

  const filteredMembers = members.filter((m) => {
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
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
          maxWidth: '680px',
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
              <Users size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#111c14' }}>
                Custom Groups & Committees
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#5c675e', margin: '2px 0 0' }}>
                Manage custom task groups (e.g. Uniform Committee, Music Team)
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

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {isCreating || editingGroupId ? (
            /* Create / Edit Form */
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#111c14' }}>
                  {isCreating ? 'Create New Custom Group' : 'Edit Custom Group'}
                </h4>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                >
                  Cancel
                </button>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Group Name <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Uniform Committee, Audio Team, Liturgy"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: '#ffffff', color: '#111c14' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Description (Optional)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Purpose or responsibilities of this group"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: '#ffffff', color: '#111c14' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                    Group Members ({selectedMemberIds.length} Selected)
                  </label>
                  <div style={{ position: 'relative', width: '200px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#5c675e' }} />
                    <input
                      type="text"
                      placeholder="Search member..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px 6px 30px',
                        fontSize: '0.78rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(0,0,0,0.12)',
                        background: '#ffffff',
                        color: '#111c14',
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    maxHeight: '220px',
                    overflowY: 'auto',
                    border: '1px solid rgba(11, 77, 36, 0.12)',
                    borderRadius: '14px',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    background: '#faf8f3',
                  }}
                >
                  {filteredMembers.map((m) => {
                    const isSelected = selectedMemberIds.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleMember(m.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '10px',
                          background: isSelected ? 'rgba(11, 77, 36, 0.08)' : '#ffffff',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid rgba(0,0,0,0.06)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar src={m.avatar_url} name={m.full_name} size="sm" border />
                          <div>
                            <strong style={{ fontSize: '0.86rem', color: '#111c14', display: 'block' }}>
                              {m.full_name}
                            </strong>
                            {m.voice_part && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>
                                {m.voice_part}
                              </span>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '6px',
                            border: isSelected ? 'none' : '1.5px solid rgba(0,0,0,0.2)',
                            background: isSelected ? 'var(--primary)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                          }}
                        >
                          {isSelected && <Check size={14} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !groupName.trim()}
                  className="btn btn-primary"
                  style={{ padding: '8px 20px', fontWeight: 700 }}
                >
                  {loading ? 'Saving...' : isCreating ? 'Create Group' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            /* Groups List */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#5c675e', textTransform: 'uppercase' }}>
                  Existing Custom Groups ({groups.length})
                </span>
                <button
                  onClick={startCreate}
                  className="btn btn-primary"
                  style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={14} /> New Group
                </button>
              </div>

              {groups.length === 0 ? (
                <div
                  style={{
                    padding: '36px 20px',
                    textAlign: 'center',
                    background: '#faf8f3',
                    borderRadius: '16px',
                    border: '1px dashed rgba(11, 77, 36, 0.16)',
                  }}
                >
                  <Users size={32} style={{ color: 'var(--primary)', margin: '0 auto 8px', opacity: 0.6 }} />
                  <h4 style={{ fontSize: '0.98rem', fontWeight: 800, margin: '0 0 4px', color: '#111c14' }}>
                    No custom groups yet
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: '#5c675e', maxWidth: '300px', margin: '0 auto 12px' }}>
                    Create custom committees to target entire teams with one click when delegating tasks.
                  </p>
                  <button
                    onClick={startCreate}
                    className="btn btn-primary"
                    style={{ padding: '7px 16px', fontSize: '0.82rem' }}
                  >
                    + Create First Group
                  </button>
                </div>
              ) : (
                groups.map((g) => (
                  <div
                    key={g.id}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '14px',
                      background: '#faf8f3',
                      border: '1px solid rgba(11, 77, 36, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <strong style={{ fontSize: '0.96rem', color: '#111c14' }}>{g.name}</strong>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: 'rgba(11, 77, 36, 0.08)',
                            color: 'var(--primary)',
                          }}
                        >
                          {g.member_count || 0} Members
                        </span>
                      </div>
                      {g.description && (
                        <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#5c675e' }}>{g.description}</p>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => startEdit(g)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(g)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 8px', fontSize: '0.76rem', color: 'var(--error)' }}
                        title="Delete Group"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
