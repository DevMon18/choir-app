'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useToast } from '@/components/Toast';

interface DocumentTemplate {
  id: string;
  title: string;
  type: string;
  file_path: string;
  expires_at: string | null;
}

export interface MemberSignatureRow {
  id: string;
  document_id: string;
  activity_id: string | null;
  primary_member_id: string;
  additional_names: string[];
  signer_printed_name: string | null;
  status: 'pending' | 'submitted' | 'verified' | 'verified_manual' | 'rejected';
  is_archived?: boolean;
  signature_path: string | null;
  selfie_path: string | null;
  created_at: string;
  updated_at: string;
  documents?: DocumentTemplate | null;
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface Props {
  currentUserProfile: Profile;
  initialSignatures: MemberSignatureRow[];
}

const DOC_TYPE_LABELS: Record<string, string> = {
  activity_waiver: 'Activity Waiver',
  wedding_waiver: 'Wedding Waiver',
  wake_guide: 'Wake Guide',
  general: 'General Document',
};

const DOC_TYPE_COLORS: Record<string, string> = {
  activity_waiver: 'rgba(197,160,89,0.15)',
  wedding_waiver: 'rgba(11,77,36,0.10)',
  wake_guide: 'rgba(100,100,120,0.12)',
  general: 'rgba(59,130,246,0.10)',
};

const DOC_TYPE_TEXT: Record<string, string> = {
  activity_waiver: 'var(--accent)',
  wedding_waiver: 'var(--primary)',
  wake_guide: '#64647a',
  general: '#2563eb',
};

export default function MyDocumentsClient({ currentUserProfile, initialSignatures }: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted' | 'verified' | 'archived'>('all');

  const filteredSignatures = useMemo(() => {
    if (filter === 'all') {
      return initialSignatures.filter((s) => !s.is_archived);
    }
    if (filter === 'pending') {
      return initialSignatures.filter((s) => !s.is_archived && (s.status === 'pending' || s.status === 'rejected'));
    }
    if (filter === 'submitted') {
      return initialSignatures.filter((s) => !s.is_archived && s.status === 'submitted');
    }
    if (filter === 'verified') {
      return initialSignatures.filter((s) => !s.is_archived && (s.status === 'verified' || s.status === 'verified_manual'));
    }
    if (filter === 'archived') {
      return initialSignatures.filter((s) => s.is_archived);
    }
    return initialSignatures;
  }, [initialSignatures, filter]);

  const pendingCount = useMemo(
    () => initialSignatures.filter((s) => !s.is_archived && (s.status === 'pending' || s.status === 'rejected')).length,
    [initialSignatures]
  );

  const archivedCount = useMemo(
    () => initialSignatures.filter((s) => s.is_archived).length,
    [initialSignatures]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '450px', height: '450px' }} />
      <div className="bg-orb bg-orb-2" style={{ width: '400px', height: '400px' }} />

      <Navbar profile={currentUserProfile} />

