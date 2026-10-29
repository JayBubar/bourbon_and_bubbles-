import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Icon, type IconName } from '../components/Icon'

const items: { to: string; label: string; icon: IconName; adminOnly?: boolean }[] = [
  { to: '/ideas', label: 'Ideas Board', icon: 'bulb' },
  { to: '/tables', label: 'Tables', icon: 'table' },
  { to: '/budget', label: 'Budget', icon: 'dollar', adminOnly: true },
  { to: '/users', label: 'Users', icon: 'users', adminOnly: true },
  { to: '/settings', label: 'Settings', icon: 'gear', adminOnly: true },
  { to: '/profile', label: 'My profile', icon: 'user' },
]

export default function More() {
  const { isAdmin, signOut } = useAuth()
  return (
    <div>
      <h1 className="text-2xl">More</h1>
      <ul className="card mt-4 divide-y divide-gold/20 p-0">
        {items
          .filter((i) => !i.adminOnly || isAdmin)
          .map((i) => (
            <li key={i.to}>
              <Link to={i.to} className="flex min-h-14 items-center gap-3 px-4 text-navy">
                <Icon name={i.icon} className="h-5 w-5 text-burgundy" />
                <span className="flex-1">{i.label}</span>
                <Icon name="chevron" className="h-4 w-4 text-navy/40" />
              </Link>
            </li>
          ))}
        <li>
          <button onClick={signOut} className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-navy">
            <Icon name="logout" className="h-5 w-5 text-burgundy" />
            Sign out
          </button>
        </li>
      </ul>
    </div>
  )
}
