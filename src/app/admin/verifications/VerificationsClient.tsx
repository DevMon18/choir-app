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
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
      <Navbar profile={currentUserProfile} />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px 64px' }}>
        {/* Header Title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)' }}>
                Waiver Verifications
              </h1>
              {submittedCount > 0 && (
                <span className="badge badge-danger" style={{ fontSize: '0.85rem', padding: '4px 10px' }}>
                  {submittedCount} PENDING REVIEW
                </span>
              )}
            </div>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '0.92rem' }}>
              Review submitted digital signatures, selfies, and multi-dependent waivers.
            </p>
          </div>

          <Link href="/admin/documents" className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            ← Back to Documents Manager
          </Link>
        </div>

        {/* Filters & Control Toolbar Bar */}
        <div className="glass-container" style={{ padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('submitted')}
              className={`btn ${activeTab === 'submitted' ? 'btn-danger' : 'btn-secondary'}`}
              style={{ fontSize: '0.85rem', padding: '8px 16px' }}
            >
              Submitted ({submittedCount})
            </button>
            <button
              onClick={() => setActiveTab('verified')}
              className={`btn ${activeTab === 'verified' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.85rem', padding: '8px 16px' }}
            >
              Verified ({verifications.filter((v) => v.status === 'verified' || v.status === 'verified_manual').length})
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`btn ${activeTab === 'rejected' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.85rem', padding: '8px 16px' }}
            >
              Rejected ({verifications.filter((v) => v.status === 'rejected').length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.85rem', padding: '8px 16px' }}
            >
              All ({verifications.length})
            </button>
          </div>

          {/* Search, Sort Dropdown, and View Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: '100%', maxWidth: '580px', justifyContent: 'flex-end' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                type="text"
                placeholder="Search member or document..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '10px', border: '1px solid var(--border)', background: '#ffffff', color: 'var(--foreground)', fontSize: '0.85rem' }}
              />
            </div>

            {/* Sort Select */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              style={{
                padding: '8px 10px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: '#ffffff',
                color: 'var(--foreground)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value="newest">🕒 Newest First</option>
              <option value="oldest">⏳ Oldest First</option>
              <option value="member_asc">🔤 Member (A-Z)</option>
              <option value="doc_asc">📄 Document (A-Z)</option>
            </select>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', padding: '2px' }}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Card Grid View"
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: viewMode === 'grid' ? '#ffffff' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--primary)' : 'var(--muted)',
                  cursor: 'pointer',
                  boxShadow: viewMode === 'grid' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                }}
              >
                <LayoutGrid size={15} /> Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="Table List View"
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: viewMode === 'list' ? '#ffffff' : 'transparent',
                  color: viewMode === 'list' ? 'var(--primary)' : 'var(--muted)',
                  cursor: 'pointer',
                  boxShadow: viewMode === 'list' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                }}
              >
                <List size={15} /> List
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Action Bar (when viewing submitted tab & items selected) */}
        {activeTab === 'submitted' && filteredItems.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '0 8px' }}>
            <button
              onClick={toggleSelectAll}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
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
                className="btn btn-primary"
                style={{ fontSize: '0.85rem', padding: '6px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Check size={16} /> Approve Selected ({selectedIds.length})
              </button>
            )}

            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              Showing {filteredItems.length} submission{filteredItems.length === 1 ? '' : 's'}
            </span>
          </div>
        )}

        {/* Verification Submissions View (Grid or Table List) */}
        {filteredItems.length === 0 ? (
          <div className="glass-container" style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📋</div>
            <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 8px' }}>
              No submissions found
            </p>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              {activeTab === 'submitted'
                ? 'All pending waiver signatures have been reviewed!'
                : `No records match status "${activeTab}".`}
            </p>
          </div>
        ) : viewMode === 'list' ? (
          /* Compact Table List View (Mobile Responsive with Touch Scroll) */
          <div className="glass-container" style={{ padding: '0', overflow: 'hidden', borderRadius: '16px' }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(11,77,36,0.06)', borderBottom: '1px solid var(--border)' }}>
                    {activeTab === 'submitted' && <th style={{ padding: '12px 16px', width: '36px' }}></th>}
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>Member</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>Document</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>Signer & Family</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>Thumbnails</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--glass-border)', background: isSelected ? 'rgba(11,77,36,0.04)' : undefined }}>
                        {activeTab === 'submitted' && (
                          <td style={{ padding: '12px 16px' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(item.id)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                            />
                          </td>
                        )}
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ position: 'relative', width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(30,58,138,0.1)', flexShrink: 0 }}>
                              {item.member?.avatar_url ? (
                                <Image src={item.member.avatar_url} alt={item.member.full_name} fill style={{ objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '0.8rem' }}>
                                  {item.member?.full_name?.substring(0, 2).toUpperCase() || 'M'}
                                </div>
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--foreground)' }}>{item.member?.full_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{item.member?.role} • {item.member?.voice_part || 'Vocalist'}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{item.document?.title}</div>
                          {item.signedPdfSignedUrl && (
                            <button
                              type="button"
                              onClick={() => setPdfPreviewModal({ url: item.signedPdfSignedUrl!, title: `${item.document?.title || 'Signed Waiver'} — ${item.member?.full_name}` })}
                              style={{ background: 'none', border: 'none', color: 'var(--primary)', padding: 0, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', marginTop: '2px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            >
                              📄 View Stamped PDF
                            </button>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{item.signer_printed_name || 'Self'} ({item.signer_relationship || 'Member'})</div>
                          {item.additional_names && item.additional_names.length > 0 && (
                            <button
                              onClick={() => setDependentsModal({ memberName: item.member?.full_name || 'Member', names: item.additional_names })}
                              style={{ background: 'rgba(30,58,138,0.1)', color: 'var(--primary)', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', marginTop: '4px' }}
                            >
                              👥 +{item.additional_names.length} Dependents
                            </button>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {item.signatureSignedUrl && (
                              <img
                                src={item.signatureSignedUrl}
                                alt="Signature"
                                onClick={() => setLightboxUrl({ url: item.signatureSignedUrl!, title: `Signature: ${item.member?.full_name}` })}
                                style={{ width: '48px', height: '32px', objectFit: 'contain', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', background: '#fff' }}
                              />
                            )}
                            {item.selfieSignedUrl && (
                              <img
                                src={item.selfieSignedUrl}
                                alt="Selfie"
                                onClick={() => setLightboxUrl({ url: item.selfieSignedUrl!, title: `Selfie: ${item.member?.full_name}` })}
                                style={{ width: '32px', height: '32px', objectFit: 'cover', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer' }}
                              />
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className={`badge ${item.status === 'verified' || item.status === 'verified_manual' ? 'badge-success' : item.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.72rem' }}>
                            {item.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            {item.status !== 'verified' && item.status !== 'verified_manual' && (
                              <button
                                onClick={() => handleSingleApprove(item.id)}
                                disabled={isPending}
                                className="btn btn-primary"
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                title="Approve Signature"
                              >
                                <Check size={13} />
                              </button>
                            )}
                            {item.status !== 'rejected' && (
                              <button
                                onClick={() => handleReject(item.id)}
                                disabled={isPending}
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#dc2626', borderColor: 'rgba(220,38,38,0.3)' }}
                                title="Reject Signature"
                              >
                                <X size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={isPending}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#991b1b', borderColor: 'rgba(153,27,27,0.3)' }}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {filteredItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const hasDependents = item.additional_names && item.additional_names.length > 0;

              return (
                <div
                  key={item.id}
                  className="glass-container anim-card"
                  style={{
                    padding: '20px',
                    position: 'relative',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
                    boxShadow: isSelected ? '0 8px 24px rgba(11,77,36,0.15)' : undefined,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  {/* Top Bar with Select Checkbox & Status */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {item.status === 'submitted' && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(item.id)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                          />
                        )}
                        <div style={{ position: 'relative', width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(30,58,138,0.1)', flexShrink: 0 }}>
                          {item.member?.avatar_url ? (
                            <Image src={item.member.avatar_url} alt={item.member.full_name} fill style={{ objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>
                              {item.member?.full_name?.substring(0, 2).toUpperCase() || 'M'}
                            </div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground)' }}>
                            {item.member?.full_name}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                            {item.member?.role} • {item.member?.voice_part || 'Vocalist'}
                          </div>
                        </div>
                      </div>

                      <span className={`badge ${item.status === 'verified' || item.status === 'verified_manual' ? 'badge-success' : item.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                        {item.status === 'verified_manual' ? 'VERIFIED (MANUAL)' : item.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Document Details */}
                    <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border)', marginBottom: '16px' }}>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px' }}>
                        Document
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem', marginTop: '2px' }}>
                        {item.document?.title}
                      </div>

                      {item.signer_printed_name && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '4px' }}>
                          Signed by: <strong style={{ color: 'var(--foreground)' }}>{item.signer_printed_name}</strong> ({item.signer_relationship || 'Self'})
                        </div>
                      )}

                      {hasDependents && (
                        <button
                          onClick={() => setDependentsModal({ memberName: item.member?.full_name || 'Member', names: item.additional_names })}
                          className="badge"
                          style={{
                            marginTop: '6px',
                            marginRight: '6px',
                            background: 'rgba(30,58,138,0.1)',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            fontWeight: 700,
                            border: 'none',
                            fontSize: '0.75rem',
                          }}
                        >
                          👥 +{item.additional_names.length} DEPENDENTS (VIEW)
                        </button>
                      )}

                      {item.signedPdfSignedUrl && (
                        <button
                          type="button"
                          onClick={() => setPdfPreviewModal({ url: item.signedPdfSignedUrl!, title: `${item.document?.title || 'Signed Waiver'} — ${item.member?.full_name}` })}
                          className="badge"
                          style={{
                            marginTop: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(11,77,36,0.12)',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          📄 VIEW STAMPED PDF
                        </button>
                      )}

                      {(item.known_allergies || item.current_medications || item.no_allergies || item.no_medications) && (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--glass-border)', fontSize: '0.8rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
                            🩺 Medical Authorization Info:
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--foreground)', marginTop: '2px' }}>
                            <strong>Allergies/Conditions:</strong> {item.no_allergies ? <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>None indicated</span> : (item.known_allergies || 'None')}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--foreground)', marginTop: '2px' }}>
                            <strong>Medications:</strong> {item.no_medications ? <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>None indicated</span> : (item.current_medications || 'None')}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Signature & Selfie Image Thumbnails */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                      {/* Signature Thumbnail */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>
                          Signature
                        </div>
                        {item.signatureSignedUrl ? (
                          <div
                            onClick={() => setLightboxUrl({ url: item.signatureSignedUrl!, title: `Signature: ${item.member?.full_name}` })}
                            style={{
                              height: '74px',
                              borderRadius: '8px',
                              border: '1px solid var(--border)',
                              background: '#ffffff',
                              position: 'relative',
                              cursor: 'pointer',
                              overflow: 'hidden',
                            }}
                          >
                            <Image src={item.signatureSignedUrl} alt="Signature" fill style={{ objectFit: 'contain', padding: '6px' }} />
                          </div>
                        ) : (
                          <div style={{ height: '74px', borderRadius: '8px', border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {item.status === 'verified_manual' ? 'Paper on File' : 'No Image'}
                          </div>
                        )}
                      </div>

                      {/* Selfie Thumbnail */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>
                          Selfie Verification
                        </div>
                        {item.selfieSignedUrl ? (
                          <div
                            onClick={() => setLightboxUrl({ url: item.selfieSignedUrl!, title: `Selfie: ${item.member?.full_name}` })}
                            style={{
                              height: '74px',
                              borderRadius: '8px',
                              border: '1px solid var(--border)',
                              background: '#ffffff',
                              position: 'relative',
                              cursor: 'pointer',
                              overflow: 'hidden',
                            }}
                          >
                            <Image src={item.selfieSignedUrl} alt="Selfie Verification" fill style={{ objectFit: 'cover' }} />
                          </div>
                        ) : (
                          <div style={{ height: '74px', borderRadius: '8px', border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {item.status === 'verified_manual' ? 'Paper on File' : 'No Selfie'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '10px' }}>
                      Updated: {new Date(item.updated_at).toLocaleString()}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {item.status !== 'verified' && item.status !== 'verified_manual' && (
                        <button
                          onClick={() => handleSingleApprove(item.id)}
                          disabled={isPending}
                          className="btn btn-primary"
                          style={{ flex: 1, padding: '8px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                        >
                          <Check size={14} /> Approve
                        </button>
                      )}

                      {item.status !== 'rejected' && (
                        <button
                          onClick={() => handleReject(item.id)}
                          disabled={isPending}
                          className="btn btn-secondary"
                          style={{ padding: '8px 10px', fontSize: '0.8rem', color: '#dc2626', borderColor: 'rgba(220,38,38,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <X size={14} /> Reject
                        </button>
                      )}

                      {item.status !== 'verified_manual' && item.status !== 'verified' && (
                        <button
                          onClick={() => handleManualVerify(item.id)}
                          disabled={isPending}
                          className="btn btn-secondary"
                          style={{ padding: '8px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="Verify manually with paper file"
                        >
                          <FileCheck size={14} /> Paper
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={isPending}
                        className="btn btn-secondary"
                        style={{ padding: '8px 10px', fontSize: '0.8rem', color: '#991b1b', borderColor: 'rgba(153,27,27,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
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
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(15,23,42,0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setLightboxUrl(null)}
        >
          <div
            className="glass-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '540px',
              width: '100%',
              maxHeight: '90vh',
              padding: '20px',
              background: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)' }}>
                {lightboxUrl.title}
              </h3>
              <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                style={{
                  background: 'rgba(0,0,0,0.06)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  color: 'var(--foreground)',
                }}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 'min(360px, 50vh)',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#f8fafc',
                border: '1px solid var(--border)',
              }}
            >
              <Image src={lightboxUrl.url} alt={lightboxUrl.title} fill style={{ objectFit: 'contain' }} />
            </div>
          </div>
        </div>
      )}

      {/* Dependents Modal */}
      {dependentsModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(15,23,42,0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setDependentsModal(null)}
        >
          <div
            className="glass-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '460px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              background: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                👥 Covered Participants ({dependentsModal.memberName})
              </h3>
              <button
                type="button"
                onClick={() => setDependentsModal(null)}
                style={{
                  background: 'rgba(0,0,0,0.06)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  color: 'var(--foreground)',
                }}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>
              The signer registered the following dependents / family members on this digital waiver:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              {dependentsModal.names.map((name, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(11,77,36,0.06)',
                    border: '1px solid var(--border)',
                    fontSize: '0.925rem',
                    fontWeight: 600,
                    color: 'var(--foreground)',
                  }}
                >
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', fontSize: '0.725rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(15,23,42,0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px',
          }}
          onClick={() => setPdfPreviewModal(null)}
        >
          <div
            className="glass-container"
            style={{
              width: '96%',
              maxWidth: '880px',
              height: '90vh',
              maxHeight: '820px',
              display: 'flex',
              flexDirection: 'column',
              padding: '0',
              overflow: 'hidden',
              borderRadius: '16px',
              background: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Bar */}
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  📄 {pdfPreviewModal.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPdfPreviewModal(null)}
                className="btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: 600 }}
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Canvas Viewer Body */}
            <div style={{ flex: 1, padding: '12px', overflow: 'hidden', background: '#f8fafc' }}>
              <PdfCanvasViewer url={pdfPreviewModal.url} title={pdfPreviewModal.title} height="100%" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
