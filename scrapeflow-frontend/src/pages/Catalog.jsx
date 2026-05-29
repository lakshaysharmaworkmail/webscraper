import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePageAnimation, useStaggerAnimation } from '../hooks/useGsapAnimation'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

function addToHistory(scraperId, scraperName, urls) {
  const history = JSON.parse(localStorage.getItem('scrapeHistory') || '[]')
  const urlList = Array.isArray(urls) ? urls : [urls]
  const newEntry = { id: Date.now(), scraperId, scraperName, urls: urlList, urlCount: urlList.length, timestamp: new Date().toISOString() }
  history.unshift(newEntry)
  if (history.length > 50) history.pop()
  localStorage.setItem('scrapeHistory', JSON.stringify(history))
}

const SCRAPERS = [
  { id: 'youtube', name: 'YouTube', emoji: '▶️', color: 'from-red-600 to-red-400', placeholder: 'Enter YouTube video URL...' },
  { id: 'tiktok', name: 'TikTok', emoji: '🎵', color: 'from-pink-500 to-fuchsia-400', placeholder: 'Enter TikTok video URL...' },
  { id: 'facebook', name: 'Facebook', emoji: '👤', color: 'from-blue-600 to-blue-400', placeholder: 'Enter Facebook post URL...' },
  { id: 'dailymotion', name: 'Dailymotion', emoji: '▶️', color: 'from-indigo-600 to-indigo-400', placeholder: 'Enter Dailymotion video URL...' },
  { id: 'archive', name: 'Archive.org', emoji: '📦', color: 'from-orange-600 to-orange-400', placeholder: 'Enter URL to archive...' },
  { id: 'twitter', name: 'X / Twitter', emoji: '🐦', color: 'from-sky-500 to-sky-400', placeholder: 'Enter X/Twitter post URL...' },
  { id: 'kwai', name: 'Kwai', emoji: '⚡', color: 'from-yellow-500 to-yellow-400', placeholder: 'Enter Kwai video URL...' },
  { id: 'snackvideo', name: 'SnackVideo', emoji: '🔥', color: 'from-orange-500 to-orange-400', placeholder: 'Enter SnackVideo URL...' },
  { id: 'okru', name: 'OK.ru', emoji: '✅', color: 'from-red-500 to-red-400', placeholder: 'Enter OK.ru video URL...' },
  { id: 'telegram', name: 'Telegram', emoji: '✈️', color: 'from-blue-500 to-blue-400', placeholder: 'Enter Telegram public post URL...' },
]

