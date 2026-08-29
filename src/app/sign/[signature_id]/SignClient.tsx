'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useToast } from '@/components/Toast';
import { PdfCanvasViewer } from '@/components/PdfCanvasViewer';
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

  // Medical Authorization State
  const [knownAllergies, setKnownAllergies] = useState(
    (signature as any).known_allergies || ''
  );
  const [noAllergies, setNoAllergies] = useState(
    (signature as any).no_allergies || false
  );
  const [currentMedications, setCurrentMedications] = useState(
    (signature as any).current_medications || ''
  );
  const [noMedications, setNoMedications] = useState(
    (signature as any).no_medications || false
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
      fd.append('knownAllergies', knownAllergies);
      fd.append('noAllergies', noAllergies ? 'true' : 'false');
      fd.append('currentMedications', currentMedications);
      fd.append('noMedications', noMedications ? 'true' : 'false');
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
    <div className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1 w-[450px] h-[450px]" />
      <div className="bg-orb bg-orb-2 w-[400px] h-[400px]" />

      <Navbar profile={currentUserProfile} />

      <main className="flex-1 max-w-[800px] mx-auto w-full py-6 px-4 pb-[120px]">
        {/* Back Link */}
        <div className="mb-4.5">
          <Link
            href="/dashboard"
            className="text-sm text-muted inline-flex items-center gap-1.5 font-semibold no-underline hover:text-foreground"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Status Header Banner if submitted or verified */}
        {isSubmitted && (
          <div className="alert alert-info mb-6 flex justify-between items-center flex-wrap gap-3">
            <div>
              <strong className="text-base">✅ Signature Submitted</strong>
              <p className="mt-0.5 mb-0 text-xs sm:text-sm">
                Your signature has been submitted and is pending admin verification.
              </p>
            </div>
            <button
              onClick={() => setShowRetractConfirm(true)}
              disabled={retracting}
              className="btn btn-secondary text-xs !py-1.5 !px-3.5"
            >
              {retracting ? 'Retracting…' : 'Retract & Re-sign'}
            </button>
          </div>
        )}

        {isVerified && (
          <div className="alert alert-success mb-6">
            <strong className="text-base">🎉 Signature Verified!</strong>
            <p className="mt-0.5 mb-0 text-xs sm:text-sm">
              This waiver has been verified by the choir director. No further action is required.
            </p>
          </div>
        )}

        {/* Document Header Card */}
        <div className="glass-container p-6 mb-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <span className="badge bg-primary/15 text-accent font-bold text-xs mb-2">
                {DOC_TYPE_LABELS[doc.type] || doc.type}
              </span>
              <h1 className="text-xl sm:text-[1.6rem] font-bold text-primary mt-1 mb-0">
                {doc.title}
              </h1>
            </div>
            {doc.expires_at && (
              <span className="text-xs text-muted font-medium">
                Expires: {new Date(doc.expires_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* PDF Document Viewer Container */}
        <div className="mb-7">
          {pdfSignedUrl ? (
            <PdfCanvasViewer url={pdfSignedUrl} title={doc.title} height="420px" />
          ) : (
            <div className="glass-container p-10 text-center text-muted">
              PDF preview unavailable. Please proceed to sign below.
            </div>
          )}
        </div>

        {/* Form Error Banner */}
        {errorMsg && (
          <div className="alert alert-error mb-5">
            {errorMsg}
          </div>
        )}

        {/* Signing Form (Disabled if verified or submitted without retracting) */}
        {!isVerified && !isSubmitted && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-7">
            {/* Section 1: Signer Printed Name */}
            <div className="glass-container p-6">
              <h3 className="text-base sm:text-[1.1rem] font-bold text-primary m-0 mb-3.5">
                1. Signer Information
              </h3>

              <div className="bg-blue-900/6 rounded-xl p-2.5 px-3.5 mb-3.5 border border-border">
                <span className="text-[0.78rem] text-muted font-semibold">Choir Member Account</span>
                <div className="text-sm sm:text-[0.95rem] font-bold text-foreground">
                  👤 {currentUserProfile.full_name}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="input-label block m-0 font-bold" htmlFor="signer-printed-name">
                  Parent / Legal Guardian / Signer Printed Name *
                </label>
                <p className="text-xs text-muted m-0 mb-1">
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

              <div className="flex flex-col gap-1.5 mt-3.5">
                <label className="input-label block m-0 font-bold" htmlFor="signer-relationship">
                  Relationship to Member *
                </label>
                <select
                  id="signer-relationship"
                  className="input-field cursor-pointer"
                  value={signerRelationship}
                  onChange={(e) => setSignerRelationship(e.target.value)}
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

            {/* Section 2: Multi-Dependent / Sibling Input Form */}
            <div className="glass-container p-6">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-base sm:text-[1.1rem] font-bold text-primary m-0">
                  2. Siblings &amp; Additional Family Members
                </h3>
              </div>
              <p className="text-xs text-muted m-0 mb-3.5">
                Signing for siblings or family members who don&apos;t have separate accounts? Add their full names below so this waiver covers them as participants.
              </p>

              <div className="flex items-center gap-2.5 mb-3.5">
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
                  className="w-4.5 h-4.5 accent-primary cursor-pointer"
                />
                <label htmlFor="hasDependents" className="text-xs sm:text-[0.925rem] font-semibold text-foreground cursor-pointer">
                  Are you signing on behalf of siblings, dependents, or family members?
                </label>
              </div>

              {hasDependents && (
                <div className="flex flex-col gap-3 mt-2.5">
                  {dependents.map((dep, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        className="input-field flex-1"
                        placeholder={`Sibling / Family Member #${idx + 1} Full Name`}
                        value={dep}
                        onChange={(e) => handleUpdateDependent(idx, e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveDependent(idx)}
                        className="btn btn-secondary !p-2.5 px-3.5 !text-error !border-error"
                        aria-label="Remove family member"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddDependent}
                    className="btn btn-secondary self-start text-xs sm:text-[0.85rem] mt-1"
                  >
                    + Add Sibling / Family Member
                  </button>
                </div>
              )}
            </div>

            {/* Section 3: Medical Authorization */}
            <div className="glass-container p-6">
              <h3 className="text-base sm:text-[1.1rem] font-bold text-primary m-0 mb-1">
                3. Medical Authorization
              </h3>
              <p className="text-xs text-muted m-0 mb-3.5">
                Please provide any emergency medical details or check the box if none apply.
              </p>

              {/* Allergies / Conditions */}
              <div className="flex flex-col gap-2 mb-4.5">
                <label className="input-label block m-0 font-bold" htmlFor="known-allergies">
                  Allergies / Medical Conditions
                </label>
                {!noAllergies && (
                  <input
                    id="known-allergies"
                    type="text"
                    className="input-field"
                    value={knownAllergies}
                    onChange={(e) => {
                      setKnownAllergies(e.target.value);
                      if (e.target.value.trim()) setNoAllergies(false);
                    }}
                    placeholder="e.g. Peanut allergy, Asthma, Diabetes"
                  />
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <input
                    type="checkbox"
                    id="noAllergies"
                    checked={noAllergies}
                    onChange={(e) => {
                      setNoAllergies(e.target.checked);
                      if (e.target.checked) setKnownAllergies('');
                    }}
                    className="w-4.5 h-4.5 accent-primary cursor-pointer"
                  />
                  <label
                    htmlFor="noAllergies"
                    className={`text-xs sm:text-sm cursor-pointer ${
                      noAllergies ? 'font-bold text-primary' : 'font-medium text-foreground'
                    }`}
                  >
                    [ ✓ ] No known allergies or medical conditions
                  </label>
                </div>
              </div>

              {/* Current Medications */}
              <div className="flex flex-col gap-2">
                <label className="input-label block m-0 font-bold" htmlFor="current-medications">
                  Current Medications
                </label>
                {!noMedications && (
                  <input
                    id="current-medications"
                    type="text"
                    className="input-field"
                    value={currentMedications}
                    onChange={(e) => {
                      setCurrentMedications(e.target.value);
                      if (e.target.value.trim()) setNoMedications(false);
                    }}
                    placeholder="e.g. Inhaler as needed, Allergy medicine"
                  />
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <input
                    type="checkbox"
                    id="noMedications"
                    checked={noMedications}
                    onChange={(e) => {
                      setNoMedications(e.target.checked);
                      if (e.target.checked) setCurrentMedications('');
                    }}
                    className="w-4.5 h-4.5 accent-primary cursor-pointer"
                  />
                  <label
                    htmlFor="noMedications"
                    className={`text-xs sm:text-sm cursor-pointer ${
                      noMedications ? 'font-bold text-primary' : 'font-medium text-foreground'
                    }`}
                  >
                    [ ✓ ] No current routine medications
                  </label>
                </div>
              </div>
            </div>

            {/* Section 4: Signature Pad Canvas */}
            <div className="glass-container p-6">
              <div className="flex justify-between items-center mb-2.5">
                <div>
                  <h3 className="text-base sm:text-[1.1rem] font-bold text-primary m-0">
                    4. Digital Signature *
                  </h3>
                  <p className="text-xs text-muted m-0 mt-0.5">
                    Draw your signature inside the box below.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="btn btn-secondary text-xs !py-1.5 !px-3"
                >
                  Clear Signature
                </button>
              </div>

              {/* Canvas Box with touch-action: none for mobile WebView */}
              <div
                className={`touch-none rounded-xl border-2 border-dashed bg-white shadow-inner overflow-hidden relative ${
                  hasSignature ? 'border-primary' : 'border-glass-border'
                }`}
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
                  className="w-full h-[180px] block cursor-crosshair touch-none"
                />
                {!hasSignature && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-zinc-400 text-xs sm:text-sm italic">
                    Draw signature here with finger or mouse
                  </div>
                )}
              </div>
            </div>

            {/* Section 5: Selfie Photo Capture */}
            <div className="glass-container p-6">
              <h3 className="text-base sm:text-[1.1rem] font-bold text-primary m-0 mb-1">
                5. Selfie Verification Photo *
              </h3>
              <p className="text-xs text-muted m-0 mb-3.5">
                Take a quick photo of yourself to verify identity for choir records.
              </p>

              <input
                ref={selfieInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleSelfieChange}
                className="hidden"
                id="selfie-camera-input"
              />

              {!selfiePreviewUrl ? (
                <button
                  type="button"
                  onClick={() => selfieInputRef.current?.click()}
                  className="btn btn-secondary w-full p-6 rounded-xl border-2 border-dashed border-glass-border flex flex-col items-center gap-2 bg-white/40"
                >
                  <span className="text-3xl">📸</span>
                  <span className="font-bold text-sm sm:text-base text-primary">
                    Take Selfie Photo
                  </span>
                  <span className="text-xs text-muted">
                    Opens front camera on mobile devices
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-4 p-3 rounded-xl bg-primary/6 border border-primary/15">
                  <div className="w-20 h-20 rounded-xl overflow-hidden relative shrink-0 border-2 border-primary">
                    <Image src={selfiePreviewUrl} alt="Selfie preview" fill className="object-cover" />
                  </div>
                  <div>
                    <p className="font-bold text-xs sm:text-sm text-primary m-0">
                      ✓ Selfie Captured
                    </p>
                    <button
                      type="button"
                      onClick={() => selfieInputRef.current?.click()}
                      className="btn btn-secondary text-xs !py-1 !px-2.5 mt-2"
                    >
                      Retake Photo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Final Submit Button */}
            <div className="mt-2">
              <button
                type="submit"
                disabled={submitting || !hasSignature || !selfieFile}
                className="btn btn-primary w-full min-h-[52px] text-base font-bold rounded-xl shadow-[0_8px_24px_rgba(11,77,36,0.3)]"
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
