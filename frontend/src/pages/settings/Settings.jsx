import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { Lock, Bell, Settings as SettingsIcon } from 'lucide-react';
import { authService } from '../../services/authService';

const Settings = () => {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('password');
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [preferences, setPreferences] = useState({
    emailNotifications: user?.emailNotificationsEnabled ?? true,
    autoCategorize: user?.aiClassificationEnabled ?? true,
    mfaEnabled: user?.mfaEnabled ?? false,
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    try {
      setMessage({ type: 'success', text: 'Password updated successfully' });
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to update password',
      });
    }
  };

  const handlePreferenceChange = async (key) => {
    const next = {
      ...preferences,
      [key]: !preferences[key],
    };

    setPreferences(next);
    setMessage({ type: '', text: '' });

    try {
      const updated = await authService.updatePreferences({
        emailNotificationsEnabled: next.emailNotifications,
        aiClassificationEnabled: next.autoCategorize,
        mfaEnabled: next.mfaEnabled,
      });

      updateUser(updated);
      setMessage({ type: 'success', text: 'Preferences saved successfully' });
    } catch (error) {
      setPreferences(preferences);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to save preferences',
      });
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <SettingsIcon size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
        </div>
        <p className="text-base text-slate-600 dark:text-slate-400 font-medium">Manage your account settings and preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-2 transition-all">
            <button
              onClick={() => setActiveTab('password')}
              className={`w-full px-4 py-3 text-left rounded-lg text-sm font-bold transition-all flex items-center gap-3 mb-1 ${activeTab === 'password'
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
            >
              <Lock size={18} />
              Password
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`w-full px-4 py-3 text-left rounded-lg text-sm font-bold transition-all flex items-center gap-3 ${activeTab === 'preferences'
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
            >
              <Bell size={18} />
              Preferences
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {message.text && (
            <div
              className={`mb-6 p-4 rounded-lg border text-sm font-medium ${message.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border-red-200 text-red-700'
                }`}
            >
              {message.text}
            </div>
          )}

          {activeTab === 'password' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden animate-fade-in">
              <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Change Password</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">Update your password to keep your account secure</p>
              </div>
              <div className="p-6">
                <form onSubmit={handlePasswordSubmit} className="space-y-5">
                  <Input
                    label="Current Password"
                    type="password"
                    name="currentPassword"
                    placeholder="Enter current password"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    required
                  />
                  <Input
                    label="New Password"
                    type="password"
                    name="newPassword"
                    placeholder="Enter new password"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    required
                  />
                  <Input
                    label="Confirm New Password"
                    type="password"
                    name="confirmPassword"
                    placeholder="Confirm new password"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    required
                  />
                  <Button type="submit" variant="primary">
                    Update Password
                  </Button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden animate-fade-in">
              <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Preferences</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">Customize your application preferences</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-all font-medium">
                    <div className="flex-1">
                      <div className="text-sm font-bold text-slate-900 dark:text-white mb-1">Email Notifications</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Receive email updates about your files</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.emailNotifications}
                        onChange={() => handlePreferenceChange('emailNotifications')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-all font-medium">
                    <div className="flex-1">
                      <div className="text-sm font-bold text-slate-900 dark:text-white mb-1">Auto Categorize Files</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Automatically categorize uploaded files using AI</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.autoCategorize}
                        onChange={() => handlePreferenceChange('autoCategorize')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-all font-medium">
                    <div className="flex-1">
                      <div className="text-sm font-bold text-slate-900 dark:text-white mb-1">Multi-Factor Authentication</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Require an email security code when signing in</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.mfaEnabled}
                        onChange={() => handlePreferenceChange('mfaEnabled')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
