import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">

      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 flex justify-between items-center px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="none">
                <path d="M4 6L5.5 18 8 6 10.5 18 12 6" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M14 6v12M14 6h8M14 12h6M14 18h8" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>
              </svg>
          </div>
          <span className="text-lg font-bold tracking-tight">Web Extract</span>
        </div>
        <div className="hidden md:flex gap-8 items-center">
          <Link to="/dashboard" className="text-slate-900 font-semibold border-b-2 border-indigo-600">Dashboard</Link>
          <a className="text-slate-500 font-medium hover:text-slate-900 transition-colors" href="#">Solutions</a>
          <a className="text-slate-500 font-medium hover:text-slate-900 transition-colors" href="#">Enterprise</a>
          <a className="text-slate-500 font-medium hover:text-slate-900 transition-colors" href="#">API</a>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="px-5 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Sign In</Link>
          <Link to="/register" className="px-5 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 transition-all shadow-sm">Get Started</Link>
        </div>
      </nav>

      <main className="pt-24">
        {/* Hero */}
        <section className="px-8 py-24 md:py-32 max-w-7xl mx-auto flex flex-col md:flex-row gap-16 items-center">
          <div className="md:w-1/2 space-y-8">
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-600 font-semibold">The Precision Curator</p>
            <h1 className="text-5xl md:text-7xl font-bold leading-tight text-slate-900">
              Architecture <br />for <span className="text-indigo-600">Infinite</span> Data.
            </h1>
            <p className="text-lg text-slate-500 max-w-lg leading-relaxed">
              Transforming raw web entropy into structured institutional intelligence. Web Extract delivers high-fidelity data extraction at the speed of modern commerce.
            </p>
            <div className="flex gap-4 pt-4">
              <Link to="/dashboard">
                <button className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition-all shadow-sm cursor-pointer">Initialize Engine</button>
              </Link>
              <button className="px-8 py-4 border border-slate-300 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-all cursor-pointer">View Blueprint</button>
            </div>
          </div>
          <div className="md:w-1/2 relative">
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-indigo-100 rounded-full blur-3xl"></div>
            <div className="relative bg-slate-900 border border-slate-800 p-6 shadow-2xl rounded-2xl z-10">
              <div className="rounded-xl overflow-hidden bg-slate-800/50 p-8">
                <div className="flex gap-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <pre className="text-slate-300 text-sm font-mono">
                  <code>{`> extract --target market.data
  ✓ Schema detected (4 fields)
  ✓ Proxy routed (us-east-1)
  ✓ Data normalized
  → 2.4GB ready`}</code>
                </pre>
              </div>
              <div className="mt-6 flex justify-between items-end">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Real-time Stream</p>
                  <h3 className="text-2xl font-bold mt-1 text-white">98.2 TB/hr</h3>
                </div>
                <div className="h-1 w-32 bg-indigo-500 rounded-full"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Metrics */}
        <section className="bg-slate-50 border-y border-slate-200 py-20">
          <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 md:grid-cols-3 gap-16">
            <div>
              <span className="text-5xl font-bold text-slate-900">14ms</span>
              <p className="text-xs uppercase tracking-widest mt-2 text-slate-500">Mean Latency</p>
              <div className="h-[2px] w-12 bg-indigo-500 mt-4"></div>
            </div>
            <div>
              <span className="text-5xl font-bold text-slate-900">99.9%</span>
              <p className="text-xs uppercase tracking-widest mt-2 text-slate-500">Extraction Fidelity</p>
              <div className="h-[2px] w-12 bg-indigo-500 mt-4"></div>
            </div>
            <div>
              <span className="text-5xl font-bold text-slate-900">1.2B</span>
              <p className="text-xs uppercase tracking-widest mt-2 text-slate-500">Requests Daily</p>
              <div className="h-[2px] w-12 bg-indigo-500 mt-4"></div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-8 py-32 max-w-7xl mx-auto">
          <div className="mb-20 text-center max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900">Designed for <span className="text-indigo-600">Technical Rigor</span></h2>
            <p className="text-slate-500 leading-relaxed">Our infrastructure treats every data point as a critical asset, ensuring structured delivery through an elegant, high-throughput pipeline.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-8 bg-white border border-slate-200 p-12 rounded-2xl border-t-4 border-indigo-500 hover:shadow-md transition-shadow">
              <div className="max-w-md">
                <svg className="w-10 h-10 text-indigo-600 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>
                <h3 className="text-3xl font-bold mb-4 text-slate-900">Semantic Schema Discovery</h3>
                <p className="text-slate-500 leading-relaxed mb-8">AI-driven identification of data hierarchies. Our engine maps unstructured web layouts into precise JSON schemas automatically, reducing integration time from days to minutes.</p>
              </div>
            </div>
            <div className="md:col-span-4 bg-indigo-600 p-12 rounded-2xl flex flex-col justify-center">
              <svg className="w-10 h-10 text-indigo-200 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
              <h3 className="text-3xl font-bold mb-4 text-white">Fortress Protocol</h3>
              <p className="text-indigo-200 leading-relaxed">Enterprise-grade rotating proxies and fingerprint spoofing. We handle the complexity of anti-bot bypass so your data remains accessible and compliant.</p>
              <div className="mt-12 space-y-4">
                <div className="flex items-center gap-3 text-indigo-200">
                  <svg className="w-5 h-5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-xs uppercase tracking-widest">GDPR Ready</span>
                </div>
                <div className="flex items-center gap-3 text-indigo-200">
                  <svg className="w-5 h-5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-xs uppercase tracking-widest">SOC-2 Type II</span>
                </div>
              </div>
            </div>
            <div className="md:col-span-4 bg-white border border-slate-200 p-10 rounded-2xl hover:shadow-md transition-shadow">
              <svg className="w-8 h-8 text-indigo-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" /></svg>
              <h4 className="text-xl font-bold mb-2 text-slate-900">Native Fluidity</h4>
              <p className="text-sm text-slate-500 leading-relaxed">SDKs for Python, Node, and Rust. Deploy via CLI or integrate directly with our GraphQL endpoint.</p>
            </div>
            <div className="md:col-span-4 bg-white border border-slate-200 p-10 rounded-2xl hover:shadow-md transition-shadow">
              <svg className="w-8 h-8 text-indigo-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" /></svg>
              <h4 className="text-xl font-bold mb-2 text-slate-900">Edge Computation</h4>
              <p className="text-sm text-slate-500 leading-relaxed">Pre-process, filter, and clean your data at the edge before it even hits your storage servers.</p>
            </div>
            <div className="md:col-span-4 bg-white border border-slate-200 p-10 rounded-2xl hover:shadow-md transition-shadow">
              <svg className="w-8 h-8 text-emerald-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
              <h4 className="text-xl font-bold mb-2 text-slate-900">Active Observability</h4>
              <p className="text-sm text-slate-500 leading-relaxed">Visual logs for every extraction. Replay requests and debug selectors with our visual DOM inspector.</p>
            </div>
          </div>
        </section>

        {/* Code Section */}
        <section className="bg-slate-50 border-y border-slate-200 py-32">
          <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row gap-20 items-center">
            <div className="md:w-1/2">
              <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight text-slate-900">Native Fluidity:<br />Code-First Architecture.</h2>
              <p className="text-slate-500 text-lg mb-10 leading-relaxed">
                Web Extract is built to disappear into your stack. We provide the hooks; you provide the intent.
              </p>
              <div className="space-y-6">
                <div className="flex gap-6 items-start">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 mb-1">Universal Webhooks</h5>
                    <p className="text-sm text-slate-500">Instant triggers for downstream automation workflows.</p>
                  </div>
                </div>
                <div className="flex gap-6 items-start">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" /></svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 mb-1">GraphQL Native</h5>
                    <p className="text-sm text-slate-500">Fetch only the fields you need with high-performance queries.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="md:w-1/2 w-full">
              <div className="bg-slate-900 rounded-xl p-8 shadow-2xl font-mono text-sm overflow-hidden relative border border-slate-800">
                <div className="flex gap-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <pre className="text-slate-300 overflow-x-auto">
                  <code>{`const flow = new Web Extract({
  apiKey: 'sk_live_precision',
  region: 'us-east-1'
});

await flow.extract({
  target: 'https://market.data/signals',
  schema: {
    price: '.ticker-val',
    volume: '.vol-24h',
    trend: 'span.status @data-trend'
  },
  fluidMode: true
});`}</code>
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-8 py-32">
          <div className="max-w-5xl mx-auto bg-indigo-600 rounded-3xl overflow-hidden relative">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 60%)' }}></div>
            <div className="relative z-10 px-12 py-24 text-center">
              <h2 className="text-4xl md:text-5xl font-bold mb-8 text-white">Master the Data Ledger.</h2>
              <p className="text-indigo-200 text-lg mb-12 max-w-2xl mx-auto leading-relaxed">
                Stop fighting the web. Start curating it. Join 500+ enterprise teams scaling their intelligence with Web Extract's precision engine.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <Link to="/login">
                  <button className="px-10 py-5 bg-white text-indigo-700 font-bold rounded-xl hover:scale-105 transition-transform shadow-xl cursor-pointer">Start Free Trial</button>
                </Link>
                <button className="px-10 py-5 border border-white/30 text-white font-bold rounded-xl hover:bg-white/10 transition-all cursor-pointer">Talk to Architecture</button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full py-12 px-8 border-t border-slate-200 bg-white flex flex-col md:flex-row justify-between items-center gap-6">
        <p className="text-[10px] uppercase tracking-widest text-slate-400">© 2026 Web Extract Inc. All rights reserved.</p>
        <div className="flex gap-8">
          <a className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors" href="#">Documentation</a>
          <a className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors" href="#">API Status</a>
          <a className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors" href="#">Privacy</a>
          <a className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors" href="#">Support</a>
        </div>
      </footer>
    </div>
  )
}