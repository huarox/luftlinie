interface Props { options: Array<{ value: string; label: string }>; value: string; onChange: (v: string) => void; }

export function SegmentedControl({ options, value, onChange }: Props) {
  return <div style={{ display: 'flex', padding: 2, borderRadius: 8, background: 'var(--bg-tertiary)' }}>{options.map(o => <button key={o.value} onClick={() => onChange(o.value)} className="btn" style={{ flex: 1, height: 36, padding: '0 10px', fontSize: 13, fontWeight: 500, borderRadius: 6, background: value === o.value ? 'var(--bg-elevated)' : 'transparent', color: value === o.value ? 'var(--text)' : 'var(--text-secondary)', boxShadow: value === o.value ? 'var(--e1)' : 'none' }}>{o.label}</button>)}</div>;
}
