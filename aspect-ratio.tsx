import { type LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  desc: string;
  selected?: boolean;
  onClick: () => void;
  className?: string;
}

export function GlassCard({ icon: Icon, title, desc, selected, onClick, className = '' }: Props) {
  return (
    <button
      onClick={onClick}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '18px 20px',
        borderRadius: 'var(--r-lg)',
        border: '1.5px solid ' + (selected ? 'var(--text)' : 'var(--glass-border)'),
        background: 'var(--glass)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: selected
          ? 'inset 0 1px 0 var(--glass-highlight), 0 8px 32px rgba(0,0,0,0.15)'
          : 'inset 0 1px 0 var(--glass-highlight), var(--e1)',
        transition: 'all 0.2s var(--spring)',
        textAlign: 'left',
        cursor: 'pointer',
        transform: selected ? 'scale(1.02)' : 'scale(1)',
        width: '100%',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: selected ? 'var(--text)' : 'var(--bg-elevated)',
          color: selected ? 'var(--bg)' : 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.2s',
        }}
      >
        <Icon size={20} />
      </div>
      <div>
        <div className="t-body" style={{ fontWeight: 700, marginBottom: 2 }}>
          {title}
        </div>
        <div className="t-footnote" style={{ color: 'var(--text-secondary)' }}>
          {desc}
        </div>
      </div>
    </button>
  );
}
