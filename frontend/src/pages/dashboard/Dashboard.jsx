import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FolderOpen,
  Upload,
  Clock,
  Shield,
  Search,
  Plus,
  ArrowRight,
  BrainCircuit,
  FileText,
  PieChart,
  Cloud,
  History,
  HardDrive,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import FileCard from '../../components/files/FileCard';
import Button from '../../components/common/Button';
import fileService from '../../services/fileService';
import { calculateStorageUsage } from '../../utils/storage';
import { formatFileSize } from '../../utils/format';

const StatsCard = ({ title, value, icon, trend, className = '' }) => (
  <div className={`p-6 rounded-2xl flex flex-col justify-between shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md hover:-translate-y-1 bg-white dark:bg-slate-900 ${className}`}>
    <div className="flex justify-between items-start mb-4">
      <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/30">
        {icon}
      </div>
      <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
        {trend}
      </span>
    </div>
    <div>
      <h3 className="text-slate-500 dark:text-slate-400 text-sm font-bold mb-1">{title}</h3>
      <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</p>
    </div>
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalFiles: 0,
    storageUsedBytes: 0,
    storageUsedGB: '0',
    percentUsed: 0,
    aiProcessedFiles: 0,
    storageLimitGB: '1',
    breakdown: []
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const result = await fileService.getAllFiles();
        if (result.success) {
          const allFiles = result.data;
          setFiles(allFiles);

          const storage = calculateStorageUsage(allFiles, user);
          const usedGB = storage.totalBytes / (1024 * 1024 * 1024);
          const limitGB = storage.limitBytes / (1024 * 1024 * 1024);
          const aiProcessedFiles = allFiles.filter((file) => file.aiAnalysisStatus === 'COMPLETED').length;

          // Breakdown calculation
          const categories = {};
          allFiles.forEach(f => {
            const cat = f.category || 'Other';
            categories[cat] = (categories[cat] || 0) + (f.size || 0);
          });

          const breakdownData = Object.entries(categories).map(([label, size]) => {
            const colorMap = {
              'Documents': 'bg-blue-500',
              'Images': 'bg-emerald-500',
              'Media': 'bg-purple-500',
              'Code': 'bg-amber-500',
              'Other': 'bg-slate-500'
            };
            return {
              label,
              sizeText: formatFileSize(size),
              percent: storage.totalBytes > 0 ? Math.round((size / storage.totalBytes) * 100) : 0,
              color: colorMap[label] || colorMap['Other']
            };
          }).sort((a, b) => b.percent - a.percent).slice(0, 3);

          setStats({
            totalFiles: allFiles.length,
            storageUsedBytes: storage.totalBytes,
            storageUsedGB: usedGB.toFixed(4),
            percentUsed: storage.percentUsed.toFixed(2),
            aiProcessedFiles,
            storageLimitGB: limitGB.toFixed(2),
            breakdown: breakdownData
          });
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const recentFiles = files.slice(0, 4);
  const activityLog = files.slice(0, 3).map(f => ({
    user: 'You',
    action: 'Uploaded',
    target: f.originalName,
    time: f.uploadDate ? new Date(f.uploadDate).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'Just now',
    icon: <Upload size={14} />
  }));

  return (
    <div className="space-y-8 pb-12 animate-fade-in max-w-7xl mx-auto">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-indigo-600 dark:bg-indigo-700 p-8 lg:p-10 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight mb-2">
            Hello, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-indigo-100 font-medium text-lg">
            Your workspace is organized and ready.
          </p>
        </div>
        <div className="flex gap-4 relative z-10">
          <Link to="/upload">
            <Button variant="secondary" className="bg-white !text-indigo-600 hover:bg-slate-50 border-none shadow-md rounded-xl h-12 px-6 font-bold transition-all hover:-translate-y-1 text-sm">
              <Plus size={18} className="mr-2 stroke-[2]" /> Upload File
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Files"
          value={stats.totalFiles}
          icon={<FolderOpen size={22} />}
          trend="All Files"
        />
        <StatsCard
          title="Storage Used"
          value={`${stats.percentUsed}%`}
          icon={<HardDrive size={22} />}
          trend={`Of ${stats.storageLimitGB}GB Limit`}
        />
        <StatsCard
          title="Storage Size"
          value={`${stats.storageUsedGB} GB`}
          icon={<Upload size={22} />}
          trend="Total Used"
        />
        <StatsCard
          title="AI Processed"
          value={stats.aiProcessedFiles}
          icon={<BrainCircuit size={22} />}
          trend="Completed Files"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Files */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <Clock size={20} className="text-indigo-600" />
              Recent Uploads
            </h2>
            <Link to="/files" className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
              View All Files <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200 dark:border-slate-800"></div>
              ))
            ) : recentFiles.length > 0 ? (
              recentFiles.map(file => (
                <FileCard
                  key={file.id}
                  file={file}
                  viewMode="grid"
                  onDeleted={(deletedId) => {
                    setFiles((prev) => (prev || []).filter((item) => item.id !== deletedId));
                  }}
                />
              ))
            ) : (
              <div className="col-span-2 py-16 flex flex-col items-center justify-center bg-white/95 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700/70 rounded-2xl text-center shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center text-slate-300 dark:text-slate-500 mb-6 border border-slate-100 dark:border-slate-700">
                  <FolderOpen size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">No Files Yet</h3>
                <p className="text-slate-500 dark:text-slate-300 max-w-xs font-medium text-sm">Upload your first file to get started with AI sorting.</p>
                <Link to="/upload" className="mt-6">
                  <Button
                    variant="secondary"
                    className="rounded-xl px-6 border border-slate-200 dark:border-indigo-400/40 text-sm font-bold bg-white dark:bg-indigo-500/90 dark:text-white hover:bg-slate-50 dark:hover:bg-indigo-500"
                  >
                    Upload File
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick Activity / Storage Breakdown */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <PieChart size={20} className="text-emerald-500" />
              Storage Breakdown
            </h2>

            <div className="space-y-6">
              {stats.breakdown.length > 0 ? stats.breakdown.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{item.label}</span>
                    <span className="text-slate-500 text-xs">{item.sizeText} ({item.percent}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className={`${item.color} h-full rounded-full transition-all duration-1000`} style={{ width: `${item.percent}%` }}></div>
                  </div>
                </div>
              )) : (
                <div className="py-6 text-center text-slate-400 font-medium text-sm italic">
                  No categorization data available.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <History size={20} className="text-indigo-500" />
              Recent Activity
            </h2>

            <div className="space-y-6">
              {activityLog.length > 0 ? activityLog.map((log, i) => (
                <div key={i} className="flex gap-4 group">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center text-slate-500 dark:text-slate-400 flex-shrink-0 transition-all duration-300">
                    {log.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">
                      <span className="text-slate-900 dark:text-white">{log.user}</span> {log.action.toLowerCase()} <span className="text-indigo-600 dark:text-indigo-400">{log.target}</span>
                    </p>
                    <span className="text-xs text-slate-500 dark:text-slate-500">{log.time}</span>
                  </div>
                </div>
              )) : (
                <div className="py-6 text-center text-slate-400 font-medium text-sm italic">
                  No recent activity logs found.
                </div>
              )}
            </div>

            <Link to="/analytics" className="block text-center mt-8 text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
              View Analytics
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
