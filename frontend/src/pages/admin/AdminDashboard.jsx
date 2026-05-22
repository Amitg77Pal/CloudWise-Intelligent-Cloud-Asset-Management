import { useState, useEffect, useMemo } from 'react';
import {
    Users,
    HardDrive,
    Activity,
    ShieldCheck,
    UserPlus,
    BarChart3,
    Database,
    Lock,
    Search,
    MoreVertical,
    CheckCircle2,
    Filter,
    SlidersHorizontal,
    Settings,
    Power,
    Server,
    XCircle,
    FileText,
    Download,
    Calendar,
    ClipboardList
} from 'lucide-react';
import Button from '../../components/common/Button';
import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

const AdminDashboard = () => {
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalStorage: '0 B',
        activeUsers: 0,
        systemUptime: '0%',
        storageLimit: '100 GB'
    });

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [transfers, setTransfers] = useState([]);
    const [settings, setSettings] = useState({
        uploadMaxFileSizeBytes: 104857600,
        transferDefaultExpiryMinutes: 10,
        transferDefaultMaxDownloads: 1,
        transferMaxFileSizeBytes: 52428800,
        defaultUserStorageLimitBytes: 1073741824,
    });
    const [savingSettings, setSavingSettings] = useState(false);
    const [updatingUserId, setUpdatingUserId] = useState(null);
    const [pendingLimits, setPendingLimits] = useState({});
    const { showToast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [sortKey, setSortKey] = useState('storage');

    // Audit report state
    const [auditReportOpen, setAuditReportOpen] = useState(false);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditReport, setAuditReport] = useState(null);
    const [auditFrom, setAuditFrom] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [auditTo, setAuditTo] = useState(() => new Date().toISOString().split('T')[0]);

    // Recent audit logs
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditLogsLoading, setAuditLogsLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError('');
                const [statsRes, usersRes, settingsRes, transfersRes] = await Promise.all([
                    adminService.getStats(),
                    adminService.getUsers(),
                    adminService.getSettings(),
                    adminService.getTransfers(),
                ]);

                setStats(statsRes.stats || stats);
                setUsers(usersRes.items || []);
                setSettings({
                    uploadMaxFileSizeBytes: settingsRes.uploadMaxFileSizeBytes ?? settings.uploadMaxFileSizeBytes,
                    transferDefaultExpiryMinutes: settingsRes.transferDefaultExpiryMinutes ?? settings.transferDefaultExpiryMinutes,
                    transferDefaultMaxDownloads: settingsRes.transferDefaultMaxDownloads ?? settings.transferDefaultMaxDownloads,
                    transferMaxFileSizeBytes: settingsRes.transferMaxFileSizeBytes ?? settings.transferMaxFileSizeBytes,
                    defaultUserStorageLimitBytes: settingsRes.defaultUserStorageLimitBytes ?? null,
                });
                setTransfers(transfersRes.items || []);
            } catch (error) {
                console.error("Failed to fetch admin statistics", error);
                setError('Unable to load admin data. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        fetchAuditLogs();
    }, []);

    const fetchAuditLogs = async () => {
        try {
            setAuditLogsLoading(true);
            const res = await adminService.getAuditLogs();
            setAuditLogs(res.items || []);
        } catch (e) {
            console.error('Failed to fetch audit logs', e);
        } finally {
            setAuditLogsLoading(false);
        }
    };

    const filteredUsers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        let next = users;
        if (query) {
            next = next.filter((u) =>
                String(u.name || '').toLowerCase().includes(query) ||
                String(u.email || '').toLowerCase().includes(query)
            );
        }
        if (roleFilter !== 'All') {
            next = next.filter((u) => String(u.role || '').toUpperCase() === roleFilter);
        }

        const sorter = {
            storage: (a, b) => (b.storageBytes || 0) - (a.storageBytes || 0),
            files: (a, b) => (b.fileCount || 0) - (a.fileCount || 0),
            newest: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
            name: (a, b) => String(a.name || '').localeCompare(String(b.name || '')),
        };

        return [...next].sort(sorter[sortKey] || sorter.storage);
    }, [users, searchQuery, roleFilter, sortKey]);

    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    };

    const handleToggleUser = async (user) => {
        if (!user) return;
        setUpdatingUserId(user.id);
        try {
            const res = await adminService.updateUserStatus({ id: user.id, active: !user.active });
            setUsers((prev) => prev.map((u) => (u.id === user.id ? {
                ...u,
                active: res.active,
                status: res.active ? 'Active' : 'Disabled',
            } : u)));
            showToast({ type: 'success', message: user.active ? 'User deactivated.' : 'User reactivated.', duration: 6000 });
            fetchAuditLogs();
        } catch (e) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'Failed to update user status.', duration: 7000 });
        } finally {
            setUpdatingUserId(null);
        }
    };

    const handleUpdateStorageLimit = async (user) => {
        if (!user) return;
        const raw = pendingLimits[user.id];
        const value = raw === '' || raw == null ? null : Number(raw);
        if (value != null && Number.isNaN(value)) {
            showToast({ type: 'error', message: 'Storage limit must be a number (GB).', duration: 6000 });
            return;
        }

        const bytes = value == null ? 0 : Math.max(0, Math.round(value * 1024 * 1024 * 1024));
        setUpdatingUserId(user.id);
        try {
            const res = await adminService.updateUserStorageLimit({ id: user.id, storageLimitBytes: bytes });
            setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, storageLimitBytes: res.storageLimitBytes } : u)));
            setPendingLimits((prev) => ({ ...prev, [user.id]: '' }));
            showToast({ type: 'success', message: 'Storage limit updated.', duration: 6000 });
            fetchAuditLogs();
        } catch (e) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'Failed to update storage limit.', duration: 7000 });
        } finally {
            setUpdatingUserId(null);
        }
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            const payload = {
                uploadMaxFileSizeBytes: Number(settings.uploadMaxFileSizeBytes),
                transferDefaultExpiryMinutes: Number(settings.transferDefaultExpiryMinutes),
                transferDefaultMaxDownloads: Number(settings.transferDefaultMaxDownloads),
                transferMaxFileSizeBytes: Number(settings.transferMaxFileSizeBytes),
                defaultUserStorageLimitBytes: settings.defaultUserStorageLimitBytes == null || settings.defaultUserStorageLimitBytes === ''
                    ? 0
                    : Number(settings.defaultUserStorageLimitBytes),
            };
            const res = await adminService.updateSettings(payload);
            setSettings({
                uploadMaxFileSizeBytes: res.uploadMaxFileSizeBytes ?? settings.uploadMaxFileSizeBytes,
                transferDefaultExpiryMinutes: res.transferDefaultExpiryMinutes ?? settings.transferDefaultExpiryMinutes,
                transferDefaultMaxDownloads: res.transferDefaultMaxDownloads ?? settings.transferDefaultMaxDownloads,
                transferMaxFileSizeBytes: res.transferMaxFileSizeBytes ?? settings.transferMaxFileSizeBytes,
                defaultUserStorageLimitBytes: res.defaultUserStorageLimitBytes ?? null,
            });
            showToast({ type: 'success', message: 'Settings updated.', duration: 6000 });
            fetchAuditLogs();
        } catch (e) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'Failed to update settings.', duration: 7000 });
        } finally {
            setSavingSettings(false);
        }
    };

    const handleEndTransfer = async (sessionId) => {
        if (!sessionId) return;
        if (!window.confirm('End this transfer session? This will revoke access.')) return;
        try {
            const res = await adminService.endTransfer({ session_id: sessionId });
            if (res?.error) {
                throw new Error(res.error);
            }
            setTransfers((prev) => prev.filter((item) => item.session_id !== sessionId));
            showToast({ type: 'success', message: 'Transfer session ended.', duration: 6000 });
            fetchAuditLogs();
        } catch (e) {
            showToast({ type: 'error', message: e?.response?.data?.message || e?.message || 'Failed to end transfer session.', duration: 7000 });
        }
    };

    const handleGenerateAuditReport = async () => {
        setAuditLoading(true);
        try {
            const report = await adminService.getAuditReport({ from: auditFrom, to: auditTo });
            setAuditReport(report);
            showToast({ type: 'success', message: 'Audit report generated.', duration: 5000 });
        } catch (e) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'Failed to generate audit report.', duration: 7000 });
        } finally {
            setAuditLoading(false);
        }
    };

    const handleDownloadCsv = () => {
        if (!auditReport?.entries?.length) return;
        const headers = ['Timestamp', 'Action', 'Performed By', 'Email', 'Target ID', 'Target Type', 'Details', 'IP Address'];
        const rows = auditReport.entries.map((e) => [
            e.timestamp || '',
            e.action || '',
            e.performedBy || '',
            e.performedByEmail || '',
            e.targetId || '',
            e.targetType || '',
            (e.details || '').replace(/"/g, '""'),
            e.ipAddress || '',
        ]);
        const csvContent = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-report-${auditFrom}-to-${auditTo}.csv`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const getActionColor = (action) => {
        if (!action) return 'text-slate-500 bg-slate-50 dark:bg-slate-800';
        if (action.includes('DELETE')) return 'text-rose-600 bg-rose-50 dark:bg-rose-900/20';
        if (action.includes('LOGIN_FAILED')) return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20';
        if (action.includes('UPLOAD') || action.includes('REGISTER')) return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20';
        if (action.includes('ADMIN')) return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20';
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6 sm:space-y-8 pb-10 sm:pb-12 animate-fade-in max-w-7xl mx-auto px-2 sm:px-0">
            {/* Admin Header */}
            <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 lg:p-10 rounded-3xl sm:rounded-[40px] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 sm:p-12 opacity-5 pointer-events-none transform translate-x-10 sm:translate-x-20 -translate-y-10 sm:-translate-y-20">
                    <ShieldCheck size={320} className="text-white" />
                </div>

                <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-4 sm:mb-6">
                        <Lock size={12} />
                        Master Control Center
                    </div>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tighter mb-3 sm:mb-4">
                        System Overseer Console
                    </h1>
                    <p className="text-slate-400 font-medium text-sm sm:text-base lg:text-lg max-w-2xl">
                        Real-time platform metrics and user governance. <span className="text-indigo-400">Strictly privacy-compliant.</span>
                    </p>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 px-6 py-4 font-semibold text-sm">
                    {error}
                </div>
            )}

            {/* Admin Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
                {[
                    { title: 'Registered Users', value: stats.totalUsers, icon: <Users />, trend: 'All time', color: 'text-blue-500' },
                    { title: 'Total Storage', value: stats.totalStorage, icon: <HardDrive />, trend: `${stats.storageLimit} max`, color: 'text-indigo-500' },
                    { title: 'Total Files', value: stats.totalFiles || 0, icon: <Database />, trend: 'All assets', color: 'text-emerald-500' },
                    { title: 'Concurrent Sessions', value: stats.activeUsers, icon: <Activity />, trend: 'System stable', color: 'text-amber-500' },
                    { title: 'Core Hub Uptime', value: stats.systemUptime, icon: <BarChart3 />, trend: '99.9% SLA', color: 'text-purple-500' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm hover:shadow-md transition-all">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-3 sm:mb-4 ${stat.color}`}>
                            {stat.icon}
                        </div>
                        <h3 className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-1">{stat.title}</h3>
                        <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2">{stat.value}</p>
                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.trend}</span>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* User Management Table */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl sm:rounded-[40px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                                <UserPlus size={24} className="text-indigo-500" />
                                User Governance
                            </h2>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search users..."
                                        className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-10 pr-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2">
                                    <Filter size={14} className="text-slate-400" />
                                    <select
                                        value={roleFilter}
                                        onChange={(e) => setRoleFilter(e.target.value)}
                                        className="bg-transparent text-xs font-bold text-slate-600 dark:text-slate-300 outline-none"
                                    >
                                        <option value="All">All roles</option>
                                        <option value="ADMIN">Admin</option>
                                        <option value="USER">User</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2">
                                    <SlidersHorizontal size={14} className="text-slate-400" />
                                    <select
                                        value={sortKey}
                                        onChange={(e) => setSortKey(e.target.value)}
                                        className="bg-transparent text-xs font-bold text-slate-600 dark:text-slate-300 outline-none"
                                    >
                                        <option value="storage">Sort: Storage</option>
                                        <option value="files">Sort: Files</option>
                                        <option value="newest">Sort: Newest</option>
                                        <option value="name">Sort: Name</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        <th className="px-8 py-4">User Identity</th>
                                        <th className="px-8 py-4">Consumption</th>
                                        <th className="px-8 py-4">Creation Date</th>
                                        <th className="px-8 py-4">Status</th>
                                        <th className="px-8 py-4">Access</th>
                                        <th className="px-8 py-4 text-center">Controls</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-8 py-10 text-center text-sm font-semibold text-slate-500">
                                                No users match the current filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map((u) => (
                                            <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors group">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 font-black text-xs">
                                                            {String(u.name || 'U').charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-slate-900 dark:text-white">{u.name}</p>
                                                            <p className="text-xs text-slate-500">{u.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="text-xs font-bold text-slate-500 mb-2">{u.storage}</div>
                                                    <div className="h-2 w-40 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-indigo-500 rounded-full"
                                                            style={{ width: `${Math.min(100, Math.round(((u.storageBytes || 0) / Math.max(stats.totalStorageBytes || 1, 1)) * 100))}%` }}
                                                        ></div>
                                                    </div>
                                                    <div className="mt-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                                                        {u.fileCount || 0} files
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-sm font-medium text-slate-500">{u.joined}</td>
                                                <td className="px-8 py-5">
                                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${u.status === 'Active' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                                                        }`}>
                                                        {u.status}
                                                    </span>
                                                    <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                                        {u.role || 'USER'}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => handleToggleUser(u)}
                                                            disabled={updatingUserId === u.id}
                                                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${u.active ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}
                                                        >
                                                            {u.active ? <Power size={12} /> : <XCircle size={12} />}
                                                            {u.active ? 'Active' : 'Disabled'}
                                                        </button>
                                                        <div className="text-[10px] font-bold text-slate-400">
                                                            Limit: {u.storageLimitBytes ? formatBytes(u.storageLimitBytes) : 'Unlimited'}
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            placeholder="Limit (GB)"
                                                            value={pendingLimits[u.id] ?? ''}
                                                            onChange={(e) => setPendingLimits((prev) => ({ ...prev, [u.id]: e.target.value }))}
                                                            className="w-28 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-semibold"
                                                        />
                                                        <Button
                                                            variant="secondary"
                                                            size="small"
                                                            onClick={() => handleUpdateStorageLimit(u)}
                                                            disabled={updatingUserId === u.id}
                                                        >
                                                            Save
                                                        </Button>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400" title="More options">
                                                        <MoreVertical size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* System Activity */}
                <div className="space-y-8">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-8 rounded-3xl sm:rounded-[40px] shadow-sm">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                            <Database size={20} className="text-purple-500" />
                            S3 Infrastructure
                        </h3>

                        <div className="space-y-6">
                            {[
                                { label: 'Region: ap-south-1', value: 'Healthy', icon: <CheckCircle2 size={16} />, color: 'text-emerald-500' },
                                { label: 'Bucket Encryption', value: 'AES-256', icon: <Lock size={16} />, color: 'text-indigo-500' },
                                { label: 'API Latency', value: '24ms', icon: <Activity size={16} />, color: 'text-blue-500' },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <span className={item.color}>{item.icon}</span>
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{item.label}</span>
                                    </div>
                                    <span className="text-xs font-black text-slate-900 dark:text-white">{item.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-end mb-4">
                                <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Global Capacity</p>
                                <p className="text-xs font-bold text-slate-500">43.2% Full</p>
                            </div>
                            <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full w-[43.2%] bg-indigo-500 rounded-full"></div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-indigo-600 p-5 sm:p-8 rounded-3xl sm:rounded-[40px] shadow-xl text-white">
                        <h3 className="text-lg font-black mb-2 tracking-tight">Security Protocol</h3>
                        <p className="text-indigo-100 text-sm font-medium mb-6 leading-relaxed">
                            Administrative access is audited. No access to private user binary data is permitted under protocol v2.4.
                        </p>
                        <Button
                            variant="secondary"
                            className="w-full bg-white text-indigo-600 border-none font-black text-xs uppercase tracking-widest rounded-2xl h-12"
                            onClick={() => setAuditReportOpen(!auditReportOpen)}
                        >
                            <FileText size={16} className="mr-2" />
                            {auditReportOpen ? 'Close Audit Panel' : 'Generate Audit Report'}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-8 rounded-3xl sm:rounded-[40px] shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <Server size={18} className="text-indigo-500" />
                            Active Transfers
                        </h3>
                        <span className="text-xs font-bold text-slate-400">{transfers.length} sessions</span>
                    </div>

                    {transfers.length === 0 ? (
                        <div className="text-sm text-slate-500">No active transfer sessions found.</div>
                    ) : (
                        <div className="space-y-3">
                            {transfers.slice(0, 8).map((item) => (
                                <div key={item.session_id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-black uppercase tracking-widest text-slate-400">Session</div>
                                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 break-all">{item.session_id}</div>
                                        </div>
                                        <Button variant="secondary" size="small" onClick={() => handleEndTransfer(item.session_id)}>
                                            End
                                        </Button>
                                    </div>
                                    <div className="mt-2 text-xs text-slate-500">
                                        Status: {item.status} • Expires: {new Date(item.expires_at).toLocaleString()}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                        Downloads: {item.downloads_count}/{item.max_downloads} • User ID: {item.created_by_user_id}
                                    </div>
                                </div>
                            ))}
                            {transfers.length > 8 && (
                                <div className="text-xs text-slate-400 font-bold">Showing 8 of {transfers.length} active sessions.</div>
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-8 rounded-3xl sm:rounded-[40px] shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <Settings size={18} className="text-amber-500" />
                            Platform Settings
                        </h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Max upload size (MB)</label>
                            <input
                                type="number"
                                min="1"
                                value={Math.round((settings.uploadMaxFileSizeBytes || 0) / (1024 * 1024))}
                                onChange={(e) => setSettings((prev) => ({
                                    ...prev,
                                    uploadMaxFileSizeBytes: Number(e.target.value) * 1024 * 1024,
                                }))}
                                className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-semibold"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Transfer expiry (minutes)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={settings.transferDefaultExpiryMinutes}
                                    onChange={(e) => setSettings((prev) => ({
                                        ...prev,
                                        transferDefaultExpiryMinutes: e.target.value,
                                    }))}
                                    className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-semibold"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Max downloads</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={settings.transferDefaultMaxDownloads}
                                    onChange={(e) => setSettings((prev) => ({
                                        ...prev,
                                        transferDefaultMaxDownloads: e.target.value,
                                    }))}
                                    className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-semibold"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Transfer max file size (MB)</label>
                            <input
                                type="number"
                                min="1"
                                value={Math.round((settings.transferMaxFileSizeBytes || 0) / (1024 * 1024))}
                                onChange={(e) => setSettings((prev) => ({
                                    ...prev,
                                    transferMaxFileSizeBytes: Number(e.target.value) * 1024 * 1024,
                                }))}
                                className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-semibold"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Default user storage limit (GB)</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="0 = unlimited"
                                value={settings.defaultUserStorageLimitBytes == null ? '' : Math.round(settings.defaultUserStorageLimitBytes / (1024 * 1024 * 1024))}
                                onChange={(e) => setSettings((prev) => ({
                                    ...prev,
                                    defaultUserStorageLimitBytes: e.target.value === '' ? null : Number(e.target.value) * 1024 * 1024 * 1024,
                                }))}
                                className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-semibold"
                            />
                        </div>

                        <Button variant="primary" onClick={handleSaveSettings} disabled={savingSettings}>
                            {savingSettings ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Recent Audit Activity */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-8 rounded-3xl sm:rounded-[40px] shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <ClipboardList size={18} className="text-indigo-500" />
                        Recent Audit Activity
                    </h3>
                    <button
                        onClick={fetchAuditLogs}
                        className="text-xs font-bold text-indigo-500 hover:text-indigo-600 transition-colors"
                    >
                        Refresh
                    </button>
                </div>

                {auditLogsLoading ? (
                    <div className="text-sm text-slate-500 text-center py-4">Loading audit logs...</div>
                ) : auditLogs.length === 0 ? (
                    <div className="text-sm text-slate-500 text-center py-8 font-semibold">
                        No audit events yet. Actions like login, file upload, and admin changes will appear here.
                    </div>
                ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {auditLogs.slice(0, 20).map((log, i) => (
                            <div key={log.id || i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase whitespace-nowrap ${getActionColor(log.action)}`}>
                                    {log.action}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{log.details || '—'}</div>
                                    <div className="text-[10px] text-slate-400">{log.performedByEmail || 'System'} • {log.timestamp}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* Audit Report Panel Modal */}
        {auditReportOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl sm:rounded-[40px] shadow-2xl animate-scale-up max-w-5xl w-full max-h-[90vh] overflow-y-auto relative">
                    <button
                        onClick={() => setAuditReportOpen(false)}
                        className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                        title="Close"
                    >
                        <XCircle size={24} />
                    </button>
                    <div className="flex items-center justify-between mb-6 pr-8">
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <ClipboardList size={24} className="text-indigo-500" />
                            Audit Report Generator
                        </h3>
                    </div>

                    <div className="flex flex-wrap items-end gap-4 mb-6">
                        <div>
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500 block mb-2">
                                <Calendar size={12} className="inline mr-1" /> From
                            </label>
                            <input
                                type="date"
                                value={auditFrom}
                                onChange={(e) => setAuditFrom(e.target.value)}
                                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-semibold"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500 block mb-2">
                                <Calendar size={12} className="inline mr-1" /> To
                            </label>
                            <input
                                type="date"
                                value={auditTo}
                                onChange={(e) => setAuditTo(e.target.value)}
                                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-semibold"
                            />
                        </div>
                        <Button variant="primary" onClick={handleGenerateAuditReport} disabled={auditLoading}>
                            {auditLoading ? 'Generating...' : 'Generate Report'}
                        </Button>
                        {auditReport?.entries?.length > 0 && (
                            <Button variant="secondary" onClick={handleDownloadCsv}>
                                <Download size={14} className="mr-1" /> Export CSV
                            </Button>
                        )}
                    </div>

                    {auditReport && (
                        <div className="space-y-6">
                            {/* Report Summary */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-4 rounded-2xl">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-1">Period</div>
                                    <div className="text-sm font-bold text-slate-800 dark:text-white">{auditReport.periodFrom?.split(' ')[0]} → {auditReport.periodTo?.split(' ')[0]}</div>
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-2xl">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">Total Events</div>
                                    <div className="text-2xl font-black text-slate-800 dark:text-white">{auditReport.totalEvents}</div>
                                </div>
                                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4 rounded-2xl">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-purple-500 mb-1">Unique Users</div>
                                    <div className="text-2xl font-black text-slate-800 dark:text-white">{auditReport.uniqueUsers}</div>
                                </div>
                            </div>

                            {/* Action Breakdown */}
                            {auditReport.actionBreakdown?.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-black text-slate-900 dark:text-white mb-3 uppercase tracking-wider">Action Breakdown</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {auditReport.actionBreakdown.map((item, i) => (
                                            <div key={i} className={`px-3 py-2 rounded-xl text-xs font-bold ${getActionColor(item.action)}`}>
                                                {item.action}: {item.count}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Report Entries Table */}
                            {auditReport.entries?.length > 0 && (
                                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                <th className="px-4 py-3">Timestamp</th>
                                                <th className="px-4 py-3">Action</th>
                                                <th className="px-4 py-3">User</th>
                                                <th className="px-4 py-3">Target</th>
                                                <th className="px-4 py-3">Details</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {auditReport.entries.slice(0, 50).map((entry, i) => (
                                                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{entry.timestamp}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${getActionColor(entry.action)}`}>
                                                            {entry.action}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-semibold">{entry.performedByEmail || '—'}</td>
                                                    <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">{entry.targetType ? `${entry.targetType}:${entry.targetId || ''}` : '—'}</td>
                                                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{entry.details || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {auditReport.entries.length > 50 && (
                                        <div className="px-4 py-3 text-xs text-slate-400 font-bold bg-slate-50 dark:bg-slate-800/50">
                                            Showing 50 of {auditReport.entries.length} entries. Export CSV for full data.
                                        </div>
                                    )}
                                </div>
                            )}

                            {auditReport.entries?.length === 0 && (
                                <div className="text-sm text-slate-500 text-center py-8 font-semibold">No audit events found for this period.</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}
    </>
);
};

export default AdminDashboard;
