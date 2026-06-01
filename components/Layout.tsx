// components/Layout.tsx
import { ReactNode } from 'react'
import { Zap } from 'lucide-react'

interface NavItem { id: string; label: string; icon: any; badge?: number }

interface LayoutProps {
  children: ReactNode
  navItems: NavItem[]
  activePage: string
  onNav: (id: string) => void
  topbarRight?: ReactNode
  sidebarTop?: ReactNode
  sidebarBottom?: ReactNode
  portalLabel: string
  portalColor: string
}

export default function Layout({ children, navItems, activePage, onNav, topbarRight, sidebarTop, sidebarBottom, portalLabel, portalColor }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-navy-950 bg-grid-pattern">
      {/* Sidebar */}
      <aside className="w-56 min-h-screen flex-shrink-0 flex flex-col sticky top-0 h-screen overflow-y-auto"
        style={{ background: 'rgba(5,12,23,0.95)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Brand */}
        <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-glow-blue flex-shrink-0">
              <Zap size={16} className="text-white" fill="white" />
            </div>
            <div>
              <div className="font-bold text-white text-base tracking-tight leading-none mono">FleetOps</div>
              <div className="text-xs mt-0.5" style={{ color: portalColor }}>{portalLabel}</div>
            </div>
          </div>
        </div>
        {/* Sidebar top slot */}
        {sidebarTop && <div className="px-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{sidebarTop}</div>}
        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = activePage === item.id
            return (
              <button key={item.id} onClick={() => onNav(item.id)}
                className={`nav-item ${isActive ? 'active' : ''}`}>
                <Icon size={16} className="flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span className="bg-rose-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{item.badge}</span>
                ) : null}
              </button>
            )
          })}
        </nav>
        {/* Sidebar bottom slot */}
        {sidebarBottom && <div className="px-3 py-3 mt-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>{sidebarBottom}</div>}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 flex items-center px-6 gap-3 flex-shrink-0 sticky top-0 z-30"
          style={{ background: 'rgba(5,12,23,0.95)', borderBottom: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}>
          <div className="flex-1" />
          {topbarRight}
        </header>
        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}
