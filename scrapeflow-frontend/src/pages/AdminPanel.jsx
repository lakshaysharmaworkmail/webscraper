import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePageAnimation } from '../hooks/useGsapAnimation'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '-'
  const diff = Date.now() - new Date(timestamp).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return formatDate(timestamp)
}

function getPlatformColor(platform) {
  const colors = { youtube: 'bg-red-100 text-red-700', tiktok: 'bg-pink-100 text-pink-700', facebook: 'bg-blue-100 text-blue-700', dailymotion: 'bg-indigo-100 text-indigo-700', archive: 'bg-orange-100 text-orange-700', twitter: 'bg-sky-100 text-sky-700' }
  return colors[platform] || 'bg-slate-100 text-slate-700'
}

export default function AdminPanel() {
  const { user, logout, token } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [usersList, setUsersList] = useState([])
  const [actionMsg, setActionMsg] = useState(null)
  const [showProfile, setShowProfile] = useState(false)

  const pageRef = useRef(null)
  usePageAnimation(pageRef, [])

  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/dashboard'); return }
    fetchData()
  }, [user])

  const fetchData = async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/admin/stats/overview`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setStats(data)
      const historyRes = await fetch(`${API_URL}/admin/history?limit=100`, { headers: { Authorization: `Bearer ${token}` } })
      const historyData = await historyRes.json()
      setHistory(historyData.history || [])
    } catch (err) { console.error('Failed to fetch:', err) }
    finally { setLoading(false) }
  }

  const fetchUsers = async () => {
    setActionMsg(null)
    try {
      const res = await fetch(`${API_URL}/auth/admin/users`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setUsersList(data.users || [])
    } catch (err) { console.error('Failed to fetch users:', err) }
  }

  const handleApprove = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/auth/admin/users/${userId}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setActionMsg({ type: 'success', text: data.message }); fetchUsers()
    } catch (err) { setActionMsg({ type: 'error', text: err.message }) }
  }

  const handleReject = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/auth/admin/users/${userId}/reject`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setActionMsg({ type: 'success', text: data.message }); fetchUsers()
    } catch (err) { setActionMsg({ type: 'error', text: err.message }) }
  }

  useEffect(() => { if (activeTab === 'users') fetchUsers() }, [activeTab])

  const handleLogout = () => { logout(); navigate('/login') }

  const getPlatformStats = () => stats?.platformStats?.sort((a, b) => b.count - a.count) || []
  const getDailyStats = () => stats?.dailyStats?.sort((a, b) => b._id.localeCompare(a._id)) || []
  const getTopUsers = () => stats?.users?.slice(0, 10) || []

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      <aside className="h-screen w-64 fixed left-0 top-0 bg-white border-r border-slate-200 flex flex-col py-8 px-4 z-50">
        <div className="mb-10 px-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="none">
                <path d="M4 6L5.5 18 8 6 10.5 18 12 6" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M14 6v12M14 6h8M14 12h6M14 18h8" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Web Extract</h1>
              <p className="text-[9px] uppercase tracking-[0.2em] text-indigo-600 font-semibold">Admin</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-4 py-3 transition-all cursor-pointer ${activeTab === 'overview' ? 'bg-indigo-50 rounded-lg text-indigo-700 font-semibold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg'}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
            <span className="text-sm">Overview</span>
          </button>
          <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-4 py-3 transition-all cursor-pointer ${activeTab === 'users' ? 'bg-indigo-50 rounded-lg text-indigo-700 font-semibold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg'}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
            <span className="text-sm">Users</span>
          </button>
          <button onClick={() => setActiveTab('activity')} className={`w-full flex items-center gap-3 px-4 py-3 transition-all cursor-pointer ${activeTab === 'activity' ? 'bg-indigo-50 rounded-lg text-indigo-700 font-semibold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg'}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="text-sm">Activity</span>
          </button>
        </nav>
        <div className="mt-auto space-y-2">
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
            <span className="text-sm">Dashboard</span>
          </Link>
          <button onClick={handleLogout} className="w-full py-2.5 text-sm text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all cursor-pointer">Sign Out</button>
        </div>
      </aside>

      <main className="ml-64 min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Admin Panel</h2>
            <p className="text-xs text-slate-400">Monitor platform usage and user activity</p>
          </div>
          <div className="relative">
            <button onClick={() => setShowProfile(!showProfile)} className="flex items-center gap-2 cursor-pointer">
              <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-sm">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${showProfile ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>
            {showProfile && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowProfile(false)}></div>
                <div className="absolute right-0 top-12 z-20 w-64 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  <div className="p-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white">{user?.email?.charAt(0).toUpperCase()}</div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{user?.displayName || 'Admin'}</p>
                        <p className="text-xs text-slate-400">{user?.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto w-full">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div ref={pageRef}>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                        </div>
                        <span className="text-sm text-slate-400">Total Scrapes</span>
                      </div>
                      <div className="text-3xl font-bold text-slate-900">{stats?.totalScrapes || 0}</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <span className="text-sm text-slate-400">Successful</span>
                      </div>
                      <div className="text-3xl font-bold text-emerald-600">{stats?.successCount || 0}</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                        </div>
                        <span className="text-sm text-slate-400">Failed</span>
                      </div>
                      <div className="text-3xl font-bold text-red-600">{stats?.errorCount || 0}</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
                        </div>
                        <span className="text-sm text-slate-400">Active Users</span>
                      </div>
                      <div className="text-3xl font-bold text-indigo-600">{stats?.users?.length || 0}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white border border-slate-200 rounded-xl p-6">
                      <h3 className="font-bold text-slate-900 mb-4">Scrapes by Platform</h3>
                      <div className="space-y-3">
                        {getPlatformStats().map((p) => (
                          <div key={p._id} className="flex items-center justify-between">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getPlatformColor(p._id)}`}>{p._id?.toUpperCase()}</span>
                            <div className="flex items-center gap-2 flex-1 ml-3">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(p.count / (stats?.totalScrapes || 1)) * 100}%` }}></div>
                              </div>
                              <span className="text-sm font-medium text-slate-700 w-12 text-right">{p.count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-6">
                      <h3 className="font-bold text-slate-900 mb-4">Last 7 Days</h3>
                      <div className="space-y-2">
                        {getDailyStats().map((d) => (
                          <div key={d._id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                            <span className="text-sm text-slate-500">{formatDate(d._id)}</span>
                            <span className="text-sm font-bold text-slate-900">{d.count} scrapes</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-6">
                    <h3 className="font-bold text-slate-900 mb-4">Top Users</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">User</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Total Scrapes</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Success</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Last Activity</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Platforms</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getTopUsers().map((u) => (
                            <tr key={u._id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">{u.userEmail?.charAt(0).toUpperCase()}</div>
                                  <span className="text-sm text-slate-900">{u.userEmail}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4"><span className="text-sm font-bold text-slate-900">{u.totalScrapes}</span></td>
                              <td className="py-3 px-4">
                                <span className="text-sm text-emerald-600">{u.successCount}</span>
                                <span className="text-xs text-slate-400 ml-1">({Math.round((u.successCount / u.totalScrapes) * 100)}%)</span>
                              </td>
                              <td className="py-3 px-4"><span className="text-xs text-slate-400">{formatTimeAgo(u.lastScrape)}</span></td>
                              <td className="py-3 px-4">
                                <div className="flex gap-1 flex-wrap">
                                  {u.platforms?.map(p => <span key={p} className={`px-2 py-0.5 rounded text-xs ${getPlatformColor(p)}`}>{p}</span>)}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'users' && (
                <div>
                  {actionMsg && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${actionMsg.type === 'success' ? 'bg-emerald-100 border border-emerald-200 text-emerald-700' : 'bg-red-100 border border-red-200 text-red-700'}`}>
                      {actionMsg.text}
                    </div>
                  )}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="font-bold text-slate-900">Registered Users</h3>
                      <button onClick={fetchUsers} className="text-xs text-indigo-600 hover:text-indigo-500 transition-colors cursor-pointer">Refresh</button>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">User</th>
                          <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">Role</th>
                          <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">Status</th>
                          <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">Registered</th>
                          <th className="text-left py-4 px-6 text-xs font-medium text-slate-500 uppercase">Last Login</th>
                          <th className="text-right py-4 px-6 text-xs font-medium text-slate-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersList.length === 0 ? (
                          <tr><td colSpan="6" className="py-12 text-center text-slate-400">No users found</td></tr>
                        ) : (
                          usersList.map((u) => (
                            <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                                    {(u.displayName || u.email).charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-slate-900">{u.displayName || '—'}</p>
                                    <p className="text-xs text-slate-400">{u.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>{u.role}</span>
                              </td>
                              <td className="py-4 px-6">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${u.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : u.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{u.status}</span>
                              </td>
                              <td className="py-4 px-6 text-sm text-slate-600">{formatDate(u.createdAt)}</td>
                              <td className="py-4 px-6 text-sm text-slate-600">{u.lastLogin ? formatTimeAgo(u.lastLogin) : '—'}</td>
                              <td className="py-4 px-6 text-right">
                                {u.status === 'pending' ? (
                                  <div className="flex gap-2 justify-end">
                                    <button onClick={() => handleApprove(u.id)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer">Approve</button>
                                    <button onClick={() => handleReject(u.id)} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer">Reject</button>
                                  </div>
                                ) : u.status === 'approved' && u.id !== user?.userId ? (
                                  <button onClick={() => handleReject(u.id)} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer">Deactivate</button>
                                ) : u.status === 'approved' && u.id === user?.userId ? (
                                  <span className="text-xs text-slate-400">You</span>
                                ) : u.status === 'rejected' ? (
                                  <button onClick={() => handleApprove(u.id)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer">Reactivate</button>
                                ) : <span className="text-xs text-slate-400">Deactivated</span>}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="bg-white border border-slate-200 rounded-xl">
                  <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900">Recent Activity</h3>
                    <span className="text-sm text-slate-400">{history.length} total records</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                    {history.length === 0 && (
                      <div className="p-12 text-center text-slate-400">No activity yet</div>
                    )}
                    {history.map((item) => (
                      <div key={item._id} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold ${item.platform ? getPlatformColor(item.platform).split(' ')[0] : 'bg-slate-100'}`}>
                            {item.platform?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-slate-900 text-sm">{item.userEmail}</span>
                              <span className={`px-2 py-0.5 rounded text-xs ${item.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{item.status === 'success' ? 'Success' : 'Failed'}</span>
                            </div>
                            <p className="text-sm text-slate-500 truncate">{item.url}</p>
                            <p className="text-xs text-slate-400 mt-1">{formatTimeAgo(item.createdAt)}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getPlatformColor(item.platform)}`}>{item.platform}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="w-full py-8 px-8 border-t border-slate-200 bg-white mt-auto">
          <div className="max-w-6xl mx-auto text-center">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">© 2026 Web Extract Inc. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </div>
  )
}