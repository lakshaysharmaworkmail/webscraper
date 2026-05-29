import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const res = await fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
          } else {
            localStorage.removeItem('token');
            setToken(null);
          }
        } catch {
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, [token]);

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    navigate('/dashboard');
  };

  const register = async (email, password, displayName) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    navigate('/login', { state: { message: 'Registration successful! Please wait for admin approval.' } });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    navigate('/');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}