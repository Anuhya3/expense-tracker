import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { TrendingDown, ArrowRight } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('demo@expense.app');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex dark:bg-gray-900">
      {/* Theme toggle — top right */}
      <div className="fixed top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 text-white flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
            <span className="text-xl font-semibold tracking-tight">ExpenseFlow</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-6">
            Track every pound.<br />
            <span className="text-gray-400">Know where it goes.</span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-md">
            Real-time spending insights, category budgets, and trend analysis
            — built with React, Node.js, TypeScript, and MongoDB.
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="flex gap-1">
              {['React', 'TypeScript', 'Node.js', 'MongoDB', 'JWT'].map(t => (
                <span key={t} className="px-2.5 py-1 bg-white/5 rounded-lg">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-gray-900">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold">ExpenseFlow</span>
          </div>

          <h2 className="text-2xl font-bold mb-1 dark:text-white">
            {isLogin ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
            {isLogin ? 'Sign in to your account' : 'Start tracking your expenses'}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="label">Name</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? 'Please wait...' : isLogin ? 'Sign in' : 'Create account'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-gray-900 font-medium hover:underline">
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          {isLogin && (
            <div className="mt-6 p-3 bg-gray-50 rounded-xl text-xs text-gray-500 text-center">
              Demo: <span className="font-mono">demo@expense.app</span> / <span className="font-mono">demo123</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
