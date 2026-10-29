import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Icon, type IconName } from './Icon'

interface NavItem {
  to: string
  label: string
  icon: IconName
  adminOnly?: boolean
}

// Bottom tabs on phones
const mobileTabs: NavItem[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/tasks', label: 'Tasks', icon: 'check' },
  { to: '/outreach', label: 'Outreach', icon: 'building' },
  { to: '/tickets', label: 'Tickets', icon: 'ticket' },
  { to: '/more', label: 'More', icon: 'menu' },
]

// Full nav on larger screens
const desktopNav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'home' },
  { to: '/tasks', label: 'Tasks', icon: 'check' },
  { to: '/outreach', label: 'Outreach', icon: 'building' },
  { to: '/tickets', label: 'Tickets', icon: 'ticket' },
  { to: '/tables', label: 'Tables', icon: 'table' },
  { to: '/ideas', label: 'Ideas', icon: 'bulb' },
  { to: '/budget', label: 'Budget', icon: 'dollar', adminOnly: true },
  { to: '/users', label: 'Users', icon: 'users', adminOnly: true },
  { to: '/settings', label: 'Settings', icon: 'gear', adminOnly: true },
]

export default function Layout() {
  const { me, isAdmin, signOut } = useAuth()

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar (md+) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-navy text-cream md:flex">
        <div className="flex items-center gap-3 border-b border-gold/30 p-4">
          <img src="/icon-192.png" alt="" className="h-12 w-12 rounded-full" />
          <div className="leading-tight">
            <div className="font-serif text-lg text-gold-light">Bourbon &amp; Bubbles</div>
            <div className="text-xs text-cream/70">Volunteer Hub</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {desktopNav
            .filter((n) => !n.adminOnly || isAdmin)
            .map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition ${
                    isActive ? 'bg-gold/20 text-gold-light' : 'text-cream/85 hover:bg-white/10'
                  }`
                }
              >
                <Icon name={n.icon} className="h-5 w-5" />
                {n.label}
              </NavLink>
            ))}
        </nav>
        <div className="border-t border-gold/30 p-3 text-sm">
          <NavLink to="/profile" className="block truncate rounded-lg px-3 py-2 hover:bg-white/10">
            {me?.name}
            <span className="block truncate text-xs text-cream/60">{me?.email}</span>
          </NavLink>
          <button onClick={signOut} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-cream/70 hover:bg-white/10">
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header (phones) */}
        <header className="sticky top-0 z-20 flex items-center gap-3 bg-navy px-4 py-2 text-cream shadow md:hidden" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
          <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-full" />
          <div className="font-serif text-lg text-gold-light">Bourbon &amp; Bubbles</div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-10">
          <Outlet />
        </main>

        {/* Bottom tabs (phones) */}
        <nav
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-gold/40 bg-navy text-cream md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {mobileTabs.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${
                  isActive ? 'text-gold-light' : 'text-cream/70'
                }`
              }
            >
              <Icon name={n.icon} className="h-6 w-6" />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
