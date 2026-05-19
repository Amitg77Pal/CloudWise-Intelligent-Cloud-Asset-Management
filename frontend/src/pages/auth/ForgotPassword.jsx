import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ShieldCheck, KeyRound } from 'lucide-react';
import Button from '../../components/common/Button';
import { authService } from '../../services/authService';
import { useToast } from '../../context/ToastContext';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const res = await authService.forgotPassword(email);
      setOtpSent(true);
      setMessage(res.message || 'If the account exists, an OTP has been sent.');
      showToast({ type: 'success', message: 'Check your email for the 6-digit OTP.', duration: 6000 });
    } catch (error) {
      showToast({ type: 'error', message: error.response?.data?.message || 'Unable to send reset email.', duration: 7000 });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    const cleanedOtp = (otp || '').replace(/\D/g, '').slice(0, 6);
    if (cleanedOtp.length !== 6) {
      showToast({ type: 'error', message: 'Enter the 6-digit OTP.', duration: 6000 });
      return;
    }

    setVerifying(true);
    try {
      const res = await authService.verifyPasswordResetOtp({ email, otp: cleanedOtp });
      const resetToken = res.resetToken;
      if (!resetToken) {
        showToast({ type: 'error', message: 'OTP verification failed.', duration: 7000 });
        return;
      }

      showToast({ type: 'success', message: 'OTP verified. Create a new password.', duration: 6000 });
      navigate(`/reset-password?token=${encodeURIComponent(resetToken)}`);
    } catch (error) {
      showToast({ type: 'error', message: error.response?.data?.message || 'Invalid or expired OTP.', duration: 7000 });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Forgot Password</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">We will email you a 6-digit OTP.</p>
          </div>
        </div>

        {message && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {message}
          </div>
        )}

        <form onSubmit={handleSendOtp} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@domain.com"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-4 py-2.5 text-sm font-semibold"
              />
            </div>
          </div>

          <Button type="submit" variant="primary" loading={loading} className="w-full">
            {otpSent ? 'Resend OTP' : 'Send OTP'}
          </Button>
        </form>

        {otpSent && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 mt-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">OTP</label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-4 py-2.5 text-sm font-semibold tracking-widest"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Enter the 6-digit code (expires in 5 minutes).</p>
            </div>

            <Button type="submit" variant="primary" loading={verifying} className="w-full">
              Verify OTP
            </Button>
          </form>
        )}

        <div className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          Remembered your password?{' '}
          <Link to="/login" className="font-semibold text-blue-600 dark:text-blue-400">Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
