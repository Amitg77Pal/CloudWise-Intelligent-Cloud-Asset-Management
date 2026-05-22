import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Cloud, ArrowRight, Shield, Zap, Lock, Mail } from 'lucide-react';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { useToast } from '../../context/ToastContext';

const Login = () => {
  const navigate = useNavigate();
  const { login, verifyMfa } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: false,
  });
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (requiresMfa) {
      const result = await verifyMfa(formData.email, mfaCode, { remember: formData.remember });
      if (result.success) {
        showToast({ type: 'success', message: 'Signed in successfully.', duration: 6000 });
        setTimeout(() => navigate('/dashboard'), 800);
      } else {
        setError(result.error || 'Invalid security code.');
      }
      setLoading(false);
      return;
    }

    const result = await login(formData.email, formData.password, { remember: formData.remember });

    if (result.requiresMfa) {
      setRequiresMfa(true);
      showToast({ type: 'info', message: 'Please check your email for the security code.', duration: 6000 });
    } else if (result.success) {
      showToast({ type: 'success', message: 'Signed in successfully.', duration: 6000 });
      setTimeout(() => navigate('/dashboard'), 800);
    } else {
      setError(result.error || 'Invalid email or password');
      showToast({ type: 'error', message: result.error || 'Login failed. Please check your credentials.', duration: 6000 });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Left Side: Illustration & Branding */}
      <div className="hidden lg:flex w-1/2 bg-blue-600 relative items-center justify-center p-12 overflow-hidden">
        {/* Soft decorative elements */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-blue-500 opacity-50 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-blue-700 opacity-50 blur-3xl"></div>

        <div className="relative z-10 max-w-md text-white">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
              <Cloud className="w-7 h-7" />
            </div>
            <span className="text-3xl font-bold tracking-tight">CloudWise</span>
          </div>

          <h1 className="text-4xl font-bold mb-6 leading-tight">
            Secure, intelligent <br />
            cloud storage.
          </h1>

          <p className="text-lg text-blue-100 mb-12 leading-relaxed">
            Manage your files effortlessly with our AI-powered organization tailored for modern workflows.
          </p>

          <div className="grid grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-black/10 backdrop-blur-sm border border-white/10">
              <Shield className="w-6 h-6 text-emerald-300 mb-3" />
              <h3 className="font-semibold mb-1">AES-256 Security</h3>
              <p className="text-sm text-blue-100/70">Enterprise-grade encryption for all files.</p>
            </div>
            <div className="p-5 rounded-xl bg-black/10 backdrop-blur-sm border border-white/10">
              <Zap className="w-6 h-6 text-amber-300 mb-3" />
              <h3 className="font-semibold mb-1">Lightning Fast</h3>
              <p className="text-sm text-blue-100/70">Optimized access and rapid downloads.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white dark:bg-slate-900 shadow-2xl relative z-10 rounded-l-3xl lg:-ml-6">
        <div className="absolute top-8 right-8 lg:hidden">
          <div className="flex items-center gap-2">
            <Cloud className="w-6 h-6 text-blue-600" />
            <span className="text-xl font-bold dark:text-white">CloudWise</span>
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              {requiresMfa ? 'Security Check' : 'Welcome Back'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              {requiresMfa ? 'Enter the 6-digit code sent to your email' : 'Sign in to your CloudWise account'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/30 rounded-xl flex items-center gap-3 text-rose-600 dark:text-rose-400 text-sm md:text-base">
              <Lock size={16} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {requiresMfa ? (
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Security Code</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <Shield size={18} />
                  </div>
                  <input
                    type="text"
                    name="mfaCode"
                    placeholder="123456"
                    maxLength={6}
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none text-slate-900 dark:text-white tracking-widest text-center text-lg font-bold"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      name="email"
                      placeholder="name@domain.com"
                      className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none text-slate-900 dark:text-white"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Password</label>
                    <Link to="/forgot-password" className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">Forgot password?</Link>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <Lock size={18} />
                    </div>
                    <input
                      type="password"
                      name="password"
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none text-slate-900 dark:text-white"
                      value={formData.password}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 pb-2">
                  <input
                    type="checkbox"
                    id="remember"
                    name="remember"
                    checked={formData.remember}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="remember" className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer">Stay signed in</label>
                </div>
              </>
            )}

            <Button type="submit" variant="primary" loading={loading} className="w-full py-3.5 text-base font-semibold bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/30 transition-all">
              {requiresMfa ? 'Verify Security Code' : 'Sign In'}
            </Button>
          </form>

          {!requiresMfa && (
            <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline underline-offset-4">
                Create one
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
