import { useState, useRef, useEffect } from 'react';
import { Upload, X, Cloud, File } from 'lucide-react';
import Button from '../common/Button';

const UploadBox = ({ onUpload, accept, multiple = false, maxFileSizeBytes = 100 * 1024 * 1024 }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);
  const fileListRef = useRef(null);

  // Auto-scroll to file list when files are added
  useEffect(() => {
    if (selectedFiles.length > 0 && fileListRef.current) {
      fileListRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedFiles.length]);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
  };

  const handleFiles = (files) => {
    const filtered = [];
    for (const f of files) {
      if (maxFileSizeBytes > 0 && f.size > maxFileSizeBytes) {
        // Inform user about rejected file
        try { window.alert(`File "${f.name}" exceeds the allowed max size of ${Math.round(maxFileSizeBytes / (1024*1024))} MB and was skipped.`); } catch (e) {}
        continue;
      }
      filtered.push(f);
    }
    if (!filtered.length) return;
    if (multiple) {
      setSelectedFiles((prev) => [...prev, ...filtered]);
    } else {
      setSelectedFiles(filtered.slice(0, 1));
    }
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0 && onUpload) {
      onUpload(multiple ? selectedFiles : selectedFiles[0]);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-[32px] p-6 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <div
        className={`border-4 border-dashed rounded-[32px] p-10 sm:p-16 lg:p-20 text-center transition-all duration-700 cursor-pointer relative overflow-hidden group ${isDragging
          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/40 scale-[1.01]'
          : 'border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/40 hover:border-indigo-200 dark:hover:border-indigo-700 hover:bg-white dark:hover:bg-slate-900 hover:shadow-2xl hover:shadow-indigo-50/50 dark:hover:shadow-indigo-900/10'
          }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.12),_transparent_55%)] opacity-70"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

        <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 sm:mb-8 rounded-3xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 relative z-10">
          {isDragging ? (
            <Cloud size={44} className="text-indigo-600 animate-bounce" />
          ) : (
            <Upload size={44} className="text-indigo-600" />
          )}
        </div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
            Drag & drop ready
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">
            {isDragging ? 'Drop Files Here' : 'Drop Files Here'}
          </div>
          <div className="text-xs sm:text-[15px] text-slate-500 dark:text-slate-400 mb-6 font-black uppercase tracking-widest">or tap to choose files</div>
          <div className="flex items-center justify-center gap-4">
            <div className="h-px w-8 bg-slate-200 dark:bg-slate-700"></div>
            <div className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Universal Support • 100MB Max</div>
            <div className="h-px w-8 bg-slate-200 dark:bg-slate-700"></div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {selectedFiles.length > 0 && (
        <div ref={fileListRef} className="mt-8 sm:mt-12 pt-8 sm:pt-10 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
              <span className="text-[12px] sm:text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] sm:tracking-widest">
                Selected Files ({selectedFiles.length})
              </span>
            </div>
            <Button
              variant="primary"
              size="medium"
              onClick={handleUpload}
              className="w-full sm:w-auto px-5 sm:px-8 h-10 sm:h-12 rounded-xl font-black text-[12px] sm:text-[13px] uppercase tracking-wider shadow-lg shadow-indigo-100 dark:shadow-none"
            >
              <Upload size={18} className="mr-2" />
              Upload Files
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-xl hover:shadow-slate-100 dark:hover:shadow-indigo-900/10 transition-all group"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600 transition-colors duration-500">
                    <File size={24} className="text-slate-400 dark:text-slate-500 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{file.name}</div>
                    <div className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{formatFileSize(file.size)}</div>
                  </div>
                </div>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 border border-transparent transition-all active:scale-95 ml-4"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadBox;
