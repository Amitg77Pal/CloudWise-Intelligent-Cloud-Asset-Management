import { useState, useEffect, useRef } from 'react';
import {
  FolderOpen,
  Search,
  Filter,
  Grid,
  List as ListIcon,
  Plus,
  Binary,
  ArrowUpDown,
  Database,
  Trash2,
  Download,
  Share2,
  Tags
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import fileService from '../../services/fileService';
import FileCard from '../../components/files/FileCard';
import Button from '../../components/common/Button';
import CustomSelect from '../../components/common/CustomSelect';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import { parseAiTags } from '../../utils/aiTags';
import { useToast } from '../../context/ToastContext';

const MyFiles = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('newest');
  const [categories, setCategories] = useState([]);
  const [aiCategories, setAiCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedAiCategory, setSelectedAiCategory] = useState('All');
  const [selectedTag, setSelectedTag] = useState('All');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkCategoryModalOpen, setBulkCategoryModalOpen] = useState(false);
  const [bulkCategoryValue, setBulkCategoryValue] = useState('');
  const searchInputRef = useRef(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadFiles();
    loadCategories();
  }, [selectedCategory, selectedAiCategory]);

  const loadCategories = async () => {
    try {
      const result = await fileService.getCategories();
      if (result.success) {
        setCategories(result.data.standard || []);
        setAiCategories(result.data.ai || []);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadFiles = async () => {
    try {
      setLoading(true);
      setError(null);

      let result;
      if (searchQuery.trim()) {
        result = await fileService.searchFiles(searchQuery);
      } else {
        const params = {};
        if (selectedCategory !== 'All') params.category = selectedCategory;
        if (selectedAiCategory !== 'All') params.aiCategory = selectedAiCategory;
        result = await fileService.getAllFiles(params);
      }

      if (result.success) {
        setFiles(result.data);
      } else {
        setError(result.message || 'Failed to load files.');
      }
    } catch (err) {
      console.error('Error loading files:', err);
      setError('An error occurred while fetching files. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadFiles();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleBulkDelete = async () => {
    if (!selectedFiles.length) return;
    if (!window.confirm(`Delete ${selectedFiles.length} files?`)) return;

    try {
      const result = await fileService.deleteBulk(selectedFiles);
      if (result.success) {
        setSelectedFiles([]);
        setIsSelectionMode(false);
        loadFiles();
        loadCategories();
        showToast({ type: 'success', message: `Deleted ${selectedFiles.length} file(s).` });
      } else {
        setError(result.error || 'Failed to delete selected files.');
        showToast({ type: 'error', message: result.error || 'Bulk delete failed.' });
      }
    } catch (err) {
      console.error('Bulk delete failed:', err);
      setError('An error occurred during bulk deletion.');
      showToast({ type: 'error', message: 'Bulk delete failed. Please try again.' });
    }
  };

  const handleBulkDownload = async () => {
    if (!selectedFiles.length) return;
    try {
      setBulkBusy(true);
      const result = await fileService.downloadFilesZip(selectedFiles, 'my-files.zip');
      if (!result.success) {
        showToast({ type: 'error', message: result.error || 'Bulk download failed.', duration: 7000 });
        return;
      }
      showToast({ type: 'success', message: 'Download started (ZIP).', duration: 6000 });
    } catch (err) {
      console.error('Bulk download failed:', err);
      showToast({ type: 'error', message: 'Bulk download failed. Please try again.', duration: 7000 });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkTransfer = async () => {
    if (!selectedFiles.length) return;
    // Navigate to Transfer page with preselected ids.
    navigate('/transfer', { state: { preselectedFileIds: selectedFiles } });
  };

  const openBulkCategoryModal = () => {
    setBulkCategoryValue('');
    setBulkCategoryModalOpen(true);
  };

  const applyBulkCategory = async () => {
    if (!selectedFiles.length) return;
    const nextCategory = bulkCategoryValue.trim();
    if (!nextCategory) {
      showToast({ type: 'error', message: 'Category cannot be empty.', duration: 6000 });
      return;
    }

    try {
      setBulkBusy(true);
      const result = await fileService.updateCategoryBulk(selectedFiles, nextCategory);
      if (!result.success) {
        showToast({ type: 'error', message: result.error || 'Bulk update failed.', duration: 7000 });
        return;
      }
      showToast({ type: 'success', message: `Updated category for ${selectedFiles.length} file(s).`, duration: 7000 });
      setBulkCategoryModalOpen(false);
      setSelectedFiles([]);
      setIsSelectionMode(false);
      loadFiles();
      loadCategories();
    } catch (err) {
      console.error('Bulk category update failed:', err);
      showToast({ type: 'error', message: 'Bulk category update failed. Please try again.', duration: 7000 });
    } finally {
      setBulkBusy(false);
    }
  };

  const filteredAndSortedFiles = (files || [])
    .filter(file => {
      // Local filter on top of search results
      let match = true;
      if (selectedCategory !== 'All') {
        match = match && (file.category === selectedCategory);
      }
      if (selectedAiCategory !== 'All') {
        match = match && (file.aiCategory === selectedAiCategory);
      }
      if (selectedTag !== 'All') {
        const tags = parseAiTags(file.aiTags).map((t) => t.toLowerCase());
        match = match && tags.includes(selectedTag.toLowerCase());
      }
      return match;
    })
    .sort((a, b) => {
      if (!a || !b) return 0;
      if (sortBy === 'newest') return new Date(b.uploadDate || 0) - new Date(a.uploadDate || 0);
      if (sortBy === 'oldest') return new Date(a.uploadDate || 0) - new Date(b.uploadDate || 0);
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'size') return (b.size || 0) - (a.size || 0);
      return 0;
    });

  const aiTagStats = (files || []).reduce((acc, file) => {
    parseAiTags(file.aiTags).forEach((tag) => {
      const key = String(tag).trim();
      if (!key) return;
      acc[key] = (acc[key] || 0) + 1;
    });
    return acc;
  }, {});

  const aiTagOptions = [
    { label: 'All Tags', value: 'All' },
    ...Object.entries(aiTagStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([tag, count]) => ({ label: `${tag} (${count})`, value: tag })),
  ];

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e) => {
      // CMD+F or CTRL+F or /
      if ((e.key === 'f' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        // Prevent default browser search or typing '/'
        if (e.key === '/') {
          if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
            return; // Don't prevent default if already typing somewhere
          }
        }
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12 px-1 sm:px-0 overflow-x-hidden">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">System Status</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">My Files</h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-semibold sm:font-bold mt-1">
            Manage and query your smart cloud storage
          </p>
        </div>
        <Link to="/upload">
          <Button variant="primary" className="bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 rounded-2xl h-11 sm:h-12 px-5 sm:px-6 font-bold w-full sm:w-auto whitespace-nowrap text-sm sm:text-base">
            <Plus size={18} className="mr-2" /> Upload File
          </Button>
        </Link>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row gap-2 sm:gap-4 items-stretch lg:items-center justify-between bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 group w-full flex flex-col gap-2 sm:gap-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search my files... (Press '/')"
              className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-slate-900 dark:text-white font-semibold text-xs sm:text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3 lg:gap-4">
            <CustomSelect
              options={[
                { label: 'All Types', value: 'All' },
                ...categories.map(cat => ({ label: `${cat.category} (${cat.count})`, value: cat.category }))
              ]}
              value={selectedCategory}
              onChange={setSelectedCategory}
              icon={Filter}
              className="w-full sm:w-[170px] lg:w-[190px]"
            />

            <CustomSelect
              options={[
                { label: 'All Categories', value: 'All' },
                ...aiCategories.map(cat => ({ label: `${cat.category} (${cat.count})`, value: cat.category }))
              ]}
              value={selectedAiCategory}
              onChange={setSelectedAiCategory}
              icon={Binary}
              className="w-full sm:w-[190px] lg:w-[210px]"
            />

            <CustomSelect
              options={aiTagOptions}
              value={selectedTag}
              onChange={setSelectedTag}
              icon={Database}
              className="w-full sm:w-[180px] lg:w-[200px]"
            />

            <CustomSelect
              options={[
                { label: 'Newest First', value: 'newest' },
                { label: 'Oldest First', value: 'oldest' },
                { label: 'Name (A-Z)', value: 'name' },
                { label: 'Size', value: 'size' }
              ]}
              value={sortBy}
              onChange={setSortBy}
              icon={ArrowUpDown}
              className="w-full sm:w-[170px] lg:w-[190px]"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full lg:w-auto">

          <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner border border-slate-200 dark:border-slate-700">
          </div>

          <Button
            variant="primary"
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              if (isSelectionMode) setSelectedFiles([]);
            }}
            className={`px-4 rounded-xl text-sm font-bold w-full sm:w-auto ${isSelectionMode ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
          >
            {isSelectionMode ? 'Cancel Selection' : 'Select'}
          </Button>

          {isSelectionMode && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <Button
                variant="secondary"
                onClick={handleBulkDownload}
                disabled={!selectedFiles.length || bulkBusy}
                className="rounded-xl px-4 text-sm font-bold w-full sm:w-auto"
              >
                <Download size={16} className="mr-2" /> Download ({selectedFiles.length || 0})
              </Button>
              <Button
                variant="secondary"
                onClick={handleBulkTransfer}
                disabled={!selectedFiles.length || bulkBusy}
                className="rounded-xl px-4 text-sm font-bold w-full sm:w-auto"
              >
                <Share2 size={16} className="mr-2" /> Transfer
              </Button>
              <Button
                variant="secondary"
                onClick={openBulkCategoryModal}
                disabled={!selectedFiles.length || bulkBusy}
                className="rounded-xl px-4 text-sm font-bold w-full sm:w-auto"
              >
                <Tags size={16} className="mr-2" /> Update
              </Button>
              <Button
                variant="danger"
                onClick={handleBulkDelete}
                disabled={!selectedFiles.length || bulkBusy}
                className="bg-rose-500 hover:bg-rose-600 text-white shadow-sm rounded-xl px-4 text-sm font-bold w-full sm:w-auto"
              >
                <Trash2 size={16} className="mr-2" /> Delete
              </Button>
            </div>
          )}

          <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden md:block"></div>

          <div className="hidden sm:flex bg-slate-50 dark:bg-slate-800 rounded-2xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              aria-label="Grid View"
              className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Grid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              aria-label="List View"
              className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <ListIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 px-6 py-4 rounded-2xl flex items-center justify-between mb-8 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-rose-100 dark:bg-rose-900/50 p-2 rounded-xl">
              <Trash2 size={20} className="text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h4 className="font-bold text-sm">Action Failed</h4>
              <p className="text-xs">{error}</p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={loadFiles}
            className="bg-white dark:bg-slate-800 border-none shadow-sm text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-50 dark:hover:bg-slate-700"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Repository Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-3xl animate-pulse border border-slate-200 dark:border-slate-800"></div>
          ))}
        </div>
      ) : filteredAndSortedFiles.length > 0 ? (
        <div className={viewMode === 'grid'
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          : "space-y-4"
        }>
          {filteredAndSortedFiles.map(file => (
            <div key={file.id} className="relative group cursor-pointer">
              <FileCard
                file={file}
                viewMode={viewMode}
                onDeleted={(deletedId) => {
                  setFiles((prev) => (prev || []).filter((item) => item.id !== deletedId));
                  loadCategories();
                }}
              />

              {isSelectionMode && (
                <div
                  className="absolute inset-0 z-20 flex"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (selectedFiles.includes(file.id)) {
                      setSelectedFiles(prev => prev.filter(id => id !== file.id));
                    } else {
                      setSelectedFiles(prev => [...prev, file.id]);
                    }
                  }}
                >
                  <div className="absolute top-4 left-4 p-1">
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${selectedFiles.includes(file.id) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 bg-white/80 dark:bg-slate-800/80'}`}>
                      {selectedFiles.includes(file.id) && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-24 flex flex-col items-center justify-center bg-white/95 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700/70 rounded-[48px] text-center">
          <div className="w-20 h-20 rounded-3xl bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center text-slate-300 dark:text-slate-500 mb-6 border border-slate-100 dark:border-slate-700">
            <Binary size={40} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">No files found</h3>
          <p className="text-slate-500 dark:text-slate-300 max-w-sm font-bold text-sm">Your search criteria returned no results. Adjust filters or upload a file.</p>
          <Button
            variant="secondary"
            className="mt-8 border-2 border-slate-200 dark:border-indigo-400/40 rounded-2xl px-8 font-black text-slate-600 dark:text-slate-100 text-xs uppercase tracking-widest bg-white dark:bg-indigo-500/90 hover:bg-slate-50 dark:hover:bg-indigo-500 transition-all"
            onClick={() => setSearchQuery('')}
          >
            Reset Filters
          </Button>
        </div>
      )}

      <Modal
        isOpen={bulkCategoryModalOpen}
        onClose={() => setBulkCategoryModalOpen(false)}
        title={`Update Category (${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'})`}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setBulkCategoryModalOpen(false)} disabled={bulkBusy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={applyBulkCategory} disabled={bulkBusy}>
              Apply
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Input
            label="Category"
            placeholder="e.g. Documents"
            value={bulkCategoryValue}
            onChange={(e) => setBulkCategoryValue(e.target.value)}
            required
          />

          {categories.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Quick pick</div>
              <div className="flex flex-wrap gap-2">
                {categories.slice(0, 12).map((cat) => (
                  <button
                    key={cat.category}
                    type="button"
                    onClick={() => setBulkCategoryValue(cat.category)}
                    className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    {cat.category}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="text-xs text-slate-500">
            This updates only the category metadata (no re-upload).
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MyFiles;
