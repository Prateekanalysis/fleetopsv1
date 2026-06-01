// components/ui.tsx  — shared design system components
import { ReactNode, useState, useEffect } from 'react'
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react'

// ── SPINNER ──────────────────────────────────────
export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`animate-spin ${className}`}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" fill="none" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// ── TOAST ────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info'
interface ToastProps { type: ToastType; message: string; onClose: () => void }

export function Toast({ type, message, onClose }: ToastProps) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  const configs = {
    success: { icon: CheckCircle, bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400', iconColor: 'text-emerald-400' },
    error:   { icon: XCircle,     bg: 'bg-rose-500/15',    border: 'border-rose-500/30',    text: 'text-rose-300',    iconColor: 'text-rose-400' },
    warning: { icon: AlertTriangle,bg: 'bg-amber-500/15',  border: 'border-amber-500/30',  text: 'text-amber-300',   iconColor: 'text-amber-400' },
    info:    { icon: Info,         bg: 'bg-blue-500/15',   border: 'border-blue-500/30',   text: 'text-blue-300',    iconColor: 'text-blue-400' },
  }
  const c = configs[type]
  const Icon = c.icon
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 px-4 py-3.5 rounded-2xl border ${c.bg} ${c.border} shadow-modal animate-slide-in-right max-w-sm backdrop-blur-xl`}>
      <Icon size={18} className={`${c.iconColor} mt-0.5 flex-shrink-0`} />
      <p className="text-sm text-slate-200 flex-1 leading-snug">{message}</p>
      <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 ml-1">
        <X size={14} />
      </button>
    </div>
  )
}

// ── MODAL ────────────────────────────────────────
interface ModalProps { title: string; subtitle?: string; children: ReactNode; onClose: () => void; size?: 'sm' | 'md' | 'lg' }
export function Modal({ title, subtitle, children, onClose, size = 'md' }: ModalProps) {
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className={`relative w-full ${widths[size]} glass-card border border-white/10 shadow-modal animate-slide-up`} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1 hover:bg-white/5 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  )
}

// ── PROGRESS RING ─────────────────────────────────
export function ProgressRing({ value, max, size = 80, strokeWidth = 6, color = '#3b82f6', label, sublabel }: {
  value: number; max: number; size?: number; strokeWidth?: number; color?: string; label?: string; sublabel?: string
}) {
  const r = (size - strokeWidth * 2) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(value / max, 1)
  const dash = pct * circ
  const gap = circ - dash
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${gap}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease-out' }} />
      </svg>
      {(label || sublabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {label && <span className="font-bold text-white mono" style={{ fontSize: size > 80 ? 18 : 13 }}>{label}</span>}
          {sublabel && <span className="text-slate-500" style={{ fontSize: size > 80 ? 10 : 8 }}>{sublabel}</span>}
        </div>
      )}
    </div>
  )
}

// ── KPI CARD ──────────────────────────────────────
export function KpiCard({ label, value, sub, color, icon: Icon, trend }: {
  label: string; value: string | number; sub?: string; color: string; icon: any; trend?: { dir: 'up'|'down'; val: string }
}) {
  const colors: Record<string, string> = {
    blue: 'from-blue-600/20 to-blue-600/5 border-blue-500/20',
    emerald: 'from-emerald-600/20 to-emerald-600/5 border-emerald-500/20',
    amber: 'from-amber-600/20 to-amber-600/5 border-amber-500/20',
    rose: 'from-rose-600/20 to-rose-600/5 border-rose-500/20',
    violet: 'from-violet-600/20 to-violet-600/5 border-violet-500/20',
    cyan: 'from-cyan-600/20 to-cyan-600/5 border-cyan-500/20',
  }
  const iconColors: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/15', emerald: 'text-emerald-400 bg-emerald-500/15',
    amber: 'text-amber-400 bg-amber-500/15', rose: 'text-rose-400 bg-rose-500/15',
    violet: 'text-violet-400 bg-violet-500/15', cyan: 'text-cyan-400 bg-cyan-500/15',
  }
  const valColors: Record<string, string> = {
    blue: 'text-blue-300', emerald: 'text-emerald-300', amber: 'text-amber-300',
    rose: 'text-rose-300', violet: 'text-violet-300', cyan: 'text-cyan-300',
  }
  return (
    <div className={`stat-card bg-gradient-to-br ${colors[color]} border`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${iconColors[color]}`}>
          <Icon size={18} />
        </div>
        {trend && (
          <span className={`text-xs font-semibold ${trend.dir === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trend.dir === 'up' ? '↑' : '↓'} {trend.val}
          </span>
        )}
      </div>
      <div className={`text-3xl font-bold mono tracking-tight ${valColors[color]} mb-1`}>{value}</div>
      <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}

// ── AVATAR ────────────────────────────────────────
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm'|'md'|'lg' }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' }
  const colors = ['bg-blue-500/20 text-blue-300 border-blue-500/30', 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', 'bg-rose-500/20 text-rose-300 border-rose-500/30']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className={`${sizes[size]} rounded-full border font-bold flex items-center justify-center flex-shrink-0 ${color}`}>
      {initials}
    </div>
  )
}

// ── EMPTY STATE ───────────────────────────────────
export function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="p-5 rounded-2xl bg-white/5 border border-white/10 mb-4">
        <Icon size={32} className="text-slate-600" />
      </div>
      <h3 className="text-slate-300 font-semibold text-base mb-1">{title}</h3>
      {description && <p className="text-slate-500 text-sm max-w-xs">{description}</p>}
    </div>
  )
}

// ── SKELETON ──────────────────────────────────────
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-white/5 rounded-xl ${className}`} />
}

// ── SECTION DIVIDER ───────────────────────────────
export function Divider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-white/10" />
      {label && <span className="text-xs text-slate-600 font-medium uppercase tracking-widest">{label}</span>}
      <div className="flex-1 h-px bg-white/10" />
    </div>
  )
}

// ── TAG ───────────────────────────────────────────
export function Tag({ children, color = 'gray' }: { children: ReactNode; color?: string }) {
  const cls: Record<string, string> = {
    gray: 'badge-gray', blue: 'badge-blue', green: 'badge-green',
    amber: 'badge-amber', red: 'badge-red', violet: 'badge-violet',
  }
  return <span className={cls[color] || cls.gray}>{children}</span>
}
