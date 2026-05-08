export function Logo({ size = 96 }: { size?: number }) {
  const p = size * 0.18;
  return (
    <div style={{
      width: size, height: size, borderRadius: 22,
      background: '#007AFF',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 1px 3px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.15)',
      flexShrink: 0,
      animation: 'float 6s ease-in-out infinite',
    }}>
      <svg viewBox="0 0 60 60" fill="none" style={{ width: size - p * 2, height: size - p * 2 }}>
        <circle cx="30" cy="30" r="7" fill="white" />
        <circle cx="30" cy="30" r="14" stroke="white" strokeWidth="1.5" fill="none" opacity="0.5" />
        <circle cx="30" cy="30" r="21" stroke="white" strokeWidth="1" fill="none" opacity="0.25" />
        <line x1="30" y1="6" x2="30" y2="12.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <line x1="54" y1="30" x2="47.5" y2="30" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <line x1="30" y1="54" x2="30" y2="47.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="30" x2="12.5" y2="30" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
