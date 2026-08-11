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
} from './actions';
import { Check, X, ShieldCheck, FileCheck, Eye, Search, CheckSquare, Square } from 'lucide-react';

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
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [verifications, setVerifications] = useState<VerificationCardData[]>(initialVerifications);
  const [activeTab, setActiveTab] = useState<'submitted' | 'verified' | 'rejected' | 'all'>('submitted');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<{ url: string; title: string } | null>(null);
  const [dependentsModal, setDependentsModal] = useState<{ memberName: string; names: string[] } | null>(null);

  const filteredItems = useMemo(() => {
    return verifications.filter((item) => {
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
  }, [verifications, activeTab, searchQuery]);

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
    if (!confirm('Reject this signature submission? The member will be asked to re-sign.')) return;

    startTransition(async () => {
      const res = await rejectSignatureAction(id);
      if (res.success) {
        addToast({ type: 'info', title: 'Signature rejected. Member will be prompted to re-sign.' });
        setVerifications((prev) =>
          prev.map((v) =>
            v.id === id
              ? { ...v, status: 'rejected', signature_path: null, selfie_path: null, signatureSignedUrl: null, selfieSignedUrl: null }
              : v
          )
        );
        setSelectedIds((prev) => prev.filter((i) => i !== id));
      } else {
        addToast({ type: 'error', title: res.error || 'Failed to reject' });
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '450px', height: '450px' }} />
      <div className="bg-orb bg-orb-2" style={{ width: '400px', height: '400px' }} />

      <Navbar profile={currentUserProfile} />

      <main style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '24px 16px 120px' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                Waiver Verifications
              </h1>
              {submittedCount > 0 && (
                <span className="badge" style={{ background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: '0.825rem' }}>
                  {submittedCount} Pending Review
                </span>
              )}
            </div>
            <p style={{ color: 'var(--muted)', margin: '4px 0 0', fontSize: '0.925rem' }}>
              Review submitted digital signatures, selfies, and multi-dependent waivers.
            </p>
          </div>

          <Link href="/admin/documents" className="btn btn-secondary" style={{ fontSize: '0.88rem', padding: '8px 16px' }}>
            ← Back to Documents Manager
          </Link>
        </div>

        {/* Filters & Search */}
        <div className="glass-container" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('submitted')}
              className={`btn ${activeTab === 'submitted' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.85rem', padding: '8px 16px', background: activeTab === 'submitted' ? '#dc2626' : undefined, borderColor: activeTab === 'submitted' ? '#dc2626' : undefined, color: activeTab === 'submitted' ? '#fff' : undefined }}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', maxWidth: '320px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                type="text"
                placeholder="Search member or document..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--foreground)', fontSize: '0.875rem' }}
              />
            </div>
          </div>
        </div>

        {/* Select All Bar (when viewing submitted tab) */}
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

            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              Showing {filteredItems.length} submission{filteredItems.length === 1 ? '' : 's'}
            </span>
          </div>
        )}

        {/* Verification Grid */}
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
        ) : (
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
                          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                            {item.member?.full_name || 'Choir Member'}
                          </h4>
                          <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                            {item.member?.role ? item.member.role.replace('_', ' ') : 'Member'} • {item.member?.voice_part || 'Vocalist'}
                          </span>
                        </div>
                      </div>

                      <span
                        className="badge"
                        style={{
                          fontSize: '0.725rem',
                          fontWeight: 700,
                          background:
                            item.status === 'pending' ? 'rgba(220,38,38,0.12)' :
                            item.status === 'submitted' ? 'rgba(197,160,89,0.18)' :
                            item.status === 'rejected' ? 'rgba(220,38,38,0.12)' :
                            'rgba(11,77,36,0.12)',
                          color:
                            item.status === 'pending' ? '#dc2626' :
                            item.status === 'submitted' ? 'var(--accent)' :
                            item.status === 'rejected' ? '#dc2626' :
                            'var(--primary)',
                        }}
                      >
                        {item.status === 'pending' ? 'Pending' :
                         item.status === 'submitted' ? '⏳ Submitted' :
                         item.status === 'rejected' ? 'Rejected' :
                         item.status === 'verified_manual' ? 'Verified (Manual)' :
                         'Verified'}
                      </span>
                    </div>

                    {/* Document Title & Type */}
                    <div style={{ background: 'rgba(255,255,255,0.4)', borderRadius: '10px', padding: '10px 12px', marginBottom: '14px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Document</div>
                      <div style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--primary)' }}>
                        {item.document?.title || 'Waiver Document'}
                      </div>
                      {item.signer_printed_name && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--foreground)', marginTop: '4px' }}>
                          Signed by: <strong>{item.signer_printed_name}</strong> {item.signer_relationship && <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>({item.signer_relationship})</span>}
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
                          👥 +{item.additional_names.length} Dependents (View)
                        </button>
                      )}

                      {item.signedPdfSignedUrl && (
                        <a
                          href={item.signedPdfSignedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
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
                            textDecoration: 'none',
                          }}
                        >
                          📄 View Stamped PDF ↗
                        </a>
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
                          style={{ flex: 1, padding: '8px 10px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
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

                      {item.status !== 'verified_manual' && (
                        <button
                          onClick={() => handleManualVerify(item.id)}
                          disabled={isPending}
                          className="btn btn-secondary"
                          style={{ padding: '8px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="Verify manually if paper signed waiver is on file"
                        >
                          <FileCheck size={14} /> Paper
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sticky Bottom Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div
            style={{
              position: 'fixed',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--primary)',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: '30px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              zIndex: 100,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.925rem' }}>
              {selectedIds.length} Signature{selectedIds.length === 1 ? '' : 's'} Selected
            </span>

            <button
              onClick={handleBulkApprove}
              disabled={isPending}
              className="btn btn-primary"
              style={{
                background: '#ffffff',
                color: 'var(--primary)',
                fontWeight: 700,
                fontSize: '0.875rem',
                padding: '8px 18px',
                borderRadius: '20px',
              }}
            >
              {isPending ? 'Verifying...' : 'Approve Selected →'}
            </button>

            <button
              onClick={() => setSelectedIds([])}
              style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}
            >
              Cancel
            </button>
          </div>
        )}
      </main>

      {/* Lightbox Preview Modal */}
      {lightboxUrl && (
        <div className="modal-backdrop" onClick={() => setLightboxUrl(null)}>
          <div
            className="modal-content glass-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '600px', width: '90%', padding: '24px', textAlign: 'center' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary)' }}>{lightboxUrl.title}</h3>
              <button onClick={() => setLightboxUrl(null)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--muted)' }}>
                &times;
              </button>
            </div>

            <div style={{ position: 'relative', width: '100%', height: '360px', borderRadius: '12px', overflow: 'hidden', background: '#ffffff', border: '1px solid var(--border)' }}>
              <Image src={lightboxUrl.url} alt={lightboxUrl.title} fill style={{ objectFit: 'contain' }} />
            </div>
          </div>
        </div>
      )}

      {/* Dependents Modal */}
      {dependentsModal && (
        <div className="modal-backdrop" onClick={() => setDependentsModal(null)}>
          <div
            className="modal-content glass-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '450px', width: '90%', padding: '24px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary)' }}>
                👥 Dependents List ({dependentsModal.memberName})
              </h3>
              <button onClick={() => setDependentsModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--muted)' }}>
                &times;
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--muted)', margin: '0 0 12px' }}>
              The signer registered the following dependents on this waiver:
            </p>

            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {dependentsModal.names.map((name, idx) => (
                <li key={idx} style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)' }}>
                  {name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
