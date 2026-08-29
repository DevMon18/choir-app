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
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[620px] max-h-[88vh] bg-white rounded-3xl border border-primary/16 shadow-2xl flex flex-col overflow-hidden animate-slideUpModal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="py-4.5 px-6 border-b border-primary/10 flex items-center justify-between bg-gradient-to-br from-[#fbfaf6] to-[#f4efe4]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-green-700 text-white flex items-center justify-center">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold m-0 text-foreground">
                Forward / Add Assignee
              </h3>
              <p className="text-xs text-muted mt-0.5 mb-0">
                Task: &ldquo;{task.title}&rdquo;
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

        {/* Form Body */}
        <form onSubmit={handleForward} className="flex-1 overflow-y-auto p-5 sm:py-5 sm:px-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold mb-1.5 text-foreground">
              Responsibility / Role Title
            </label>
            <input
              type="text"
              className="input-field w-full !py-2.5 !px-3.5 !rounded-xl bg-white text-foreground"
              value={responsibilityTitle}
              onChange={(e) => setResponsibilityTitle(e.target.value)}
              placeholder="e.g. Stage Decoration, Alto Lead, Soprano Solo"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 text-foreground">
              Due Date (Optional)
            </label>
            <input
              type="date"
              className="input-field w-full !py-2.5 !px-3.5 !rounded-xl bg-white text-foreground"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-bold mb-1.5 text-foreground">
              Select Audience to Add
            </label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setMode('individual')}
                className={`flex-1 p-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  mode === 'individual'
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-black/10 bg-white text-muted'
                }`}
              >
                Individual Members
              </button>
              <button
                type="button"
                onClick={() => setMode('system_group')}
                className={`flex-1 p-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  mode === 'system_group'
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-black/10 bg-white text-muted'
                }`}
              >
                System Group
              </button>
              <button
                type="button"
                onClick={() => setMode('custom_group')}
                className={`flex-1 p-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  mode === 'custom_group'
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-black/10 bg-white text-muted'
                }`}
              >
                Custom Group
              </button>
            </div>

            {mode === 'system_group' && (
              <select
                className="input-field w-full !py-2.5 !px-3.5 !rounded-xl bg-white text-foreground"
                value={selectedSystemGroup}
                onChange={(e) => setSelectedSystemGroup(e.target.value as any)}
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
                <p className="text-xs sm:text-sm text-muted m-0">
                  No custom groups created yet.
                </p>
              ) : (
                <select
                  className="input-field w-full !py-2.5 !px-3.5 !rounded-xl bg-white text-foreground"
                  value={selectedCustomGroupId}
                  onChange={(e) => setSelectedCustomGroupId(e.target.value)}
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
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    placeholder="Search member to add..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full py-2 pr-3 pl-8 text-xs rounded-xl border border-black/12 bg-white text-foreground"
                  />
                </div>

                <div className="max-h-[180px] overflow-y-auto border border-primary/12 rounded-xl p-1.5 flex flex-col gap-1 bg-[#faf8f3]">
                  {filteredMembers.map((m) => {
                    const isAlreadyAssigned = alreadyAssignedMemberIds.includes(m.id);
                    const isSelected = selectedMemberIds.includes(m.id);

                    return (
                      <div
                        key={m.id}
                        onClick={() => !isAlreadyAssigned && toggleMember(m.id)}
                        className={`flex items-center justify-between p-2 rounded-lg ${
                          isAlreadyAssigned
                            ? 'bg-black/3 border border-black/6 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-primary/8 border border-primary cursor-pointer'
                            : 'bg-white border border-black/6 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar src={m.avatar_url} name={m.full_name} size="sm" border />
                          <span className="text-xs sm:text-[0.84rem] font-semibold text-foreground">{m.full_name}</span>
                          {m.voice_part && <span className="text-xs text-primary">({m.voice_part})</span>}
                        </div>

                        {isAlreadyAssigned ? (
                          <span className="text-[0.7rem] text-muted italic">Already Assigned</span>
                        ) : (
                          <div
                            className={`w-5 h-5 rounded flex items-center justify-center text-white ${
                              isSelected ? 'bg-primary' : 'border border-black/20 bg-transparent'
                            }`}
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
          <div className="py-2.5 px-3.5 rounded-xl bg-[#faf8f3] border border-primary/10 text-xs text-foreground">
            <strong>Preview: </strong>
            {newMemberIds.length === 0 ? (
              <span className="text-muted">Select members to add to this task.</span>
            ) : (
              <span>
                Adding <strong className="text-primary">{newMemberIds.length} member(s)</strong> to ongoing task.
              </span>
            )}
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-2.5 mt-1.5">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary !py-2 !px-4 text-xs sm:text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || newMemberIds.length === 0}
              className="btn btn-primary !py-2 !px-5 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5"
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
