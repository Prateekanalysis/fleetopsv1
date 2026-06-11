// components/Layout.tsx — shared app shell with animated background
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

export default function Layout({
  children, navItems, activePage, onNav,
  topbarRight, sidebarTop, sidebarBottom,
  portalLabel, portalColor,
}: LayoutProps) {
  return (
    <>
      {/* ── Animated background layer ── */}
      <div className="app-bg" aria-hidden>
        <div className="app-grid" />
        <div className="app-scanline" />
      </div>

      {/* ── App shell ── */}
      <div className="app-shell">
        {/* SIDEBAR */}
        <aside className="sidebar">
          {/* Brand */}
          <div className="sidebar-brand">
            <div className="sidebar-brand-logo">
              <div className="logo-icon">
                <Zap size={17} color="#fff" fill="#fff" />
              </div>
              <div>
                <div className="logo-text">FleetOps</div>
                <div className="logo-sub" style={{ color: portalColor }}>{portalLabel}</div>
              </div>
            </div>
          </div>

          {/* Rider info slot */}
          {sidebarTop && (
            <div style={{ padding: '10px 10px 0', borderBottom: '1px solid rgba(255,255,255,0.045)' }}>
              {sidebarTop}
            </div>
          )}

          {/* Nav */}
          <nav style={{ flex: 1, paddingTop: 8, paddingBottom: 8 }}>
            {navItems.map((item, i) => {
              const Icon = item.icon
              const isActive = activePage === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onNav(item.id)}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <Icon size={15} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge ? (
                    <span className="notif-badge">{item.badge}</span>
                  ) : null}
                </button>
              )
            })}
          </nav>

          {/* Bottom slot */}
          {sidebarBottom && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.045)', paddingTop: 8, paddingBottom: 12 }}>
              {sidebarBottom}
            </div>
          )}
        </aside>

        {/* MAIN */}
        <div className="main-content">
          {/* Topbar */}
          <header className="topbar">
            <div style={{ flex: 1 }} />
            {topbarRight}
          </header>

          {/* Page content */}
          <main className="page-content">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}
