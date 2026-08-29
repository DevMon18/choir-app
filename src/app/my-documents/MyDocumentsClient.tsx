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
    <div className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1 w-[450px] h-[450px]" />
      <div className="bg-orb bg-orb-2 w-[400px] h-[400px]" />

      <Navbar profile={currentUserProfile} />

      <main className="flex-1 max-w-[1000px] mx-auto w-full py-6 px-4 pb-[120px]">
        {/* Header Title */}
        <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-[1.75rem] font-bold text-primary m-0">
              📁 Choir Document &amp; Waiver Drive
            </h1>
            <p className="text-muted mt-1 m-0 text-sm sm:text-[0.95rem]">
              Browse choir folders, download guidelines, and manage your signed activity waivers.
            </p>
          </div>

          {isAdmin && (
            <Link
              href="/admin/documents"
              className="btn btn-primary text-xs sm:text-[0.85rem] !py-2 !px-4 font-semibold inline-flex items-center gap-1.5"
            >
              <Settings size={15} />
              <span>Manage Drive</span>
            </Link>
          )}
        </div>

        {/* Main Tab Switcher */}
        <div className="flex gap-2.5 mb-6 border-b-2 border-primary/10 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className={`btn ${activeTab === 'storage' ? 'btn-primary' : 'btn-secondary'} text-xs sm:text-[0.925rem] !py-2.5 !px-5 font-bold rounded-xl`}
          >
            📁 Choir File Drive ({initialDocuments.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('waivers')}
            className={`btn ${activeTab === 'waivers' ? 'btn-primary' : 'btn-secondary'} text-xs sm:text-[0.925rem] !py-2.5 !px-5 font-bold rounded-xl relative`}
          >
            ✍️ My Signed Waivers ({initialSignatures.length})
            {pendingWaiversCount > 0 && (
              <span className="ml-2 bg-red-600 text-white rounded-xl py-0.5 px-2 text-xs font-extrabold">
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
            <div className="glass-container p-3.5 sm:py-3.5 sm:px-4.5 mb-5 flex items-center justify-between flex-wrap gap-3">
              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(null)}
                  className={`bg-transparent border-none text-xs sm:text-[0.925rem] p-0 flex items-center gap-1.5 cursor-pointer ${
                    selectedFolderId === null ? 'font-bold text-primary' : 'font-medium text-muted'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  </svg>
                  <span>Choir Storage Drive</span>
                </button>

                {currentFolder && (
                  <>
                    <span className="text-muted">/</span>
                    <span className="text-xs sm:text-[0.925rem] font-bold text-primary flex items-center gap-1.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      <span>{currentFolder.name}</span>
                    </span>
                  </>
                )}
              </div>

              {/* Search & Grid/List View Selector */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <input
                  type="text"
                  placeholder="Search storage files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field !py-1.5 !px-3 text-xs sm:text-[0.85rem] w-[190px]"
                />

                <div className="flex border border-glass-border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`border-none py-1.5 px-3 cursor-pointer text-xs font-semibold ${
                      viewMode === 'grid' ? 'bg-primary text-white' : 'bg-white text-foreground'
                    }`}
                    title="Grid View"
                  >
                    Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`border-none py-1.5 px-3 cursor-pointer text-xs font-semibold ${
                      viewMode === 'list' ? 'bg-primary text-white' : 'bg-white text-foreground'
                    }`}
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
                className="btn btn-secondary mb-4 text-xs sm:text-[0.85rem] !py-1.5 !px-3.5 inline-flex items-center gap-1.5"
              >
                <span>⬅️ Back to Main Folders</span>
              </button>
            )}

            {/* Folder Grid Section */}
            {displayedFolders.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs sm:text-[0.9rem] uppercase tracking-wider text-muted mb-3 font-bold">
                  Folders ({displayedFolders.length})
                </h3>

                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
                  {displayedFolders.map((folder) => {
                    const fileCount = initialDocuments.filter((d) => d.folder_id === folder.id).length;
                    return (
                      <div
                        key={folder.id}
                        onClick={() => setSelectedFolderId(folder.id)}
                        className="glass-container anim-card p-4 cursor-pointer rounded-2xl border border-glass-border bg-white/70 flex items-center gap-3.5 transition-all shadow-sm hover:shadow-md"
                      >
                        <div
                          className="w-11.5 h-11.5 rounded-xl flex items-center justify-center text-2xl shrink-0"
                          style={{
                            backgroundColor: folder.color ? `${folder.color}15` : 'rgba(11,77,36,0.1)',
                            color: folder.color || 'var(--primary)',
                          }}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                          </svg>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="m-0 mb-0.5 text-xs sm:text-sm font-bold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                            {folder.name}
                          </h4>
                          <p className="m-0 text-[0.78rem] text-muted">
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
              <h3 className="text-xs sm:text-[0.9rem] uppercase tracking-wider text-muted mb-3 font-bold">
                Files ({displayedDocuments.length})
              </h3>

              {displayedDocuments.length === 0 ? (
                <div className="glass-container p-10 text-center text-muted">
                  <div className="text-4xl mb-2">📄</div>
                  <h4 className="m-0 mb-1 text-base font-bold text-foreground">
                    No Files in This Folder
                  </h4>
                  <p className="m-0 text-xs sm:text-sm">
                    There are no documents uploaded in this folder location yet.
                  </p>
                </div>
              ) : viewMode === 'grid' ? (
                /* GRID VIEW */
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                  {displayedDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="glass-container anim-card p-4 rounded-2xl flex flex-col justify-between bg-white/85 border border-glass-border"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2.5">
                          <span
                            className="badge text-xs font-bold"
                            style={{
                              backgroundColor: DOC_TYPE_COLORS[doc.type] || 'rgba(11,77,36,0.1)',
                              color: DOC_TYPE_TEXT[doc.type] || 'var(--primary)',
                            }}
                          >
                            {DOC_TYPE_LABELS[doc.type] || doc.type}
                          </span>
                          <span className="text-xs text-muted">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <h4
                          title={doc.title}
                          className="m-0 mb-1.5 text-xs sm:text-sm font-bold text-foreground overflow-hidden text-ellipsis whitespace-nowrap"
                        >
                          📄 {doc.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 mt-4">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="btn btn-secondary flex-1 !py-1.5 !px-3 text-xs font-semibold"
                        >
                          👁️ Preview
                        </button>
                        <a
                          href={doc.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="btn btn-primary flex-1 !py-1.5 !px-3 text-xs font-semibold text-center"
                        >
                          ⬇️ Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* LIST VIEW */
                <div className="glass-container p-2 rounded-2xl">
                  {displayedDocuments.map((doc, idx) => (
                    <div
                      key={doc.id}
                      className={`flex items-center justify-between p-3 sm:py-3 sm:px-4 flex-wrap gap-2.5 ${
                        idx === displayedDocuments.length - 1 ? '' : 'border-b border-glass-border'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                        <span className="text-2xl shrink-0">📄</span>
                        <div className="flex-1 min-w-0">
                          <h4
                            title={doc.title}
                            className="m-0 text-xs sm:text-sm font-bold text-foreground overflow-hidden text-ellipsis whitespace-nowrap"
                          >
                            {doc.title}
                          </h4>
                          <span className="text-xs text-muted">
                            Uploaded: {new Date(doc.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span
                          className="badge text-xs font-bold"
                          style={{
                            backgroundColor: DOC_TYPE_COLORS[doc.type] || 'rgba(11,77,36,0.1)',
                            color: DOC_TYPE_TEXT[doc.type] || 'var(--primary)',
                          }}
                        >
                          {DOC_TYPE_LABELS[doc.type] || doc.type}
                        </span>

                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="btn btn-secondary !py-1.5 !px-3 text-xs font-semibold"
                        >
                          👁️ Preview
                        </button>
                        <a
                          href={doc.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="btn btn-primary !py-1.5 !px-3 text-xs font-semibold"
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
            <div className="flex gap-2 mb-5 flex-wrap">
              <button
                type="button"
                onClick={() => setWaiverFilter('all')}
                className={`btn ${waiverFilter === 'all' ? 'btn-primary' : 'btn-secondary'} text-xs sm:text-sm !py-2 !px-4`}
              >
                Active Documents ({initialSignatures.filter((s) => !s.is_archived).length})
              </button>
              <button
                type="button"
                onClick={() => setWaiverFilter('pending')}
                className={`btn ${
                  waiverFilter === 'pending'
                    ? '!bg-red-600 !border-red-600 !text-white'
                    : 'btn-secondary !text-red-600'
                } text-xs sm:text-sm !py-2 !px-4`}
              >
                Action Required ({pendingWaiversCount})
              </button>
              <button
                type="button"
                onClick={() => setWaiverFilter('submitted')}
                className={`btn ${waiverFilter === 'submitted' ? 'btn-primary' : 'btn-secondary'} text-xs sm:text-sm !py-2 !px-4`}
              >
                Submitted ({initialSignatures.filter((s) => !s.is_archived && s.status === 'submitted').length})
              </button>
              <button
                type="button"
                onClick={() => setWaiverFilter('verified')}
                className={`btn ${waiverFilter === 'verified' ? 'btn-primary' : 'btn-secondary'} text-xs sm:text-sm !py-2 !px-4`}
              >
                Verified ({initialSignatures.filter((s) => !s.is_archived && (s.status === 'verified' || s.status === 'verified_manual')).length})
              </button>
              <button
                type="button"
                onClick={() => setWaiverFilter('archived')}
                className={`btn ${waiverFilter === 'archived' ? 'btn-primary' : 'btn-secondary'} text-xs sm:text-sm !py-2 !px-4`}
              >
                📁 Archived ({archivedWaiversCount})
              </button>
            </div>

            {/* Waiver List */}
            {filteredSignatures.length === 0 ? (
              <div className="glass-container p-12 text-center text-muted">
                <div className="text-4xl mb-2">📄</div>
                <h3 className="m-0 mb-1 text-base font-bold text-foreground">
                  No documents in this view
                </h3>
                <p className="m-0 text-xs sm:text-sm">
                  You don&apos;t have any assigned document waivers in this category.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {filteredSignatures.map((sig) => {
                  const doc = sig.documents;
                  const docType = doc?.type || 'general';
                  const isUrgent = sig.status === 'pending' || sig.status === 'rejected';

                  return (
                    <div
                      key={sig.id}
                      className="glass-container anim-card p-4 sm:p-4.5 rounded-2xl flex items-center justify-between gap-4 flex-wrap"
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-[240px]">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                          style={{
                            backgroundColor: DOC_TYPE_COLORS[docType] || 'rgba(11,77,36,0.1)',
                            color: DOC_TYPE_TEXT[docType] || 'var(--primary)',
                          }}
                        >
                          📄
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="m-0 text-xs sm:text-base font-bold text-foreground">
                              {doc?.title || 'Choir Waiver Document'}
                            </h3>
                            <span
                              className="badge text-xs font-bold"
                              style={{
                                backgroundColor:
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

                          <span className="text-xs text-muted block mt-1">
                            Assigned: {new Date(sig.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
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
                            className="btn btn-secondary !py-2 !px-3.5 text-xs whitespace-nowrap font-semibold !text-primary"
                          >
                            📄 Stamped PDF
                          </button>
                        )}

                        <Link
                          href={`/sign/${sig.id}`}
                          className={`btn ${
                            isUrgent ? '!bg-red-600 !border-red-600 !text-white' : 'btn-secondary'
                          } !py-2 !px-4 text-xs sm:text-sm font-bold whitespace-nowrap`}
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
                            className="btn btn-secondary !py-2 !px-3.5 text-xs whitespace-nowrap"
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
            className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
            onClick={() => setPreviewDoc(null)}
          >
            <div
              className="glass-container w-full max-w-[850px] bg-white rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-slideUpModal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between py-3.5 px-5 bg-primary text-white">
                <h3 className="m-0 text-sm sm:text-base font-bold">
                  📄 {previewDoc.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="bg-transparent border-none text-white text-xl cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-4">
                <PdfCanvasViewer url={previewDoc.signedUrl} title={previewDoc.title} height="500px" />
              </div>

              <div className="py-3 px-5 border-t border-glass-border flex justify-end gap-2.5">
                <a
                  href={previewDoc.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="btn btn-primary text-xs sm:text-sm !py-2 !px-4.5"
                >
                  ⬇️ Download PDF
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="btn btn-secondary text-xs sm:text-sm !py-2 !px-4.5"
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
