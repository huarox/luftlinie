import { ChevronLeft } from 'lucide-react';

interface Props { title: string; onBack?: () => void; right?: React.ReactNode; }

export function TopBar({ title, onBack, right }: Props) {
  return (
    <div className="bar">
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 60, zIndex: 1 }}>
        {onBack && <button className="pill pill-ghost pill-sm" onClick={onBack}><ChevronLeft size={20} strokeWidth={2.5} /><span style={{ marginLeft: -4 }}>Back</span></button>}
      </div>
      <div className="bar-title">{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 60, zIndex: 1 }}>{right}</div>
    </div>
  );
}
