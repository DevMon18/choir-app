'use client';

import React, { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Navbar } from '@/components/Navbar';
import { useToast } from '@/components/Toast';
import {
  VerificationCardData,
  bulkVerifySignaturesAction,
  singleVerifySignatureAction,
  rejectSignatureAction,
  manualVerifySignatureAction,
  deleteSignatureAction,
} from './actions';
import { Check, X, ShieldCheck, FileCheck, Eye, Search, CheckSquare, Square, LayoutGrid, List, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PdfCanvasViewer } from '@/components/PdfCanvasViewer';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface Props {
  currentUserProfile: Profile;
  initialVerifications: VerificationCardData[];
}

const DOC_TYPE_LABELS: Record<string, string> = {
  activity_waiver: 'Activity Waiver',
  wedding_waiver: 'Wedding Waiver',
  wake_guide: 'Wake Guide',
  general: 'General Document',
};

export default function VerificationsClient({ currentUserProfile, initialVerifications }: Props) {
  const router = useRouter();
  const { addToast } = useToast();

  // Real-time listener for incoming member signatures and verification changes
  useRealtimeSync({
    channelName: 'admin-verifications-live',
    tables: [
      { table: 'document_signatures' },
    ],
    onEvent: (payload) => {
      if (payload.eventType === 'INSERT' || (payload.eventType === 'UPDATE' && payload.new?.status === 'submitted')) {
        addToast({
          type: 'info',
          title: '✍️ New Waiver Submitted',
          message: 'A choir member has submitted a signed waiver for verification.',
        });
      }
    },
  });
  const [isPending, startTransition] = useTransition();

  const [verifications, setVerifications] = useState<VerificationCardData[]>(initialVerifications);
  const [activeTab, setActiveTab] = useState<'submitted' | 'verified' | 'rejected' | 'all'>('submitted');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'member_asc' | 'doc_asc'>('newest');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<{ url: string; title: string } | null>(null);
  const [dependentsModal, setDependentsModal] = useState<{ memberName: string; names: string[] } | null>(null);
  const [pdfPreviewModal, setPdfPreviewModal] = useState<{ url: string; title: string } | null>(null);

  const filteredItems = useMemo(() => {
    const items = verifications.filter((item) => {
      // Tab filter
      let matchesTab = true;
      if (activeTab === 'submitted') matchesTab = item.status === 'submitted';
      else if (activeTab === 'verified') matchesTab = item.status === 'verified' || item.status === 'verified_manual';
      else if (activeTab === 'rejected') matchesTab = item.status === 'rejected';

      // Search filter
      const memberName = item.member?.full_name?.toLowerCase() || '';
      const docTitle = item.document?.title?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query || memberName.includes(query) || docTitle.includes(query);

      return matchesTab && matchesSearch;
    });

    return items.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.updated_at || a.created_at).getTime() - new Date(b.updated_at || b.created_at).getTime();
      }
      if (sortBy === 'member_asc') {
        return (a.member?.full_name || '').localeCompare(b.member?.full_name || '');
      }
      if (sortBy === 'doc_asc') {
        return (a.document?.title || '').localeCompare(b.document?.title || '');
      }
      return 0;
    });
  }, [verifications, activeTab, searchQuery, sortBy]);

  const submittedCount = useMemo(
    () => verifications.filter((v) => v.status === 'submitted').length,
    [verifications]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const visibleSubmittedIds = filteredItems.filter((i) => i.status === 'submitted').map((i) => i.id);
    if (selectedIds.length === visibleSubmittedIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(visibleSubmittedIds);
    }
  };

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) return;

    startTransition(async () => {
      const res = await bulkVerifySignaturesAction({ signatureIds: selectedIds });
      if (res.success) {
        addToast({ type: 'success', title: `Successfully verified ${res.count} signatures!` });
        setVerifications((prev) =>
          prev.map((v) => (selectedIds.includes(v.id) ? { ...v, status: 'verified' } : v))
        );
        setSelectedIds([]);
      } else {
        addToast({ type: 'error', title: res.error || 'Failed to verify signatures' });
      }
    });
  };

  const handleSingleApprove = (id: string) => {
    startTransition(async () => {
      const res = await singleVerifySignatureAction(id);
      if (res.success) {
        addToast({ type: 'success', title: 'Signature approved!' });
        setVerifications((prev) =>
          prev.map((v) => (v.id === id ? { ...v, status: 'verified' } : v))
        );
        setSelectedIds((prev) => prev.filter((i) => i !== id));
      } else {
        addToast({ type: 'error', title: res.error || 'Failed to approve' });
      }
    });
  };

  const handleReject = (id: string) => {
    startTransition(async () => {
      const res = await rejectSignatureAction(id);
      if (res.success) {
        addToast({ type: 'info', title: 'Signature rejected', message: 'Record moved to Rejected tab. Member will be prompted to re-sign.' });
        setVerifications((prev) =>
          prev.map((v) =>
            v.id === id
              ? {
                  ...v,
                  status: 'rejected',
                  signature_path: null,
                  selfie_path: null,
                  signed_pdf_path: null,
                  signatureSignedUrl: null,
                  selfieSignedUrl: null,
                  signedPdfSignedUrl: null,
                  signer_printed_name: null,
                  additional_names: [],
                }
              : v
          )
        );
        setSelectedIds((prev) => prev.filter((i) => i !== id));
        router.refresh();
      } else {
        addToast({ type: 'error', title: 'Failed to Reject', message: res.error || 'Database permission error' });
      }
    });
  };

  const handleManualVerify = (id: string) => {
    startTransition(async () => {
      const res = await manualVerifySignatureAction(id);
      if (res.success) {
        addToast({ type: 'success', title: 'Marked as verified manually (paper file).' });
        setVerifications((prev) =>
          prev.map((v) => (v.id === id ? { ...v, status: 'verified_manual' } : v))
        );
        setSelectedIds((prev) => prev.filter((i) => i !== id));
      } else {
        addToast({ type: 'error', title: res.error || 'Failed to verify' });
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteSignatureAction(id);
      if (res.success) {
        addToast({ type: 'info', title: 'Submission deleted', message: 'Record and storage files purged successfully.' });
        setVerifications((prev) => prev.filter((v) => v.id !== id));
        setSelectedIds((prev) => prev.filter((i) => i !== id));
        router.refresh();
      } else {
        addToast({ type: 'error', title: 'Failed to Delete', message: res.error || 'Database permission error' });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar profile={currentUserProfile} />

      <main className="max-w-[1200px] mx-auto py-8 px-4 pb-16">
        {/* Header Title */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="m-0 text-2xl sm:text-[1.8rem] font-extrabold text-primary">
                Waiver Verifications
              </h1>
              {submittedCount > 0 && (
                <span className="badge badge-danger text-xs sm:text-[0.85rem] !py-1 !px-2.5">
                  {submittedCount} PENDING REVIEW
                </span>
              )}
            </div>
            <p className="mt-1.5 mb-0 text-muted text-sm sm:text-[0.92rem]">
              Review submitted digital signatures, selfies, and multi-dependent waivers.
            </p>
          </div>

          <Link href="/admin/documents" className="btn btn-secondary text-xs sm:text-sm">
            ← Back to Documents Manager
          </Link>
        </div>

        {/* Filters & Control Toolbar Bar */}
        <div className="glass-container p-4 mb-6 flex items-center justify-between flex-wrap gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('submitted')}
              className={`btn text-xs sm:text-sm !py-2 !px-4 ${activeTab === 'submitted' ? 'btn-danger' : 'btn-secondary'}`}
            >
              Submitted ({submittedCount})
            </button>
            <button
              onClick={() => setActiveTab('verified')}
              className={`btn text-xs sm:text-sm !py-2 !px-4 ${activeTab === 'verified' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Verified ({verifications.filter((v) => v.status === 'verified' || v.status === 'verified_manual').length})
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`btn text-xs sm:text-sm !py-2 !px-4 ${activeTab === 'rejected' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Rejected ({verifications.filter((v) => v.status === 'rejected').length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`btn text-xs sm:text-sm !py-2 !px-4 ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            >
              All ({verifications.length})
            </button>
          </div>

          {/* Search, Sort Dropdown, and View Mode Toggle */}
          <div className="flex items-center gap-2 flex-wrap w-full max-w-[580px] justify-end">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search member or document..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full py-2 pr-3 pl-9 rounded-xl border border-border bg-white text-foreground text-xs sm:text-sm"
              />
            </div>

            {/* Sort Select */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="py-2 px-2.5 rounded-xl border border-border bg-white text-foreground text-xs font-semibold cursor-pointer"
            >
              <option value="newest">🕒 Newest First</option>
              <option value="oldest">⏳ Oldest First</option>
              <option value="member_asc">🔤 Member (A-Z)</option>
              <option value="doc_asc">📄 Document (A-Z)</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex bg-black/5 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Card Grid View"
                className={`py-1.5 px-2.5 rounded-lg border-0 cursor-pointer flex items-center gap-1 text-xs font-bold ${
                  viewMode === 'grid' ? 'bg-white text-primary shadow-sm' : 'bg-transparent text-muted'
                }`}
              >
                <LayoutGrid size={15} /> Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="Table List View"
                className={`py-1.5 px-2.5 rounded-lg border-0 cursor-pointer flex items-center gap-1 text-xs font-bold ${
                  viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'bg-transparent text-muted'
                }`}
              >
                <List size={15} /> List
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Action Bar (when viewing submitted tab & items selected) */}
        {activeTab === 'submitted' && filteredItems.length > 0 && (
          <div className="flex items-center justify-between mb-4 px-2">
            <button
              onClick={toggleSelectAll}
              className="bg-transparent border-0 text-primary font-semibold text-sm cursor-pointer inline-flex items-center gap-1.5"
            >
              {selectedIds.length > 0 && selectedIds.length === filteredItems.length ? (
                <CheckSquare size={18} />
              ) : (
                <Square size={18} />
              )}
              {selectedIds.length > 0 && selectedIds.length === filteredItems.length
                ? 'Deselect All'
                : 'Select All Submitted'}
            </button>

            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkApprove}
                disabled={isPending}
                className="btn btn-primary text-xs sm:text-sm !py-1.5 !px-4 inline-flex items-center gap-1.5"
              >
                <Check size={16} /> Approve Selected ({selectedIds.length})
              </button>
            )}

            <span className="text-xs sm:text-sm text-muted">
              Showing {filteredItems.length} submission{filteredItems.length === 1 ? '' : 's'}
            </span>
          </div>
        )}

        {/* Verification Submissions View (Grid or Table List) */}
        {filteredItems.length === 0 ? (
          <div className="glass-container text-center py-16 px-5 text-muted">
            <div className="text-5xl mb-3">📋</div>
            <p className="text-base sm:text-[1.05rem] font-semibold text-foreground m-0 mb-2">
              No submissions found
            </p>
            <p className="m-0 text-sm sm:text-[0.9rem]">
              {activeTab === 'submitted'
                ? 'All pending waiver signatures have been reviewed!'
                : `No records match status "${activeTab}".`}
            </p>
          </div>
        ) : viewMode === 'list' ? (
          /* Compact Table List View (Mobile Responsive with Touch Scroll) */
          <div className="glass-container p-0 overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-xs sm:text-sm text-left">
                <thead>
                  <tr className="bg-primary/6 border-b border-border">
                    {activeTab === 'submitted' && <th className="py-3 px-4 w-9"></th>}
                    <th className="py-3 px-4 font-bold text-primary whitespace-nowrap">Member</th>
                    <th className="py-3 px-4 font-bold text-primary whitespace-nowrap">Document</th>
                    <th className="py-3 px-4 font-bold text-primary whitespace-nowrap">Signer & Family</th>
                    <th className="py-3 px-4 font-bold text-primary whitespace-nowrap">Thumbnails</th>
                    <th className="py-3 px-4 font-bold text-primary whitespace-nowrap">Status</th>
                    <th className="py-3 px-4 font-bold text-primary text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <tr key={item.id} className={`border-b border-glass-border ${isSelected ? 'bg-primary/4' : ''}`}>
                        {activeTab === 'submitted' && (
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(item.id)}
                              className="w-4 h-4 cursor-pointer accent-primary"
                            />
                          </td>
                        )}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-primary/10 flex-shrink-0">
                              {item.member?.avatar_url ? (
                                <Image src={item.member.avatar_url} alt={item.member.full_name} fill className="object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center font-bold text-primary text-xs">
                                  {item.member?.full_name?.substring(0, 2).toUpperCase() || 'M'}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-foreground">{item.member?.full_name}</div>
                              <div className="text-xs text-muted">{item.member?.role} • {item.member?.voice_part || 'Vocalist'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-primary whitespace-nowrap">{item.document?.title}</div>
                          {item.signedPdfSignedUrl && (
                            <button
                              type="button"
                              onClick={() => setPdfPreviewModal({ url: item.signedPdfSignedUrl!, title: `${item.document?.title || 'Signed Waiver'} — ${item.member?.full_name}` })}
                              className="bg-transparent border-0 text-primary p-0 text-xs font-bold cursor-pointer underline mt-0.5 whitespace-nowrap inline-flex items-center gap-1"
                            >
                              📄 View Stamped PDF
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold">{item.signer_printed_name || 'Self'} ({item.signer_relationship || 'Member'})</div>
                          {item.additional_names && item.additional_names.length > 0 && (
                            <button
                              onClick={() => setDependentsModal({ memberName: item.member?.full_name || 'Member', names: item.additional_names })}
                              className="bg-primary/10 text-primary border-0 rounded py-0.5 px-1.5 text-[0.72rem] font-bold cursor-pointer mt-1"
                            >
                              👥 +{item.additional_names.length} Dependents
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1.5">
                            {item.signatureSignedUrl && (
                              <img
                                src={item.signatureSignedUrl}
                                alt="Signature"
                                onClick={() => setLightboxUrl({ url: item.signatureSignedUrl!, title: `Signature: ${item.member?.full_name}` })}
                                className="w-12 h-8 object-contain border border-border rounded cursor-pointer bg-white"
                              />
                            )}
                            {item.selfieSignedUrl && (
                              <img
                                src={item.selfieSignedUrl}
                                alt="Selfie"
                                onClick={() => setLightboxUrl({ url: item.selfieSignedUrl!, title: `Selfie: ${item.member?.full_name}` })}
                                className="w-8 h-8 object-cover border border-border rounded cursor-pointer"
                              />
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`badge ${item.status === 'verified' || item.status === 'verified_manual' ? 'badge-success' : item.status === 'rejected' ? 'badge-danger' : 'badge-warning'} text-[0.72rem]`}>
                            {item.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex gap-1 justify-end">
                            {item.status !== 'verified' && item.status !== 'verified_manual' && (
                              <button
                                onClick={() => handleSingleApprove(item.id)}
                                disabled={isPending}
                                className="btn btn-primary !py-1 !px-2 text-xs"
                                title="Approve Signature"
                              >
                                <Check size={13} />
                              </button>
                            )}
                            {item.status !== 'rejected' && (
                              <button
                                onClick={() => handleReject(item.id)}
                                disabled={isPending}
                                className="btn btn-secondary !py-1 !px-2 text-xs !text-red-600 !border-red-600/30"
                                title="Reject Signature"
                              >
                                <X size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={isPending}
                              className="btn btn-secondary !py-1 !px-2 text-xs !text-red-800 !border-red-800/30"
                              title="Delete Record & Purge Files"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Card Grid View */
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
            {filteredItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const hasDependents = item.additional_names && item.additional_names.length > 0;

              return (
                <div
                  key={item.id}
                  className={`glass-container anim-card p-5 relative flex flex-col justify-between border ${
                    isSelected ? 'border-2 border-primary shadow-lg shadow-primary/15' : 'border-glass-border'
                  }`}
                >
                  {/* Top Bar with Select Checkbox & Status */}
                  <div>
                    <div className="flex items-start justify-between gap-2.5 mb-3.5">
                      <div className="flex items-center gap-2.5">
                        {item.status === 'submitted' && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(item.id)}
                            className="w-4.5 h-4.5 cursor-pointer accent-primary"
                          />
                        )}
                        <div className="relative w-9.5 h-9.5 rounded-full overflow-hidden bg-primary/10 flex-shrink-0">
                          {item.member?.avatar_url ? (
                            <Image src={item.member.avatar_url} alt={item.member.full_name} fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-primary text-sm">
                              {item.member?.full_name?.substring(0, 2).toUpperCase() || 'M'}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-sm sm:text-[0.95rem] text-foreground">
                            {item.member?.full_name}
                          </div>
                          <div className="text-xs text-muted">
                            {item.member?.role} • {item.member?.voice_part || 'Vocalist'}
                          </div>
                        </div>
                      </div>

                      <span className={`badge ${item.status === 'verified' || item.status === 'verified_manual' ? 'badge-success' : item.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                        {item.status === 'verified_manual' ? 'VERIFIED (MANUAL)' : item.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Document Details */}
                    <div className="p-3 rounded-xl bg-black/2 border border-border mb-4">
                      <div className="text-xs uppercase text-muted tracking-wider">
                        Document
                      </div>
                      <div className="font-bold text-primary text-sm sm:text-[0.95rem] mt-0.5">
                        {item.document?.title}
                      </div>

                      {item.signer_printed_name && (
                        <div className="text-xs sm:text-sm text-muted mt-1">
                          Signed by: <strong className="text-foreground">{item.signer_printed_name}</strong> ({item.signer_relationship || 'Self'})
                        </div>
                      )}

                      {hasDependents && (
                        <button
                          onClick={() => setDependentsModal({ memberName: item.member?.full_name || 'Member', names: item.additional_names })}
                          className="badge mt-1.5 mr-1.5 !bg-primary/10 !text-primary cursor-pointer font-bold border-none text-xs"
                        >
                          👥 +{item.additional_names.length} DEPENDENTS (VIEW)
                        </button>
                      )}

                      {item.signedPdfSignedUrl && (
                        <button
                          type="button"
                          onClick={() => setPdfPreviewModal({ url: item.signedPdfSignedUrl!, title: `${item.document?.title || 'Signed Waiver'} — ${item.member?.full_name}` })}
                          className="badge mt-1.5 inline-flex items-center gap-1 !bg-primary/12 !text-primary font-bold text-xs border-none cursor-pointer"
                        >
                          📄 VIEW STAMPED PDF
                        </button>
                      )}

                      {(item.known_allergies || item.current_medications || item.no_allergies || item.no_medications) && (
                        <div className="mt-2 pt-2 border-t border-dashed border-glass-border text-xs sm:text-sm">
                          <div className="font-bold text-primary flex items-center gap-1 text-xs">
                            🩺 Medical Authorization Info:
                          </div>
                          <div className="text-xs text-foreground mt-0.5">
                            <strong>Allergies/Conditions:</strong> {item.no_allergies ? <span className="text-muted italic">None indicated</span> : (item.known_allergies || 'None')}
                          </div>
                          <div className="text-xs text-foreground mt-0.5">
                            <strong>Medications:</strong> {item.no_medications ? <span className="text-muted italic">None indicated</span> : (item.current_medications || 'None')}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Signature & Selfie Image Thumbnails */}
                    <div className="grid grid-cols-2 gap-2.5 mb-4">
                      {/* Signature Thumbnail */}
                      <div className="text-center">
                        <div className="text-xs font-semibold text-muted mb-1">
                          Signature
                        </div>
                        {item.signatureSignedUrl ? (
                          <div
                            onClick={() => setLightboxUrl({ url: item.signatureSignedUrl!, title: `Signature: ${item.member?.full_name}` })}
                            className="h-[74px] rounded-lg border border-border bg-white relative cursor-pointer overflow-hidden"
                          >
                            <Image src={item.signatureSignedUrl} alt="Signature" fill className="object-contain p-1.5" />
                          </div>
                        ) : (
                          <div className="h-[74px] rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-muted">
                            {item.status === 'verified_manual' ? 'Paper on File' : 'No Image'}
                          </div>
                        )}
                      </div>

                      {/* Selfie Thumbnail */}
                      <div className="text-center">
                        <div className="text-xs font-semibold text-muted mb-1">
                          Selfie Verification
                        </div>
                        {item.selfieSignedUrl ? (
                          <div
                            onClick={() => setLightboxUrl({ url: item.selfieSignedUrl!, title: `Selfie: ${item.member?.full_name}` })}
                            className="h-[74px] rounded-lg border border-border bg-white relative cursor-pointer overflow-hidden"
                          >
                            <Image src={item.selfieSignedUrl} alt="Selfie Verification" fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="h-[74px] rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-muted">
                            {item.status === 'verified_manual' ? 'Paper on File' : 'No Selfie'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div>
                    <div className="text-xs text-muted mb-2.5">
                      Updated: {new Date(item.updated_at).toLocaleString()}
                    </div>

                    <div className="flex gap-1.5 flex-wrap">
                      {item.status !== 'verified' && item.status !== 'verified_manual' && (
                        <button
                          onClick={() => handleSingleApprove(item.id)}
                          disabled={isPending}
                          className="btn btn-primary flex-1 !py-2 !px-2.5 text-xs sm:text-[0.8rem] inline-flex items-center justify-center gap-1"
                        >
                          <Check size={14} /> Approve
                        </button>
                      )}

                      {item.status !== 'rejected' && (
                        <button
                          onClick={() => handleReject(item.id)}
                          disabled={isPending}
                          className="btn btn-secondary !py-2 !px-2.5 text-xs sm:text-[0.8rem] !text-red-600 !border-red-600/30 inline-flex items-center gap-1"
                        >
                          <X size={14} /> Reject
                        </button>
                      )}

                      {item.status !== 'verified_manual' && item.status !== 'verified' && (
                        <button
                          onClick={() => handleManualVerify(item.id)}
                          disabled={isPending}
                          className="btn btn-secondary !py-2 !px-2.5 text-xs sm:text-[0.8rem] inline-flex items-center gap-1"
                          title="Verify manually with paper file"
                        >
                          <FileCheck size={14} /> Paper
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={isPending}
                        className="btn btn-secondary !py-2 !px-2.5 text-xs sm:text-[0.8rem] !text-red-800 !border-red-800/30 inline-flex items-center gap-1"
                        title="Delete Record & Purge Files"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Image Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[1100] bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div
            className="glass-container max-w-[540px] w-full max-h-[90vh] p-5 bg-white rounded-3xl shadow-2xl flex flex-col gap-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="m-0 text-base sm:text-[1.05rem] font-bold text-primary">
                {lightboxUrl.title}
              </h3>
              <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                className="bg-black/6 border-none rounded-full w-8 h-8 flex items-center justify-center text-lg cursor-pointer text-foreground"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="relative w-full h-[min(360px,50vh)] rounded-xl overflow-hidden bg-slate-50 border border-border">
              <Image src={lightboxUrl.url} alt={lightboxUrl.title} fill className="object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Dependents Modal */}
      {dependentsModal && (
        <div
          className="fixed inset-0 z-[1100] bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setDependentsModal(null)}
        >
          <div
            className="glass-container max-w-[460px] w-full max-h-[90vh] overflow-y-auto p-6 bg-white rounded-3xl shadow-2xl flex flex-col gap-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="m-0 text-base sm:text-[1.05rem] font-bold text-primary flex items-center gap-2">
                👥 Covered Participants ({dependentsModal.memberName})
              </h3>
              <button
                type="button"
                onClick={() => setDependentsModal(null)}
                className="bg-black/6 border-none rounded-full w-8 h-8 flex items-center justify-center text-lg cursor-pointer text-foreground"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <p className="text-xs sm:text-sm text-muted m-0">
              The signer registered the following dependents / family members on this digital waiver:
            </p>

            <div className="flex flex-col gap-2 mt-1">
              {dependentsModal.names.map((name, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 p-2.5 sm:py-2.5 sm:px-3.5 rounded-xl bg-primary/6 border border-border text-sm sm:text-[0.925rem] font-semibold text-foreground"
                >
                  <span className="w-5.5 h-5.5 rounded-full bg-primary text-white text-[0.725rem] flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span>{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stamped PDF In-App Preview Modal */}
      {pdfPreviewModal && (
        <div
          className="fixed inset-0 z-[1100] bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-3"
          onClick={() => setPdfPreviewModal(null)}
        >
          <div
            className="glass-container w-[96%] max-w-[880px] h-[90vh] max-h-[820px] flex flex-col p-0 overflow-hidden rounded-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Bar */}
            <div className="py-3.5 px-5 border-b border-border flex items-center justify-between bg-white">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base font-bold text-primary truncate">
                  📄 {pdfPreviewModal.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPdfPreviewModal(null)}
                className="btn btn-secondary !py-1.5 !px-3.5 text-xs font-semibold"
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Canvas Viewer Body */}
            <div className="flex-1 p-3 overflow-hidden bg-slate-50">
              <PdfCanvasViewer url={pdfPreviewModal.url} title={pdfPreviewModal.title} height="100%" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
