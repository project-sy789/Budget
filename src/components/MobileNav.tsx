import { NavLink } from 'react-router-dom'

interface NavItem {
  path: string
  label: string
  icon: string
}

const navItems: NavItem[] = [
  { path: '/', label: 'หน้าหลัก', icon: '🏠' },
  { path: '/agents', label: 'สายส่ง', icon: '🤝' },
  { path: '/loans', label: 'สินเชื่อ', icon: '📋' },
  { path: '/add-loan', label: 'เพิ่ม', icon: '➕' },
  { path: '/payments', label: 'เครื่องมือคำนวณ', icon: '📉' },
  { path: '/reports', label: 'รายงาน', icon: '📊' },
]

export default function MobileNav() {
  return (
    <nav className="mobile-nav">
      {navItems.map(item => (
        <NavLink 
          key={item.path} 
          to={item.path} 
          className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
          end={item.path === '/'}
        >
          <span className="mobile-nav-icon">{item.icon}</span>
          <span className="mobile-nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
