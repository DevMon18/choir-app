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
  const [isCollapsed, setIsCollapsed] = useState(true); // Minimized by default!
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
        errMsg = 'Microphone permission was denied by your browser or Android system settings.';
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
        setIsCollapsed(false); // Auto-expand list to reveal new recording!
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
        setIsCollapsed(false); // Auto-expand list to reveal new upload!
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
    <div className="glass-container !py-5 !px-6 mb-6">
      {/* Top Bar Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-9 h-9 rounded-full bg-primary/8 text-primary flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>

          <div>
            <h2 className="text-[1.1rem] font-bold text-primary m-0">
              Practice Audio Recordings
            </h2>
            <p className="text-xs text-muted mt-0.5 m-0">
              Reference tracks for your song voicing.
            </p>
          </div>

          <span className="text-xs font-bold bg-primary/8 text-primary py-0.5 px-2.5 rounded-full">
            {recordings.length} {recordings.length === 1 ? 'Track' : 'Tracks'}
          </span>
        </div>

        {/* Top Action Buttons: "+ Add Recording", "History", and Minimize/Maximize Toggle */}
        <div className="flex gap-2 items-center flex-wrap">
          <button
            onClick={handleOpenHistory}
            className="btn btn-secondary inline-flex items-center gap-1.5 !py-2 !px-3 text-xs font-semibold !rounded-xl"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 16 14" />
            </svg>
            History
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn btn-primary inline-flex items-center gap-1.5 !py-2 !px-3.5 text-sm font-semibold !rounded-xl"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Recording
          </button>

          {/* Minimize / Maximize Toggle Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Maximize / Show tracks' : 'Minimize / Hide tracks'}
            className="btn btn-secondary inline-flex items-center gap-1.5 !py-2 !px-3 text-xs font-semibold !rounded-xl"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-200 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <span>{isCollapsed ? 'Show Tracks' : 'Hide Tracks'}</span>
          </button>
        </div>
      </div>

      {/* Combined Practice Recordings List (Collapsible / Default Minimized) */}
      {!isCollapsed && (
        <div className="mt-4 animate-fade-in">
          {recordings.length === 0 ? (
            <div className="text-center py-5 px-4 bg-white/30 rounded-xl border border-dashed border-black/15">
              <p className="text-sm text-muted m-0">
                No practice recordings yet. Click <strong>&quot;+ Add Recording&quot;</strong> above to record or upload a reference track for your voice part!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {recordings.map((recording) => {
                const canDelete = currentUserProfile.id === recording.uploaded_by || isAdminRole;
                const voicePartName = recording.voice_part || 'Member';

                const badgeLabel = recording.label || voicePartName;
                const badgeBgColor = VOICING_LABEL_COLORS[badgeLabel.toUpperCase()] || VOICE_COLORS[voicePartName] || 'var(--primary)';

                return (
                  <div
                    key={recording.id}
                    className="bg-glass-bg border border-glass-border rounded-xl py-3.5 px-4.5 shadow-sm"
                  >
                    <div className="flex justify-between items-center gap-3 mb-2.5 flex-wrap">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Prominent Voicing / Label Badge */}
                        <span
                          className="text-xs font-extrabold uppercase tracking-wider text-white py-1 px-2.5 rounded-full shadow-sm"
                          style={{ backgroundColor: badgeBgColor }}
                        >
                          {badgeLabel}
                        </span>

                        {/* Uploader Name */}
                        <span className="font-bold text-sm text-foreground">
                          Recorded by {recording.uploader_name || 'Choir Member'}
                        </span>

                        {/* Date */}
                        <span className="text-xs text-muted">
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
                          className="bg-transparent border-0 text-muted cursor-pointer p-1 rounded-md transition-colors hover:text-error"
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
                      className="w-full h-9.5 rounded-lg"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* HIGH CONTRAST PORTAL POP-UP MODAL: Add Practice Recording */}
      {mounted && isAddModalOpen && createPortal(
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[99999999] p-5 animate-fade-in"
          onClick={closeAddModal}
        >
          <div
            className="bg-white border border-slate-300 rounded-2xl p-7 max-w-[520px] w-full max-h-[90vh] overflow-y-auto text-slate-900 shadow-2xl animate-modal-scale"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-xl font-bold text-slate-900 m-0">
                  Add Practice Recording
                </h3>
                <p className="text-sm text-slate-600 mt-1 m-0">
                  Auto-tagged as <strong>{currentUserProfile.voice_part || 'Member'}</strong>
                </p>
              </div>

              <button
                onClick={closeAddModal}
                disabled={isUploading}
                className="bg-transparent border-0 text-2xl text-slate-500 cursor-pointer p-1 leading-none hover:text-slate-900"
              >
                &times;
              </button>
            </div>

            {/* Enhanced Mobile Microphone Permission Guidance Banner */}
            {micError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 mb-4.5 text-rose-800 text-sm leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <strong className="text-rose-950 block mb-1">
                      Microphone Access Denied
                    </strong>
                    <p className="m-0 mb-2 text-xs">
                      On Mobile / Android: Go to <strong>Settings &gt; Apps &gt; Choir Collective &gt; Permissions &gt; Microphone</strong> and select <strong>Allow</strong>.
                    </p>
                    <div className="flex gap-2 flex-wrap items-center">
                      <button
                        onClick={startRecording}
                        className="bg-rose-600 text-white border-0 py-1.5 px-3 rounded-md text-xs font-bold cursor-pointer hover:bg-rose-700"
                      >
                        Retry Microphone
                      </button>
                      <span className="text-xs text-rose-950">
                        or use <strong>Upload Audio File</strong> below!
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Presets & Custom Label Selector */}
            <div className="mb-5">
              <label className="block text-sm font-bold text-slate-800 mb-2">
                Select Voicing / Label
              </label>

              <div className="flex flex-wrap gap-1.5 mb-3">
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
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        isSelected
                          ? 'border-2 border-primary bg-primary text-white'
                          : 'border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {labelPreset}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setIsCustomMode(true)}
                  disabled={isRecording || isUploading}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    isCustomMode
                      ? 'border-2 border-primary bg-primary text-white'
                      : 'border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
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
                  className="w-full py-2.5 px-3.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-primary"
                />
              )}

              {/* Overwrite Warning Banner if voicing already exists */}
              {willOverwrite && (
                <div className="mt-2 py-2 px-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-1.5">
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
              <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl py-3.5 px-4.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
                  <span className="font-bold text-red-800 text-sm">
                    Recording... {formatTime(recordingSeconds)}
                  </span>
                </div>

                <button
                  onClick={stopRecording}
                  className="bg-red-600 text-white font-bold py-2 px-4 rounded-full border-0 cursor-pointer flex items-center gap-1.5 text-sm hover:bg-red-700"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                  Stop Recording
                </button>
              </div>
            ) : recordedAudioUrl ? (
              /* Recorded Take Preview State */
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-3">
                <p className="text-sm font-bold text-emerald-800 mb-2.5">
                  Preview Take ({formatTime(recordingSeconds)})
                </p>
                
                <audio controls src={recordedAudioUrl} className="w-full mb-3.5" />

                <div className="flex gap-2.5 justify-end">
                  <button
                    onClick={discardRecording}
                    disabled={isUploading}
                    className="bg-white border border-slate-300 text-slate-900 font-bold py-2.5 px-4.5 rounded-lg text-sm cursor-pointer hover:bg-slate-50"
                  >
                    Discard
                  </button>

                  <button
                    onClick={handleSaveRecording}
                    disabled={isUploading}
                    className="bg-primary border-0 text-white font-bold py-2.5 px-5 rounded-lg text-sm cursor-pointer shadow-[0_4px_12px_rgba(11,77,36,0.3)] hover:bg-primary-hover"
                  >
                    {isUploading ? 'Saving...' : 'Save & Upload'}
                  </button>
                </div>
              </div>
            ) : (
              /* Idle Action Buttons inside Modal: Record Mic OR Upload File */
              <div className="flex flex-col gap-3">
                <button
                  onClick={startRecording}
                  disabled={isUploading}
                  className="w-full inline-flex items-center justify-center gap-2 p-3.5 text-sm font-bold text-white bg-primary border-0 rounded-xl cursor-pointer shadow-[0_4px_12px_rgba(11,77,36,0.25)] hover:bg-primary-hover"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                  Record Microphone Audio
                </button>

                <div className="text-center text-xs font-semibold text-slate-500 my-0.5">
                  &mdash; or upload an existing audio file &mdash;
                </div>

                <label
                  className={`w-full inline-flex items-center justify-center gap-2 p-3.5 text-sm font-bold text-slate-900 bg-white border-2 border-slate-900 rounded-xl ${
                    isUploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-50'
                  }`}
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
                    className="hidden"
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
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[99999999] p-5 animate-fade-in"
          onClick={() => setIsHistoryModalOpen(false)}
        >
          <div
            className="bg-white border border-slate-300 rounded-2xl p-7 max-w-[560px] w-full max-h-[85vh] flex flex-col text-slate-900 shadow-2xl animate-modal-scale"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-xl font-bold text-slate-900 m-0">
                  Practice Tracks Edit History
                </h3>
                <p className="text-xs text-slate-500 mt-1 m-0">
                  Audit log of practice recording uploads and overwrites.
                </p>
              </div>

              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="bg-transparent border-0 text-2xl text-slate-500 cursor-pointer p-1 leading-none hover:text-slate-900"
              >
                &times;
              </button>
            </div>

            {/* History Body List */}
            <div className="flex-1 overflow-y-auto pr-1">
              {isLoadingHistory ? (
                <div className="text-center py-7 text-slate-500 text-sm">
                  Loading edit history...
                </div>
              ) : historyItems.length === 0 ? (
                <div className="text-center py-7 text-slate-500 text-sm">
                  No history recorded yet for this song.
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {historyItems.map((item) => {
                    const isOverwrite = item.action_type === 'OVERWROTE';
                    const isDelete = item.action_type === 'DELETED';
                    const badgeBg = isOverwrite ? '#fef3c7' : isDelete ? '#fee2e2' : '#dcfce7';
                    const badgeText = isOverwrite ? '#92400e' : isDelete ? '#991b1b' : '#166534';

                    return (
                      <div
                        key={item.id}
                        className="bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 flex justify-between items-center gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-sm text-slate-900">
                              {item.uploader_name || 'Choir Member'}
                            </span>

                            <span
                              className="text-[0.68rem] font-extrabold py-0.5 px-2 rounded-full uppercase"
                              style={{ background: badgeBg, color: badgeText }}
                            >
                              {item.action_type}
                            </span>
                          </div>

                          {item.voicing_label && (
                            <p className="text-xs font-semibold text-slate-700 m-0">
                              Voicing: <strong>{item.voicing_label}</strong>
                            </p>
                          )}
                        </div>

                        <span className="text-xs text-slate-500 whitespace-nowrap">
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
            <div className="mt-5 pt-3 border-t border-slate-200 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                {isSuperAdminOrDirector
                  ? 'As a Director or Super Admin, you can clear this log.'
                  : 'Only Directors and Super Admins can clear edit history.'}
              </span>

              {isSuperAdminOrDirector && historyItems.length > 0 && (
                <button
                  onClick={() => setIsConfirmingClearHistory(true)}
                  className="bg-red-500 text-white border-0 py-2 px-3.5 rounded-lg font-bold text-xs cursor-pointer hover:bg-red-600"
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
