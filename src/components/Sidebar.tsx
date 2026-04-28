import { NavLink } from 'react-router-dom'
import { logout } from '../lib/auth'
import { useStore } from '../store/useStore'

interface Props { onLogout: () => void; overdueCount: number }

const navItems = [
  { path: '/', label: 'ภาพรวม', icon: '🏠', section: 'หลัก' },
  { path: '/agents', label: 'คุมสายส่ง', icon: '🤝', section: 'หลัก' },
  { path: '/loans', label: 'รายการสินเชื่อ', icon: '📋', section: 'หลัก' },
  { path: '/add-loan', label: 'เพิ่มสินเชื่อใหม่', icon: '➕', section: 'หลัก' },
  { path: '/payments', label: 'จำลองกู้', icon: '📉', section: 'การเงิน' },
  { path: '/reports', label: 'รายงาน', icon: '📊', section: 'การเงิน' },
]

export default function Sidebar({ onLogout, overdueCount }: Props) {
  const { theme, toggleTheme } = useStore()

  const handleLogout = () => {
    logout()
    onLogout()
  }

  const sections = [...new Set(navItems.map(i => i.section))]

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">💰</div>
        <h1>ระบบจัดการสินเชื่อ</h1>
        <p>Loan Tracker Pro</p>
      </div>

      <nav className="sidebar-nav">
        {sections.map(section => (
          <div key={section} className="nav-section">
            <div className="nav-section-label">{section}</div>
            {navItems.filter(i => i.section === section).map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                end={item.path === '/'}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.path === '/loans' && overdueCount > 0 && (
                  <span className="nav-badge">{overdueCount}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button onClick={toggleTheme} className="btn btn-secondary btn-full btn-sm" style={{ marginBottom: 8 }}>
          {theme === 'dark' ? '☀️ โหมดสว่าง' : '🌙 โหมดมืด'}
        </button>
        <button onClick={handleLogout} className="btn btn-danger btn-full btn-sm" style={{ opacity: 0.8 }}>
          🚪 ออกจากระบบ
        </button>
      </div>
    </aside>
  )
}
