'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import {
  X,
  CheckCircle2,
  Clock,
  Send,
  Users,
  Loader2,
  Sparkles,
  AlertCircle,
  BellRing,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import {
  getPostAcknowledgementRoster,
  nudgePendingMembers,
  getAnnouncementAcknowledgementRoster,
  nudgeAnnouncementPendingMembers,
  AcknowledgementRosterSection,
} from '../actions';
import { useToast } from '@/components/Toast';

interface ThreadAcknowledgementModalProps {
  isOpen: boolean;
  postId?: string;
  announcementId?: string;
  title?: string;
  isOfficer: boolean;
  onClose: () => void;
}

export const ThreadAcknowledgementModal: React.FC<ThreadAcknowledgementModalProps> = ({
  isOpen,
  postId,
  announcementId,
  title = 'Acknowledgements',
  isOfficer,
  onClose,
}) => {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nudging, setNudging] = useState(false);
  const [totalConfirmed, setTotalConfirmed] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [sections, setSections] = useState<AcknowledgementRosterSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const { addToast } = useToast();

  const targetId = postId || announcementId;
  const isAnnouncement = !postId && !!announcementId;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !targetId) return;

    let isSubscribed = true;
    setLoading(true);

    async function fetchRoster() {
      const res = isAnnouncement
        ? await getAnnouncementAcknowledgementRoster(targetId!)
        : await getPostAcknowledgementRoster(targetId!);

      if (!isSubscribed) return;
      setLoading(false);

      if (res?.error) {
        addToast({ type: 'error', title: 'Error', message: res.error });
      } else if (res) {
        setTotalConfirmed(res.total_confirmed || 0);
        setTotalMembers(res.total_members || 0);
        setPercentage(res.percentage || 0);
        setSections(res.sections || []);
      }
    }

    fetchRoster();

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, targetId, isAnnouncement, addToast]);

  if (!isOpen || !mounted) return null;

  const totalPending = Math.max(0, totalMembers - totalConfirmed);

  const handleNudge = async () => {
    if (nudging || totalPending === 0 || !targetId) return;
    setNudging(true);

    const res = isAnnouncement
      ? await nudgeAnnouncementPendingMembers(targetId)
      : await nudgePendingMembers(targetId);

    setNudging(false);

    if (res?.error) {
      addToast({ type: 'error', title: 'Nudge Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: '📢 Reminders Sent',
        message: `Sent notification reminder to ${res.count} pending choristers.`,
      });
    }
  };

  const filteredSections = selectedSection === 'all'
    ? sections
    : sections.filter((s) => s.section.toLowerCase() === selectedSection.toLowerCase());

  const formatAckTime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-[1150] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[88vh] sm:max-h-[80vh] overflow-hidden animate-in slide-in-from-bottom duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/80">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  {title}
                </h3>
                <p className="text-[0.7rem] text-slate-500">
                  {totalConfirmed} of {totalMembers} choir members confirmed ({percentage}%)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden my-2.5">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>

          {/* Section Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            <button
              type="button"
              onClick={() => setSelectedSection('all')}
              className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
                selectedSection === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Sections
            </button>
            {sections.map((s) => (
              <button
                key={s.section}
                type="button"
                onClick={() => setSelectedSection(s.section)}
                className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer inline-flex items-center gap-1 ${
                  selectedSection === s.section
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{s.section}</span>
                <span className="text-[0.65rem] opacity-80">({s.confirmed_count}/{s.total_count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Member Roster List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 size={24} className="animate-spin text-primary" />
              <span className="text-xs font-medium">Loading section roster…</span>
            </div>
          ) : filteredSections.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-medium">
              No members found in this section.
            </div>
          ) : (
            filteredSections.map((sec) => (
              <div key={sec.section} className="pt-3 first:pt-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    {sec.section}
                  </span>
                  <span className="text-[0.68rem] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {sec.confirmed_count} / {sec.total_count} Confirmed
                  </span>
                </div>

                <div className="space-y-1.5">
                  {sec.members.map((m) => (
                    <div
                      key={m.id}
                      className={`p-2 sm:p-2.5 rounded-2xl flex items-center justify-between gap-3 border transition-colors ${
                        m.has_acknowledged
                          ? 'bg-emerald-50/50 border-emerald-100/80'
                          : 'bg-slate-50/60 border-slate-200/60'
                      }`}
                    >
                      <Link
                        href={`/directory/${m.id}`}
                        className="flex items-center gap-2.5 min-w-0 group hover:opacity-90 cursor-pointer"
                      >
                        <Avatar src={m.avatar_url} name={m.full_name} size={32} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 truncate group-hover:text-primary group-hover:underline">
                              {m.full_name}
                            </span>
                            {m.role !== 'member' && (
                              <span className="text-[0.6rem] font-bold px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-700 uppercase">
                                {m.role.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                          <span className="text-[0.68rem] text-slate-400 block truncate">
                            {m.voice_part || 'Choir Member'}
                          </span>
                        </div>
                      </Link>

                      {m.has_acknowledged ? (
                        <div className="flex items-center gap-1 text-[0.68rem] font-bold text-emerald-700 shrink-0 bg-white px-2 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                          <CheckCircle2 size={12} className="text-emerald-600" />
                          <span>Noted {formatAckTime(m.acknowledged_at)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[0.68rem] font-bold text-slate-400 shrink-0 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                          <Clock size={11} />
                          <span>Pending</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <div className="text-[0.72rem] text-slate-500 font-medium">
            {totalPending > 0 ? (
              <span className="text-amber-700 font-semibold">{totalPending} members have not yet acknowledged</span>
            ) : (
              <span className="text-emerald-700 font-semibold">✓ 100% Choir compliance achieved!</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isOfficer && totalPending > 0 && (
              <button
                type="button"
                onClick={handleNudge}
                disabled={nudging}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {nudging ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <BellRing size={13} />
                )}
                <span>Nudge Pending ({totalPending})</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
