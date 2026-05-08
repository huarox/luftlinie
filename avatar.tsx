interface Props { checked: boolean; onChange: (v: boolean) => void; }

export function IOSSwitch({ checked, onChange }: Props) {
  return <label style={{ width: 51, height: 31, position: 'relative', display: 'inline-block', flexShrink: 0, cursor: 'pointer' }}><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} /><span style={{ position: 'absolute', inset: 0, borderRadius: 15.5, background: checked ? 'var(--green)' : 'var(--bg-tertiary)', transition: 'background 200ms cubic-bezier(0.32,0.72,0,1)' }}><span style={{ position: 'absolute', top: 2, left: checked ? 22 : 2, width: 27, height: 27, borderRadius: '50%', background: '#FFF', boxShadow: '0 2px 6px rgba(0,0,0,0.18), 0 0.5px 1px rgba(0,0,0,0.08)', transition: 'transform 200ms cubic-bezier(0.32,0.72,0,1)' }} /></span></label>;
}
