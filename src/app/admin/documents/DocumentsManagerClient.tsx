'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Eye,
  Pencil,
  Folder,
  Send,
  Trash2,
  FolderPlus,
  Upload,
  MoreVertical,
  FileText,
  ChevronRight,
  LayoutGrid,
  List,
  Search,
  FolderOpen,
  ArrowLeft,
  X,
  Sparkles,
  Users,
  Bell,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { PdfCanvasViewer } from '@/components/PdfCanvasViewer';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import {
  uploadDocumentAction,
  deleteDocumentAction,
  distributeDocumentAction,
  getDocumentSignedUrl,
  renameDocumentAction,
  moveDocumentAction,
  createWaiverFromDocumentAction,
  saveWaiverTemplateAction,
  getDocumentRecipientsAction,
  sendWaiverReminderAction,
  RecipientInfo,
  DocumentRow,
  DocumentType,
  MemberOption,
  SequenceOption,
} from './actions';
import { DEFAULT_WAIVER_CONTENT, WaiverContent } from '@/lib/waiver-types';
import {
  createFolderAction,
  updateFolderAction,
  deleteFolderAction,
  moveFolderAction,
  assignDocumentToFolderAction,
  FolderInput,
} from './folderActions';

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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          {/* File Selection / Preview Box */}
          {!file ? (
            <div
              onDrop={handleFileDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--primary)' : 'rgba(11,77,36,0.25)'}`,
                borderRadius: '16px',
                padding: '32px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'rgba(11,77,36,0.06)' : 'rgba(248,250,252,0.8)',
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
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: 'rgba(11,77,36,0.1)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p style={{ fontWeight: 700, fontSize: '0.975rem', color: 'var(--foreground)', margin: 0 }}>
                Drop PDF file here or click to browse
              </p>
              <p style={{ fontSize: '0.825rem', color: 'var(--muted)', margin: '4px 0 0' }}>
                Only .pdf files accepted (max 20 MB)
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: '12px', background: 'rgba(11,77,36,0.06)', border: '1px solid rgba(11,77,36,0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(11,77,36,0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
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
                  style={{ fontSize: '0.78rem', padding: '6px 12px', flexShrink: 0 }}
                >
                  Change File
                </button>
              </div>

              {/* Embedded Client-side PDF Preview */}
              {previewUrl && (
                <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--glass-border)', background: '#ffffff', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      PDF Live Preview
                    </span>
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }}>
                      Open full view ↗
                    </a>
                  </div>
                  <iframe
                    src={previewUrl}
                    style={{ width: '100%', height: '220px', border: 'none' }}
                    title="PDF Upload Live Preview"
                  />
                </div>
              )}
            </div>
          )}

          {/* Form Fields */}
          <div style={{ width: '100%' }}>
            <label htmlFor="doc-title" style={{ display: 'block', width: '100%', fontWeight: 700, fontSize: '0.85rem', color: 'var(--foreground)', marginBottom: '6px' }}>
              Document Title *
            </label>
            <input
              id="doc-title"
              type="text"
              placeholder="e.g. Summer Activity Waiver 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                padding: '11px 15px',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                background: '#ffffff',
                fontSize: '0.925rem',
                color: 'var(--foreground)',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ width: '100%' }}>
            <label htmlFor="doc-folder" style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', fontWeight: 700, fontSize: '0.85rem', color: 'var(--foreground)', marginBottom: '6px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span>Destination Folder (Optional)</span>
            </label>
            <select
              id="doc-folder"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                padding: '11px 15px',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                background: '#ffffff',
                fontSize: '0.925rem',
                color: 'var(--foreground)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="none">Root (No Folder)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: '100%' }}>
            <label htmlFor="doc-type" style={{ display: 'block', width: '100%', fontWeight: 700, fontSize: '0.85rem', color: 'var(--foreground)', marginBottom: '6px' }}>
              Document Type *
            </label>
            <select
              id="doc-type"
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                padding: '11px 15px',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                background: '#ffffff',
                fontSize: '0.925rem',
                color: 'var(--foreground)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="activity_waiver">Activity Waiver</option>
              <option value="wedding_waiver">Wedding Waiver</option>
              <option value="wake_guide">Wake Guide</option>
              <option value="general">General Document</option>
            </select>
          </div>

          <div style={{ width: '100%' }}>
            <label htmlFor="doc-expires" style={{ display: 'block', width: '100%', fontWeight: 700, fontSize: '0.85rem', color: 'var(--foreground)', marginBottom: '6px' }}>
              Expiry Date (Optional)
            </label>
            <input
              id="doc-expires"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                padding: '11px 15px',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                background: '#ffffff',
                fontSize: '0.925rem',
                color: 'var(--foreground)',
                outline: 'none',
              }}
            />
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px', width: '100%' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '10px 20px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                padding: '10px 24px',
                fontSize: '0.875rem',
                fontWeight: 700,
                background: 'var(--primary)',
                borderColor: 'var(--primary)',
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              {loading ? 'Uploading…' : 'Upload Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Waiver Editor Modal (Full Text & Clause Customization) ────────────────────

interface WaiverEditorModalProps {
  document: DocumentRow;
  isCreating?: boolean;
  onClose: () => void;
  onSaved: (docOrId: DocumentRow | string, title: string) => void;
}

const WaiverEditorModal = ({ document, isCreating = false, onClose, onSaved }: WaiverEditorModalProps) => {
  const { addToast } = useToast();
  const existingWaiver = (document as any).waiver_content as WaiverContent | undefined;

  const [title, setTitle] = useState(
    isCreating ? `${document.title} — Consent & Waiver` : document.title
  );
  const [headerNote, setHeaderNote] = useState(
    existingWaiver?.headerNote || DEFAULT_WAIVER_CONTENT.headerNote || ''
  );

  const [clause1Title, setClause1Title] = useState(
    existingWaiver?.clause1Title || DEFAULT_WAIVER_CONTENT.clause1Title || ''
  );
  const [clause1Text, setClause1Text] = useState(
    existingWaiver?.clause1Text || DEFAULT_WAIVER_CONTENT.clause1Text || ''
  );

  const [clause2Title, setClause2Title] = useState(
    existingWaiver?.clause2Title || DEFAULT_WAIVER_CONTENT.clause2Title || ''
  );
  const [clause2Text, setClause2Text] = useState(
    existingWaiver?.clause2Text || DEFAULT_WAIVER_CONTENT.clause2Text || ''
  );

  const [clause3Title, setClause3Title] = useState(
    existingWaiver?.clause3Title || DEFAULT_WAIVER_CONTENT.clause3Title || ''
  );
  const [clause3Text, setClause3Text] = useState(
    existingWaiver?.clause3Text || DEFAULT_WAIVER_CONTENT.clause3Text || ''
  );

  const [clause4Title, setClause4Title] = useState(
    existingWaiver?.clause4Title || DEFAULT_WAIVER_CONTENT.clause4Title || ''
  );
  const [clause4Text, setClause4Text] = useState(
    existingWaiver?.clause4Text || DEFAULT_WAIVER_CONTENT.clause4Text || ''
  );

  const [clause5Title, setClause5Title] = useState(
    existingWaiver?.clause5Title || DEFAULT_WAIVER_CONTENT.clause5Title || ''
  );
  const [clause5Text, setClause5Text] = useState(
    existingWaiver?.clause5Text || DEFAULT_WAIVER_CONTENT.clause5Text || ''
  );

  const [specialInstructions, setSpecialInstructions] = useState(
    existingWaiver?.specialInstructions || ''
  );

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleResetDefaults = () => {
    setHeaderNote(DEFAULT_WAIVER_CONTENT.headerNote || '');
    setClause1Title(DEFAULT_WAIVER_CONTENT.clause1Title || '');
    setClause1Text(DEFAULT_WAIVER_CONTENT.clause1Text || '');
    setClause2Title(DEFAULT_WAIVER_CONTENT.clause2Title || '');
    setClause2Text(DEFAULT_WAIVER_CONTENT.clause2Text || '');
    setClause3Title(DEFAULT_WAIVER_CONTENT.clause3Title || '');
    setClause3Text(DEFAULT_WAIVER_CONTENT.clause3Text || '');
    setClause4Title(DEFAULT_WAIVER_CONTENT.clause4Title || '');
    setClause4Text(DEFAULT_WAIVER_CONTENT.clause4Text || '');
    setClause5Title(DEFAULT_WAIVER_CONTENT.clause5Title || '');
    setClause5Text(DEFAULT_WAIVER_CONTENT.clause5Text || '');
    setSpecialInstructions('');
    addToast({ type: 'info', title: 'Reset to Standard Clauses', message: 'Restored the 5 standard legal clauses.' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Waiver title is required.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const waiverContent: WaiverContent = {
      headerNote: headerNote.trim(),
      clause1Title: clause1Title.trim(),
      clause1Text: clause1Text.trim(),
      clause2Title: clause2Title.trim(),
      clause2Text: clause2Text.trim(),
      clause3Title: clause3Title.trim(),
      clause3Text: clause3Text.trim(),
      clause4Title: clause4Title.trim(),
      clause4Text: clause4Text.trim(),
      clause5Title: clause5Title.trim(),
      clause5Text: clause5Text.trim(),
      specialInstructions: specialInstructions.trim(),
    };

    let res: { success?: boolean; error?: string; id?: string; document?: DocumentRow };

    if (isCreating) {
      res = await createWaiverFromDocumentAction({
        documentId: document.id,
        customTitle: title.trim(),
        waiverContent,
      });
    } else {
      res = await saveWaiverTemplateAction({
        documentId: document.id,
        title: title.trim(),
        waiverContent,
      });
    }

    setLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      addToast({
        type: 'success',
        title: isCreating ? 'Activity Waiver Created!' : 'Waiver Clauses Saved',
        message: isCreating
          ? `Generated combined 2-page Waiver: "${title}"`
          : 'Updated waiver clauses & re-compiled PDF template.',
      });
      onSaved(res.document || res.id || document.id, title.trim());
      onClose();
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}
    >
      <div
        className="glass-container docs-modal-container"
        style={{ width: '100%', maxWidth: '780px', maxHeight: '92vh', overflowY: 'auto', padding: '28px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(11,77,36,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                {isCreating ? 'Create & Edit Activity Waiver' : 'Edit Waiver Clauses'}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '2px 0 0' }}>
                Source Document: "{document.title}"
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            title="Reset to default legal wording"
          >
            🔄 Reset Standard Text
          </button>
        </div>

        {errorMsg && (
          <div className="alert alert-error" style={{ marginBottom: '16px', fontSize: '0.88rem' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label htmlFor="waiver-title" style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', color: 'var(--foreground)', marginBottom: '6px' }}>
              Waiver Title *
            </label>
            <input
              id="waiver-title"
              type="text"
              className="input-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Summer Choir Activity Consent & Waiver"
              required
            />
          </div>

          <div>
            <label htmlFor="header-note" style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', color: 'var(--foreground)', marginBottom: '6px' }}>
              Header Subtitle / Acknowledgement Note
            </label>
            <textarea
              id="header-note"
              className="input-field"
              rows={2}
              value={headerNote}
              onChange={(e) => setHeaderNote(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            />
          </div>

          {/* Clause 1 */}
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.6)', border: '1px solid var(--glass-border)' }}>
            <label htmlFor="clause1-title" style={{ display: 'block', fontWeight: 700, fontSize: '0.825rem', color: 'var(--primary)', marginBottom: '4px' }}>
              Clause 1 Title
            </label>
            <input
              id="clause1-title"
              type="text"
              className="input-field"
              value={clause1Title}
              onChange={(e) => setClause1Title(e.target.value)}
              style={{ marginBottom: '8px', fontSize: '0.875rem' }}
            />
            <label htmlFor="clause1-text" style={{ display: 'block', fontWeight: 700, fontSize: '0.825rem', color: 'var(--muted)', marginBottom: '4px' }}>
              Clause 1 Wording
            </label>
            <textarea
              id="clause1-text"
              className="input-field"
              rows={2}
              value={clause1Text}
              onChange={(e) => setClause1Text(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            />
          </div>

          {/* Clause 2 */}
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.6)', border: '1px solid var(--glass-border)' }}>
            <label htmlFor="clause2-title" style={{ display: 'block', fontWeight: 700, fontSize: '0.825rem', color: 'var(--primary)', marginBottom: '4px' }}>
              Clause 2 Title
            </label>
            <input
              id="clause2-title"
              type="text"
              className="input-field"
              value={clause2Title}
              onChange={(e) => setClause2Title(e.target.value)}
              style={{ marginBottom: '8px', fontSize: '0.875rem' }}
            />
            <label htmlFor="clause2-text" style={{ display: 'block', fontWeight: 700, fontSize: '0.825rem', color: 'var(--muted)', marginBottom: '4px' }}>
              Clause 2 Wording
            </label>
            <textarea
              id="clause2-text"
              className="input-field"
              rows={2}
              value={clause2Text}
              onChange={(e) => setClause2Text(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            />
          </div>

          {/* Clause 3 */}
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.6)', border: '1px solid var(--glass-border)' }}>
            <label htmlFor="clause3-title" style={{ display: 'block', fontWeight: 700, fontSize: '0.825rem', color: 'var(--primary)', marginBottom: '4px' }}>
              Clause 3 Title (Medical Authorization)
            </label>
            <input
              id="clause3-title"
              type="text"
              className="input-field"
              value={clause3Title}
              onChange={(e) => setClause3Title(e.target.value)}
              style={{ marginBottom: '8px', fontSize: '0.875rem' }}
            />
            <label htmlFor="clause3-text" style={{ display: 'block', fontWeight: 700, fontSize: '0.825rem', color: 'var(--muted)', marginBottom: '4px' }}>
              Clause 3 Wording
            </label>
            <textarea
              id="clause3-text"
              className="input-field"
              rows={2}
              value={clause3Text}
              onChange={(e) => setClause3Text(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            />
          </div>

          {/* Clause 4 */}
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.6)', border: '1px solid var(--glass-border)' }}>
            <label htmlFor="clause4-title" style={{ display: 'block', fontWeight: 700, fontSize: '0.825rem', color: 'var(--primary)', marginBottom: '4px' }}>
              Clause 4 Title
            </label>
            <input
              id="clause4-title"
              type="text"
              className="input-field"
              value={clause4Title}
              onChange={(e) => setClause4Title(e.target.value)}
              style={{ marginBottom: '8px', fontSize: '0.875rem' }}
            />
            <label htmlFor="clause4-text" style={{ display: 'block', fontWeight: 700, fontSize: '0.825rem', color: 'var(--muted)', marginBottom: '4px' }}>
              Clause 4 Wording
            </label>
            <textarea
              id="clause4-text"
              className="input-field"
              rows={2}
              value={clause4Text}
              onChange={(e) => setClause4Text(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            />
          </div>

          {/* Clause 5 */}
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.6)', border: '1px solid var(--glass-border)' }}>
            <label htmlFor="clause5-title" style={{ display: 'block', fontWeight: 700, fontSize: '0.825rem', color: 'var(--primary)', marginBottom: '4px' }}>
              Clause 5 Title
            </label>
            <input
              id="clause5-title"
              type="text"
              className="input-field"
              value={clause5Title}
              onChange={(e) => setClause5Title(e.target.value)}
              style={{ marginBottom: '8px', fontSize: '0.875rem' }}
            />
            <label htmlFor="clause5-text" style={{ display: 'block', fontWeight: 700, fontSize: '0.825rem', color: 'var(--muted)', marginBottom: '4px' }}>
              Clause 5 Wording
            </label>
            <textarea
              id="clause5-text"
              className="input-field"
              rows={2}
              value={clause5Text}
              onChange={(e) => setClause5Text(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            />
          </div>

          {/* Special Instructions */}
          <div>
            <label htmlFor="special-instructions" style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', color: 'var(--foreground)', marginBottom: '6px' }}>
              Special Instructions / Venue Rules (Optional)
            </label>
            <textarea
              id="special-instructions"
              className="input-field"
              rows={2}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="e.g. Call time is 8:00 AM at St. Peter Parish. Formal choir uniform required."
              style={{ fontSize: '0.85rem' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '10px 20px', fontSize: '0.875rem' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ padding: '10px 24px', fontSize: '0.875rem', fontWeight: 700 }}
            >
              {loading ? (isCreating ? 'Generating Combined PDF…' : 'Saving Clauses…') : isCreating ? '⚡ Generate & Create Waiver' : '💾 Save Waiver Clauses'}
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
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}
      onClick={onClose}
    >
      <div
        className="glass-container docs-modal-container"
        style={{ width: '96%', maxWidth: '920px', height: '90vh', maxHeight: '820px', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', borderRadius: '16px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', background: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(11,77,36,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{document.title}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {signedUrl && (
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>↗ Open PDF</span>
              </a>
            )}
            <button onClick={onClose} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: 700 }}>
              ✕ Close
            </button>
          </div>
        </div>

        {/* Modal Viewer Body */}
        <div style={{ flex: 1, padding: '12px', background: 'rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', gap: '10px', minHeight: '300px' }}>
              <div style={{ width: '24px', height: '24px', border: '3px solid rgba(11,77,36,0.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span>Loading secure PDF preview…</span>
            </div>
          ) : errorMsg ? (
            <div className="alert alert-error" style={{ margin: 'auto' }}>{errorMsg}</div>
          ) : (
            <PdfCanvasViewer url={signedUrl!} title={document.title} height="100%" />
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
  const [assignedMemberIds, setAssignedMemberIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getDocumentRecipientsAction(document.id).then((res) => {
      if (res.recipients) {
        setAssignedMemberIds(new Set(res.recipients.map((r) => r.memberId)));
      }
    });
  }, [document.id]);

  const filteredMembers = useMemo(() => {
    const q = search.toLowerCase();
    return members.filter(
      (m) => m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [members, search]);

  const under18Members = useMemo(() => members.filter((m) => isUnder18(m.birthdate)), [members]);
  const unassignedMembers = useMemo(() => members.filter((m) => !assignedMemberIds.has(m.id)), [members, assignedMemberIds]);

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

  const handleSelectUnassigned = () => {
    setSelectedIds(new Set(unassignedMembers.map((m) => m.id)));
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

          {errorMsg && (
            <div className="alert alert-error" style={{ marginTop: '14px', fontSize: '0.85rem' }}>
              {errorMsg}
            </div>
          )}
        </div>

        {/* Search & Bulk Select Toolbar */}
        <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--glass-border)', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Search member name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '0.9rem' }}
            />
          </div>
          {unassignedMembers.length > 0 && assignedMemberIds.size > 0 && (
            <button
              onClick={handleSelectUnassigned}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--primary)', fontWeight: 700 }}
              type="button"
            >
              ➕ Unassigned ({unassignedMembers.length})
            </button>
          )}
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
                const isAlreadyAssigned = assignedMemberIds.has(m.id);
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.full_name}
                        </span>
                        {isAlreadyAssigned && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(37,99,235,0.1)', color: '#2563eb', whiteSpace: 'nowrap' }}>
                            Already Assigned
                          </span>
                        )}
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

// ─── Track Recipients & Submission Status Modal ──────────────────────────────

interface TrackRecipientsModalProps {
  document: DocumentRow;
  onClose: () => void;
  onOpenDistribute?: () => void;
}

const TrackRecipientsModal = ({ document, onClose, onOpenDistribute }: TrackRecipientsModalProps) => {
  const { addToast } = useToast();
  const router = useRouter();
  const [recipients, setRecipients] = useState<RecipientInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'submitted' | 'verified'>('pending');
  const [search, setSearch] = useState('');
  const [remindingAll, setRemindingAll] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);

  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    const res = await getDocumentRecipientsAction(document.id);
    setLoading(false);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setRecipients(res.recipients || []);
    }
  }, [document.id]);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  const pendingList = useMemo(() => recipients.filter((r) => r.status === 'pending'), [recipients]);
  const submittedList = useMemo(() => recipients.filter((r) => r.status === 'submitted'), [recipients]);
  const verifiedList = useMemo(
    () => recipients.filter((r) => r.status === 'verified' || r.status === 'verified_manual'),
    [recipients]
  );
  const rejectedList = useMemo(() => recipients.filter((r) => r.status === 'rejected'), [recipients]);

  const totalCount = recipients.length;
  const completedCount = submittedList.length + verifiedList.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const filteredRecipients = useMemo(() => {
    let list = recipients;
    if (activeTab === 'pending') list = pendingList;
    else if (activeTab === 'submitted') list = submittedList;
    else if (activeTab === 'verified') list = verifiedList;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.fullName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.voicePart && r.voicePart.toLowerCase().includes(q))
      );
    }
    return list;
  }, [recipients, activeTab, pendingList, submittedList, verifiedList, search]);

  const handleRemindAll = async () => {
    if (pendingList.length === 0) return;
    setRemindingAll(true);
    const res = await sendWaiverReminderAction({
      documentId: document.id,
      documentTitle: document.title,
    });
    setRemindingAll(false);
    if (res.error) {
      addToast({ type: 'error', title: 'Reminder Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Reminders Sent!',
        message: res.message || `Notified ${res.count} members who haven't submitted yet.`,
      });
    }
  };

  const handleRemindSingle = async (memberId: string, memberName: string) => {
    setRemindingId(memberId);
    const res = await sendWaiverReminderAction({
      documentId: document.id,
      documentTitle: document.title,
      memberIds: [memberId],
    });
    setRemindingId(null);
    if (res.error) {
      addToast({ type: 'error', title: 'Reminder Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Reminder Sent',
        message: `Notified ${memberName} to sign their waiver.`,
      });
    }
  };

  const getVoiceColor = (voice: string | null) => {
    switch (voice) {
      case 'Soprano':
        return '#6366f1';
      case 'Alto':
        return '#7c3aed';
      case 'Tenor':
        return '#0ea5e9';
      case 'Bass':
        return '#0b4d24';
      default:
        return 'var(--muted)';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-container docs-modal-container"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden',
          borderRadius: '20px',
          background: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '24px 28px 18px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.8)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'rgba(11,77,36,0.1)',
                    color: 'var(--primary)',
                  }}
                >
                  <Users size={16} />
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
                  Waiver Submission Tracker
                </h3>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--muted)', margin: 0, fontStyle: 'italic' }}>
                "{document.title}"
              </p>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Progress Bar & Summary Stats */}
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.825rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>
                Overall Submission Progress
              </span>
              <span style={{ fontWeight: 800, color: completionRate === 100 ? 'var(--primary)' : '#d97706' }}>
                {completedCount} of {totalCount} Submitted ({completionRate}%)
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: '8px', borderRadius: '999px', background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${completionRate}%`,
                  height: '100%',
                  background: completionRate === 100 ? 'var(--primary)' : 'linear-gradient(90deg, #d97706, #0b4d24)',
                  borderRadius: '999px',
                  transition: 'width 0.5s ease',
                }}
              />
            </div>

            {/* Quick Stat Pill Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '14px' }}>
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: activeTab === 'pending' ? 'rgba(217,119,6,0.12)' : 'rgba(0,0,0,0.03)',
                  border: activeTab === 'pending' ? '1.5px solid #d97706' : '1px solid var(--glass-border)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => setActiveTab('pending')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d97706', fontSize: '0.78rem', fontWeight: 700 }}>
                  <Clock size={14} /> Not Submitted
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
                  {pendingList.length}
                </div>
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: activeTab === 'submitted' ? 'rgba(37,99,235,0.12)' : 'rgba(0,0,0,0.03)',
                  border: activeTab === 'submitted' ? '1.5px solid #2563eb' : '1px solid var(--glass-border)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => setActiveTab('submitted')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2563eb', fontSize: '0.78rem', fontWeight: 700 }}>
                  <Send size={14} /> Submitted
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>
                  {submittedList.length}
                </div>
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: activeTab === 'verified' ? 'rgba(11,77,36,0.12)' : 'rgba(0,0,0,0.03)',
                  border: activeTab === 'verified' ? '1.5px solid var(--primary)' : '1px solid var(--glass-border)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => setActiveTab('verified')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 700 }}>
                  <CheckCircle2 size={14} /> Verified
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
                  {verifiedList.length}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar (Search & Actions) */}
        <div
          style={{
            padding: '12px 28px',
            background: '#fafafa',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}
            />
            <input
              type="text"
              placeholder="Search member by name, voice, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: '#ffffff',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {pendingList.length > 0 && (
              <button
                type="button"
                onClick={handleRemindAll}
                disabled={remindingAll}
                className="btn btn-primary"
                style={{
                  padding: '7px 14px',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#d97706',
                  borderColor: '#d97706',
                }}
                title="Send notification to all members who have not submitted yet"
              >
                <Bell size={14} />
                {remindingAll ? 'Reminding...' : `Remind Unsubmitted (${pendingList.length})`}
              </button>
            )}

            {onOpenDistribute && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDistribute();
                }}
                className="btn btn-secondary"
                style={{ padding: '7px 12px', fontSize: '0.825rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Send size={13} /> Distribute More
              </button>
            )}
          </div>
        </div>

        {/* Recipients List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
              <div className="spinner" style={{ width: '28px', height: '28px', margin: '0 auto 12px' }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Loading recipient submission status...</p>
            </div>
          ) : errorMsg ? (
            <div className="alert alert-error" style={{ fontSize: '0.875rem' }}>
              {errorMsg}
            </div>
          ) : totalCount === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'rgba(0,0,0,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  color: 'var(--muted)',
                }}
              >
                <Users size={28} />
              </div>
              <h4 style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--foreground)' }}>
                No Members Assigned Yet
              </h4>
              <p style={{ margin: '0 0 16px', fontSize: '0.875rem' }}>
                This waiver has not been distributed to any choir members.
              </p>
              {onOpenDistribute && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenDistribute();
                  }}
                  className="btn btn-primary"
                  style={{ fontSize: '0.875rem' }}
                >
                  <Send size={14} style={{ marginRight: '6px' }} /> Distribute Waiver Now
                </button>
              )}
            </div>
          ) : filteredRecipients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                {activeTab === 'pending'
                  ? '🎉 Great news! All assigned members have submitted this waiver!'
                  : 'No recipients match the selected filter or search.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredRecipients.map((recipient) => {
                const isPending = recipient.status === 'pending';
                const isSubmitted = recipient.status === 'submitted';
                const isVerified = recipient.status === 'verified' || recipient.status === 'verified_manual';
                const isRejected = recipient.status === 'rejected';

                const voiceColor = getVoiceColor(recipient.voicePart);

                return (
                  <div
                    key={recipient.signatureId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: isPending ? 'rgba(217,119,6,0.03)' : '#ffffff',
                      border: isPending ? '1px solid rgba(217,119,6,0.25)' : '1px solid var(--glass-border)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                  >
                    {/* Member Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: `${voiceColor}15`,
                          color: voiceColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.9rem',
                          flexShrink: 0,
                          border: `1px solid ${voiceColor}30`,
                        }}
                      >
                        {recipient.fullName.charAt(0).toUpperCase()}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--foreground)' }}>
                            {recipient.fullName}
                          </span>
                          {recipient.voicePart && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: `${voiceColor}15`,
                                color: voiceColor,
                              }}
                            >
                              {recipient.voicePart}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>
                          {recipient.email || 'No email registered'}
                        </div>
                      </div>
                    </div>

                    {/* Status & Action */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      {isPending && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(217,119,6,0.15)',
                              color: '#b45309',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Clock size={12} /> Not Submitted
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemindSingle(recipient.memberId, recipient.fullName)}
                            disabled={remindingId === recipient.memberId}
                            className="btn btn-secondary"
                            style={{
                              padding: '5px 10px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#b45309',
                              borderColor: 'rgba(217,119,6,0.3)',
                            }}
                            title={`Remind ${recipient.fullName}`}
                          >
                            <Bell size={12} />
                            {remindingId === recipient.memberId ? 'Sending...' : 'Remind'}
                          </button>
                        </div>
                      )}

                      {isSubmitted && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(37,99,235,0.12)',
                              color: '#1d4ed8',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Send size={12} /> Submitted
                          </span>

                          <button
                            type="button"
                            onClick={() => router.push('/admin/verifications')}
                            className="btn btn-secondary"
                            style={{
                              padding: '5px 10px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#1d4ed8',
                            }}
                          >
                            Review →
                          </button>
                        </div>
                      )}

                      {isVerified && (
                        <span
                          className="badge"
                          style={{
                            background: 'rgba(11,77,36,0.12)',
                            color: 'var(--primary)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle2 size={12} /> Verified
                        </span>
                      )}

                      {isRejected && (
                        <span
                          className="badge"
                          style={{
                            background: 'rgba(239,68,68,0.12)',
                            color: '#dc2626',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          Rejected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 28px',
            borderTop: '1px solid var(--glass-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.9)',
          }}
        >
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>
            {filteredRecipients.length} of {totalCount} member{totalCount !== 1 ? 's' : ''} shown
          </span>
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '7px 18px', fontSize: '0.85rem' }}>
            Close
          </button>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Folder name is required.'); return; }

    setLoading(true);
    setError('');

    const res = await createFolderAction({ name, description, icon: '📁', color: '#0b4d24' });
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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15,23,42,0.5)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-container"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '28px',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(11,77,36,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)' }}>
                Create New Folder
              </h3>
              <span style={{ fontSize: '0.825rem', color: 'var(--muted)' }}>
                Organize documents &amp; waivers for choir members
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.2rem',
              color: 'var(--muted)',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          {/* Folder Name Input */}
          <div style={{ marginBottom: '16px', width: '100%' }}>
            <label
              htmlFor="folder-name-input"
              style={{
                display: 'block',
                width: '100%',
                fontWeight: 600,
                fontSize: '0.875rem',
                color: 'var(--foreground)',
                marginBottom: '6px',
              }}
            >
              Folder Name *
            </label>
            <input
              id="folder-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Choir Recollection 2026"
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                background: '#ffffff',
                fontSize: '0.925rem',
                color: 'var(--foreground)',
                outline: 'none',
              }}
            />
          </div>

          {/* Description Input */}
          <div style={{ marginBottom: '24px', width: '100%' }}>
            <label
              htmlFor="folder-desc-input"
              style={{
                display: 'block',
                width: '100%',
                fontWeight: 600,
                fontSize: '0.875rem',
                color: 'var(--foreground)',
                marginBottom: '6px',
              }}
            >
              Description (Optional)
            </label>
            <input
              id="folder-desc-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Activity waivers & schedules"
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                background: '#ffffff',
                fontSize: '0.925rem',
                color: 'var(--foreground)',
                outline: 'none',
              }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '8px 16px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                padding: '8px 20px',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {loading ? 'Creating…' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── File Action Three-Dot Dropdown Menu ─────────────────────────────────────

const FileActionMenu = ({
  doc,
  onPreview,
  onRename,
  onMove,
  onDistribute,
  onTrackRecipients,
  onCreateWaiver,
  onEditWaiver,
  onDelete,
}: {
  doc: DocumentRow;
  onPreview: () => void;
  onRename: () => void;
  onMove: () => void;
  onDistribute: () => void;
  onTrackRecipients: () => void;
  onCreateWaiver: () => void;
  onEditWaiver: () => void;
  onDelete: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!open && e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      const menuWidth = 180;
      const menuHeight = 250;

      let left = rect.right - menuWidth;
      if (left < 12) left = 12;
      if (left + menuWidth > window.innerWidth - 12) {
        left = window.innerWidth - menuWidth - 12;
      }

      let top = rect.bottom + 4;
      if (top + menuHeight > window.innerHeight && rect.top - menuHeight > 0) {
        top = rect.top - menuHeight - 4;
      }

      setMenuPos({ top, left });
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleScroll = () => {
      if (open) setOpen(false);
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, { capture: true });
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [open]);

  const dropdownMenu = open && menuPos ? (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: `${menuPos.top}px`,
        left: `${menuPos.left}px`,
        zIndex: 99999,
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
        width: '185px',
        overflow: 'hidden',
        padding: '4px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => { setOpen(false); onPreview(); }}
        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <Eye size={15} style={{ color: 'var(--primary)' }} /> Preview
      </button>

      {doc.type === 'activity_waiver' ? (
        <button
          type="button"
          onClick={() => { setOpen(false); onEditWaiver(); }}
          style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'rgba(11,77,36,0.06)', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Sparkles size={15} style={{ color: 'var(--primary)' }} /> Edit Waiver Clauses
        </button>
      ) : (
        <button
          type="button"
          onClick={() => { setOpen(false); onCreateWaiver(); }}
          style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'rgba(197,160,89,0.12)', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Sparkles size={15} style={{ color: 'var(--accent)' }} /> Create Waiver
        </button>
      )}

      <button
        type="button"
        onClick={() => { setOpen(false); onRename(); }}
        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <Pencil size={15} style={{ color: 'var(--accent)' }} /> Rename
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); onMove(); }}
        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <Folder size={15} style={{ color: '#2563eb' }} /> Move
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); onDistribute(); }}
        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <Send size={15} style={{ color: 'var(--primary)' }} /> Distribute
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); onTrackRecipients(); }}
        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'rgba(37,99,235,0.06)', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: '#1d4ed8', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <Users size={15} style={{ color: '#1d4ed8' }} /> Track Submissions
      </button>
      <div style={{ height: '1px', background: 'var(--glass-border)', margin: '4px 0' }} />
      <button
        type="button"
        onClick={() => { setOpen(false); onDelete(); }}
        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--error)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <Trash2 size={15} style={{ color: 'var(--error)' }} /> Delete
      </button>
    </div>
  ) : null;

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        style={{
          background: 'none',
          border: '1px solid var(--glass-border)',
          borderRadius: '8px',
          padding: '4px 10px',
          cursor: 'pointer',
          color: 'var(--foreground)',
          fontSize: '1.1rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
        title="File Options"
      >
        ⋮
      </button>

      {mounted && dropdownMenu && createPortal(dropdownMenu, document.body)}
    </div>
  );
};

// ─── Folder Action Context Menu (Right-Click & Long Press) ────────────────────

const FolderContextMenu = ({
  folder,
  x,
  y,
  onClose,
  onOpen,
  onRename,
  onMove,
  onDelete,
}: {
  folder: FolderItem;
  x: number;
  y: number;
  onClose: () => void;
  onOpen: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const folderMenu = (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: Math.min(x, window.innerWidth - 180),
        top: Math.min(y, window.innerHeight - 220),
        zIndex: 99999,
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
        minWidth: '170px',
        padding: '6px',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ padding: '6px 10px 8px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid rgba(0,0,0,0.06)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Folder size={14} style={{ color: 'var(--accent)' }} /> {folder.name}
      </div>
      <button
        type="button"
        onClick={() => { onClose(); onOpen(); }}
        style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <FolderOpen size={15} style={{ color: 'var(--primary)' }} /> Open Folder
      </button>
      <button
        type="button"
        onClick={() => { onClose(); onRename(); }}
        style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <Pencil size={15} style={{ color: 'var(--accent)' }} /> Rename Folder
      </button>
      <button
        type="button"
        onClick={() => { onClose(); onMove(); }}
        style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <Folder size={15} style={{ color: '#2563eb' }} /> Move Folder
      </button>
      <div style={{ height: '1px', background: 'var(--glass-border)', margin: '4px 0' }} />
      <button
        type="button"
        onClick={() => { onClose(); onDelete(); }}
        style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--error)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <Trash2 size={15} style={{ color: 'var(--error)' }} /> Delete Folder
      </button>
    </div>
  );

  return mounted ? createPortal(folderMenu, document.body) : null;
};

// ─── Rename Folder Modal ─────────────────────────────────────────────────────

const RenameFolderModal = ({
  folder,
  onClose,
  onRenamed,
}: {
  folder: FolderItem;
  onClose: () => void;
  onRenamed: (updated: FolderItem) => void;
}) => {
  const { addToast } = useToast();
  const [name, setName] = useState(folder.name);
  const [description, setDescription] = useState(folder.description || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    const res = await updateFolderAction(folder.id, {
      name: name.trim(),
      description: description.trim(),
      icon: folder.icon,
      color: folder.color,
      parent_id: folder.parent_id,
    });

    setLoading(false);
    if (res.error) {
      addToast({ type: 'error', title: 'Rename Failed', message: res.error });
    } else if (res.folder) {
      addToast({ type: 'success', title: 'Folder Renamed', message: 'Folder updated successfully.' });
      onRenamed(res.folder);
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-container"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '24px',
          borderRadius: '16px',
          background: '#ffffff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--foreground)' }}>
            ✏️ Rename Folder
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--muted)' }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>
              Folder Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Waivers & Contracts"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading || !name.trim()} className="btn btn-primary" style={{ padding: '8px 20px' }}>
              {loading ? 'Saving…' : 'Save Name'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Move Folder Modal ───────────────────────────────────────────────────────

const MoveFolderModal = ({
  folder,
  allFolders,
  onClose,
  onMoved,
}: {
  folder: FolderItem;
  allFolders: FolderItem[];
  onClose: () => void;
  onMoved: (targetParentId: string | null) => void;
}) => {
  const { addToast } = useToast();
  const [selectedParentId, setSelectedParentId] = useState<string>(folder.parent_id || '');
  const [loading, setLoading] = useState(false);

  const availableParents = useMemo(() => {
    return allFolders.filter((f) => f.id !== folder.id);
  }, [allFolders, folder.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const targetParentId = selectedParentId === '' ? null : selectedParentId;

    const res = await moveFolderAction(folder.id, targetParentId);
    setLoading(false);

    if (res.error) {
      addToast({ type: 'error', title: 'Move Failed', message: res.error });
    } else {
      addToast({ type: 'success', title: 'Folder Moved', message: 'Folder directory location updated.' });
      onMoved(targetParentId);
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-container"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '24px',
          borderRadius: '16px',
          background: '#ffffff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--foreground)' }}>
            📁 Move Folder "{folder.name}"
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--muted)' }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>
              Destination Folder Directory
            </label>
            <select
              value={selectedParentId}
              onChange={(e) => setSelectedParentId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#ffffff',
              }}
            >
              <option value="">📁 Root Choir Storage Drive (No Parent)</option>
              {availableParents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  📁 {parent.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '8px 20px' }}>
              {loading ? 'Moving…' : 'Move Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Rename Document Modal ───────────────────────────────────────────────────

const RenameDocumentModal = ({
  document,
  onClose,
  onRenamed,
}: {
  document: DocumentRow;
  onClose: () => void;
  onRenamed: (newTitle: string) => void;
}) => {
  const { addToast } = useToast();
  const [title, setTitle] = useState(document.title);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    setLoading(true);
    setError('');

    const res = await renameDocumentAction(document.id, title.trim());
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      addToast({ type: 'success', title: 'File Renamed', message: `Renamed to "${title.trim()}"` });
      onRenamed(title.trim());
      onClose();
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}
    >
      <div
        className="glass-container"
        style={{ width: '100%', maxWidth: '440px', padding: '28px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)' }}>
          ✏️ Rename File
        </h3>

        {error && <div className="alert alert-error" style={{ marginBottom: '16px', fontSize: '0.85rem' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="rename-title-input" style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '6px' }}>
              New File Name *
            </label>
            <input
              id="rename-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--glass-border)', outline: 'none', fontSize: '0.925rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.875rem' }}>
              {loading ? 'Saving…' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Move Document Modal ─────────────────────────────────────────────────────

const MoveDocumentModal = ({
  document,
  folders,
  onClose,
  onMoved,
}: {
  document: DocumentRow;
  folders: FolderItem[];
  onClose: () => void;
  onMoved: (targetFolderId: string | null) => void;
}) => {
  const { addToast } = useToast();
  const [targetFolderId, setTargetFolderId] = useState<string>(document.folder_id || 'none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const destId = targetFolderId === 'none' ? null : targetFolderId;
    const res = await moveDocumentAction(document.id, destId);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      addToast({ type: 'success', title: 'File Moved', message: `Moved "${document.title}" successfully.` });
      onMoved(destId);
      onClose();
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}
    >
      <div
        className="glass-container"
        style={{ width: '100%', maxWidth: '440px', padding: '28px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)' }}>
          📁 Move File
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--muted)' }}>
          Select destination folder for "{document.title}"
        </p>

        {error && <div className="alert alert-error" style={{ marginBottom: '16px', fontSize: '0.85rem' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="move-folder-select" style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '6px' }}>
              Destination Folder
            </label>
            <select
              id="move-folder-select"
              value={targetFolderId}
              onChange={(e) => setTargetFolderId(e.target.value)}
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--glass-border)', outline: 'none', fontSize: '0.925rem', cursor: 'pointer' }}
            >
              <option value="none">Choir Storage Drive (Root / No Folder)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.875rem' }}>
              {loading ? 'Moving…' : 'Move File'}
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
  const router = useRouter();

  // Real-time sync for documents, folders, and waiver signature statuses
  useRealtimeSync({
    channelName: 'admin-docs-manager-live',
    tables: [
      { table: 'documents' },
      { table: 'document_folders' },
      { table: 'document_signatures' },
    ],
  });

  const [documents, setDocuments] = useState<DocumentRow[]>(initialDocuments);
  const [folders, setFolders] = useState<FolderItem[]>(initialFolders);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [distributeTarget, setDistributeTarget] = useState<DocumentRow | null>(null);
  const [trackingTarget, setTrackingTarget] = useState<DocumentRow | null>(null);
  const [previewTarget, setPreviewTarget] = useState<DocumentRow | null>(null);
  const [renameTarget, setRenameTarget] = useState<DocumentRow | null>(null);
  const [moveTarget, setMoveTarget] = useState<DocumentRow | null>(null);
  const [creatingWaiverTarget, setCreatingWaiverTarget] = useState<DocumentRow | null>(null);
  const [editingWaiverTarget, setEditingWaiverTarget] = useState<DocumentRow | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const currentFolder = useMemo(() => {
    return folders.find((f) => f.id === selectedFolderId) || null;
  }, [folders, selectedFolderId]);

  const displayedFolders = useMemo(() => {
    return folders.filter((f) => f.parent_id === (selectedFolderId || null));
  }, [folders, selectedFolderId]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Filter by folder if not searching, or filter by search query across all
      const matchesFolder = searchQuery.trim()
        ? true
        : selectedFolderId === null
        ? !doc.folder_id
        : doc.folder_id === selectedFolderId;

      const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFolder && matchesSearch;
    });
  }, [documents, selectedFolderId, searchQuery]);

  const [isDraggingOverPage, setIsDraggingOverPage] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);

  const [folderContextMenu, setFolderContextMenu] = useState<{ folder: FolderItem; x: number; y: number } | null>(null);
  const [renameFolderTarget, setRenameFolderTarget] = useState<FolderItem | null>(null);
  const [moveFolderTarget, setMoveFolderTarget] = useState<FolderItem | null>(null);
  const [deleteFolderTargetId, setDeleteFolderTargetId] = useState<string | null>(null);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStartFolder = (folder: FolderItem, e: React.TouchEvent) => {
    const touch = e.touches[0];
    const posX = touch.clientX;
    const posY = touch.clientY;
    longPressTimerRef.current = setTimeout(() => {
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
      setFolderContextMenu({ folder, x: posX, y: posY });
    }, 500);
  };

  const handleTouchEndFolder = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleConfirmDeleteFolder = async () => {
    if (!deleteFolderTargetId) return;
    const id = deleteFolderTargetId;
    setDeleteFolderTargetId(null);

    const res = await deleteFolderAction(id);
    if (res.error) {
      addToast({ type: 'error', title: 'Delete Failed', message: res.error });
    } else {
      setFolders((prev) => prev.filter((f) => f.id !== id));
      if (selectedFolderId === id) setSelectedFolderId(null);
      addToast({ type: 'success', title: 'Folder Deleted', message: 'Folder removed successfully.' });
    }
  };

  const handlePageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOverPage(true);
    }
  };

  const handlePageDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOverPage(false);
  };

  const handlePageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverPage(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setShowUpload(true);
    }
  };

  const handleDropOnFolder = async (folderId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const docId = e.dataTransfer.getData('text/plain') || draggedDocId;
    if (!docId) return;

    setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, folder_id: folderId } : d)));
    const res = await moveDocumentAction(docId, folderId);
    if (res.error) {
      addToast({ type: 'error', title: 'Move Failed', message: res.error });
    } else {
      addToast({ type: 'success', title: 'File Moved', message: 'Document moved into folder.' });
    }
    setDraggedDocId(null);
  };

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
      addToast({ type: 'success', title: 'Document Deleted', message: 'Document removed from storage.' });
    }
  };

  return (
    <div
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}
    >
      {/* Drag and Drop File Upload Overlay */}
      {isDraggingOverPage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'rgba(11, 77, 36, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              padding: '40px',
              borderRadius: '24px',
              border: '3px dashed rgba(255,255,255,0.8)',
              textAlign: 'center',
              maxWidth: '440px',
            }}
          >
            <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>📥</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 8px' }}>
              Drop Files to Upload
            </h2>
            <p style={{ margin: 0, opacity: 0.9, fontSize: '0.95rem' }}>
              Release your files to upload directly into {currentFolder ? `"${currentFolder.name}"` : 'Choir Storage Drive'}.
            </p>
          </div>
        </div>
      )}
      <div className="bg-orb bg-orb-1" style={{ width: '450px', height: '450px' }} />
      <div className="bg-orb bg-orb-2" style={{ width: '400px', height: '400px' }} />

      <Navbar profile={currentUserProfile} />

      <main className="admin-content-full" style={{ flex: 1, maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
              Document &amp; Waiver Storage Explorer
            </h1>
            <p style={{ color: 'var(--muted)', margin: '4px 0 0', fontSize: '0.95rem' }}>
              Manage choir folders, waivers, guides, and distribute files to members.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowCreateFolder(true)}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
              <span>New Folder</span>
            </button>

            <button
              onClick={() => setShowUpload(true)}
              className="btn btn-primary docs-desktop-create"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Upload Document
            </button>
          </div>
        </div>

        {/* Windows Explorer Storage Container */}
        <div className="glass-container" style={{ padding: '20px', borderRadius: '16px', marginBottom: '32px' }}>
          {/* Windows Explorer Navigation Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', paddingBottom: '16px', marginBottom: '16px', borderBottom: '1px solid var(--glass-border)' }}>
            {/* Breadcrumb Path */}
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

            {/* Search Bar & View Mode Switcher */}
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
                >
                  List
                </button>
              </div>
            </div>
          </div>

          {/* Back button if inside subfolder */}
          {selectedFolderId !== null && (
            <button
              type="button"
              onClick={() => setSelectedFolderId(currentFolder?.parent_id || null)}
              className="btn btn-secondary"
              style={{ marginBottom: '16px', fontSize: '0.825rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <span>← Back to Parent Storage</span>
            </button>
          )}

          {/* Folders Section (Windows Explorer Style Yellow Folder Cards) */}
          {displayedFolders.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '12px', fontWeight: 700 }}>
                Storage Folders ({displayedFolders.length})
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
                {displayedFolders.map((folder) => {
                  const fileCount = documents.filter((d) => d.folder_id === folder.id).length;
                  const isHovered = dragOverFolderId === folder.id;
                  return (
                    <div
                      key={folder.id}
                      onClick={() => setSelectedFolderId(folder.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setFolderContextMenu({ folder, x: e.clientX, y: e.clientY });
                      }}
                      onTouchStart={(e) => handleTouchStartFolder(folder, e)}
                      onTouchMove={handleTouchEndFolder}
                      onTouchEnd={handleTouchEndFolder}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverFolderId(folder.id);
                      }}
                      onDragLeave={() => setDragOverFolderId(null)}
                      onDrop={(e) => handleDropOnFolder(folder.id, e)}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: isHovered ? '2px dashed var(--primary)' : '1px solid var(--glass-border)',
                        background: isHovered ? 'rgba(11,77,36,0.1)' : 'rgba(255,255,255,0.85)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isHovered ? '0 4px 14px rgba(11,77,36,0.2)' : '0 2px 8px rgba(0,0,0,0.03)',
                        transform: isHovered ? 'scale(1.02)' : 'none',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                      }}
                      title="Right click or long press for options"
                    >
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          background: 'rgba(197,160,89,0.15)',
                          color: 'var(--accent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.925rem', color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {folder.name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>
                          {isHovered ? 'Drop file to move here 📥' : `${fileCount} file${fileCount !== 1 ? 's' : ''}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Documents Section */}
          <div>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '12px', fontWeight: 700 }}>
              Files ({filteredDocuments.length})
            </div>

            {filteredDocuments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', background: 'rgba(0,0,0,0.02)', borderRadius: '12px' }}>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>No files found in this directory.</p>
              </div>
            ) : viewMode === 'grid' ? (
              /* Grid / Tile View */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', doc.id);
                      setDraggedDocId(doc.id);
                    }}
                    onDragEnd={() => setDraggedDocId(null)}
                    style={{
                      padding: '16px',
                      borderRadius: '14px',
                      border: '1px solid var(--glass-border)',
                      background: '#ffffff',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '14px',
                      cursor: 'grab',
                      opacity: draggedDocId === doc.id ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: 'rgba(11,77,36,0.1)',
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          title={doc.title}
                          style={{
                            fontWeight: 700,
                            fontSize: '0.925rem',
                            color: 'var(--foreground)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            lineHeight: 1.3,
                          }}
                        >
                          {doc.title}
                        </div>
                        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            className="badge"
                            style={{
                              background: DOC_TYPE_COLORS[doc.type],
                              color: DOC_TYPE_TEXT[doc.type],
                              fontSize: '0.725rem',
                              fontWeight: 700,
                            }}
                          >
                            {DOC_TYPE_LABELS[doc.type]}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.05)', gap: '6px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => setPreviewTarget(doc)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                          title="Preview File"
                        >
                          <Eye size={13} /> Preview
                        </button>
                        {(doc.type === 'activity_waiver' || doc.type === 'wedding_waiver') && (
                          <button
                            onClick={() => setTrackingTarget(doc)}
                            className="btn btn-secondary"
                            style={{
                              padding: '6px 10px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                              color: '#1d4ed8',
                              borderColor: 'rgba(37,99,235,0.3)',
                              background: 'rgba(37,99,235,0.05)',
                            }}
                            title="View who has signed and who hasn't submitted yet"
                          >
                            <Users size={13} /> Tracker
                          </button>
                        )}
                      </div>

                      <FileActionMenu
                        doc={doc}
                        onPreview={() => setPreviewTarget(doc)}
                        onRename={() => setRenameTarget(doc)}
                        onMove={() => setMoveTarget(doc)}
                        onDistribute={() => setDistributeTarget(doc)}
                        onTrackRecipients={() => setTrackingTarget(doc)}
                        onCreateWaiver={() => setCreatingWaiverTarget(doc)}
                        onEditWaiver={() => setEditingWaiverTarget(doc)}
                        onDelete={() => setDeleteTargetId(doc.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* List / Details View */
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
                    {filteredDocuments.map((doc) => (
                      <tr
                        key={doc.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', doc.id);
                          setDraggedDocId(doc.id);
                        }}
                        onDragEnd={() => setDraggedDocId(null)}
                        style={{ opacity: draggedDocId === doc.id ? 0.5 : 1, cursor: 'grab' }}
                      >
                        <td data-label="Document">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                            <span
                              title={doc.title}
                              style={{
                                fontWeight: 600,
                                fontSize: '0.925rem',
                                color: 'var(--foreground)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'inline-block',
                                maxWidth: '240px',
                              }}
                            >
                              {doc.title}
                            </span>
                          </div>
                        </td>
                        <td data-label="Type">
                          <span className="badge" style={{ background: DOC_TYPE_COLORS[doc.type], color: DOC_TYPE_TEXT[doc.type], fontWeight: 600, fontSize: '0.75rem' }}>
                            {DOC_TYPE_LABELS[doc.type]}
                          </span>
                        </td>
                        <td data-label="Uploaded By">
                          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                            {(doc.profiles as any)?.full_name || 'Admin'}
                          </span>
                        </td>
                        <td data-label="Expires">
                          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                            {doc.expires_at ? new Date(doc.expires_at).toLocaleDateString() : 'No expiry'}
                          </span>
                        </td>
                        <td data-label="Actions">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              onClick={() => setPreviewTarget(doc)}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.78rem', cursor: 'pointer' }}
                            >
                              Preview
                            </button>
                            {(doc.type === 'activity_waiver' || doc.type === 'wedding_waiver') && (
                              <button
                                onClick={() => setTrackingTarget(doc)}
                                className="btn btn-secondary"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  color: '#1d4ed8',
                                  borderColor: 'rgba(37,99,235,0.3)',
                                  background: 'rgba(37,99,235,0.05)',
                                }}
                                title="Submission Tracker"
                              >
                                Tracker
                              </button>
                            )}
                            <FileActionMenu
                              doc={doc}
                              onPreview={() => setPreviewTarget(doc)}
                              onRename={() => setRenameTarget(doc)}
                              onMove={() => setMoveTarget(doc)}
                              onDistribute={() => setDistributeTarget(doc)}
                              onTrackRecipients={() => setTrackingTarget(doc)}
                              onCreateWaiver={() => setCreatingWaiverTarget(doc)}
                              onEditWaiver={() => setEditingWaiverTarget(doc)}
                              onDelete={() => setDeleteTargetId(doc.id)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
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

      {renameTarget && (
        <RenameDocumentModal
          document={renameTarget}
          onClose={() => setRenameTarget(null)}
          onRenamed={(newTitle) => {
            setDocuments((prev) => prev.map((d) => (d.id === renameTarget.id ? { ...d, title: newTitle } : d)));
          }}
        />
      )}

      {moveTarget && (
        <MoveDocumentModal
          document={moveTarget}
          folders={folders}
          onClose={() => setMoveTarget(null)}
          onMoved={(newFolderId) => {
            setDocuments((prev) => prev.map((d) => (d.id === moveTarget.id ? { ...d, folder_id: newFolderId } : d)));
          }}
        />
      )}

      {folderContextMenu && (
        <FolderContextMenu
          folder={folderContextMenu.folder}
          x={folderContextMenu.x}
          y={folderContextMenu.y}
          onClose={() => setFolderContextMenu(null)}
          onOpen={() => setSelectedFolderId(folderContextMenu.folder.id)}
          onRename={() => setRenameFolderTarget(folderContextMenu.folder)}
          onMove={() => setMoveFolderTarget(folderContextMenu.folder)}
          onDelete={() => setDeleteFolderTargetId(folderContextMenu.folder.id)}
        />
      )}

      {renameFolderTarget && (
        <RenameFolderModal
          folder={renameFolderTarget}
          onClose={() => setRenameFolderTarget(null)}
          onRenamed={(updated) => {
            setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
          }}
        />
      )}

      {moveFolderTarget && (
        <MoveFolderModal
          folder={moveFolderTarget}
          allFolders={folders}
          onClose={() => setMoveFolderTarget(null)}
          onMoved={(newParentId) => {
            setFolders((prev) => prev.map((f) => (f.id === moveFolderTarget.id ? { ...f, parent_id: newParentId } : f)));
          }}
        />
      )}

      {deleteFolderTargetId && (
        <ConfirmModal
          title="Delete Folder"
          message="This will delete this folder. Documents inside this folder will not be erased but will be unlinked back to root storage drive."
          confirmLabel="Yes, Delete Folder"
          isDanger
          onConfirm={handleConfirmDeleteFolder}
          onCancel={() => setDeleteFolderTargetId(null)}
        />
      )}

      {distributeTarget && (
        <DistributeModal
          document={distributeTarget}
          members={initialMembers}
          sequences={initialSequences}
          onClose={() => setDistributeTarget(null)}
          onDistributed={() => {
            setDistributeTarget(null);
            router.refresh();
          }}
        />
      )}

      {trackingTarget && (
        <TrackRecipientsModal
          document={trackingTarget}
          onClose={() => setTrackingTarget(null)}
          onOpenDistribute={() => {
            setDistributeTarget(trackingTarget);
            setTrackingTarget(null);
          }}
        />
      )}

      {creatingWaiverTarget && (
        <WaiverEditorModal
          document={creatingWaiverTarget}
          isCreating
          onClose={() => setCreatingWaiverTarget(null)}
          onSaved={(createdDocOrId, newTitle) => {
            setCreatingWaiverTarget(null);
            if (typeof createdDocOrId === 'object') {
              setDocuments((prev) => prev.map((d) => (d.id === createdDocOrId.id ? createdDocOrId : d)));
            }
            router.refresh();
            addToast({ type: 'success', title: 'Activity Waiver Created', message: `"${newTitle}" is now an Activity Waiver with appended consent page.` });
          }}
        />
      )}

      {editingWaiverTarget && (
        <WaiverEditorModal
          document={editingWaiverTarget}
          isCreating={false}
          onClose={() => setEditingWaiverTarget(null)}
          onSaved={(docId, updatedTitle) => {
            setEditingWaiverTarget(null);
            setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, title: updatedTitle } : d)));
          }}
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
