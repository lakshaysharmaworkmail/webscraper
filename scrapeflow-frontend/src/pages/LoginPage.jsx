import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import gsap from 'gsap';
import AnimatedBg from '../components/AnimatedBg';

function ForgotForm({ onBack }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [link, setLink] = useState('');
  const cardRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(cardRef.current, { opacity: 0, y: 30, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.6 });
    if (formRef.current) {
      tl.fromTo(formRef.current.querySelectorAll('input, button'), { opacity: 0, y: 15 }, { opacity: 1, y: 0, stagger: 0.08, duration: 0.4 }, '-=0.3');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMsg(''); setLink(''); setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setMsg(data.message);
      if (data.resetLink) setLink(data.resetLink);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <AnimatedBg />
      <div ref={cardRef} className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="none">
                <path d="M4 6L5.5 18 8 6 10.5 18 12 6" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M14 6v12M14 6h8M14 12h6M14 18h8" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Web Extract</h1>
            <p className="text-slate-500 text-sm mt-1">Reset your password</p>
        </div>

        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-8 shadow-xl shadow-indigo-200/20">
          {msg && <div className="mb-4 p-3 bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{msg}</div>}
          {link && (
            <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm break-all">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold mb-1">Dev Reset Link</p>
              <a href={link} className="text-indigo-600 underline text-xs">{link}</a>
            </div>
          )}
          {error && <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

          <form ref={formRef} className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email</label>
              <input
                className="w-full bg-white/80 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-900 transition-colors cursor-pointer bg-transparent border-none">← Back to Sign In</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login, register } = useAuth();
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [showForgot, setShowForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const cardRef = useRef(null);
  const formRef = useRef(null);
  const msg = location.state?.message;

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(cardRef.current, { opacity: 0, y: 30, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.7 });
    if (formRef.current) {
      tl.fromTo(
        formRef.current.querySelectorAll('input, button, .switch-link'),
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.07 },
        '-=0.35'
      );
    }
  }, [isLogin]);

  const switchMode = (mode) => {
    gsap.to(cardRef.current, { opacity: 0, y: 10, scale: 0.97, duration: 0.15, onComplete: () => {
      setIsLogin(mode === 'login');
      setShowForgot(false);
      setError('');
      gsap.to(cardRef.current, { opacity: 1, y: 0, scale: 1, duration: 0.3 });
    }});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (isLogin) await login(email, password);
      else await register(email, password, displayName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally { setLoading(false); }
  };

  if (showForgot) return <ForgotForm onBack={() => { setShowForgot(false); setError(''); }} />;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <AnimatedBg />
      <div ref={cardRef} className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200/50">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="none">
                <path d="M4 6L5.5 18 8 6 10.5 18 12 6" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M14 6v12M14 6h8M14 12h6M14 18h8" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>
              </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Web Extract</h1>
          <p className="text-slate-500 text-sm mt-1">{isLogin ? 'Sign in to your account' : 'Create a new account'}</p>
        </div>

        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-8 shadow-xl shadow-indigo-200/20">
          {msg && <div className="mb-4 p-3 bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-sm text-center">{msg}</div>}
          {error && <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

          <form ref={formRef} className="space-y-5" onSubmit={handleSubmit}>
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Name</label>
                <input
                  className="w-full bg-white/80 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  placeholder="Your name" type="text"
                  value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email</label>
              <input
                className="w-full bg-white/80 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                placeholder="you@example.com" type="email"
                value={email} onChange={(e) => setEmail(e.target.value)} required
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Password</label>
                {isLogin && (
                  <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-indigo-600 hover:text-indigo-500 transition-colors bg-transparent border-none cursor-pointer">Forgot?</button>
                )}
              </div>
              <input
                className="w-full bg-white/80 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                placeholder="••••••••" type="password"
                value={password} onChange={(e) => setPassword(e.target.value)} required
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Please wait...
                </span>
              ) : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="mt-8 text-center switch-link">
            <p className="text-sm text-slate-500">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
              <button onClick={() => switchMode(isLogin ? 'register' : 'login')}
                className="text-indigo-600 hover:text-indigo-500 font-semibold ml-1.5 transition-colors bg-transparent border-none cursor-pointer"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center space-x-6">
          <a className="text-xs text-slate-400 hover:text-slate-600 transition-colors" href="#">Privacy</a>
          <a className="text-xs text-slate-400 hover:text-slate-600 transition-colors" href="#">Terms</a>
          <a className="text-xs text-slate-400 hover:text-slate-600 transition-colors" href="#">Security</a>
        </div>
      </div>
    </div>
  );
}