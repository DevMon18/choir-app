'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  uploadPracticeRecording,
  deletePracticeRecording,
  getPracticeTrackHistory,
  clearPracticeTrackHistory,
  PracticeRecordingItem,
  PracticeTrackHistoryItem,
} from './recordings-actions';

interface Profile {
  id: string;
  full_name: string;
  role: string;
  voice_part?: string | null;
}

interface PracticeRecordingsProps {
  songId: string;
  currentUserProfile: Profile;
  initialRecordings: PracticeRecordingItem[];
}

const PRESET_VOICING_LABELS = [
  'SOPRANO VOICING',
  'ALTO VOICING',
  'TENOR VOICING',
  'BASS VOICING',
  'MELODY',
] as const;

const VOICE_COLORS: Record<string, string> = {
  Soprano: '#6366f1',
  Alto: '#7c3aed',
  Tenor: '#0ea5e9',
  Bass: '#0b4d24',
};

const VOICING_LABEL_COLORS: Record<string, string> = {
  'SOPRANO VOICING': '#6366f1',
  'ALTO VOICING': '#7c3aed',
  'TENOR VOICING': '#0ea5e9',
  'BASS VOICING': '#0b4d24',
  'MELODY': '#d97706',
};

export const PracticeRecordings: React.FC<PracticeRecordingsProps> = ({
  songId,
  currentUserProfile,
  initialRecordings,
}) => {
  const { addToast } = useToast();
  const [mounted, setMounted] = useState(false);

  const [recordings, setRecordings] = useState<PracticeRecordingItem[]>(initialRecordings);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Selected preset label or custom note
  const [selectedPreset, setSelectedPreset] = useState<string>('SOPRANO VOICING');
  const [customLabel, setCustomLabel] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  // History state
  const [historyItems, setHistoryItems] = useState<PracticeTrackHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isConfirmingClearHistory, setIsConfirmingClearHistory] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);

  // MediaRecorder states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Delete modal state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // SSR hydration flag
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state if prop changes
  useEffect(() => {
    setRecordings(initialRecordings);
  }, [initialRecordings]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [recordedAudioUrl]);

  // Derived effective label
  const activeLabel = isCustomMode ? customLabel.trim() : selectedPreset;

  // Check if activeLabel will overwrite an existing recording
  const willOverwrite = Boolean(
    activeLabel && recordings.some((r) => r.label && r.label.toUpperCase() === activeLabel.toUpperCase())
  );

  // Timer helper
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Close Add Modal
  const closeAddModal = () => {
    if (isRecording) {
      stopRecording();
    }
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setRecordedBlob(null);
    setRecordedAudioUrl(null);
    setRecordingSeconds(0);
    setMicError(null);
    setCustomLabel('');
    setIsCustomMode(false);
    setIsAddModalOpen(false);
  };

  // Open History Modal
  const handleOpenHistory = async () => {
    setIsHistoryModalOpen(true);
    setIsLoadingHistory(true);
    try {
      const res = await getPracticeTrackHistory(songId);
      if (res.error) {
        addToast({ title: 'History Notice', type: 'info', message: res.error });
      } else {
        setHistoryItems(res.history || []);
      }
    } catch (err: any) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Clear History handler (Only super_admin and director)
  const handleClearHistory = async () => {
    setIsClearingHistory(true);
    try {
      const res = await clearPracticeTrackHistory(songId);
      if (res.error) {
        addToast({ title: 'Clear History Failed', type: 'error', message: res.error });
      } else {
        addToast({ title: 'History Cleared', type: 'success', message: 'Edit history audit log cleared.' });
        setHistoryItems([]);
      }
    } catch (err: any) {
      addToast({ title: 'Clear History Error', type: 'error', message: err.message });
    } finally {
      setIsClearingHistory(false);
      setIsConfirmingClearHistory(false);
    }
  };

  // Start browser mic recording
  const startRecording = async () => {
    setMicError(null);
    audioChunksRef.current = [];
    setRecordedBlob(null);
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const msg = 'Audio recording is not supported in this browser environment.';
        setMicError(msg);
        addToast({ title: 'Recording Unsupported', type: 'error', message: msg });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(audioBlob);
        setRecordedBlob(audioBlob);
        setRecordedAudioUrl(url);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone permission or recording error:', err);
      let errMsg = 'Failed to access microphone. Please check permissions.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errMsg = 'Microphone access was denied. Please allow microphone permissions in your browser/device settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errMsg = 'No microphone device found on this system.';
      }
      setMicError(errMsg);
      addToast({ title: 'Microphone Permission', type: 'error', message: errMsg });
    }
  };

  // Stop browser mic recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Discard take
  const discardRecording = () => {
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setRecordedBlob(null);
    setRecordedAudioUrl(null);
    setRecordingSeconds(0);
  };

  // Save recorded take
  const handleSaveRecording = async () => {
    if (!recordedBlob) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      const fileExt = recordedBlob.type.includes('mp4') ? 'm4a' : 'webm';
      const file = new File([recordedBlob], `recording_${Date.now()}.${fileExt}`, {
        type: recordedBlob.type || 'audio/webm',
      });

      formData.append('file', file);
      if (activeLabel) {
        formData.append('label', activeLabel);
      }

      const res = await uploadPracticeRecording(songId, formData);

      if (res.error || !res.recording) {
        addToast({ title: 'Save Failed', type: 'error', message: res.error || 'Failed to save recording.' });
      } else {
        const msg = res.overwritten
          ? `Overwrote existing track for "${activeLabel}".`
          : 'Practice recording saved successfully!';
        addToast({ title: 'Recording Saved', type: 'success', message: msg });

        if (res.overwritten) {
          setRecordings((prev) => [
            res.recording!,
            ...prev.filter((r) => r.label?.toUpperCase() !== activeLabel.toUpperCase()),
          ]);
        } else {
          setRecordings((prev) => [res.recording!, ...prev]);
        }
        closeAddModal();
      }
    } catch (err: any) {
      console.error('Save recording error:', err);
      addToast({ title: 'Upload Error', type: 'error', message: err.message || 'Upload failed.' });
    } finally {
      setIsUploading(false);
    }
  };

  // Upload external file via picker
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    if (file.size > 15 * 1024 * 1024) {
      addToast({ title: 'File Too Large', type: 'error', message: 'File size exceeds the 15MB limit.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (activeLabel) {
        formData.append('label', activeLabel);
      }

      const res = await uploadPracticeRecording(songId, formData);

      if (res.error || !res.recording) {
        addToast({ title: 'Upload Failed', type: 'error', message: res.error || 'Failed to upload audio file.' });
      } else {
        const msg = res.overwritten
          ? `Overwrote existing track for "${activeLabel}".`
          : 'Practice recording uploaded successfully!';
        addToast({ title: 'Upload Successful', type: 'success', message: msg });

        if (res.overwritten) {
          setRecordings((prev) => [
            res.recording!,
            ...prev.filter((r) => r.label?.toUpperCase() !== activeLabel.toUpperCase()),
          ]);
        } else {
          setRecordings((prev) => [res.recording!, ...prev]);
        }
        closeAddModal();
      }
    } catch (err: any) {
      console.error('File upload error:', err);
      addToast({ title: 'Upload Error', type: 'error', message: err.message || 'Upload failed.' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Confirm delete handler
  const handleConfirmDelete = async () => {
    if (!deletingId) return;

    setIsDeleting(true);
    try {
      const res = await deletePracticeRecording(deletingId, songId);
      if (res.error) {
        addToast({ title: 'Delete Failed', type: 'error', message: res.error });
      } else {
        addToast({ title: 'Recording Deleted', type: 'success', message: 'Recording deleted successfully.' });
        setRecordings((prev) => prev.filter((r) => r.id !== deletingId));
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      addToast({ title: 'Delete Error', type: 'error', message: err.message || 'Failed to delete recording.' });
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  const isSuperAdminOrDirector = ['super_admin', 'director'].includes(currentUserProfile.role);
  const isAdminRole = ['super_admin', 'director', 'secretary'].includes(currentUserProfile.role);

  return (
    <div className="glass-container" style={{ padding: '24px 30px', marginBottom: '24px' }}>
      {/* Top Bar Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: recordings.length > 0 ? '16px' : '0px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(11, 77, 36, 0.08)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>

          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
              Practice Audio Recordings
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '2px 0 0 0' }}>
              Reference tracks for your song voicing.
            </p>
          </div>

          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              background: 'rgba(11, 77, 36, 0.08)',
              color: 'var(--primary)',
              padding: '2px 10px',
              borderRadius: '99px',
            }}
          >
            {recordings.length} {recordings.length === 1 ? 'Track' : 'Tracks'}
          </span>
        </div>

        {/* Top Action Buttons: "+ Add Recording" and "View History" */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleOpenHistory}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '10px',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            History
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '0.88rem',
              fontWeight: 600,
              borderRadius: '10px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Recording
          </button>
        </div>
      </div>

      {/* Combined Practice Recordings List (Displayed AT THE TOP, ABOVE LYRICS) */}
      {recordings.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '20px 16px',
            marginTop: '16px',
            background: 'rgba(255, 255, 255, 0.3)',
            borderRadius: '12px',
            border: '1px dashed var(--border-color, rgba(0,0,0,0.15))',
          }}
        >
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>
            No practice recordings yet. Click <strong>&quot;+ Add Recording&quot;</strong> above to record or upload a reference track for your voice part!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          {recordings.map((recording) => {
            const canDelete = currentUserProfile.id === recording.uploaded_by || isAdminRole;
            const voicePartName = recording.voice_part || 'Member';

            // Determine badge text and color (Voicing Label takes precedence)
            const badgeLabel = recording.label || voicePartName;
            const badgeBgColor = VOICING_LABEL_COLORS[badgeLabel.toUpperCase()] || VOICE_COLORS[voicePartName] || 'var(--primary)';

            return (
              <div
                key={recording.id}
                style={{
                  background: 'var(--glass-bg, #fff)',
                  border: '1px solid var(--glass-border, rgba(255,255,255,0.4))',
                  borderRadius: '14px',
                  padding: '14px 18px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Prominent Voicing / Label Badge */}
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: '#ffffff',
                        backgroundColor: badgeBgColor,
                        padding: '3px 10px',
                        borderRadius: '99px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                      }}
                    >
                      {badgeLabel}
                    </span>

                    {/* Uploader Name */}
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--foreground)' }}>
                      Recorded by {recording.uploader_name || 'Choir Member'}
                    </span>

                    {/* Date */}
                    <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                      ({new Date(recording.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })})
                    </span>
                  </div>

                  {/* Delete Button */}
                  {canDelete && (
                    <button
                      onClick={() => setDeletingId(recording.id)}
                      title="Delete recording"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '6px',
                        transition: 'color 0.2s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Native HTML5 Audio Controls */}
                <audio
                  controls
                  src={recording.file_url}
                  style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* HIGH CONTRAST PORTAL POP-UP MODAL: Add Practice Recording */}
      {mounted && isAddModalOpen && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999999,
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={closeAddModal}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '20px',
              padding: '28px',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              color: '#0f172a',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.55)',
              animation: 'slideUpModal 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Add Practice Recording
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#475569', margin: '4px 0 0 0' }}>
                  Auto-tagged as <strong>{currentUserProfile.voice_part || 'Member'}</strong>
                </p>
              </div>

              <button
                onClick={closeAddModal}
                disabled={isUploading}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.6rem',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            {/* Mic Permission Error Banner */}
            {micError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  marginBottom: '18px',
                  color: '#991b1b',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{micError}</span>
              </div>
            )}

            {/* Presets & Custom Label Selector */}
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#1e293b',
                  marginBottom: '8px',
                }}
              >
                Select Voicing / Label
              </label>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {PRESET_VOICING_LABELS.map((labelPreset) => {
                  const isSelected = !isCustomMode && selectedPreset === labelPreset;
                  return (
                    <button
                      key={labelPreset}
                      type="button"
                      onClick={() => {
                        setSelectedPreset(labelPreset);
                        setIsCustomMode(false);
                      }}
                      disabled={isRecording || isUploading}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        border: isSelected ? '2px solid #0b4d24' : '1px solid #cbd5e1',
                        background: isSelected ? '#0b4d24' : '#f8fafc',
                        color: isSelected ? '#ffffff' : '#334155',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {labelPreset}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setIsCustomMode(true)}
                  disabled={isRecording || isUploading}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    border: isCustomMode ? '2px solid #0b4d24' : '1px solid #cbd5e1',
                    background: isCustomMode ? '#0b4d24' : '#f8fafc',
                    color: isCustomMode ? '#ffffff' : '#334155',
                    cursor: 'pointer',
                  }}
                >
                  Custom Note...
                </button>
              </div>

              {isCustomMode && (
                <input
                  type="text"
                  placeholder="Enter custom voicing label (e.g., Verse 1 Harmony)"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  disabled={isRecording || isUploading}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '0.9rem',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                />
              )}

              {/* Overwrite Warning Banner if voicing already exists */}
              {willOverwrite && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Note: Uploading will overwrite the existing track for &quot;{activeLabel}&quot;.
                </div>
              )}
            </div>

            {/* Live Recording State Controls */}
            {isRecording ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '12px',
                  padding: '14px 18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: '#dc2626',
                      animation: 'pulse 1s infinite ease-in-out',
                    }}
                  />
                  <span style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.92rem' }}>
                    Recording... {formatTime(recordingSeconds)}
                  </span>
                </div>

                <button
                  onClick={stopRecording}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    fontWeight: 700,
                    padding: '8px 16px',
                    borderRadius: '99px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.85rem',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                  Stop Recording
                </button>
              </div>
            ) : recordedAudioUrl ? (
              /* Recorded Take Preview State */
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '12px',
                }}
              >
                <p style={{ fontSize: '0.88rem', fontWeight: 700, color: '#166534', marginBottom: '10px' }}>
                  Preview Take ({formatTime(recordingSeconds)})
                </p>
                
                <audio controls src={recordedAudioUrl} style={{ width: '100%', marginBottom: '14px' }} />

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={discardRecording}
                    disabled={isUploading}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      fontWeight: 700,
                      padding: '10px 18px',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                    }}
                  >
                    Discard
                  </button>

                  <button
                    onClick={handleSaveRecording}
                    disabled={isUploading}
                    style={{
                      background: '#0b4d24',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: 700,
                      padding: '10px 20px',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(11, 77, 36, 0.3)',
                    }}
                  >
                    {isUploading ? 'Saving...' : 'Save & Upload'}
                  </button>
                </div>
              </div>
            ) : (
              /* Idle Action Buttons inside Modal: Record Mic OR Upload File */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  onClick={startRecording}
                  disabled={isUploading}
                  style={{
                    width: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '14px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    background: '#0b4d24',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(11, 77, 36, 0.25)',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                  Record Microphone Audio
                </button>

                <div style={{ textAlign: 'center', fontSize: '0.82rem', fontWeight: 600, color: '#64748b', margin: '2px 0' }}>
                  &mdash; or upload an existing audio file &mdash;
                </div>

                <label
                  style={{
                    width: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '14px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    background: '#ffffff',
                    border: '2px solid #0f172a',
                    borderRadius: '12px',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    opacity: isUploading ? 0.6 : 1,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {isUploading ? 'Uploading Audio File...' : 'Upload Audio File'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* EDIT HISTORY PORTAL POP-UP MODAL */}
      {mounted && isHistoryModalOpen && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999999,
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setIsHistoryModalOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '20px',
              padding: '28px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              color: '#0f172a',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.55)',
              animation: 'slideUpModal 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Practice Tracks Edit History
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0 0' }}>
                  Audit log of practice recording uploads and overwrites.
                </p>
              </div>

              <button
                onClick={() => setIsHistoryModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.6rem',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            {/* History Body List */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
              {isLoadingHistory ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
                  Loading edit history...
                </div>
              ) : historyItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b', fontSize: '0.9rem' }}>
                  No history recorded yet for this song.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {historyItems.map((item) => {
                    const isOverwrite = item.action_type === 'OVERWROTE';
                    const isDelete = item.action_type === 'DELETED';
                    const badgeBg = isOverwrite ? '#fef3c7' : isDelete ? '#fee2e2' : '#dcfce7';
                    const badgeText = isOverwrite ? '#92400e' : isDelete ? '#991b1b' : '#166534';

                    return (
                      <div
                        key={item.id}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          padding: '12px 16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                              {item.uploader_name || 'Choir Member'}
                            </span>

                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '99px',
                                background: badgeBg,
                                color: badgeText,
                                textTransform: 'uppercase',
                              }}
                            >
                              {item.action_type}
                            </span>
                          </div>

                          {item.voicing_label && (
                            <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', margin: 0 }}>
                              Voicing: <strong>{item.voicing_label}</strong>
                            </p>
                          )}
                        </div>

                        <span style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {new Date(item.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer (Clear History for Super Admin & Director) */}
            <div
              style={{
                marginTop: '20px',
                paddingTop: '12px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                {isSuperAdminOrDirector
                  ? 'As a Director or Super Admin, you can clear this log.'
                  : 'Only Directors and Super Admins can clear edit history.'}
              </span>

              {isSuperAdminOrDirector && historyItems.length > 0 && (
                <button
                  onClick={() => setIsConfirmingClearHistory(true)}
                  style={{
                    background: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  Clear History
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Clear History Confirmation Modal */}
      {isConfirmingClearHistory && (
        <ConfirmModal
          title="Clear Edit History"
          message="Are you sure you want to clear all edit history logs for this song? This action cannot be undone."
          confirmLabel={isClearingHistory ? 'Clearing...' : 'Clear All History'}
          cancelLabel="Cancel"
          isDanger
          onConfirm={handleClearHistory}
          onCancel={() => setIsConfirmingClearHistory(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <ConfirmModal
          title="Delete Practice Recording"
          message="Are you sure you want to delete this practice recording? This action cannot be undone."
          confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
          cancelLabel="Cancel"
          isDanger
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
};

export default PracticeRecordings;
