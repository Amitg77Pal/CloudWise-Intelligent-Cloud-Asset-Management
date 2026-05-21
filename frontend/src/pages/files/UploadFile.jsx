import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import fileService from '../../services/fileService';
import UploadBox from '../../components/files/UploadBox';
import Button from '../../components/common/Button';
import { Upload, Info, ShieldCheck, Zap, Sparkles, Binary, ArrowLeft } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const UploadFile = () => {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState({ type: '', text: '' });
  const messageRef = useRef(null);
  const progressRef = useRef(null);
  const { showToast } = useToast();
  const [uploadMaxFileSizeBytes, setUploadMaxFileSizeBytes] = useState(100 * 1024 * 1024);

  useEffect(() => {
    let mounted = true;
    import('../../services/adminService').then((mod) => {
      const adminService = mod.adminService;
      adminService.getSettings().then((settings) => {
        if (mounted && settings && typeof settings.uploadMaxFileSizeBytes === 'number') {
          const val = settings.uploadMaxFileSizeBytes;
          if (typeof val === 'number' && val > 0) setUploadMaxFileSizeBytes(val);
        }
      }).catch(() => {});
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const isMobileViewport = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(max-width: 639px)').matches;
  };

  const handleUpload = async (files) => {
    const filesToUpload = Array.isArray(files) ? files : [files];
    setUploading(true);
    setMessage({ type: '', text: '' });

    if (isMobileViewport()) {
      setTimeout(() => {
        progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
    }

    try {
      for (const file of filesToUpload) {
        await fileService.uploadFile(file, (progress) => {
          setUploadProgress(progress);
        });
      }

      setMessage({
        type: 'success',
        text: `Successfully uploaded ${filesToUpload.length} file(s) to cloud storage.`,
      });
      showToast({ type: 'success', message: `Uploaded ${filesToUpload.length} file(s).`, duration: 7000 });

      // Auto-scroll to success message
      setTimeout(() => {
        messageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);

      setTimeout(() => {
        navigate('/files');
      }, 2000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Upload failed. Please check your connection and try again.',
      });
      showToast({ type: 'error', message: error.response?.data?.message || 'Upload failed. Please try again.', duration: 7000 });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-10 animate-fade-in pb-20 px-1 sm:px-0">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors mb-4 sm:mb-6 group text-xs sm:text-sm font-black uppercase tracking-widest"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back
          </button>
          <div className="flex items-center gap-3 sm:gap-4 mb-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl sm:rounded-3xl bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30">
              <Upload size={26} className="text-white stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tighter">Upload Files</h1>
              <p className="text-sm sm:text-base lg:text-lg text-slate-500 dark:text-slate-400 font-semibold sm:font-bold mt-1">
                Upload and organize your files securely in the cloud.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {message.text && (
        <div
          ref={messageRef}
          className={`p-4 sm:p-6 rounded-2xl sm:rounded-[32px] border-2 text-sm sm:text-[15px] font-black flex items-center gap-3 sm:gap-4 animate-in slide-in-from-top-4 duration-500 shadow-lg ${message.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-400'
            : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30 text-rose-700 dark:text-rose-400'
            }`}
        >
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 ${message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
            {message.type === 'success' ? <ShieldCheck size={24} /> : <Info size={24} />}
          </div>
          <div className="flex-1">
            <p className="uppercase tracking-widest text-[10px] mb-0.5 opacity-60">Notification</p>
            <p>{message.text}</p>
          </div>
        </div>
      )}

      {/* Progress */}
      {uploading && (
        <div
          ref={progressRef}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl sm:rounded-[40px] p-5 sm:p-10 shadow-2xl relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600">
                <Binary size={24} className="animate-pulse" />
              </div>
              <div>
                <span className="text-[12px] sm:text-[14px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] block mb-1">Uploading...</span>
                <span className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-bold">Transferring your files to cloud storage...</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400">{uploadProgress}%</span>
            </div>
          </div>
          <div className="w-full h-5 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden p-1 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 via-blue-500 to-indigo-600 bg-[length:200%_auto] animate-shimmer transition-all duration-500 rounded-xl"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Upload Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-10">
        <div className="lg:col-span-2">
          <UploadBox onUpload={handleUpload} multiple={true} maxFileSizeBytes={uploadMaxFileSizeBytes} />
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl sm:rounded-[40px] p-5 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-5 sm:mb-6">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600">
                <Info size={20} />
              </div>
              <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-sm">Upload Info</h3>
            </div>
            <div className="space-y-6">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-2">
                  <Zap size={16} className="text-amber-500" />
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase underline decoration-amber-500/30 underline-offset-4">Max File Size</span>
                </div>
                <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white">{(uploadMaxFileSizeBytes / (1024 * 1024)).toFixed(0)} MB</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Per upload</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-2">
                  <Sparkles size={16} className="text-indigo-500" />
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase underline decoration-indigo-500/30 underline-offset-4">AI Processing</span>
                </div>
                <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white">Automated</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Files are auto-categorized by AI</p>
              </div>
            </div>
          </div>

          <div className="bg-indigo-600 dark:bg-indigo-700 rounded-3xl sm:rounded-[40px] p-5 sm:p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-500/30">
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
            <h3 className="text-lg sm:text-xl font-black mb-3 sm:mb-4 tracking-tight">Security & Encryption</h3>
            <p className="text-indigo-100 text-xs sm:text-sm font-bold leading-relaxed mb-5 sm:mb-6">
              Your files are encrypted using AES-256 standards during upload and storage.
            </p>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 w-fit px-3 py-1.5 rounded-full">
              <ShieldCheck size={12} />
              Secured by AWS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadFile;
