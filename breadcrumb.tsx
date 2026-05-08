interface Props { icon: string; name: string; desc: string; active: boolean; onClick: () => void; }

export function ModeCard({ icon, name, desc, active, onClick }: Props) {
  return <button onClick={onClick} className="btn" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '16px 8px', borderRadius: 10, background: active ? 'var(--blue-tint)' : 'var(--bg-secondary)', border: active ? '1.5px solid var(--blue)' : '1px solid var(--border)', height: 'auto', minHeight: 80 }}><span style={{ fontSize: 22 }}>{icon}</span><span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.3px', color: active ? 'var(--blue)' : 'var(--text)' }}>{name}</span><span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.3, textAlign: 'center' }}>{desc}</span></button>;
}
