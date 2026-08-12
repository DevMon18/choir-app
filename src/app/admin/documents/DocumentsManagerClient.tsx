'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { PdfCanvasViewer } from '@/components/PdfCanvasViewer';
import {
  uploadDocumentAction,
  deleteDocumentAction,
  distributeDocumentAction,
  getDocumentSignedUrl,
  DocumentRow,
  DocumentType,
  MemberOption,
  SequenceOption,
} from './actions';
import { createFolderAction, assignDocumentToFolderAction, FolderInput } from './folderActions';

export interface FolderItem {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  parent_id: string | null;
  created_at: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface Props {
  currentUserProfile: Profile;
  initialDocuments: DocumentRow[];
  initialFolders?: FolderItem[];
  initialMembers: MemberOption[];
  initialSequences: SequenceOption[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  activity_waiver: 'Activity Waiver',
  wedding_waiver: 'Wedding Waiver',
  wake_guide: 'Wake Guide',
  general: 'General Document',
};

const DOC_TYPE_COLORS: Record<DocumentType, string> = {
  activity_waiver: 'rgba(197,160,89,0.15)',
  wedding_waiver: 'rgba(11,77,36,0.10)',
  wake_guide: 'rgba(100,100,120,0.12)',
  general: 'rgba(59,130,246,0.10)',
};

const DOC_TYPE_TEXT: Record<DocumentType, string> = {
  activity_waiver: 'var(--accent)',
  wedding_waiver: 'var(--primary)',
  wake_guide: '#64647a',
  general: '#2563eb',
};

const isUnder18 = (birthdate: string | null): boolean => {
  if (!birthdate) return false;
  const dob = new Date(birthdate + 'T00:00:00');
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return dob > cutoff;
};

// ─── Upload Modal ─────────────────────────────────────────────────────────────

interface UploadModalProps {
  folders: FolderItem[];
  onClose: () => void;
  onUploaded: (doc: DocumentRow) => void;
}

const UploadModal = ({ folders, onClose, onUploaded }: UploadModalProps) => {
  const { addToast } = useToast();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DocumentType>('general');
  const [folderId, setFolderId] = useState<string>('none');
  const [expiresAt, setExpiresAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manage client-side PDF preview URL
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Auto-fill title if empty
    if (!title) {
      const autoTitle = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
      setTitle(autoTitle.charAt(0).toUpperCase() + autoTitle.slice(1));
    }

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === 'application/pdf') {
      setFile(dropped);
      setErrorMsg('');
    } else {
      setErrorMsg('Only PDF files are accepted.');
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.type === 'application/pdf') {
        setFile(selected);
        setErrorMsg('');
      } else {
        setErrorMsg('Only PDF files are accepted.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setErrorMsg('Please select a PDF file.'); return; }
    if (!title.trim()) { setErrorMsg('Document title is required.'); return; }

    setLoading(true);
    setErrorMsg('');

    const fd = new FormData();
    fd.append('title', title.trim());
    fd.append('type', type);
    fd.append('file', file);
    if (folderId && folderId !== 'none') fd.append('folder_id', folderId);
    if (expiresAt) fd.append('expires_at', new Date(expiresAt).toISOString());

    const res = await uploadDocumentAction(fd);
    setLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      addToast({ type: 'success', title: 'Document Uploaded', message: `"${title}" is now available for distribution.` });
      onUploaded({
        id: res.id as string,
        title: title.trim(),
        type,
        folder_id: folderId !== 'none' ? folderId : null,
        file_path: '',
        created_by: '',
        created_at: new Date().toISOString(),
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      onClose();
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}
    >
      <div
        className="glass-container docs-modal-container"
        style={{ width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto', padding: '32px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(11,77,36,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>Upload Document</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '2px 0 0' }}>PDF files only · max 20 MB</p>
          </div>
        </div>

        {errorMsg && (
          <div className="alert alert-error" style={{ marginBottom: '16px', fontSize: '0.88rem' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* File Selection / Preview Box */}
          {!file ? (
            <div
              onDrop={handleFileDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--glass-border)'}`,
                borderRadius: '12px',
                padding: '36px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'rgba(11,77,36,0.04)' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.2s ease',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={handleFileInput}
                id="doc-file-input"
              />
              <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>☁️</div>
              <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--foreground)', margin: 0 }}>
                Drop PDF here or click to browse
              </p>
              <p style={{ fontSize: '0.825rem', color: 'var(--muted)', margin: '4px 0 0' }}>
                Only .pdf files accepted (max 20 MB)
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '10px', background: 'rgba(11,77,36,0.06)', border: '1px solid rgba(11,77,36,0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                  <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>📄</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.925rem', color: 'var(--primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {file.name}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '2px 0 0' }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB · PDF Document
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setFile(null); }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '4px 10px', flexShrink: 0 }}
                >
                  Change File
                </button>
              </div>

              {/* Embedded Client-side PDF Preview */}
              {previewUrl && (
                <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--glass-border)', background: '#ffffff', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      PDF Live Preview
                    </span>
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'underline', fontWeight: 600 }}>
                      Open full view ↗
                    </a>
                  </div>
                  <iframe
                    src={previewUrl}
                    style={{ width: '100%', height: '240px', border: 'none' }}
                    title="PDF Upload Live Preview"
                  />
                </div>
              )}
            </div>
          )}

          {/* Form Fields — Explicit Vertical Stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="input-label" htmlFor="doc-title" style={{ display: 'block', margin: 0 }}>
              Document Title *
            </label>
            <input
              id="doc-title"
              type="text"
              className="input-field"
              placeholder="e.g. Summer Activity Waiver 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
              📁 Destination Folder (Optional)
            </label>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="form-input"
              style={{ width: '100%' }}
            >
              <option value="none">📁 Root (No Folder)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.icon} {f.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="input-label" htmlFor="doc-type" style={{ display: 'block', margin: 0 }}>
              Document Type *
            </label>
            <select
              id="doc-type"
              className="input-field"
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
            >
              <option value="activity_waiver">Activity Waiver</option>
              <option value="wedding_waiver">Wedding Waiver</option>
              <option value="wake_guide">Wake Guide</option>
              <option value="general">General Document</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="input-label" htmlFor="doc-expires" style={{ display: 'block', margin: 0 }}>
              Expiry Date (optional)
            </label>
            <input
              id="doc-expires"
              type="datetime-local"
              className="input-field"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ minWidth: '140px' }}>
              {loading ? 'Uploading…' : 'Upload Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── PDF Preview Modal (For existing documents) ───────────────────────────────

interface DocPreviewModalProps {
  document: DocumentRow;
  onClose: () => void;
}

const DocPreviewModal = ({ document, onClose }: DocPreviewModalProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function loadSignedUrl() {
      setLoading(true);
      setErrorMsg('');
      const url = await getDocumentSignedUrl(document.file_path);
      if (!isMounted) return;
      setLoading(false);
      if (!url) {
        setErrorMsg('Unable to generate secure document preview URL.');
      } else {
        setSignedUrl(url);
      }
    }
    loadSignedUrl();
    return () => {
      isMounted = false;
    };
  }, [document]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}
    >
      <div
        className="glass-container docs-modal-container"
        style={{ width: '100%', maxWidth: '880px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(11,77,36,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>{document.title}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span className="badge" style={{ background: DOC_TYPE_COLORS[document.type], color: DOC_TYPE_TEXT[document.type], fontWeight: 600, fontSize: '0.75rem' }}>
                  {DOC_TYPE_LABELS[document.type]}
                </span>
                {document.expires_at && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    Expires: {new Date(document.expires_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {signedUrl && (
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>↗ Open in New Tab</span>
              </a>
            )}
            <button onClick={onClose} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              Close
            </button>
          </div>
        </div>

        {/* Modal Viewer Body */}
        <div style={{ flex: 1, padding: '16px', background: 'rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', minHeight: '360px', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', gap: '10px', minHeight: '300px' }}>
              <div style={{ width: '24px', height: '24px', border: '3px solid rgba(11,77,36,0.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span>Loading secure PDF preview…</span>
            </div>
          ) : errorMsg ? (
            <div className="alert alert-error" style={{ margin: 'auto' }}>{errorMsg}</div>
          ) : (
            <PdfCanvasViewer url={signedUrl!} title={document.title} height="55vh" />
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Distribute Modal ──────────────────────────────────────────────────────────

interface DistributeModalProps {
  document: DocumentRow;
  members: MemberOption[];
  sequences: SequenceOption[];
  onClose: () => void;
  onDistributed: (count: number) => void;
}

const DistributeModal = ({ document, members, sequences, onClose, onDistributed }: DistributeModalProps) => {
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activityId, setActivityId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const filteredMembers = useMemo(() => {
    const q = search.toLowerCase();
    return members.filter(
      (m) => m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [members, search]);

  const under18Members = useMemo(() => members.filter((m) => isUnder18(m.birthdate)), [members]);

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredMembers.length && filteredMembers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMembers.map((m) => m.id)));
    }
  };

  const handleQuickSelectUnder18 = () => {
    const ids = under18Members.map((m) => m.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      setErrorMsg('Please select at least one member.');
      return;
    }
    setLoading(true);
    setErrorMsg('');

    const res = await distributeDocumentAction({
      documentId: document.id,
      activityId: activityId || null,
      memberIds: Array.from(selectedIds),
    });

    setLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      const { distributed = 0, skipped = 0 } = res as any;
      addToast({
        type: 'success',
        title: 'Document Distributed',
        message: `Sent to ${distributed} member${distributed !== 1 ? 's' : ''}${skipped > 0 ? ` · ${skipped} already had it` : ''}.`,
      });
      onDistributed(distributed);
      onClose();
    }
  };

  const allVisibleSelected =
    filteredMembers.length > 0 && filteredMembers.every((m) => selectedIds.has(m.id));

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}
    >
      <div
        className="glass-container docs-modal-container"
        style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '28px 28px 20px', borderBottom: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)', margin: '0 0 4px' }}>Distribute Document</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--muted)', margin: 0, fontStyle: 'italic' }}>"{document.title}"</p>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px', flexShrink: 0 }}
              aria-label="Close distribute modal"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Link to Activity */}
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="input-label" htmlFor="dist-activity" style={{ display: 'block', margin: 0 }}>
              Link to Activity (optional)
            </label>
            <select
              id="dist-activity"
              className="input-field"
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
            >
              <option value="">— No specific activity —</option>
              {sequences.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="alert alert-error" style={{ margin: '12px 28px 0', fontSize: '0.88rem' }}>
            {errorMsg}
          </div>
        )}

        {/* Controls bar */}
        <div style={{ padding: '16px 28px 0', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <input
              type="search"
              className="input-field"
              placeholder="🔍 Search members…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '0.9rem' }}
            />
          </div>
          {under18Members.length > 0 && (
            <button
              onClick={handleQuickSelectUnder18}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '8px 12px', whiteSpace: 'nowrap' }}
              type="button"
            >
              ⚡ Under 18 ({under18Members.length})
            </button>
          )}
          <button
            onClick={handleSelectAll}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '8px 12px', whiteSpace: 'nowrap' }}
            type="button"
          >
            {allVisibleSelected ? 'Deselect All' : `Select All (${filteredMembers.length})`}
          </button>
        </div>

        {/* Member list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 28px', minHeight: '200px' }}>
          {filteredMembers.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0', fontSize: '0.9rem' }}>
              No members match your search.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredMembers.map((m) => {
                const checked = selectedIds.has(m.id);
                const under18 = isUnder18(m.birthdate);
                return (
                  <label
                    key={m.id}
                    htmlFor={`member-${m.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      background: checked ? 'rgba(11,77,36,0.07)' : 'rgba(255,255,255,0.35)',
                      border: `1px solid ${checked ? 'rgba(11,77,36,0.25)' : 'var(--glass-border)'}`,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      id={`member-${m.id}`}
                      checked={checked}
                      onChange={() => toggleMember(m.id)}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.full_name}
                        </span>
                        {under18 && (
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '1px 6px', borderRadius: '20px', background: 'rgba(197,160,89,0.18)', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                            &lt;18
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{m.email}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 500 }}>
            {selectedIds.size} member{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || selectedIds.size === 0}
              className="btn btn-primary"
              style={{ minWidth: '140px' }}
            >
              {loading ? 'Distributing…' : `Distribute to ${selectedIds.size}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Create Folder Modal ──────────────────────────────────────────────────────

const CreateFolderModal = ({ onClose, onCreated }: { onClose: () => void; onCreated: (folder: FolderItem) => void }) => {
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📁');
  const [color, setColor] = useState('#0b4d24');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Folder name is required.'); return; }

    setLoading(true);
    setError('');

    const res = await createFolderAction({ name, description, icon, color });
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else if (res.folder) {
      addToast({ type: 'success', title: 'Folder Created', message: `Folder "${name}" created successfully.` });
      onCreated(res.folder);
      onClose();
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}
    >
      <div
        className="glass-container"
        style={{ width: '100%', maxWidth: '480px', padding: '28px', background: '#ffffff', borderRadius: '16px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>
          📁 Create New Folder
        </h3>

        {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label className="form-label">Folder Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              placeholder="e.g. Choir Recollection 2026"
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label className="form-label">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
              placeholder="e.g. Handouts, waivers & schedules"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label className="form-label">Icon</label>
              <select value={icon} onChange={(e) => setIcon(e.target.value)} className="form-input">
                <option value="📁">📁 Folder</option>
                <option value="📜">📜 Waiver</option>
                <option value="🎼">🎼 Sheet Music</option>
                <option value="📝">📝 Notes</option>
                <option value="🎉">🎉 Event</option>
              </select>
            </div>

            <div>
              <label className="form-label">Folder Color</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: '100%', height: '40px', padding: '2px', borderRadius: '8px', cursor: 'pointer' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Creating…' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Client Component ─────────────────────────────────────────────────────

export const DocumentsManagerClient = ({
  currentUserProfile,
  initialDocuments,
  initialFolders = [],
  initialMembers,
  initialSequences,
}: Props) => {
  const { addToast } = useToast();
  const [documents, setDocuments] = useState<DocumentRow[]>(initialDocuments);
  const [folders, setFolders] = useState<FolderItem[]>(initialFolders);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [distributeTarget, setDistributeTarget] = useState<DocumentRow | null>(null);
  const [previewTarget, setPreviewTarget] = useState<DocumentRow | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleUploaded = (doc: DocumentRow) => {
    setDocuments((prev) => [doc, ...prev]);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);
    setDeletingId(id);

    const res = await deleteDocumentAction(id);
    setDeletingId(null);

    if (res.error) {
      addToast({ type: 'error', title: 'Delete Failed', message: res.error });
    } else {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      addToast({ type: 'success', title: 'Document Deleted', message: 'Document and its associated files have been removed.' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '450px', height: '450px' }} />
      <div className="bg-orb bg-orb-2" style={{ width: '400px', height: '400px' }} />

      <Navbar profile={currentUserProfile} />

      <main className="admin-content-full" style={{ flex: 1, maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
              Documents &amp; Waivers
            </h1>
            <p style={{ color: 'var(--muted)', margin: '4px 0 0', fontSize: '0.95rem' }}>
              Upload PDF documents, preview waivers, and distribute signature requests to members.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowCreateFolder(true)}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              📁 + Create Folder
            </button>

            <button
              onClick={() => setShowUpload(true)}
              className="btn btn-primary docs-desktop-create"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Upload Document
            </button>
          </div>
        </div>

        {/* Document list */}
        {documents.length === 0 ? (
          <div className="glass-container" style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📄</div>
            <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 8px' }}>No documents yet</p>
            <p style={{ margin: 0 }}>Upload a PDF waiver or guide to get started.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Uploaded By</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td data-label="Document">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(11,77,36,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          </svg>
                        </div>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--foreground)' }}>{doc.title}</span>
                      </div>
                    </td>
                    <td data-label="Type">
                      <span
                        className="badge"
                        style={{
                          background: DOC_TYPE_COLORS[doc.type],
                          color: DOC_TYPE_TEXT[doc.type],
                          fontWeight: 600,
                          fontSize: '0.78rem',
                        }}
                      >
                        {DOC_TYPE_LABELS[doc.type]}
                      </span>
                    </td>
                    <td data-label="Uploaded By">
                      <span style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
                        {(doc.profiles as any)?.full_name || 'Admin'}
                      </span>
                    </td>
                    <td data-label="Expires">
                      <span style={{ fontSize: '0.85rem', color: doc.expires_at ? 'var(--foreground)' : 'var(--muted)' }}>
                        {doc.expires_at ? new Date(doc.expires_at).toLocaleDateString() : 'No expiry'}
                      </span>
                    </td>
                    <td data-label="Actions">
                      <div className="docs-table-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setPreviewTarget(doc)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                          aria-label={`Preview ${doc.title}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                          Preview
                        </button>
                        <button
                          onClick={() => setDistributeTarget(doc)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                          aria-label={`Distribute ${doc.title}`}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                          </svg>
                          Distribute
                        </button>
                        <button
                          onClick={() => setDeleteTargetId(doc.id)}
                          disabled={deletingId === doc.id}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--error)', borderColor: 'var(--error)' }}
                          aria-label={`Delete ${doc.title}`}
                        >
                          {deletingId === doc.id ? '…' : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Mobile FAB */}
      <button
        onClick={() => setShowUpload(true)}
        className="btn btn-primary docs-mobile-fab"
        aria-label="Upload new document"
      >
        + Upload Document
      </button>

      {/* Modals */}
      {showCreateFolder && (
        <CreateFolderModal
          onClose={() => setShowCreateFolder(false)}
          onCreated={(f) => setFolders((prev) => [...prev, f])}
        />
      )}

      {showUpload && (
        <UploadModal folders={folders} onClose={() => setShowUpload(false)} onUploaded={handleUploaded} />
      )}

      {previewTarget && (
        <DocPreviewModal document={previewTarget} onClose={() => setPreviewTarget(null)} />
      )}

      {distributeTarget && (
        <DistributeModal
          document={distributeTarget}
          members={initialMembers}
          sequences={initialSequences}
          onClose={() => setDistributeTarget(null)}
          onDistributed={() => setDistributeTarget(null)}
        />
      )}

      {deleteTargetId && (
        <ConfirmModal
          title="Delete Document"
          message="This will permanently delete the document and all associated signature records for members who haven't signed yet. This cannot be undone."
          confirmLabel="Yes, Delete"
          isDanger
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}
    </div>
  );
};
