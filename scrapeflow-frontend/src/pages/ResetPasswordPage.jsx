import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import gsap from 'gsap';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const cardRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(cardRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6 });
    if (formRef.current) {
      const els = formRef.current.querySelectorAll('input, button, label');
      tl.fromTo(els, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.08 }, '-=0.3');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      setMessage('Password reset successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-8">
      <div ref={cardRef} className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-10 shadow-lg">
        <header className="mb-10 text-center">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="none">
                <path d="M4 6L5.5 18 8 6 10.5 18 12 6" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M14 6v12M14 6h8M14 12h6M14 18h8" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>
              </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Set New Password</h2>
          <p className="text-slate-500 text-sm">Enter your new password below.</p>
        </header>

        {message && (
          <div className="mb-6 p-3 bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-sm text-center">{message}</div>
        )}
        {error && (
          <div className="mb-6 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm text-center">{error}</div>
        )}

        <form ref={formRef} className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold ml-1">New Password</label>
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 px-4 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="••••••••" type="password"
              value={password} onChange={(e) => setPassword(e.target.value)} required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold ml-1">Confirm Password</label>
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 px-4 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="••••••••" type="password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} required
            />
          </div>
          <div className="pt-4">
            <button
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              type="submit" disabled={loading}
            >
              {loading ? 'Please wait...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}