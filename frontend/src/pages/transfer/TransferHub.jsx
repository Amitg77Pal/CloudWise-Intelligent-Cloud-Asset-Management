import { useEffect, useMemo, useRef, useState } from 'react';
import { QrCode, Link as LinkIcon, Copy, UploadCloud, ShieldCheck, DownloadCloud, FolderOpen, Search, FileText, CheckCircle2, HardDrive } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import transferService from '../../services/transferService';
import JSZip from 'jszip';
import fileService from '../../services/fileService';
import Button from '../../components/common/Button';
import { useToast } from '../../context/ToastContext';

const TransferHub = () => {
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [session, setSession] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTransfers, setActiveTransfers] = useState([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [adminSettings, setAdminSettings] = useState(null);
  const [transferMode, setTransferMode] = useState('upload');
  const [existingFiles, setExistingFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedExistingFileIds, setSelectedExistingFileIds] = useState([]);
  const [existingSearch, setExistingSearch] = useState('');
  const { showToast } = useToast();

  const handledPrefillRef = useRef(false);
  const prefillExistingIdsRef = useRef(null);

  const transferUrl = useMemo(() => session?.transfer_url || '', [session]);
  const autoDeleteAt = useMemo(() => session?.auto_delete_at || session?.expires_at || null, [session]);
  const selectedExistingFileSet = useMemo(
    () => new Set((selectedExistingFileIds || []).map((value) => String(value))),
    [selectedExistingFileIds]
  );

  const selectedExistingFiles = useMemo(
    () => existingFiles.filter((candidate) => selectedExistingFileSet.has(String(candidate.id))),
    [existingFiles, selectedExistingFileSet]
  );

  const selectedExistingFile = useMemo(() => selectedExistingFiles[0] || null, [selectedExistingFiles]);

  const filteredExistingFiles = useMemo(() => {
    const query = existingSearch.trim().toLowerCase();
    if (!query) return existingFiles;
    return existingFiles.filter((candidate) => {
      const haystack = [candidate.name, candidate.originalName, candidate.category, candidate.aiCategory, candidate.mimeType]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [existingFiles, existingSearch]);

  const formatIst = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    try {
      return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return date.toLocaleString();
    }
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const sizeValue = Number(bytes);
    const unitSteps = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.floor(Math.log(sizeValue) / Math.log(1024));
    return `${(sizeValue / (1024 ** unitIndex)).toFixed(1)} ${unitSteps[unitIndex]}`;
  };

  const loadMyTransfers = async () => {
    try {
      setLoadingTransfers(true);
      const res = await transferService.getMySessions();
      if (res.success) {
        setActiveTransfers(res.data?.items || []);
      }
    } catch {
      // Keep sender flow usable even if listing fails.
    } finally {
      setLoadingTransfers(false);
    }
  };

  const loadExistingFiles = async () => {
    try {
      setLoadingFiles(true);
      const res = await fileService.getAllFiles();
      if (res.success) {
        setExistingFiles(res.data || []);
      }
    } catch {
      // Non-blocking. Users can still upload a new file.
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    loadMyTransfers();
    loadExistingFiles();
    // fetch admin settings for transfer limits
    (async () => {
      try {
        const mod = await import('../../services/adminService');
        const admin = mod.adminService;
        const settings = await admin.getSettings();
        if (settings) setAdminSettings(settings);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    const hydratePinIfMissing = async () => {
      if (step !== 3) return;
      if (!session?.session_id) return;
      if (session?.pin) return;

      const fromLocalList = (activeTransfers || []).find((item) => item?.session_id === session.session_id && item?.pin);
      if (fromLocalList?.pin) {
        setSession((prev) => (prev ? { ...prev, pin: fromLocalList.pin } : prev));
        return;
      }

      try {
        const res = await transferService.getMySessions();
        if (!res?.success) return;
        const found = (res.data?.items || []).find((item) => item?.session_id === session.session_id && item?.pin);
        if (found?.pin) {
          setSession((prev) => (prev ? { ...prev, pin: found.pin } : prev));
        }
      } catch {
        // ignore
      }
    };

    hydratePinIfMissing();
  }, [step, session?.session_id, session?.pin, activeTransfers]);

  useEffect(() => {
    if (handledPrefillRef.current) return;
    const ids = location?.state?.preselectedFileIds;
    if (Array.isArray(ids) && ids.length > 0) {
      handledPrefillRef.current = true;
      prefillExistingIdsRef.current = ids.map((value) => String(value));
      setTransferMode('existing');
    }
  }, [location?.state]);

  useEffect(() => {
    setStep(1);
    setSession(null);
    setFiles([]);
    setError('');
    if (transferMode === 'existing' && Array.isArray(prefillExistingIdsRef.current) && prefillExistingIdsRef.current.length > 0) {
      setSelectedExistingFileIds(prefillExistingIdsRef.current);
      prefillExistingIdsRef.current = null;
      showToast({ type: 'success', message: 'Selected files ready for transfer. Click “Share Selected Files”.', duration: 6000 });
    } else {
      setSelectedExistingFileIds([]);
    }
  }, [transferMode]);

  const endSession = async (sessionId) => {
    if (!sessionId) return;
    if (!window.confirm('End this transfer session? This will revoke access.')) return;

    try {
      const res = await transferService.endSession({ session_id: sessionId });
      if (!res.success) {
        showToast({ type: 'error', message: res.error || 'Failed to end transfer session.', duration: 7000 });
        return;
      }

      showToast({ type: 'success', message: 'Transfer session ended.', duration: 6000 });
      setActiveTransfers((prev) => prev.filter((item) => item.session_id !== sessionId));
      if (session?.session_id === sessionId) {
        setSession(null);
        setStep(1);
      }
    } catch (e) {
      showToast({ type: 'error', message: e?.response?.data?.error || 'Failed to end transfer session.', duration: 7000 });
    }
  };

  const createUploadSession = async () => {
    try {
      setLoading(true);
      setError('');
      const maxDownloads = adminSettings?.transferDefaultMaxDownloads ?? 1;
      const expiryMinutes = adminSettings?.transferDefaultExpiryMinutes ?? 10;
      const res = await transferService.createSession({ max_downloads: maxDownloads, expiry_minutes: expiryMinutes });
      if (!res.success) {
        setError(res.error || 'Failed to create session');
        showToast({ type: 'error', message: res.error || 'Failed to create transfer session.', duration: 7000 });
        return;
      }
      setSession(res.data);
      setStep(2);
      loadMyTransfers();
      showToast({ type: 'success', message: 'Transfer session created.', duration: 6000 });
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to create session');
      showToast({ type: 'error', message: e?.response?.data?.error || 'Failed to create transfer session.', duration: 7000 });
    } finally {
      setLoading(false);
    }
  };

  const createExistingFileTransfer = async () => {
    if (!selectedExistingFileIds || selectedExistingFileIds.length === 0) return;

    try {
      setLoading(true);
      setError('');
      const maxDownloads = adminSettings?.transferDefaultMaxDownloads ?? 1;
      const expiryMinutes = adminSettings?.transferDefaultExpiryMinutes ?? 10;
      const res = await transferService.createSessionFromFile({
        file_ids: selectedExistingFileIds,
        max_downloads: maxDownloads,
        expiry_minutes: expiryMinutes,
      });

      if (!res.success) {
        setError(res.error || 'Failed to create session');
        showToast({ type: 'error', message: res.error || 'Failed to create transfer session.', duration: 7000 });
        return;
      }

      setSession(res.data);
      setStep(3);
      loadMyTransfers();
      showToast({
        type: 'success',
        message: selectedExistingFileIds.length > 1 ? 'Existing cloud files are ready to share.' : 'Existing cloud file is ready to share.',
        duration: 6000,
      });
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to create session');
      showToast({ type: 'error', message: e?.response?.data?.error || 'Failed to create transfer session.', duration: 7000 });
    } finally {
      setLoading(false);
    }
  };

  const MAX_COMBINED_SIZE = 50 * 1024 * 1024; // 50 MB client-side guard (backend also enforces)
  const effectiveTransferMax = adminSettings?.transferMaxFileSizeBytes || (50 * 1024 * 1024);
  const MAX_COMBINED_SIZE_DYNAMIC = effectiveTransferMax;

  const uploadAndFinalize = async () => {
    if ((!files || files.length === 0) || !session?.session_id) return;

    // compute combined size
    const combinedSize = files.reduce((s, f) => s + (f.size || 0), 0);
    if (combinedSize > MAX_COMBINED_SIZE_DYNAMIC) {
      const mb = Math.round(MAX_COMBINED_SIZE_DYNAMIC / (1024 * 1024));
      setError(`Combined file size exceeds ${mb} MB upload limit`);
      showToast({ type: 'error', message: `Combined file size exceeds ${mb} MB upload limit.` });
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Per-file size validation against transfer max
      const perFileLimit = effectiveTransferMax;
      for (const f of files) {
        if (perFileLimit > 0 && f.size > perFileLimit) {
          const mb = Math.round(perFileLimit / (1024 * 1024));
          setError(`File "${f.name}" exceeds the per-file transfer limit of ${mb} MB`);
          showToast({ type: 'error', message: `File "${f.name}" exceeds the per-file transfer limit of ${mb} MB.` });
          setLoading(false);
          return;
        }
      }

      let uploadFile = null;
      let uploadName = null;
      let uploadType = null;

      if (files.length === 1) {
        uploadFile = files[0];
        uploadName = files[0].name;
        uploadType = files[0].type || 'application/octet-stream';
      } else {
        // zip multiple files client-side
        const zip = new JSZip();
        files.forEach((f) => {
          // add as file with original filename
          zip.file(f.name, f);
        });
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        uploadFile = new File([zipBlob], `transfer-${session.session_id}.zip`, { type: 'application/zip' });
        uploadName = uploadFile.name;
        uploadType = uploadFile.type;
      }

      const uploadMeta = await transferService.getUploadUrl({
        session_id: session.session_id,
        filename: uploadName,
        file_size: uploadFile.size,
        content_type: uploadType,
      });

      if (!uploadMeta.success) {
        setError(uploadMeta.error || 'Could not prepare upload');
        showToast({ type: 'error', message: uploadMeta.error || 'Could not prepare upload.', duration: 7000 });
        return;
      }

      await transferService.uploadToPresignedUrl({
        uploadUrl: uploadMeta.data.upload_url,
        file: uploadFile,
        contentType: uploadType,
        signedHeaders: uploadMeta.data.upload_headers,
      });

      const completed = await transferService.completeUpload({
        session_id: session.session_id,
        file_key: uploadMeta.data.file_key,
      });

      if (!completed.success) {
        setError(completed.error || 'Upload completion failed');
        showToast({ type: 'error', message: completed.error || 'Upload completion failed.', duration: 7000 });
        return;
      }

      setSession((prev) => ({ ...prev, ...completed.data }));
      setStep(3);
      loadMyTransfers();
      showToast({ type: 'success', message: 'Transfer ready to share.', duration: 7000 });
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Upload failed');
      showToast({ type: 'error', message: e?.response?.data?.error || e?.message || 'Upload failed.', duration: 7000 });
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (text, toastMessage = 'Copied to clipboard.') => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    showToast({ type: 'success', message: toastMessage, duration: 4000 });
  };

  const sourceBadge = transferMode === 'existing' ? 'Existing AWS file' : 'Upload from device';

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6 px-1 sm:px-0">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 md:p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
            <ShieldCheck className="text-sky-600 dark:text-sky-300" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">Secure Transfer</h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-medium mt-1">Share a file with QR/link + mandatory PIN verification. You can upload a new file or share one already stored in AWS.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-semibold">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={`rounded-2xl p-3 sm:p-4 border ${step >= n ? 'border-sky-300 bg-sky-50 dark:bg-sky-900/10 dark:border-sky-700' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}
          >
            <div className="text-xs font-black uppercase tracking-wider text-slate-500">Step {n}</div>
            <div className="font-bold text-slate-900 dark:text-white mt-1">
              {n === 1 ? 'Choose source' : n === 2 ? (transferMode === 'upload' ? 'Upload file' : 'Skipped') : 'Share + Receive'}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setTransferMode('upload')}
            className={`flex-1 min-w-[220px] rounded-2xl border p-4 text-left transition-all ${transferMode === 'upload' ? 'border-sky-300 bg-sky-50 dark:bg-sky-900/10 dark:border-sky-700' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:border-sky-300'}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-slate-500">Source</div>
                <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Upload a new file</div>
              </div>
              <UploadCloud className={transferMode === 'upload' ? 'text-sky-600 dark:text-sky-300' : 'text-slate-400'} />
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Create a temporary transfer session and send a fresh file from your device.</p>
          </button>

          <button
            type="button"
            onClick={() => setTransferMode('existing')}
            className={`flex-1 min-w-[220px] rounded-2xl border p-4 text-left transition-all ${transferMode === 'existing' ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-700' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:border-emerald-300'}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-slate-500">Source</div>
                <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Share existing AWS file</div>
              </div>
              <FolderOpen className={transferMode === 'existing' ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-400'} />
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Pick from files already stored in your cloud library and generate a secure transfer link.</p>
          </button>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-slate-500">Active mode</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white mt-1">{sourceBadge}</div>
          </div>
          <div className="text-xs font-bold text-slate-500">PIN + link based sharing</div>
        </div>

        {transferMode === 'upload' && (
          <>
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-slate-600 dark:text-slate-400">Create a one-time secure transfer session for a new upload.</p>
                <Button variant="primary" onClick={createUploadSession} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Secure Session'}
                </Button>
              </div>
            )}

            {step === 2 && session && (
              <div className="space-y-4">
                <div className="space-y-4 p-4 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 relative z-30">
                  <div className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">PIN (share separately)</div>
                  <div className="text-3xl md:text-4xl font-black tracking-widest text-amber-900 dark:text-amber-200">{session.pin}</div>
                  <p className="text-xs text-amber-700 dark:text-amber-300">Never include this PIN in messages containing the transfer link.</p>
                </div>

                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Choose file(s)</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800 text-sm"
                />
                {files && files.length > 0 && (
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    Selected: <span className="font-semibold text-slate-900 dark:text-white">{files.map((f) => f.name).join(', ')}</span>
                    <div className="text-xs text-slate-500">Combined size: {formatSize(files.reduce((s, f) => s + (f.size || 0), 0))}</div>
                  </div>
                )}
                <Button variant="primary" onClick={uploadAndFinalize} disabled={!files || files.length === 0 || loading}>
                  <UploadCloud size={16} className="mr-2" />
                  {loading ? 'Uploading...' : 'Upload & Generate Share Link'}
                </Button>
              </div>
            )}
          </>
        )}

        {transferMode === 'existing' && (
          <div className="space-y-5">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                <Search size={16} />
                Pick stored file(s)
              </div>
              <input
                value={existingSearch}
                onChange={(e) => setExistingSearch(e.target.value)}
                placeholder="Search your cloud files"
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {loadingFiles ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-6 text-sm text-slate-500">Loading your stored files...</div>
            ) : filteredExistingFiles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-8 text-center text-sm text-slate-500">
                No stored files match this search.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 max-h-[420px] overflow-y-auto pr-1">
                {filteredExistingFiles.map((storedFile) => {
                  const storedFileId = String(storedFile.id);
                  const selected = selectedExistingFileSet.has(storedFileId);
                  return (
                    <button
                      key={storedFile.id}
                      type="button"
                      onClick={() => {
                        setSelectedExistingFileIds((prev) => {
                          const prevIds = (prev || []).map((value) => String(value));
                          if (prevIds.includes(storedFileId)) {
                            return prevIds.filter((value) => value !== storedFileId);
                          }
                          return [...prevIds, storedFileId];
                        });
                      }}
                      className={`text-left rounded-2xl border p-4 transition-all ${selected ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-700 shadow-sm' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className={selected ? 'text-emerald-600' : 'text-slate-400'} />
                            <div className="font-semibold text-slate-900 dark:text-white truncate">{storedFile.originalName || storedFile.name}</div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1">{storedFile.category || 'Uncategorized'}</span>
                            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1">{formatSize(storedFile.size)}</span>
                          </div>
                        </div>
                        {selected && <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />}
                      </div>
                      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                        {storedFile.aiCategory ? `AI category: ${storedFile.aiCategory}` : 'Stored in AWS and ready to share'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button variant="primary" onClick={createExistingFileTransfer} disabled={selectedExistingFileIds.length === 0 || loading}>
                {loading ? 'Preparing...' : selectedExistingFileIds.length > 1 ? 'Share Selected Files' : 'Share Selected File'}
              </Button>
              {selectedExistingFile && (
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Selected:{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedExistingFileIds.length > 1
                      ? `${selectedExistingFileIds.length} files`
                      : (selectedExistingFile.originalName || selectedExistingFile.name)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && session && (
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                <div className="text-xs font-black uppercase tracking-wider text-slate-500">Session</div>
                <div className="mt-1 text-sm font-semibold break-all text-slate-900 dark:text-white">{session.session_id}</div>
                <div className="mt-3 grid gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <div><span className="font-bold">Expires:</span> {formatIst(session.expires_at)} (IST)</div>
                  <div><span className="font-bold">Auto-delete:</span> {formatIst(autoDeleteAt)} (IST)</div>
                  <div><span className="font-bold">Downloads:</span> {(session.downloads_count ?? 0)}/{(session.max_downloads ?? 1)}</div>
                  <div><span className="font-bold">Mode:</span> {session.transfer_mode === 'existing_file' || session.transfer_mode === 'existing_files' ? 'Existing AWS file(s)' : 'Upload from device'}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => endSession(session.session_id)}
                  className="bg-gradient-to-b from-white to-slate-100 border-slate-300 shadow-sm shadow-slate-200/60 hover:from-white hover:to-slate-200"
                >
                  End Session
                </Button>
              </div>

              <p className="text-xs text-slate-500">Recipient opens link, enters PIN, and downloads securely.</p>
              {session.transfer_mode === 'existing_file' || session.transfer_mode === 'existing_files' ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  This transfer uses file(s) already stored in AWS. The transfer session expires, but the original file(s) stay in your library.
                </p>
              ) : (
                <p className="text-xs text-slate-500">Auto cleanup: backend expires the session and removes the uploaded transfer object at {formatIst(autoDeleteAt)} (IST).</p>
              )}
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
                <div>
                  <div className="text-sm font-black uppercase tracking-wider text-slate-500">Transfer link</div>
                  <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 break-all text-sm">
                    {transferUrl}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => copyText(transferUrl, 'Link copied to clipboard.')}
                      className="bg-gradient-to-b from-white to-slate-100 border-slate-300 shadow-sm shadow-slate-200/60 hover:from-white hover:to-slate-200"
                    >
                      <Copy size={16} className="mr-2" /> Copy Link
                    </Button>
                    <a href={transferUrl} target="_blank" rel="noreferrer" className="inline-flex">
                      <Button
                        variant="secondary"
                        size="small"
                        className="bg-gradient-to-b from-white to-slate-100 border-slate-300 shadow-sm shadow-slate-200/60 hover:from-white hover:to-slate-200"
                      >
                        <LinkIcon size={16} className="mr-2" /> Open
                      </Button>
                    </a>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 items-start">
                  <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">PIN (required)</div>
                        <div className="text-2xl md:text-3xl font-black tracking-widest text-amber-900 dark:text-amber-200 mt-1">
                          {session.pin || '—'}
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => copyText(session.pin, 'PIN copied to clipboard.')}
                        disabled={!session.pin}
                        className="bg-white/70 dark:bg-slate-900 border-amber-200 dark:border-amber-800"
                      >
                        <Copy size={14} className="mr-1" /> Copy
                      </Button>
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">Share the PIN separately from the link/QR.</p>
                  </div>

                  <div>
                    <div className="text-xs font-black uppercase tracking-wider text-slate-500">QR code</div>
                    <div className="mt-2 p-4 rounded-2xl bg-white border border-slate-200 inline-block relative z-20 overflow-visible">
                      {session.qr_code ? (
                        <img src={session.qr_code} alt="Transfer QR" className="w-44 h-44 sm:w-48 sm:h-48" />
                      ) : (
                        <div className="w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center text-slate-400">
                          <QrCode />
                        </div>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      <a href={transferUrl} className="text-sm text-sky-600 dark:text-sky-400 font-semibold inline-flex items-center gap-1">
                        <DownloadCloud size={14} /> Receiver page
                      </a>
                      <div className="text-xs text-slate-500">
                        {session.transfer_mode === 'existing_file' || session.transfer_mode === 'existing_files' ? 'Existing file transfer' : 'Uploaded file transfer'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-sm">
        <div className="max-h-[480px] overflow-y-auto">
          <div className="flex items-center justify-between gap-3 sticky top-0 z-10 bg-white dark:bg-slate-900/95 py-3">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">My Active Transfers</h2>
            <Button
              variant="secondary"
              size="small"
              onClick={loadMyTransfers}
              disabled={loadingTransfers}
              className="bg-gradient-to-b from-white to-slate-100 border-slate-300 shadow-sm shadow-slate-200/60 hover:from-white hover:to-slate-200"
            >
              {loadingTransfers ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          {activeTransfers.length === 0 && !loadingTransfers && (
            <p className="text-sm text-slate-500 mt-3">No active transfers found.</p>
          )}

          <div className="mt-3 grid md:grid-cols-2 gap-4">
            {activeTransfers.map((item) => (
              <div key={item.session_id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-500">Session</div>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${item.transfer_mode === 'existing_file' || item.transfer_mode === 'existing_files' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'}`}>
                    {item.transfer_mode === 'existing_file' || item.transfer_mode === 'existing_files' ? 'Existing file' : 'Upload'}
                  </span>
                </div>
                <div className="text-sm font-semibold break-all text-slate-700 dark:text-slate-200">{item.session_id}</div>
                <div className="text-xs text-slate-500">Status: {item.status}</div>
                <div className="text-xs text-slate-500">PIN: <span className="font-black tracking-widest text-amber-700 dark:text-amber-300">{item.pin}</span></div>
                <div className="text-xs text-slate-500">Expires: {formatIst(item.expires_at)} (IST)</div>
                <div className="text-xs text-slate-500">Downloads: {item.downloads_count}/{item.max_downloads}</div>
                <div className="text-xs text-slate-500">File: {item.file_name || 'Pending upload'}</div>
                <div className="flex gap-2 pt-1 flex-wrap">
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => copyText(item.transfer_url)}
                    className="bg-gradient-to-b from-white to-slate-100 border-slate-300 shadow-sm shadow-slate-200/60 hover:from-white hover:to-slate-200"
                  >
                    <Copy size={14} className="mr-1" /> Copy Link
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => endSession(item.session_id)}
                    className="bg-gradient-to-b from-white to-slate-100 border-slate-300 shadow-sm shadow-slate-200/60 hover:from-white hover:to-slate-200"
                  >
                    End Session
                  </Button>
                  <a href={item.transfer_url} target="_blank" rel="noreferrer" className="inline-flex">
                    <Button
                      variant="secondary"
                      size="small"
                      className="bg-gradient-to-b from-white to-slate-100 border-slate-300 shadow-sm shadow-slate-200/60 hover:from-white hover:to-slate-200"
                    >
                      <LinkIcon size={14} className="mr-1" /> Open
                    </Button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferHub;
