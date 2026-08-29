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
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[680px] max-h-[88vh] bg-white rounded-3xl border border-primary/16 shadow-2xl flex flex-col overflow-hidden animate-slideUpModal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="py-4.5 px-6 border-b border-primary/10 flex items-center justify-between bg-gradient-to-br from-[#fbfaf6] to-[#f4efe4]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-green-700 text-white flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold m-0 text-foreground">
                Custom Groups & Committees
              </h3>
              <p className="text-xs text-muted mt-0.5 mb-0">
                Manage custom task groups (e.g. Uniform Committee, Music Team)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary !w-[34px] !h-[34px] !p-0 !rounded-full !min-h-0 !border-primary/12 bg-white text-muted flex items-center justify-center cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:py-5 sm:px-6">
          {isCreating || editingGroupId ? (
            /* Create / Edit Form */
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h4 className="text-base font-extrabold m-0 text-foreground">
                  {isCreating ? 'Create New Custom Group' : 'Edit Custom Group'}
                </h4>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="btn btn-secondary !py-1 !px-2.5 text-xs"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-foreground">
                  Group Name <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  className="input-field w-full !py-2.5 !px-3.5 !rounded-xl bg-white text-foreground"
                  placeholder="e.g. Uniform Committee, Audio Team, Liturgy"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-foreground">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  className="input-field w-full !py-2.5 !px-3.5 !rounded-xl bg-white text-foreground"
                  placeholder="Purpose or responsibilities of this group"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-foreground">
                    Group Members ({selectedMemberIds.length} Selected)
                  </label>
                  <div className="relative w-[200px]">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="text"
                      placeholder="Search member..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full py-1.5 pr-2.5 pl-8 text-xs rounded-lg border border-black/12 bg-white text-foreground"
                    />
                  </div>
                </div>

                <div className="max-h-[220px] overflow-y-auto border border-primary/12 rounded-2xl p-2 flex flex-col gap-1 bg-[#faf8f3]">
                  {filteredMembers.map((m) => {
                    const isSelected = selectedMemberIds.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleMember(m.id)}
                        className={`flex items-center justify-between py-2 px-3 rounded-xl cursor-pointer transition-all duration-150 ${
                          isSelected ? 'bg-primary/8 border border-primary' : 'bg-white border border-black/6'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar src={m.avatar_url} name={m.full_name} size="sm" border />
                          <div>
                            <strong className="text-xs sm:text-sm text-foreground block">
                              {m.full_name}
                            </strong>
                            {m.voice_part && (
                              <span className="text-xs text-primary font-semibold">
                                {m.voice_part}
                              </span>
                            )}
                          </div>
                        </div>

                        <div
                          className={`w-5.5 h-5.5 rounded-md flex items-center justify-center text-white ${
                            isSelected ? 'bg-primary' : 'border border-black/20 bg-transparent'
                          }`}
                        >
                          {isSelected && <Check size={14} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="btn btn-secondary !py-2 !px-4 text-xs sm:text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !groupName.trim()}
                  className="btn btn-primary !py-2 !px-5 text-xs sm:text-sm font-bold"
                >
                  {loading ? 'Saving...' : isCreating ? 'Create Group' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            /* Groups List */
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm font-bold text-muted uppercase">
                  Existing Custom Groups ({groups.length})
                </span>
                <button
                  onClick={startCreate}
                  className="btn btn-primary !py-1.5 !px-3.5 text-xs inline-flex items-center gap-1.5"
                >
                  <Plus size={14} /> New Group
                </button>
              </div>

              {groups.length === 0 ? (
                <div className="py-9 px-5 text-center bg-[#faf8f3] rounded-2xl border border-dashed border-primary/16">
                  <Users size={32} className="text-primary mx-auto mb-2 opacity-60" />
                  <h4 className="text-sm sm:text-base font-extrabold m-0 mb-1 text-foreground">
                    No custom groups yet
                  </h4>
                  <p className="text-xs text-muted max-w-[300px] mx-auto mb-3">
                    Create custom committees to target entire teams with one click when delegating tasks.
                  </p>
                  <button
                    onClick={startCreate}
                    className="btn btn-primary !py-1.5 !px-4 text-xs"
                  >
                    + Create First Group
                  </button>
                </div>
              ) : (
                groups.map((g) => (
                  <div
                    key={g.id}
                    className="py-3.5 px-4 rounded-2xl bg-[#faf8f3] border border-primary/10 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <strong className="text-sm sm:text-base text-foreground">{g.name}</strong>
                        <span className="text-[0.72rem] font-bold py-0.5 px-2 rounded-md bg-primary/8 text-primary">
                          {g.member_count || 0} Members
                        </span>
                      </div>
                      {g.description && (
                        <p className="mt-0.5 mb-0 text-xs text-muted">{g.description}</p>
                      )}
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => startEdit(g)}
                        className="btn btn-secondary !py-1.5 !px-2.5 text-xs inline-flex items-center gap-1"
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(g)}
                        className="btn btn-secondary !py-1.5 !px-2 text-xs !text-error"
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