export default function Catalog() {
  const { user, logout, token } = useAuth()
  const navigate = useNavigate()
  const [selectedScraper, setSelectedScraper] = useState(null)
  const [url, setUrl] = useState('')
  const [urls, setUrls] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [copied, setCopied] = useState(false)

  const pageRef = useRef(null)
  const gridRef = useRef(null)

  usePageAnimation(pageRef, [])
  useStaggerAnimation(gridRef, '.scraper-card')

  const handleLogout = () => { logout(); navigate('/login') }

  const handleScrape = async () => {
    if (bulkMode) { if (!urls.trim()) return } else { if (!url.trim()) return }
    setLoading(true); setResults(null)
    try {
      const endpoint = bulkMode ? 'scrape/bulk' : 'scrape'
      const body = bulkMode
        ? { platform: selectedScraper.id, urls: urls.split('\n').filter(u => u.trim()) }
        : { platform: selectedScraper.id, url: url.trim() }
      const res = await fetch(`${API_URL}/content/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (res.ok) { setResults(data); addToHistory(selectedScraper.id, selectedScraper.name, bulkMode ? urls.split('\n').filter(u => u.trim()) : url) }
      else { setResults({ error: data.error || 'Failed to scrape' }) }
    } catch { setResults({ error: 'Network error occurred' }) }
    finally { setLoading(false) }
  }

  const downloadCSV = () => {
    if (!results?.headers || !results?.data) return
    const csvRows = [results.headers.join(',')]
    results.data.forEach(row => csvRows.push(Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')))
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `${selectedScraper?.id}_scrape_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }

  const downloadXLSX = () => {
    if (!results?.headers || !results?.data) return
    const xlsRows = [results.headers.join('\t')]
    results.data.forEach(row => xlsRows.push(Object.values(row).map(v => String(v).replace(/\t/g, ' ')).join('\t')))
    const blob = new Blob([xlsRows.join('\n')], { type: 'application/vnd.ms-excel' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `${selectedScraper?.id}_scrape_${Date.now()}.xls`; a.click(); URL.revokeObjectURL(a.href)
  }

  const copyToClipboard = async () => {
    if (!results?.headers || !results?.data) return
    try { await navigator.clipboard.writeText(results.data.map(row => Object.values(row).join('\t')).join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch (err) { console.error('Copy failed:', err) }
  }

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
              <p className="text-[9px] uppercase tracking-[0.2em] text-indigo-600 font-semibold">Scrapers</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
            <span className="text-sm">Dashboard</span>
          </Link>
          <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 rounded-lg text-indigo-700 font-semibold">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
            <span className="text-sm">Scrapers</span>
          </div>
          {user?.role === 'admin' && (
            <Link to="/admin" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
              <span className="text-sm">Admin</span>
            </Link>
          )}
        </nav>
        <div className="mt-auto">
          <button onClick={handleLogout} className="w-full py-2.5 text-sm text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all cursor-pointer">Sign Out</button>
        </div>
      </aside>

      <main className="ml-64 min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Scrapers</h2>
            <p className="text-xs text-slate-400">Choose a platform to extract data</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-sm">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div ref={pageRef} className="p-10 max-w-6xl mx-auto w-full">
          <section className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-1">Scrape <span className="text-indigo-600">Content</span></h1>
            <p className="text-slate-400">Select a platform, paste the URL, and get the data you need.</p>
          </section>

          {!selectedScraper ? (
            <section ref={gridRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {SCRAPERS.map((scraper) => (
                <button key={scraper.id} onClick={() => setSelectedScraper(scraper)}
                  className="scraper-card bg-white border border-slate-200 rounded-xl p-6 hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5 transition-all text-left cursor-pointer"
                >
                  <div className="text-2xl mb-4">{scraper.emoji}</div>
                  <h3 className="font-bold text-slate-900">{scraper.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">Click to scrape</p>
                </button>
              ))}
            </section>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-3">
                <button onClick={() => { setSelectedScraper(null); setUrl(''); setUrls(''); setResults(null); setBulkMode(false) }}
                  className="text-slate-400 hover:text-slate-600 transition-colors bg-transparent border-none cursor-pointer">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15m0 0l6.75 6.75M4.5 12l6.75-6.75" /></svg>
                </button>
                <span className="text-xl">{selectedScraper.emoji}</span>
                <span className="font-bold text-slate-900">{selectedScraper.name}</span>
                <span className="text-xs text-slate-400 ml-auto">Web Extract v1.0</span>
              </div>

              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setBulkMode(false)}
                    className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all cursor-pointer ${!bulkMode ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Single URL</button>
                  <button onClick={() => setBulkMode(true)}
                    className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all cursor-pointer ${bulkMode ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Bulk URLs</button>
                </div>
                <div className="flex gap-3">
                  {bulkMode ? (
                    <div className="flex-1">
                      <textarea value={urls} onChange={(e) => setUrls(e.target.value)}
                        placeholder={`Enter ${selectedScraper.name} URLs (one per line)...`}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all h-32 resize-none text-slate-900 placeholder:text-slate-400" />
                    </div>
                  ) : (
                    <div className="flex-1">
                      <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleScrape()}
                        placeholder={selectedScraper.placeholder}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-900 placeholder:text-slate-400" />
                    </div>
                  )}
                  <button onClick={handleScrape} disabled={loading || (!url.trim() && !urls.trim())}
                    className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm cursor-pointer">
                    {loading ? (
                      <><div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div> Scraping...</>
                    ) : (
                      <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>{bulkMode ? 'Scrape All' : 'Get Data'}</>
                    )}
                  </button>
                </div>
              </div>

              <div className="min-h-[400px] p-6">
                {results && !results.error && results.headers && results.data?.length > 0 && (
                  <div className="flex gap-3 mb-4">
                    <button onClick={copyToClipboard} className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2 cursor-pointer ${copied ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={copied ? "M4.5 12.75l6 6 9-13.5" : "M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"} /></svg>
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button onClick={downloadCSV} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2 cursor-pointer">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                      CSV
                    </button>
                    <button onClick={downloadXLSX} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2 cursor-pointer">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                      XLSX
                    </button>
                  </div>
                )}

                {results && !results.error && results.headers && results.data?.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-50">
                          {results.headers.map((header, idx) => (
                            <th key={idx} className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border border-slate-200">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.data.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            {Object.values(row).map((val, i) => (
                              <td key={i} className="p-3 text-sm text-slate-600 border border-slate-200">{String(val)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {results && results.error && (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                      <p className="text-red-500">{results.error}</p>
                    </div>
                  </div>
                )}

                {!loading && !results && (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <svg className="w-16 h-16 text-slate-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m8.86-2.829a4.5 4.5 0 00-7.243 1.171l-4.5 4.5a4.5 4.5 0 006.364 6.364l1.757-1.757" /></svg>
                      <p className="text-slate-400">Enter a URL above to get started</p>
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <div className="w-12 h-12 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-slate-400">Fetching data...</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 text-xs text-slate-400 flex items-center gap-4">
                <span>Ready</span>
                <span>•</span>
                <span>UTF-8</span>
                <span className="ml-auto">{selectedScraper.name}</span>
              </div>
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