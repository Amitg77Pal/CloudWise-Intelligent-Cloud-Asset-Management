import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Cloud, Lock, Mail, User, Shield, Zap, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';
import Button from '../../components/common/Button';
import { authService } from '../../services/authService';

const AuthPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, register, verifyMfa, updateUser } = useAuth();
    const { showToast } = useToast();

    // Determine initial state from URL
    const initialIsLogin = location.pathname !== '/register';
    const [isLogin, setIsLogin] = useState(initialIsLogin);
    const getInitialIsMobile = () => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(max-width: 1024px)').matches;
    };
    const [isMobile, setIsMobile] = useState(getInitialIsMobile);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [requiresMfa, setRequiresMfa] = useState(false);
    const [mfaCode, setMfaCode] = useState('');
    const [showMfaPrompt, setShowMfaPrompt] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Password validation rules
    const passwordRules = [
        { label: 'At least 8 characters', test: (p) => p.length >= 8 },
        { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
        { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
        { label: 'One number', test: (p) => /[0-9]/.test(p) },
        { label: 'One special character (!@#$...)', test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
    ];
    const allPasswordRulesMet = formData.password.length > 0 && passwordRules.every(r => r.test(formData.password));

    // Update URL without full page reload when switching modes
    useEffect(() => {
        const path = isLogin ? '/login' : '/register';
        if (location.pathname !== path) {
            navigate(path, { replace: true });
        }
    }, [isLogin, navigate, location.pathname]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const media = window.matchMedia('(max-width: 1024px)');
        const handleChange = () => setIsMobile(media.matches);

        if (media.addEventListener) {
            media.addEventListener('change', handleChange);
            return () => media.removeEventListener('change', handleChange);
        }

        media.addListener(handleChange);
        return () => media.removeListener(handleChange);
    }, []);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
        setError('');
    };

    const handleToggle = () => {
        setIsLogin(!isLogin);
        setError('');
        // Clear passwords but optionally keep email/name
        setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!isLogin && !allPasswordRulesMet) {
            setError('Password does not meet all requirements');
            return;
        }

        if (!isLogin && formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        if (requiresMfa) {
            const result = await verifyMfa(formData.email, mfaCode);
            if (result.success) {
                showToast({ type: 'success', message: 'Signed in successfully.', duration: 6000 });
                navigate('/dashboard');
            } else {
                setError(result.error || 'Invalid security code.');
            }
            setLoading(false);
            return;
        }

        let result;
        if (isLogin) {
            result = await login(formData.email, formData.password);
        } else {
            result = await register({
                name: formData.name,
                email: formData.email,
                password: formData.password,
            });
        }

        if (result.requiresMfa) {
            setRequiresMfa(true);
            showToast({ type: 'info', message: 'Please check your email for the security code.', duration: 6000 });
        } else if (result.success) {
            if (!isLogin) {
                // Show MFA Prompt for new registrations instead of navigating immediately
                setShowMfaPrompt(true);
                setLoading(false);
                return;
            }
            
            showToast({
                type: 'success',
                message: 'Login successful.',
                duration: 6000
            });
            navigate('/dashboard');
        } else {
            const message = result.error || (isLogin ? 'Invalid email or password' : 'Registration failed');
            setError(message);
            showToast({ type: 'error', message, duration: 6000 });
        }

        setLoading(false);
    };

    const handleEnableMfa = async () => {
        setLoading(true);
        try {
            const updated = await authService.updatePreferences({ mfaEnabled: true });
            updateUser(updated);
            showToast({ type: 'success', message: 'Multi-Factor Authentication enabled successfully!', duration: 5000 });
            navigate('/dashboard');
        } catch (err) {
            showToast({ type: 'error', message: 'Failed to enable MFA. You can try again in settings.', duration: 5000 });
            navigate('/dashboard');
        }
    };

    // Animation variants
    const containerVariants = {
        login: { x: 0 },
        register: { x: "-100%" } // Move container left
    };

    const formVariants = {
        login: { x: "100%", opacity: 1 },
        register: { x: "100%", opacity: 1 }
    };

    const formPanelVariants = isMobile
        ? {
            login: { left: '0%', borderRadius: '0' },
            register: { left: '0%', borderRadius: '0' }
        }
        : {
            login: { left: '50%', borderRadius: '3rem 0 0 3rem' },
            register: { left: '0%', borderRadius: '0 3rem 3rem 0' }
        };

    return (
        <div className={`auth-page min-h-screen flex bg-slate-50 dark:bg-slate-950 relative ${isMobile ? 'overflow-y-auto' : 'overflow-hidden'}`}>
            <div className="w-full h-full flex absolute inset-0">

                {/* Animated Background Container containing both Side Panels */}
                {!isMobile && (
                    <motion.div
                        className="auth-bg-panels w-[200%] h-full flex absolute top-0 left-0 bg-blue-600"
                        initial={false}
                        animate={isLogin ? "login" : "register"}
                        variants={{
                            login: { x: "0%" },
                            register: { x: "-50%" }
                        }}
                        transition={{ type: "spring", stiffness: 70, damping: 15 }}
                    >
                    {/* Left panel (Login Branding) */}
                    <div className="w-1/2 h-full flex flex-col justify-center p-12 relative overflow-hidden text-white">
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-blue-500 opacity-50 blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-blue-700 opacity-50 blur-3xl"></div>

                        <div className="relative z-10 max-w-md mx-auto xl:ml-32 w-full">
                            <div className="flex items-center gap-3 mb-10 cursor-pointer" onClick={() => navigate('/')}>
                                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
                                    <Cloud className="w-7 h-7" />
                                </div>
                                <span className="text-3xl font-bold tracking-tight">CloudWise</span>
                            </div>
                            <h1 className="text-4xl font-bold mb-6 leading-tight">Secure, intelligent <br />cloud storage.</h1>
                            <p className="text-lg text-blue-100 mb-12 leading-relaxed">Manage your files effortlessly with our AI-powered organization tailored for modern workflows.</p>
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

                    {/* Right panel (Register Branding) */}
                    <div className="w-1/2 h-full flex flex-col justify-center p-12 relative overflow-hidden text-white">
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-blue-500 opacity-50 blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-blue-700 opacity-50 blur-3xl"></div>

                        <div className="relative z-10 max-w-md mx-auto xl:mr-32 w-full">
                            <div className="flex items-center gap-3 mb-10 cursor-pointer" onClick={() => navigate('/')}>
                                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
                                    <Cloud className="w-7 h-7" />
                                </div>
                                <span className="text-3xl font-bold tracking-tight">CloudWise</span>
                            </div>
                            <h1 className="text-4xl font-bold mb-6 leading-tight">Start organizing <br />your digital life.</h1>
                            <p className="text-lg text-blue-100 mb-10 leading-relaxed">Join thousands of users managing their files securely in the intelligent cloud.</p>
                            <div className="space-y-6 w-full">
                                <div className="flex gap-4 items-start">
                                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-1">
                                        <CheckCircle className="text-white w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg mb-1">AI-Powered Organization</h3>
                                        <p className="text-sm text-blue-100/80">Automatically categorize and tag all your uploaded documents.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 items-start">
                                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-1">
                                        <Zap className="text-white w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg mb-1">Instant Search</h3>
                                        <p className="text-sm text-blue-100/80">Find any file in milliseconds using powerful filters.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    </motion.div>
                )}

                {/* Animated Form Container (White Panel) */}
                <motion.div
                    className="auth-form-panel relative lg:absolute top-0 w-full lg:w-1/2 min-h-screen lg:h-full bg-white dark:bg-slate-950 lg:dark:bg-slate-900 shadow-none lg:shadow-2xl z-20 overflow-y-auto flex items-center justify-center p-6 sm:p-8 transition-colors duration-300"
                    initial={false}
                    animate={isLogin ? "login" : "register"}
                    variants={formPanelVariants}
                    transition={{ type: "spring", stiffness: 70, damping: 15 }}
                >
                    {/* Mobile Branding (only visible on small screens) */}
                    <div className="absolute top-8 right-8 lg:hidden">
                        <div className="flex items-center gap-2">
                            <Cloud className="w-6 h-6 text-blue-600" />
                            <span className="text-xl font-bold dark:text-white">CloudWise</span>
                        </div>
                    </div>

                    <div className="auth-form-content w-full max-w-md my-auto pb-8">
                        <AnimatePresence mode="wait">
                            {showMfaPrompt ? (
                                <motion.div
                                    key="mfa-prompt"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 1.05 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="text-center mb-8">
                                        <div className="w-20 h-20 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6">
                                            <ShieldCheck size={40} className="text-emerald-600" />
                                        </div>
                                        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Secure Your Account</h2>
                                        <p className="text-slate-500 dark:text-slate-400 font-medium">
                                            Multi-Factor Authentication (MFA) adds an extra layer of bank-grade security to your files. We strongly recommend enabling it now.
                                        </p>
                                    </div>
                                    <div className="space-y-4">
                                        <Button onClick={handleEnableMfa} variant="primary" loading={loading} className="w-full py-4 text-base font-bold bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-500/30 transition-all">
                                            Enable MFA (Recommended)
                                        </Button>
                                        <Button onClick={() => navigate('/dashboard')} variant="ghost" disabled={loading} className="w-full py-4 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                                            Skip for now
                                        </Button>
                                    </div>
                                </motion.div>
                            ) : isLogin ? (
                                <motion.div
                                    key="login-form"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="mb-8 text-center lg:text-left">
                                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                                            {requiresMfa ? 'Multi-Factor Authentication' : 'Welcome Back'}
                                        </h2>
                                        <p className="text-slate-500 dark:text-slate-400">
                                            {requiresMfa ? 'Enter the 6-digit code sent to your email' : 'Sign in to your CloudWise account'}
                                        </p>
                                    </div>

                                    {error && (
                                        <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/30 rounded-xl flex items-center gap-3 text-rose-600 dark:text-rose-400 text-sm md:text-base animate-[shake_0.5s_ease-in-out]">
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
                                                            placeholder="name@company.com"
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
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate('/forgot-password')}
                                                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                                        >
                                                            Forgot password?
                                                        </button>
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
                                                    <input type="checkbox" id="remember" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
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
                                            <button onClick={handleToggle} type="button" className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline underline-offset-4">
                                                Create one
                                            </button>
                                        </p>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="register-form"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="mb-8 text-center lg:text-left">
                                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Create Account</h2>
                                        <p className="text-slate-500 dark:text-slate-400">Get started with a free workspace</p>
                                    </div>

                                    {error && (
                                        <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/30 rounded-xl flex items-center gap-3 text-rose-600 dark:text-rose-400 text-sm md:text-base animate-[shake_0.5s_ease-in-out]">
                                            <Lock size={16} className="flex-shrink-0" />
                                            {error}
                                        </div>
                                    )}

                                    <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
                                        <div className="space-y-1.5 col-span-1 md:col-span-2">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Full Name</label>
                                            <div className="relative group">
                                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                                                <input
                                                    type="text"
                                                    name="name"
                                                    placeholder="John Doe"
                                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none text-slate-900 dark:text-white"
                                                    value={formData.name}
                                                    onChange={handleChange}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 col-span-1 md:col-span-2">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
                                            <div className="relative group">
                                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                                                <input
                                                    type="email"
                                                    name="email"
                                                    placeholder="name@company.com"
                                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none text-slate-900 dark:text-white"
                                                    value={formData.email}
                                                    onChange={handleChange}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 col-span-1 md:col-span-1">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Password</label>
                                            <div className="relative group">
                                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                                                <input
                                                    type="password"
                                                    name="password"
                                                    placeholder="••••••••"
                                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none text-slate-900 dark:text-white"
                                                    value={formData.password}
                                                    onChange={handleChange}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 col-span-1 md:col-span-1">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Confirm</label>
                                            <div className="relative group">
                                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                                                <input
                                                    type="password"
                                                    name="confirmPassword"
                                                    placeholder="••••••••"
                                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none text-slate-900 dark:text-white"
                                                    value={formData.confirmPassword}
                                                    onChange={handleChange}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Password Requirements Checklist */}
                                        {formData.password.length > 0 && (
                                            <div className="col-span-1 md:col-span-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 space-y-2 animate-in slide-in-from-top-2 duration-300">
                                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Password must have:</p>
                                                {passwordRules.map((rule, idx) => {
                                                    const passed = rule.test(formData.password);
                                                    return (
                                                        <div key={idx} className={`flex items-center gap-2 text-xs transition-colors ${passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                                            {passed ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                            <span className="font-medium">{rule.label}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <Button type="submit" variant="primary" loading={loading} className="col-span-1 md:col-span-2 w-full py-3.5 text-base font-semibold bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/30 transition-all mt-6">
                                            Create Account
                                        </Button>
                                    </form>

                                    <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
                                        Already have an account?{' '}
                                        <button onClick={handleToggle} type="button" className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline underline-offset-4">
                                            Sign in
                                        </button>
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* Global styles required for shake animation */}
                <style dangerouslySetInnerHTML={{
                    __html: `
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
            20%, 40%, 60%, 80% { transform: translateX(4px); }
          }
          .animate-\\[shake_0\\.5s_ease-in-out\\] {
            animation: shake 0.5s ease-in-out;
          }
        `}} />
            </div >
        </div >
    );
};

export default AuthPage;
