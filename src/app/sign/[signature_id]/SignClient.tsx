'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  submitSignatureAction,
  retractSignatureAction,
  SignPageData,
} from './actions';

// ─── Types & Constants ────────────────────────────────────────────────────────

interface Props {
  data: SignPageData;
  currentUserProfile: {
    id: string;
    full_name: string;
    role: string;
  };
}

const DOC_TYPE_LABELS: Record<string, string> = {
  activity_waiver: 'Activity Waiver',
  wedding_waiver: 'Wedding Waiver',
  wake_guide: 'Wake Guide',
  general: 'General Document',
};

// Client-side image compression helper (max 1024px width, JPEG 0.8 quality)
async function compressImageFile(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1024;
      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else resolve(file);
        },
        'image/jpeg',
        0.8
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

export const SignClient = ({ data, currentUserProfile }: Props) => {
  const { signature, document: doc, pdfSignedUrl } = data;
  const router = useRouter();
  const { addToast } = useToast();

  // Form State
  const [signerPrintedName, setSignerPrintedName] = useState(
    signature.signer_printed_name || ''
  );
  const [signerRelationship, setSignerRelationship] = useState(
    (signature as any).signer_relationship || 'Parent / Guardian'
  );
  const [hasDependents, setHasDependents] = useState(
    (signature.additional_names && signature.additional_names.length > 0) || false
  );
  const [dependents, setDependents] = useState<string[]>(
    signature.additional_names || []
  );

  // Signature Pad State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Selfie State
  const [selfieFile, setSelfieFile] = useState<Blob | null>(null);
  const [selfiePreviewUrl, setSelfiePreviewUrl] = useState<string | null>(null);
  const selfieInputRef = useRef<HTMLInputElement | null>(null);

  // UI & Action State
  const [submitting, setSubmitting] = useState(false);
  const [retracting, setRetracting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showRetractConfirm, setShowRetractConfirm] = useState(false);

  const isSubmitted = signature.status === 'submitted';
  const isVerified = signature.status === 'verified' || signature.status === 'verified_manual';

  // ─── Signature Pad Handlers (Touch & Mouse with touch-action: none) ─────────

  const startDrawing = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  }, []);

  const draw = useCallback(
    (x: number, y: number) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.lineTo(x, y);
      ctx.stroke();
      setHasSignature(true);
    },
    [isDrawing]
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }, []);

  // Set up Canvas context properties
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set physical resolution matching client rect
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(2, 2);
      ctx.strokeStyle = '#0b4d24'; // Primary forest green stroke
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);

  // Event handlers for Mouse & Touch
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) startDrawing(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) draw(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (touch && rect) startDrawing(touch.clientX - rect.left, touch.clientY - rect.top);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (touch && rect) draw(touch.clientX - rect.left, touch.clientY - rect.top);
  };

  // ─── Selfie Handler ─────────────────────────────────────────────────────────

  const handleSelfieChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file);
      setSelfieFile(compressed);
      const url = URL.createObjectURL(compressed);
      setSelfiePreviewUrl(url);
      setErrorMsg('');
    } catch {
      setErrorMsg('Failed to process camera selfie.');
    }
  };

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (selfiePreviewUrl) URL.revokeObjectURL(selfiePreviewUrl);
    };
  }, [selfiePreviewUrl]);

  // ─── Dependents Handlers ─────────────────────────────────────────────────────

  const handleAddDependent = () => {
    setDependents((prev) => [...prev, '']);
  };

  const handleUpdateDependent = (index: number, val: string) => {
    setDependents((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleRemoveDependent = (index: number) => {
    setDependents((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Capacitor Back-Button Guard ─────────────────────────────────────────────

  useEffect(() => {
    let unlistener: (() => void) | null = null;
    async function setupCapacitorBackGuard() {
      try {
        const { App } = await import('@capacitor/app');
        const handle = await App.addListener('backButton', () => {
          if (submitting) {
            addToast({ type: 'warning', title: 'Uploading Signature', message: 'Please wait, upload in progress…' });
          }
        });
        unlistener = () => handle.remove();
      } catch {
        // Fallback for web browser
      }
    }
    setupCapacitorBackGuard();
    return () => {
      if (unlistener) unlistener();
    };
  }, [submitting, addToast]);

  // ─── Form Submission ─────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signerPrintedName.trim()) {
      setErrorMsg('Printed name of signer is required.');
      return;
    }
    if (!hasSignature || !canvasRef.current) {
      setErrorMsg('Please draw your signature in the signature pad.');
      return;
    }
    if (!selfieFile) {
      setErrorMsg('Selfie verification photo is required.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      // Export signature canvas as PNG Blob
      const sigBlob = await new Promise<Blob | null>((resolve) => {
        canvasRef.current?.toBlob((b) => resolve(b), 'image/png');
      });

      if (!sigBlob) {
        setSubmitting(false);
        setErrorMsg('Failed to capture signature drawing.');
        return;
      }

      // Clean empty dependent names
      const validDependents = dependents.map((d) => d.trim()).filter(Boolean);

      const fd = new FormData();
      fd.append('signatureId', signature.id);
      fd.append('signerPrintedName', signerPrintedName.trim());
      fd.append('signerRelationship', signerRelationship);
      fd.append('additionalNames', JSON.stringify(validDependents));
      fd.append('signatureFile', sigBlob, 'signature.png');
      fd.append('selfieFile', selfieFile, 'selfie.jpg');

      const res = await submitSignatureAction(fd);
      setSubmitting(false);

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        addToast({
          type: 'success',
          title: 'Signature Submitted!',
          message: 'Your document signature has been submitted for director verification.',
        });
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      setSubmitting(false);
      setErrorMsg(err.message || 'An unexpected error occurred while submitting.');
    }
  };

  // ─── Retract Submission ─────────────────────────────────────────────────────

  const handleRetractConfirm = async () => {
    setShowRetractConfirm(false);
    setRetracting(true);
    const res = await retractSignatureAction(signature.id);
    setRetracting(false);

    if (res.error) {
      addToast({ type: 'error', title: 'Retraction Failed', message: res.error });
    } else {
      addToast({ type: 'info', title: 'Signature Retracted', message: 'You can now re-sign the document.' });
      router.refresh();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '450px', height: '450px' }} />
      <div className="bg-orb bg-orb-2" style={{ width: '400px', height: '400px' }} />

      <Navbar profile={currentUserProfile} />

      <main style={{ flex: 1, maxWidth: '800px', margin: '0 auto', width: '100%', padding: '24px 16px 120px' }}>
        {/* Back Link */}
        <div style={{ marginBottom: '18px' }}>
          <Link
            href="/dashboard"
            style={{ fontSize: '0.9rem', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Status Header Banner if submitted or verified */}
        {isSubmitted && (
          <div
            className="alert alert-info"
            style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}
          >
            <div>
              <strong style={{ fontSize: '1rem' }}>✅ Signature Submitted</strong>
              <p style={{ margin: '2px 0 0', fontSize: '0.88rem' }}>
                Your signature has been submitted and is pending admin verification.
              </p>
            </div>
            <button
              onClick={() => setShowRetractConfirm(true)}
              disabled={retracting}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '6px 14px' }}
            >
              {retracting ? 'Retracting…' : 'Retract & Re-sign'}
            </button>
          </div>
        )}

        {isVerified && (
          <div className="alert alert-success" style={{ marginBottom: '24px' }}>
            <strong style={{ fontSize: '1rem' }}>🎉 Signature Verified!</strong>
            <p style={{ margin: '2px 0 0', fontSize: '0.88rem' }}>
              This waiver has been verified by the choir director. No further action is required.
            </p>
          </div>
        )}

        {/* Document Header Card */}
        <div className="glass-container" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <span className="badge" style={{ background: 'rgba(197,160,89,0.18)', color: 'var(--accent)', fontWeight: 700, fontSize: '0.75rem', marginBottom: '8px' }}>
                {DOC_TYPE_LABELS[doc.type] || doc.type}
              </span>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--primary)', margin: '4px 0 0' }}>
                {doc.title}
              </h1>
            </div>
            {doc.expires_at && (
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 500 }}>
                Expires: {new Date(doc.expires_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* PDF Document Viewer Container */}
        <div className="glass-container" style={{ padding: '20px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
              📄 Read Document Template
            </h3>
            {pdfSignedUrl && (
              <a
                href={pdfSignedUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'underline', fontWeight: 600 }}
              >
                Open Full PDF ↗
              </a>
            )}
          </div>

          {pdfSignedUrl ? (
            <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--glass-border)', background: '#ffffff' }}>
              <iframe
                src={pdfSignedUrl}
                className="docs-preview-iframe"
                style={{ width: '100%', height: '420px', minHeight: '300px', border: 'none' }}
                title={doc.title}
              />
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
              PDF preview unavailable. Please proceed to sign below.
            </div>
          )}
        </div>

        {/* Form Error Banner */}
        {errorMsg && (
          <div className="alert alert-error" style={{ marginBottom: '20px' }}>
            {errorMsg}
          </div>
        )}

        {/* Signing Form (Disabled if verified or submitted without retracting) */}
        {!isVerified && !isSubmitted && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Section 1: Signer Printed Name */}
            <div className="glass-container" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', margin: '0 0 14px' }}>
                1. Signer Information
              </h3>

              <div style={{ background: 'rgba(30,58,138,0.06)', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>Choir Member Account</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  👤 {currentUserProfile.full_name}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="input-label" htmlFor="signer-printed-name" style={{ display: 'block', margin: 0, fontWeight: 700 }}>
                  Parent / Legal Guardian / Signer Printed Name *
                </label>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0 0 4px' }}>
                  Please type the full name of the Parent or Legal Guardian (if signing for an underage member), or your own full name if 18+.
                </p>
                <input
                  id="signer-printed-name"
                  type="text"
                  className="input-field"
                  value={signerPrintedName}
                  onChange={(e) => setSignerPrintedName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '14px' }}>
                <label className="input-label" htmlFor="signer-relationship" style={{ display: 'block', margin: 0, fontWeight: 700 }}>
                  Relationship to Member *
                </label>
                <select
                  id="signer-relationship"
                  className="input-field"
                  value={signerRelationship}
                  onChange={(e) => setSignerRelationship(e.target.value)}
                  style={{ cursor: 'pointer' }}
                  required
                >
                  <option value="Parent / Guardian">Parent / Guardian</option>
                  <option value="Mother">Mother</option>
                  <option value="Father">Father</option>
                  <option value="Legal Guardian">Legal Guardian</option>
                  <option value="Self (18+)">Self (18+)</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Section 2: Multi-Dependent Input Form */}
            <div className="glass-container" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                  2. Dependents &amp; Additional Names
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <input
                  type="checkbox"
                  id="hasDependents"
                  checked={hasDependents}
                  onChange={(e) => {
                    setHasDependents(e.target.checked);
                    if (e.target.checked && dependents.length === 0) {
                      setDependents(['']);
                    }
                  }}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <label htmlFor="hasDependents" style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--foreground)', cursor: 'pointer' }}>
                  Are you signing on behalf of any dependents or family members?
                </label>
              </div>

              {hasDependents && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                  {dependents.map((dep, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="input-field"
                        placeholder={`Dependent #${idx + 1} Full Name`}
                        value={dep}
                        onChange={(e) => handleUpdateDependent(idx, e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveDependent(idx)}
                        className="btn btn-secondary"
                        style={{ padding: '10px 14px', color: 'var(--error)', borderColor: 'var(--error)' }}
                        aria-label="Remove dependent"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddDependent}
                    className="btn btn-secondary"
                    style={{ alignSelf: 'flex-start', fontSize: '0.85rem', marginTop: '4px' }}
                  >
                    + Add Another Name
                  </button>
                </div>
              )}
            </div>

            {/* Section 3: Signature Pad Canvas */}
            <div className="glass-container" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                    3. Digital Signature *
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '2px 0 0' }}>
                    Draw your signature inside the box below.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                >
                  Clear Signature
                </button>
              </div>

              {/* Canvas Box with touch-action: none for mobile WebView */}
              <div
                style={{
                  touchAction: 'none',
                  borderRadius: '12px',
                  border: `2px dashed ${hasSignature ? 'var(--primary)' : 'var(--glass-border)'}`,
                  background: '#ffffff',
                  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.03)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={stopDrawing}
                  style={{
                    width: '100%',
                    height: '180px',
                    display: 'block',
                    cursor: 'crosshair',
                    touchAction: 'none',
                  }}
                />
                {!hasSignature && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#a1a1aa',
                      fontSize: '0.9rem',
                      fontStyle: 'italic',
                    }}
                  >
                    Draw signature here with finger or mouse
                  </div>
                )}
              </div>
            </div>

            {/* Section 4: Selfie Photo Capture */}
            <div className="glass-container" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', margin: '0 0 4px' }}>
                4. Selfie Verification Photo *
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0 0 14px' }}>
                Take a quick photo of yourself to verify identity for choir records.
              </p>

              <input
                ref={selfieInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleSelfieChange}
                style={{ display: 'none' }}
                id="selfie-camera-input"
              />

              {!selfiePreviewUrl ? (
                <button
                  type="button"
                  onClick={() => selfieInputRef.current?.click()}
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    padding: '24px',
                    borderRadius: '12px',
                    border: '2px dashed var(--glass-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(255,255,255,0.4)',
                  }}
                >
                  <span style={{ fontSize: '2rem' }}>📸</span>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary)' }}>
                    Take Selfie Photo
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                    Opens front camera on mobile devices
                  </span>
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', borderRadius: '12px', background: 'rgba(11,77,36,0.06)', border: '1px solid rgba(11,77,36,0.15)' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden', position: 'relative', flexShrink: 0, border: '2px solid var(--primary)' }}>
                    <Image src={selfiePreviewUrl} alt="Selfie preview" fill style={{ objectFit: 'cover' }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)', margin: 0 }}>
                      ✓ Selfie Captured
                    </p>
                    <button
                      type="button"
                      onClick={() => selfieInputRef.current?.click()}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '4px 10px', marginTop: '8px' }}
                    >
                      Retake Photo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Final Submit Button */}
            <div style={{ marginTop: '8px' }}>
              <button
                type="submit"
                disabled={submitting || !hasSignature || !selfieFile}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  minHeight: '52px',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(11,77,36,0.3)',
                }}
              >
                {submitting ? 'Submitting & Uploading…' : 'Submit & Sign Waiver'}
              </button>
            </div>
          </form>
        )}
      </main>

      {/* Retract Confirmation Modal */}
      {showRetractConfirm && (
        <ConfirmModal
          title="Retract Signature?"
          message="Are you sure you want to retract your submission? Your signature and selfie photos will be deleted and you will need to re-sign."
          confirmLabel="Yes, Retract"
          isDanger
          onConfirm={handleRetractConfirm}
          onCancel={() => setShowRetractConfirm(false)}
        />
      )}
    </div>
  );
};
