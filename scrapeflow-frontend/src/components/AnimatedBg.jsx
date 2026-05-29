export default function AnimatedBg() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0" style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1557683311-eac922347aa1?q=80&w=2029&auto=format&fit=crop)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}></div>
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(238,242,255,0.4) 100%)'
      }}></div>
    </div>
  )
}
