// components/ui.tsx — complete design system
import { ReactNode, useEffect } from 'react'
import { X, CheckCircle, AlertTriangle, Info, XCircle, AlertCircle } from 'lucide-react'

// ── SPINNER ──────────────────────────────────────────────────
export function Spinner({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`spinner ${className}`}
      style={{ width: size, height: size }}
      aria-label="Loading"
    />
  )
}

// ── TOAST ────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info'
export function Toast({ type, message, onClose }: {
  type: ToastType; message: string; onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4500)
    return () => clearTimeout(t)
  }, [onClose])

  const cfg = {
    success: { Icon: CheckCircle,   color: '#34d399', cls: 'toast-success' },
    error:   { Icon: XCircle,       color: '#fb7185', cls: 'toast-error' },
    warning: { Icon: AlertTriangle, color: '#fcd34d', cls: 'toast-warning' },
    info:    { Icon: Info,          color: '#93c5fd', cls: 'toast-info' },
  }[type]

  return (
    <div className="toast-wrap">
      <div className={`toast-inner ${cfg.cls}`}>
        <cfg.Icon size={17} color={cfg.color} style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 13, color: '#e1e7f5', flex: 1, lineHeight: 1.45 }}>{message}</p>
        <button onClick={onClose} style={{ color: 'rgba(100,116,139,0.7)', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

// ── MODAL ────────────────────────────────────────────────────
export function Modal({ title, subtitle, children, onClose }: {
  title: string; subtitle?: string; children: ReactNode; onClose: () => void
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5ff', letterSpacing: '-0.2px' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13, color: 'rgba(100,116,139,0.85)', marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '5px', cursor: 'pointer', color: 'rgba(148,163,184,0.7)', display: 'flex', alignItems: 'center' }}>
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── PROGRESS RING ─────────────────────────────────────────────
export function ProgressRing({ value, max, size = 80, strokeWidth = 6, color = '#3b82f6', label, sublabel }: {
  value: number; max: number; size?: number; strokeWidth?: number
  color?: string; label?: string; sublabel?: string
}) {
  const r      = (size - strokeWidth * 2) / 2
  const circ   = 2 * Math.PI * r
  const pct    = Math.min(value / max, 1)
  const filled = pct * circ
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 6px ${color}60)` }} />
      </svg>
      {(label || sublabel) && (
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          {label    && <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: size > 80 ? 16 : 12, color: '#f1f5ff', lineHeight: 1 }}>{label}</div>}
          {sublabel && <div style={{ fontSize: size > 80 ? 10 : 8, color: 'rgba(100,116,139,0.7)', marginTop: 2 }}>{sublabel}</div>}
        </div>
      )}
    </div>
  )
}

// ── KPI CARD ──────────────────────────────────────────────────
export function KpiCard({ label, value, sub, color, icon: Icon, trend }: {
  label: string; value: string | number; sub?: string
  color: 'blue'|'green'|'amber'|'rose'|'violet'|'cyan'
  icon: any; trend?: { dir: 'up'|'down'; val: string }
}) {
  const iconCols: Record<string, string> = {
    blue:'#93c5fd', green:'#6ee7b7', amber:'#fcd34d', rose:'#fda4af', violet:'#c4b5fd', cyan:'#a5f3fc',
  }
  const iconBgs: Record<string, string> = {
    blue:'rgba(37,99,235,0.2)', green:'rgba(5,150,105,0.2)', amber:'rgba(180,83,9,0.2)',
    rose:'rgba(190,18,60,0.2)', violet:'rgba(109,40,217,0.2)', cyan:'rgba(6,148,162,0.2)',
  }
  return (
    <div className={`glass-card kpi-${color} glass-card-hover anim-count`} style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: iconBgs[color], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color={iconCols[color]} />
        </div>
        {trend && (
          <span style={{ fontSize: 12, fontWeight: 700, color: trend.dir === 'up' ? '#34d399' : '#fb7185' }}>
            {trend.dir === 'up' ? '↑' : '↓'} {trend.val}
          </span>
        )}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 30, fontWeight: 700, color: iconCols[color], letterSpacing: '-1px', lineHeight: 1, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(100,116,139,0.8)' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(100,116,139,0.6)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ── AVATAR ────────────────────────────────────────────────────
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm'|'md'|'lg' }) {
  const initials = name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || '?'
  const dim: Record<string, number>    = { sm: 30, md: 36, lg: 46 }
  const font: Record<string, number>   = { sm: 11, md: 13, lg: 16 }
  const palettes = [
    { bg: 'rgba(37,99,235,0.25)',  border: 'rgba(59,130,246,0.3)',  color: '#93c5fd' },
    { bg: 'rgba(109,40,217,0.25)', border: 'rgba(139,92,246,0.3)',  color: '#c4b5fd' },
    { bg: 'rgba(5,150,105,0.25)',  border: 'rgba(16,185,129,0.3)',  color: '#6ee7b7' },
    { bg: 'rgba(180,83,9,0.25)',   border: 'rgba(245,158,11,0.3)',  color: '#fcd34d' },
    { bg: 'rgba(6,148,162,0.25)',  border: 'rgba(34,211,238,0.3)',  color: '#a5f3fc' },
    { bg: 'rgba(190,18,60,0.25)',  border: 'rgba(244,63,94,0.3)',   color: '#fda4af' },
  ]
  const p = palettes[(name.charCodeAt(0) || 0) % palettes.length]
  const d = dim[size]
  return (
    <div style={{
      width: d, height: d, borderRadius: '50%',
      background: p.bg, border: `1.5px solid ${p.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: font[size], color: p.color,
      flexShrink: 0, letterSpacing: '0.02em',
      boxShadow: `0 0 12px ${p.border}40`,
    }}>
      {initials}
    </div>
  )
}

// ── EMPTY STATE ───────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description }: {
  icon: any; title: string; description?: string
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon size={28} /></div>
      <div style={{ fontWeight: 600, color: 'rgba(203,213,225,0.7)', fontSize: 15, marginBottom: 6 }}>{title}</div>
      {description && <div style={{ fontSize: 13, color: 'rgba(100,116,139,0.7)', maxWidth: 300 }}>{description}</div>}
    </div>
  )
}

// ── SKELETON ──────────────────────────────────────────────────
export function Skeleton({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`glass-card ${className}`} style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite', ...style }} />
  )
}