      <main style={{ flex: 1, maxWidth: '960px', margin: '0 auto', width: '100%', padding: '24px 16px 120px' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
              My Documents &amp; Waivers
            </h1>
            {pendingCount > 0 && (
              <span className="badge" style={{ background: '#dc2626', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem' }}>
                {pendingCount} Action Required
              </span>
            )}
          </div>
          <p style={{ color: 'var(--muted)', margin: '4px 0 0', fontSize: '0.95rem' }}>
            View and manage all choir activity waivers, guides, and signed records.
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilter('all')}
            className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.85rem', padding: '8px 16px' }}
          >
            Active Documents ({initialSignatures.filter((s) => !s.is_archived).length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              fontSize: '0.85rem',
              padding: '8px 16px',
              color: filter === 'pending' ? '#fff' : '#dc2626',
              background: filter === 'pending' ? '#dc2626' : undefined,
              borderColor: filter === 'pending' ? '#dc2626' : undefined,
            }}
          >
            Action Required ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('submitted')}
            className={`btn ${filter === 'submitted' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.85rem', padding: '8px 16px' }}
          >
            Submitted ({initialSignatures.filter((s) => !s.is_archived && s.status === 'submitted').length})
          </button>
          <button
            onClick={() => setFilter('verified')}
            className={`btn ${filter === 'verified' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.85rem', padding: '8px 16px' }}
          >
            Verified ({initialSignatures.filter((s) => !s.is_archived && (s.status === 'verified' || s.status === 'verified_manual')).length})
          </button>
          <button
            onClick={() => setFilter('archived')}
            className={`btn ${filter === 'archived' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.85rem', padding: '8px 16px' }}
          >
            📁 Archived ({archivedCount})
          </button>
        </div>

        {/* List of Documents */}
        {filteredSignatures.length === 0 ? (
          <div className="glass-container" style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📑</div>
            <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 8px' }}>
              No documents in this view
            </p>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              {filter === 'all'
                ? "You don't have any assigned document waivers."
                : `No ${filter} document records found.`}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredSignatures.map((sig) => {
              const docTemplate = sig.documents;
              const isUrgent = sig.status === 'pending' || sig.status === 'rejected';

              return (
                <div
                  key={sig.id}
                  className="glass-container anim-card"
                  style={{
                    padding: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                    borderLeft: isUrgent ? '6px solid #dc2626' : '6px solid var(--primary)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '240px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: isUrgent ? 'rgba(220,38,38,0.1)' : 'rgba(11,77,36,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isUrgent ? '#dc2626' : 'var(--primary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                          {docTemplate?.title || 'Waiver Document'}
                        </h3>
                        {docTemplate?.type && (
                          <span
                            className="badge"
                            style={{
                              background: DOC_TYPE_COLORS[docTemplate.type] || 'rgba(0,0,0,0.05)',
                              color: DOC_TYPE_TEXT[docTemplate.type] || 'var(--foreground)',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                            }}
                          >
                            {DOC_TYPE_LABELS[docTemplate.type] || docTemplate.type}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background:
                              sig.status === 'pending' ? 'rgba(220,38,38,0.12)' :
                              sig.status === 'submitted' ? 'rgba(197,160,89,0.18)' :
                              sig.status === 'rejected' ? 'rgba(220,38,38,0.12)' :
                              'rgba(11,77,36,0.12)',
                            color:
                              sig.status === 'pending' ? '#dc2626' :
                              sig.status === 'submitted' ? 'var(--accent)' :
                              sig.status === 'rejected' ? '#dc2626' :
                              'var(--primary)',
                          }}
                        >
                          {sig.status === 'pending' ? '✍️ Action Required' :
                           sig.status === 'submitted' ? '⏳ Submitted (Pending Verification)' :
                           sig.status === 'rejected' ? '❌ Rejected (Please Re-sign)' :
                           '✅ Verified'}
                        </span>

                        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                          Assigned: {new Date(sig.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <Link
                      href={`/sign/${sig.id}`}
                      className={`btn ${isUrgent ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        padding: '10px 18px',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        background: isUrgent ? '#dc2626' : undefined,
                        borderColor: isUrgent ? '#dc2626' : undefined,
                        color: isUrgent ? '#ffffff' : undefined,
                      }}
                    >
                      {isUrgent ? 'Sign Waiver Now →' : 'View Submission →'}
                    </Link>

                    {(sig.status === 'verified' || sig.status === 'verified_manual') && (
                      <button
                        type="button"
                        onClick={async () => {
                          const { toggleArchiveSignatureAction } = await import('./actions');
                          const res = await toggleArchiveSignatureAction(sig.id);
                          if (res.success) {
                            addToast({
                              type: 'success',
                              title: res.is_archived ? 'Waiver Archived' : 'Waiver Unarchived',
                              message: res.is_archived
                                ? 'Moved to archived documents. It will no longer appear on your home dashboard.'
                                : 'Restored to active documents.',
                            });
                            router.refresh();
                          } else if (res.error) {
                            addToast({ type: 'error', title: 'Action Failed', message: res.error });
                          }
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '10px 14px', fontSize: '0.825rem', whiteSpace: 'nowrap' }}
                      >
                        {sig.is_archived ? '📂 Unarchive' : '📁 Archive'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
