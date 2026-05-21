import {
  FileText,
  Image as ImageIcon,
  FileCode,
  FileArchive,
  MoreVertical,
  Download,
  Trash2,
  ExternalLink,
  Shield,
  Binary,
  BrainCircuit,
  Zap,
  ArrowRight,
  File,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import fileService from '../../services/fileService';
import { useToast } from '../../context/ToastContext';

const FileCard = ({ file, viewMode = 'grid', onDeleted }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  if (!file) return null;

  const getFileIcon = (type) => {
    const contentType = type?.toLowerCase() || '';
    if (contentType.includes('pdf')) return <FileText className="text-rose-500" />;
    if (contentType.includes('image')) return <ImageIcon className="text-emerald-500" />;
    if (contentType.includes('code') || contentType.includes('json') || contentType.includes('javascript')) return <FileCode className="text-amber-500" />;
    if (contentType.includes('zip') || contentType.includes('rar') || contentType.includes('compressed')) return <FileArchive className="text-purple-500" />;
    if (contentType.includes('word') || contentType.includes('officedocument')) return <FileText className="text-blue-500" />;
    return <File className="text-slate-400" />;
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const createdAt = file.uploadDate ? new Date(file.uploadDate).toLocaleDateString() : 'Unknown Date';

  const handleDownload = async (e) => {
    e.stopPropagation();
    const result = await fileService.downloadFile(file.id, file.originalName || file.name);
    if (result?.success === false) {
      showToast({ type: 'error', message: result.error || 'Download failed. Please try again.' });
      return;
    }
    showToast({ type: 'success', message: 'Download started.' });
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this file?')) return;
    const result = await fileService.deleteFile(file.id);
    if (result?.success === false) {
      showToast({ type: 'error', message: result.error || 'Delete failed. Please try again.', duration: 7000 });
      return;
    }
    showToast({ type: 'success', message: 'File deleted.', duration: 7000 });
    if (typeof onDeleted === 'function') {
      onDeleted(file.id);
    }
  };

  if (viewMode === 'list') {
    return (
      <div
        onClick={() => navigate(`/files/${file.id}`)}
        className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-500 transition-all cursor-pointer group animate-in fade-in slide-in-from-left-4 duration-300"
      >
        <div className="flex items-center gap-5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-inner">
            {getFileIcon(file.mimeType)}
          </div>
          <div className="min-w-0">
            <h4 className="text-[15px] font-bold text-slate-900 dark:text-white truncate tracking-tight">{file.name}</h4>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">
                {file.category || 'Uncategorized'}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">•</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">{formatSize(file.size)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <div className="hidden md:block text-right mr-4">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-0.5">Uploaded</p>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{createdAt}</p>
          </div>

          {/* Status Indicator */}
          {file.aiAnalysisStatus === 'PENDING' || file.aiAnalysisStatus === 'IN_PROGRESS' ? (
            <div className="flex items-center text-amber-500" title="AI Analysis running...">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : file.aiAnalysisStatus === 'COMPLETED' ? (
            <div className="flex items-center text-emerald-500" title="AI Analysis completed">
              <CheckCircle2 size={16} />
            </div>
          ) : file.aiAnalysisStatus === 'FAILED' ? (
            <div className="flex items-center text-rose-500" title="AI Analysis failed">
              <AlertCircle size={16} />
            </div>
          ) : null}

          {/* Actions Column */}
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all">
            <button
              onClick={handleDownload}
              aria-label="Download File"
              className="p-2.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
              title="Download"
            >
              <Download size={18} />
            </button>
            <button
              onClick={handleDelete}
              className="p-2.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
              aria-label="Delete File"
              title="Delete"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => navigate(`/files/${file.id}`)}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] p-6 hover:shadow-2xl hover:border-indigo-300 dark:hover:border-indigo-500 transition-all cursor-pointer group flex flex-col h-full transform hover:-translate-y-2 duration-300 relative overflow-hidden"
    >
      {/* Decorative gradient background for icon */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 -mr-12 -mt-12 rounded-full blur-2xl group-hover:scale-150 transition-transform"></div>

      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center relative shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
          {getFileIcon(file.mimeType)}
          {(file.aiConfidence > 0.8) && (
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-indigo-100 dark:bg-indigo-900 rounded-xl border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110">
              <Zap size={12} className="text-indigo-600 dark:text-indigo-400 fill-indigo-600 dark:fill-indigo-400" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          {/* Status Indicator */}
          {file.aiAnalysisStatus === 'PENDING' || file.aiAnalysisStatus === 'IN_PROGRESS' ? (
            <div className="flex items-center text-amber-500 mr-2" title="AI Analysis running...">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : file.aiAnalysisStatus === 'COMPLETED' ? (
            <div className="flex items-center text-emerald-500 mr-2" title="AI Analysis completed">
              <CheckCircle2 size={18} />
            </div>
          ) : file.aiAnalysisStatus === 'FAILED' ? (
            <div className="flex items-center text-rose-500 mr-2" title="AI Analysis failed">
              <AlertCircle size={18} />
            </div>
          ) : null}

          <button
            onClick={handleDownload}
            aria-label="Download File"
            className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            title="Download"
          >
            <Download size={16} />
          </button>
          <button
            onClick={handleDelete}
            aria-label="Delete File"
            className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0 mb-6 relative z-10">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 line-clamp-2 tracking-tight leading-snug" title={file.name}>
          {file.name}
        </h3>
        <div className="flex items-center flex-wrap gap-2 mt-auto">
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
            {file.category || 'Uncategorized'}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg">
            {formatSize(file.size)}
          </span>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider relative z-10">
        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
          <Shield size={14} className="text-emerald-500 flex-shrink-0" />
          <span>Verified</span>
        </div>
        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
          Details <ArrowRight size={14} className="stroke-[3]" />
        </div>
      </div>
    </div >
  );
};

export default FileCard;
