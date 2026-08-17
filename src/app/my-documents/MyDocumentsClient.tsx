'use client';

import React, { useState, useMemo } from 'react';
import { Settings, Folder, FileText, Eye, Download, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useToast } from '@/components/Toast';
import { PdfCanvasViewer } from '@/components/PdfCanvasViewer';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

export interface FolderItem {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  parent_id: string | null;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  type: string;
  file_path: string;
  folder_id: string | null;
  created_at: string;
  signedUrl: string;
}

interface DocumentTemplate {
  id: string;
  title: string;
  type: string;
  file_path: string;
  folder_id: string | null;
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
  signed_pdf_path?: string | null;
  signedPdfSignedUrl?: string | null;
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
  initialFolders?: FolderItem[];
  initialDocuments?: DocumentItem[];
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

export default function MyDocumentsClient({
  currentUserProfile,
  initialSignatures,
  initialFolders = [],
  initialDocuments = [],
}: Props) {
  const router = useRouter();
  const { addToast } = useToast();

  // Live real-time sync for member documents, folders, and assigned waivers
  useRealtimeSync({
    channelName: `my-docs-sync-${currentUserProfile.id}`,
    tables: [
      { table: 'document_signatures', filter: `primary_member_id=eq.${currentUserProfile.id}` },
      { table: 'documents' },
      { table: 'document_folders' },
    ],
  });

  const [activeTab, setActiveTab] = useState<'storage' | 'waivers'>('storage');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Preview Modal state
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  // Waiver status filter
  const [waiverFilter, setWaiverFilter] = useState<'all' | 'pending' | 'submitted' | 'verified' | 'archived'>('all');

  const isAdmin = ['super_admin', 'director', 'secretary'].includes(currentUserProfile.role);

  // Current folder information
  const currentFolder = useMemo(
    () => initialFolders.find((f) => f.id === selectedFolderId) || null,
    [initialFolders, selectedFolderId]
  );

  // Filtered documents inside current folder / search
  const displayedDocuments = useMemo(() => {
    return initialDocuments.filter((doc) => {
      if (searchQuery.trim()) {
        return doc.title.toLowerCase().includes(searchQuery.toLowerCase());
      }
      if (selectedFolderId === null) {
        return !doc.folder_id; // Root files
      }
      return doc.folder_id === selectedFolderId;
    });
  }, [initialDocuments, selectedFolderId, searchQuery]);

  // Root level or sub folders
  const displayedFolders = useMemo(() => {
    if (searchQuery.trim()) return [];
    return initialFolders.filter((f) => f.parent_id === selectedFolderId);
  }, [initialFolders, selectedFolderId, searchQuery]);

  // Waiver filtering
  const filteredSignatures = useMemo(() => {
    if (waiverFilter === 'all') {
      return initialSignatures.filter((s) => !s.is_archived);
    }
    if (waiverFilter === 'pending') {
      return initialSignatures.filter((s) => !s.is_archived && (s.status === 'pending' || s.status === 'rejected'));
    }
    if (waiverFilter === 'submitted') {
      return initialSignatures.filter((s) => !s.is_archived && s.status === 'submitted');
    }
    if (waiverFilter === 'verified') {
      return initialSignatures.filter((s) => !s.is_archived && (s.status === 'verified' || s.status === 'verified_manual'));
    }
    if (waiverFilter === 'archived') {
      return initialSignatures.filter((s) => s.is_archived);
    }
    return initialSignatures;
  }, [initialSignatures, waiverFilter]);

  const pendingWaiversCount = useMemo(
    () => initialSignatures.filter((s) => !s.is_archived && (s.status === 'pending' || s.status === 'rejected')).length,
    [initialSignatures]
  );

  const archivedWaiversCount = useMemo(
    () => initialSignatures.filter((s) => s.is_archived).length,
    [initialSignatures]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '450px', height: '450px' }} />
      <div className="bg-orb bg-orb-2" style={{ width: '400px', height: '400px' }} />

