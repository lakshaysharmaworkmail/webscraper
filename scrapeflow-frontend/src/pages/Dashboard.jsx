import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePageAnimation } from '../hooks/useGsapAnimation'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

function formatTimeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Dashboard() {
  const { user, logout, token } = useAuth()
  const navigate = useNavigate()
  const [scrapeHistory, setScrapeHistory] = useState([])
  const [stats, setStats] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showProfile, setShowProfile] = useState(false)

  const welcomeRef = useRef(null)
  const statsRef = useRef(null)
  const actionsRef = useRef(null)

  usePageAnimation([welcomeRef, statsRef, actionsRef], [token])

  const fetchData = async () => {
    if (!token) return
    try {
      const [historyRes] = await Promise.all([
        fetch(`${API_URL}/content/history?limit=20`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
      ])
      const historyData = await historyRes.json()
      setScrapeHistory(historyData.history || [])

      const today = new Date()
      const thisWeekStart = new Date(today)
      thisWeekStart.setDate(today.getDate() - 7)

      const todayScrapes = historyData.history?.filter(h =>
        new Date(h.createdAt) >= new Date(today.toDateString())
      ).length || 0

      const weekScrapes = historyData.history?.filter(h =>
        new Date(h.createdAt) >= thisWeekStart
      ).length || 0

      const successCount = historyData.history?.filter(h => h.status === 'success').length || 0

      setStats({
        today: todayScrapes,
        thisWeek: weekScrapes,
        successRate: historyData.history?.length ? Math.round((successCount / historyData.history.length) * 100) : 0
      })
    } catch (err) {
      console.error('Failed to fetch history:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const handleVisibility = () => { if (document.visibilityState === 'visible') fetchData() }
    document.addEventListener('visibilitychange', handleVisibility)
    const interval = setInterval(fetchData, 30000)
    return () => { document.removeEventListener('visibilitychange', handleVisibility); clearInterval(interval) }
  }, [token])

  const handleLogout = () => { logout(); navigate('/login') }

  const getPlatformColor = (platform) => {
    const colors = { youtube: 'bg-red-500', tiktok: 'bg-pink-500', facebook: 'bg-blue-500', dailymotion: 'bg-purple-500', archive: 'bg-orange-500', twitter: 'bg-sky-500' }
    return colors[platform] || 'bg-slate-500'
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* Sidebar */}
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
              <p className="text-[9px] uppercase tracking-[0.2em] text-indigo-600 font-semibold">Dashboard</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 rounded-lg text-indigo-700 font-semibold">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
            <span className="text-sm">Dashboard</span>
          </div>
          <Link to="/catalog" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
            <span className="text-sm">Scrapers</span>
          </Link>
          {user?.role === 'admin' && (
            <Link to="/admin" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
              <span className="text-sm">Admin</span>
            </Link>
          )}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="px-4 py-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">{user?.email?.charAt(0).toUpperCase()}</div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{user?.displayName || user?.email?.split('@')[0]}</p>
                <p className="text-[10px] text-slate-400">{user?.role}</p>
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full py-2.5 text-sm text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all cursor-pointer">Sign Out</button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-64 min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Dashboard</h2>
            <p className="text-xs text-slate-400">Monitor your scraping activity</p>
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
                        <p className="text-sm font-medium text-slate-900">{user?.displayName || 'User'}</p>
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

        {/* Content */}
        <div className="p-8 max-w-6xl mx-auto w-full">
          <section ref={welcomeRef} className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-1">Welcome back, <span className="text-indigo-600">{user?.email?.split('@')[0]}</span></h1>
            <p className="text-slate-400">Here's your scraping activity overview</p>
          </section>

          <section ref={statsRef} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <span className="text-xs text-slate-400">Today</span>
              </div>
              <div className="text-3xl font-bold text-slate-900">{stats?.today || 0}</div>
              <div className="text-sm text-slate-400 mt-1">Scrapes today</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                </div>
                <span className="text-xs text-slate-400">This Week</span>
              </div>
              <div className="text-3xl font-bold text-slate-900">{stats?.thisWeek || 0}</div>
              <div className="text-sm text-slate-400 mt-1">Scrapes this week</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <span className="text-xs text-slate-400">Success Rate</span>
              </div>
              <div className="text-3xl font-bold text-slate-900">{stats?.successRate || 0}%</div>
              <div className="text-sm text-slate-400 mt-1">Success rate</div>
            </div>
          </section>

          <section ref={actionsRef} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Link to="/catalog" className="bg-white border border-slate-200 rounded-xl p-8 hover:shadow-md hover:border-indigo-300 transition-all group">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Scrape Content</h3>
              </div>
              <p className="text-slate-400 text-sm">Extract data from YouTube, TikTok, Facebook, Dailymotion, and more.</p>
              <div className="mt-4 flex items-center text-indigo-600 text-sm font-medium">
                Start scraping
                <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </div>
            </Link>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Recent Scrapes</h3>
                </div>
                <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-500">{scrapeHistory.length} total</span>
              </div>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-indigo-500/50 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : scrapeHistory.length === 0 ? (
                <p className="text-slate-400 py-4 text-sm">No scrapes yet. Start scraping to see your history!</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {scrapeHistory.slice(0, 8).map((item) => (
                    <div key={item._id || item.id} onClick={() => setSelectedItem(item)} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${getPlatformColor(item.platform)}`}>
                          {item.platform?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-900 truncate max-w-[180px]">{item.platform?.charAt(0).toUpperCase() + item.platform?.slice(1) || 'Unknown'}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${item.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{item.status === 'success' ? '✓' : '✗'}</span>
                          </div>
                          <p className="text-xs text-slate-400 truncate max-w-[180px]">{item.url?.length > 40 ? item.url.substring(0, 40) + '...' : item.url}</p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap ml-2">{formatTimeAgo(item.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
              {scrapeHistory.length > 0 && (
                <Link to="/catalog" className="mt-4 block text-sm text-indigo-600 hover:text-indigo-500 font-medium">View all scrapers →</Link>
              )}
            </div>
          </section>

          <section className="mt-8 p-5 bg-indigo-50 border border-indigo-100 rounded-xl">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
              <div>
                <h4 className="font-semibold text-slate-900 text-sm mb-1">How it works</h4>
                <p className="text-sm text-slate-500">Simply go to Scrapers, select a platform, paste the URL, and click "Get Data". That's it!</p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="w-full py-8 px-8 border-t border-slate-200 bg-white mt-auto">
          <div className="max-w-6xl mx-auto text-center">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">© 2026 Web Extract Inc. All rights reserved.</p>
          </div>
        </footer>
      </main>

      {/* Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedItem(null)}>
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold ${getPlatformColor(selectedItem.platform)}`}>{selectedItem.platform?.charAt(0).toUpperCase()}</div>
                <div>
                  <h3 className="font-bold text-slate-900">{selectedItem.platform?.charAt(0).toUpperCase() + selectedItem.platform?.slice(1)}</h3>
                  <p className="text-xs text-slate-400">{formatDate(selectedItem.createdAt)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer bg-transparent border-none">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">URL</label>
                <p className="text-sm text-slate-600 break-all bg-slate-50 p-2 rounded mt-1">{selectedItem.url}</p>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</label>
                <p className={`text-sm font-medium mt-1 ${selectedItem.status === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>{selectedItem.status === 'success' ? '✓ Success' : '✗ Error'}</p>
              </div>
              {selectedItem.errorMessage && (
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Error</label>
                  <p className="text-sm text-red-600 bg-red-50 p-2 rounded mt-1">{selectedItem.errorMessage}</p>
                </div>
              )}
              {selectedItem.resultData && selectedItem.status === 'success' && (
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Data Retrieved</label>
                  <div className="bg-slate-50 p-3 rounded mt-1 text-xs font-mono max-h-40 overflow-y-auto text-slate-600">
                    {Object.entries(selectedItem.resultData).slice(0, 10).map(([key, val]) => (
                      <div key={key} className="flex gap-2">
                        <span className="text-slate-400">{key}:</span>
                        <span className="truncate">{String(val)?.substring(0, 50)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <a href={selectedItem.url} target="_blank" rel="noopener noreferrer" className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-center rounded-lg transition-all text-sm font-medium">Open URL</a>
              <button onClick={() => setSelectedItem(null)} className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all text-sm cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}