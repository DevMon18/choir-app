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
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[740px] max-h-[92vh] bg-white rounded-3xl border border-primary/16 shadow-2xl flex flex-col overflow-hidden animate-slideUpModal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Sticky Header */}
        <div className="py-5 px-6 border-b border-primary/10 flex items-center justify-between bg-gradient-to-br from-[#fbfaf6] to-[#f4efe4]">
          <div className="flex items-center gap-3">
            <div className="w-10.5 h-10.5 rounded-xl bg-gradient-to-br from-primary to-green-700 text-white flex items-center justify-center shadow-md shadow-primary/20">
              <ListTodo size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold m-0 text-foreground">
                Create New Choir Task
              </h2>
              <p className="text-xs text-muted mt-0.5 mb-0">
                Target individual delegates, voice sections, or custom committees
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary !w-9 !h-9 !p-0 !rounded-full !min-h-0 !border-primary/12 bg-white text-muted flex items-center justify-center cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Main Task Information */}
          <div className="flex flex-col gap-3.5">
            <div>
              <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5">
                Task Title <span className="text-error">*</span>
              </label>
              <input
                type="text"
                className="input-field w-full !rounded-xl !py-3 !px-4 text-sm sm:text-[0.94rem] bg-white border-[1.5px] border-primary/18 text-foreground"
                placeholder="e.g. Easter Vigil Rehearsal Prep, Recollection Materials, Sunday Sound Setup"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDismissedDuplicateId(null);
                }}
                required
                autoFocus
              />

              {/* Duplicate Detection Alert Banner */}
              {isDuplicatePromptVisible && bestMatch && (
                <div className="mt-2.5 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 border-[1.5px] border-blue-600/30 shadow-md shadow-blue-600/10 animate-fadeIn">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                        <GitMerge size={16} />
                      </div>
                      <div>
                        <strong className="text-xs sm:text-sm text-blue-900 block">
                          Similar Existing Task Found: &ldquo;{bestMatch.task.title}&rdquo;
                        </strong>
                        <p className="mt-0.5 mb-0 text-xs text-blue-600">
                          This task already exists with <strong>{bestMatch.task.assignments?.length || 0} assignees</strong>.
                          You can combine your members directly into this existing task instead of creating a duplicate.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDismissedDuplicateId(bestMatch.task.id)}
                      className="bg-transparent border-none text-slate-500 cursor-pointer p-0.5"
                      title="Dismiss & keep as separate task"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2.5 mt-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleCombineIntoExisting(bestMatch.task)}
                      disabled={loading}
                      className="py-1.5 px-3.5 rounded-xl bg-blue-600 border-none text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-sm shadow-blue-600/30"
                    >
                      <GitMerge size={14} /> Combine with &ldquo;{bestMatch.task.title}&rdquo;
                    </button>

                    <button
                      type="button"
                      onClick={() => setDismissedDuplicateId(bestMatch.task.id)}
                      className="py-1.5 px-3 rounded-xl bg-white border border-blue-600/25 text-blue-900 text-xs font-semibold cursor-pointer"
                    >
                      Keep as Separate Task
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-muted mb-1.5">
                Description (Optional)
              </label>
              <textarea
                className="input-field w-full !rounded-xl !py-2.5 !px-3.5 text-xs sm:text-sm bg-white border-[1.5px] border-primary/18 text-foreground leading-normal"
                rows={2}
                placeholder="Add general instructions or background notes for the task..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Priority & Deadline Grid */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-foreground mb-1.5">
                  Priority
                </label>
                <select
                  className="input-field w-full !rounded-xl !py-2.5 !px-3.5 text-xs sm:text-sm bg-white border-[1.5px] border-primary/18 text-foreground"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                >
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-foreground mb-1.5">
                  Overall Due Date
                </label>
                <input
                  type="date"
                  className="input-field w-full !rounded-xl !py-2.5 !px-3.5 text-xs sm:text-sm bg-white border-[1.5px] border-primary/18 text-foreground"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Related Entities (Song / Sequence) */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-muted mb-1.5">
                  Related Song (Optional)
                </label>
                <select
                  className="input-field w-full !rounded-xl !py-2.5 !px-3.5 text-xs sm:text-sm bg-white border-[1.5px] border-primary/18 text-foreground"
                  value={relatedSongId}
                  onChange={(e) => setRelatedSongId(e.target.value)}
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
                <label className="block text-xs sm:text-sm font-semibold text-muted mb-1.5">
                  Related Mass Sequence (Optional)
                </label>
                <select
                  className="input-field w-full !rounded-xl !py-2.5 !px-3.5 text-xs sm:text-sm bg-white border-[1.5px] border-primary/18 text-foreground"
                  value={relatedSequenceId}
                  onChange={(e) => setRelatedSequenceId(e.target.value)}
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
          <div className="border-t border-primary/12 pt-4.5 flex flex-col gap-3.5">
            <div>
              <h3 className="text-base font-extrabold m-0 text-foreground">
                Task Audience & Delegation
              </h3>
              <p className="text-xs text-muted mt-0.5 mb-0">
                Choose who will be assigned to execute this task
              </p>
            </div>

            {/* Audience Mode Segmented Switcher */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
              <button
                type="button"
                onClick={() => setAudienceType('individual')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                  audienceType === 'individual'
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-black/10 bg-white text-muted'
                }`}
              >
                Individual Roles
              </button>
              <button
                type="button"
                onClick={() => setAudienceType('system_group')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                  audienceType === 'system_group'
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-black/10 bg-white text-muted'
                }`}
              >
                System Group
              </button>
              <button
                type="button"
                onClick={() => setAudienceType('custom_group')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                  audienceType === 'custom_group'
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-black/10 bg-white text-muted'
                }`}
              >
                Custom Group
              </button>
              <button
                type="button"
                onClick={() => setAudienceType('all')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                  audienceType === 'all'
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-black/10 bg-white text-muted'
                }`}
              >
                All Members
              </button>
            </div>

            {/* Group Configuration Area */}
            {audienceType !== 'individual' && (
              <div className="p-4 rounded-2xl bg-[#faf8f3] border border-primary/14 flex flex-col gap-3">
                {audienceType === 'system_group' && (
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-foreground">
                      Select Fixed System Category
                    </label>
                    <select
                      className="input-field w-full !py-2.5 !px-3.5 !rounded-xl bg-white text-foreground"
                      value={systemGroup}
                      onChange={(e) => setSystemGroup(e.target.value as SystemGroupKey)}
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
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold text-foreground">
                        Select Custom Group / Committee
                      </label>
                      {onOpenGroupManager && (
                        <button
                          type="button"
                          onClick={onOpenGroupManager}
                          className="bg-transparent border-none text-primary text-xs font-bold cursor-pointer underline"
                        >
                          + Manage Groups
                        </button>
                      )}
                    </div>

                    {customGroups.length === 0 ? (
                      <div className="p-3 bg-white rounded-xl text-xs text-muted">
                        No custom groups available. Click &quot;Manage Groups&quot; to create one.
                      </div>
                    ) : (
                      <select
                        className="input-field w-full !py-2.5 !px-3.5 !rounded-xl bg-white text-foreground"
                        value={customGroupId}
                        onChange={(e) => setCustomGroupId(e.target.value)}
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
                  <label className="block text-xs font-bold mb-1.5 text-foreground">
                    Common Responsibility Description
                  </label>
                  <input
                    type="text"
                    className="input-field w-full !py-2.5 !px-3.5 !rounded-xl bg-white text-foreground"
                    placeholder="e.g. Practice voice parts, Attend uniform fitting session, etc."
                    value={commonResponsibility}
                    onChange={(e) => setCommonResponsibility(e.target.value)}
                  />
                </div>

                {/* Audience Resolution Counter */}
                <div className="flex items-center gap-2 text-xs text-foreground">
                  <UserCheck size={16} className="text-primary" />
                  <span>
                    Will generate <strong className="text-primary">{resolvedTargetMembers.length} individual assignment(s)</strong>.
                  </span>
                </div>
              </div>
            )}

            {/* Individual Delegation Builder */}
            {audienceType === 'individual' && (
              <div className="flex flex-col gap-2.5">
                {responsibilities.map((row, idx) => (
                  <div
                    key={idx}
                    className="p-3 sm:py-3 sm:px-3.5 rounded-2xl bg-[#faf8f3] border-[1.5px] border-primary/12 flex items-center gap-2.5 flex-wrap"
                  >
                    {/* Member Select */}
                    <div className="flex-[1_1_200px] min-w-[180px]">
                      <label className="block text-xs font-bold text-muted mb-1">
                        Member <span className="text-error">*</span>
                      </label>
                      <select
                        className="input-field w-full !py-2 !px-2.5 text-xs sm:text-[0.84rem] bg-white text-foreground"
                        value={row.member_id}
                        onChange={(e) => handleUpdateResponsibility(idx, 'member_id', e.target.value)}
                        required
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
                    <div className="flex-[2_1_240px] min-w-[200px]">
                      <label className="block text-xs font-bold text-muted mb-1">
                        Responsibility / Deliverable <span className="text-error">*</span>
                      </label>
                      <input
                        type="text"
                        className="input-field w-full !py-2 !px-2.5 text-xs sm:text-[0.84rem] bg-white text-foreground"
                        placeholder="e.g. Design the LOGO, Lead Tenor Section"
                        value={row.responsibility}
                        onChange={(e) => handleUpdateResponsibility(idx, 'responsibility', e.target.value)}
                        required
                      />
                    </div>

                    {/* Due date override */}
                    <div className="flex-[1_1_140px] min-w-[130px]">
                      <label className="block text-xs font-bold text-muted mb-1">
                        Due (Optional)
                      </label>
                      <input
                        type="date"
                        className="input-field w-full !py-1.5 !px-2 text-xs bg-white text-foreground"
                        value={row.due_date || ''}
                        onChange={(e) => handleUpdateResponsibility(idx, 'due_date', e.target.value)}
                      />
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveResponsibilityRow(idx)}
                      className="btn btn-secondary !p-1.5 !min-h-[34px] !text-error self-end"
                      title="Remove responsibility"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddResponsibilityRow}
                  className="btn btn-secondary !py-2 !px-3.5 text-xs self-start inline-flex items-center gap-1.5"
                >
                  <Plus size={14} /> Add Another Responsibility
                </button>
              </div>
            )}
          </div>

          {/* Sticky Footer Action Bar */}
          <div className="pt-4 border-t border-primary/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary !py-2.5 !px-5 text-sm !rounded-xl"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary !py-2.5 !px-6.5 text-sm !rounded-xl font-bold inline-flex items-center gap-2 shadow-md shadow-primary/30"
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