      <Navbar profile={currentUserProfile} />

      <main style={{ flex: 1, maxWidth: '1000px', margin: '0 auto', width: '100%', padding: '24px 16px 120px' }}>
        {/* Header Title */}
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
              📁 Choir Document &amp; Waiver Drive
            </h1>
            <p style={{ color: 'var(--muted)', margin: '4px 0 0', fontSize: '0.95rem' }}>
              Browse choir folders, download guidelines, and manage your signed activity waivers.
            </p>
          </div>

          {isAdmin && (
            <Link
              href="/admin/documents"
              className="btn btn-primary"
              style={{ fontSize: '0.85rem', padding: '8px 16px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Settings size={15} /> Manage Drive
            </Link>
          )}
        </div>

        {/* Main Tab Switcher */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '2px solid rgba(11,77,36,0.1)', paddingBottom: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className={`btn ${activeTab === 'storage' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.925rem', padding: '10px 20px', fontWeight: 700, borderRadius: '10px' }}
          >
            📁 Choir File Drive ({initialDocuments.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('waivers')}
            className={`btn ${activeTab === 'waivers' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.925rem', padding: '10px 20px', fontWeight: 700, borderRadius: '10px', position: 'relative' }}
          >
            ✍️ My Signed Waivers ({initialSignatures.length})
            {pendingWaiversCount > 0 && (
              <span
                style={{
                  marginLeft: '8px',
                  background: '#dc2626',
                  color: '#ffffff',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                }}
              >
                {pendingWaiversCount}
              </span>
            )}
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: FILE STORAGE EXPLORER STYLE                                  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'storage' && (
          <div>
            {/* Storage Controls Bar */}
            <div
              className="glass-container"
              style={{
                padding: '14px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              {/* Breadcrumb Navigation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '0.925rem',
                    fontWeight: selectedFolderId === null ? 700 : 500,
                    color: selectedFolderId === null ? 'var(--primary)' : 'var(--muted)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  </svg>
                  <span>Choir Storage Drive</span>
                </button>

                {currentFolder && (
                  <>
                    <span style={{ color: 'var(--muted)' }}>/</span>
                    <span style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      <span>{currentFolder.name}</span>
                    </span>
                  </>
                )}
              </div>

              {/* Search & Grid/List View Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search storage files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    width: '190px',
                  }}
                />

                <div style={{ display: 'flex', border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    style={{
                      border: 'none',
                      padding: '6px 12px',
                      background: viewMode === 'grid' ? 'var(--primary)' : '#ffffff',
                      color: viewMode === 'grid' ? '#ffffff' : 'var(--foreground)',
                      cursor: 'pointer',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                    }}
                    title="Grid View"
                  >
                    Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    style={{
                      border: 'none',
                      padding: '6px 12px',
                      background: viewMode === 'list' ? 'var(--primary)' : '#ffffff',
                      color: viewMode === 'list' ? '#ffffff' : 'var(--foreground)',
                      cursor: 'pointer',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                    }}
                    title="List View"
                  >
                    List
                  </button>
                </div>
              </div>
            </div>

            {/* Back Button inside folder */}
            {selectedFolderId !== null && (
              <button
                type="button"
                onClick={() => setSelectedFolderId(currentFolder?.parent_id || null)}
                className="btn btn-secondary"
                style={{ marginBottom: '16px', fontSize: '0.85rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>⬅️ Back to Main Folders</span>
              </button>
            )}

            {/* Folder Grid Section */}
            {displayedFolders.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '12px', fontWeight: 700 }}>
                  Folders ({displayedFolders.length})
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
                  {displayedFolders.map((folder) => {
                    const fileCount = initialDocuments.filter((d) => d.folder_id === folder.id).length;
                    return (
                      <div
                        key={folder.id}
                        onClick={() => setSelectedFolderId(folder.id)}
                        className="glass-container anim-card"
                        style={{
                          padding: '16px',
                          cursor: 'pointer',
                          borderRadius: '14px',
                          border: '1px solid var(--glass-border)',
                          background: 'rgba(255,255,255,0.7)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                        }}
                      >
                        <div
                          style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '12px',
                            background: folder.color ? `${folder.color}15` : 'rgba(11,77,36,0.1)',
                            color: folder.color || 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.5rem',
                            flexShrink: 0,
                          }}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                          </svg>
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ margin: '0 0 2px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {folder.name}
                          </h4>
                          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)' }}>
                            {fileCount} {fileCount === 1 ? 'file' : 'files'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Files Grid / List Section */}
            <div>
              <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '12px', fontWeight: 700 }}>
                Files ({displayedDocuments.length})
              </h3>

              {displayedDocuments.length === 0 ? (
                <div className="glass-container" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📄</div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                    No Files in This Folder
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.88rem' }}>
                    There are no documents uploaded in this folder location yet.
                  </p>
                </div>
              ) : viewMode === 'grid' ? (
                /* GRID VIEW */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {displayedDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="glass-container anim-card"
                      style={{
                        padding: '16px',
                        borderRadius: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        background: 'rgba(255,255,255,0.85)',
                        border: '1px solid var(--glass-border)',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.725rem',
                              fontWeight: 700,
                              background: DOC_TYPE_COLORS[doc.type] || 'rgba(11,77,36,0.1)',
                              color: DOC_TYPE_TEXT[doc.type] || 'var(--primary)',
                            }}
                          >
                            {DOC_TYPE_LABELS[doc.type] || doc.type}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {new Date(doc.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <h4
                          title={doc.title}
                          style={{
                            margin: '0 0 6px',
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            color: 'var(--foreground)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          📄 {doc.title}
                        </h4>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="btn btn-secondary"
                          style={{ flex: 1, padding: '7px 12px', fontSize: '0.825rem', fontWeight: 600 }}
                        >
                          👁️ Preview
                        </button>
                        <a
                          href={doc.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="btn btn-primary"
                          style={{ flex: 1, padding: '7px 12px', fontSize: '0.825rem', fontWeight: 600, textAlign: 'center' }}
                        >
                          ⬇️ Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* LIST VIEW */
                <div className="glass-container" style={{ padding: '8px', borderRadius: '14px' }}>
                  {displayedDocuments.map((doc, idx) => (
                    <div
                      key={doc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderBottom: idx === displayedDocuments.length - 1 ? 'none' : '1px solid var(--glass-border)',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>📄</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4
                            title={doc.title}
                            style={{
                              margin: 0,
                              fontSize: '0.95rem',
                              fontWeight: 700,
                              color: 'var(--foreground)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {doc.title}
                          </h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            Uploaded: {new Date(doc.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.725rem',
                            fontWeight: 700,
                            background: DOC_TYPE_COLORS[doc.type] || 'rgba(11,77,36,0.1)',
                            color: DOC_TYPE_TEXT[doc.type] || 'var(--primary)',
                          }}
                        >
                          {DOC_TYPE_LABELS[doc.type] || doc.type}
                        </span>

                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600 }}
                        >
                          👁️ Preview
                        </button>
                        <a
                          href={doc.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600 }}
                        >
                          ⬇️ Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: MY SIGNED WAIVERS SECTION                                    */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'waivers' && (
          <div>
            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setWaiverFilter('all')}
                className={`btn ${waiverFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.85rem', padding: '8px 16px' }}
              >
                Active Documents ({initialSignatures.filter((s) => !s.is_archived).length})
              </button>
              <button
                type="button"
                onClick={() => setWaiverFilter('pending')}
                className={`btn ${waiverFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  fontSize: '0.85rem',
                  padding: '8px 16px',
                  color: waiverFilter === 'pending' ? '#fff' : '#dc2626',
                  background: waiverFilter === 'pending' ? '#dc2626' : undefined,
                  borderColor: waiverFilter === 'pending' ? '#dc2626' : undefined,
                }}
              >
                Action Required ({pendingWaiversCount})
              </button>
              <button
                type="button"
                onClick={() => setWaiverFilter('submitted')}
                className={`btn ${waiverFilter === 'submitted' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.85rem', padding: '8px 16px' }}
              >
                Submitted ({initialSignatures.filter((s) => !s.is_archived && s.status === 'submitted').length})
              </button>
              <button
                type="button"
                onClick={() => setWaiverFilter('verified')}
                className={`btn ${waiverFilter === 'verified' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.85rem', padding: '8px 16px' }}
              >
                Verified ({initialSignatures.filter((s) => !s.is_archived && (s.status === 'verified' || s.status === 'verified_manual')).length})
              </button>
              <button
                type="button"
                onClick={() => setWaiverFilter('archived')}
                className={`btn ${waiverFilter === 'archived' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.85rem', padding: '8px 16px' }}
              >
                📁 Archived ({archivedWaiversCount})
              </button>
            </div>

            {/* Waiver List */}
            {filteredSignatures.length === 0 ? (
              <div className="glass-container" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📄</div>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', color: 'var(--foreground)' }}>
                  No documents in this view
                </h3>
                <p style={{ margin: 0, fontSize: '0.88rem' }}>
                  You don&apos;t have any assigned document waivers in this category.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {filteredSignatures.map((sig) => {
                  const doc = sig.documents;
                  const docType = doc?.type || 'general';
                  const isUrgent = sig.status === 'pending' || sig.status === 'rejected';

                  return (
                    <div
                      key={sig.id}
                      className="glass-container anim-card"
                      style={{
                        padding: '18px',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '240px' }}>
                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            background: DOC_TYPE_COLORS[docType] || 'rgba(11,77,36,0.1)',
                            color: DOC_TYPE_TEXT[docType] || 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.3rem',
                            flexShrink: 0,
                          }}
                        >
                          📄
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h3 style={{ margin: 0, fontSize: '1.025rem', fontWeight: 700, color: 'var(--foreground)' }}>
                              {doc?.title || 'Choir Waiver Document'}
                            </h3>
                            <span
                              className="badge"
                              style={{
                                fontSize: '0.725rem',
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
                               sig.status === 'submitted' ? '⏳ Submitted' :
                               sig.status === 'rejected' ? '❌ Rejected' :
                               '✅ Verified'}
                            </span>
                          </div>

                          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>
                            Assigned: {new Date(sig.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {sig.signedPdfSignedUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewDoc({
                                id: sig.id,
                                title: `${doc?.title || 'Signed Waiver'} (Stamped Copy)`,
                                type: docType,
                                file_path: '',
                                folder_id: null,
                                created_at: sig.created_at,
                                signedUrl: sig.signedPdfSignedUrl!,
                              })
                            }
                            className="btn btn-secondary"
                            style={{ padding: '9px 14px', fontSize: '0.825rem', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--primary)' }}
                          >
                            📄 Stamped PDF
                          </button>
                        )}

                        <Link
                          href={`/sign/${sig.id}`}
                          className={`btn ${isUrgent ? 'btn-primary' : 'btn-secondary'}`}
                          style={{
                            padding: '9px 16px',
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
                            style={{ padding: '9px 14px', fontSize: '0.825rem', whiteSpace: 'nowrap' }}
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
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* PREVIEW DOCUMENT MODAL                                              */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {previewDoc && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
            onClick={() => setPreviewDoc(null)}
          >
            <div
              className="glass-container"
              style={{
                width: '100%',
                maxWidth: '850px',
                background: '#ffffff',
                borderRadius: '16px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  background: 'var(--primary)',
                  color: '#ffffff',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                  📄 {previewDoc.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.25rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '16px' }}>
                <PdfCanvasViewer url={previewDoc.signedUrl} title={previewDoc.title} height="500px" />
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <a
                  href={previewDoc.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="btn btn-primary"
                  style={{ fontSize: '0.88rem', padding: '8px 18px' }}
                >
                  ⬇️ Download PDF
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.88rem', padding: '8px 18px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
