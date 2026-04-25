import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { isLoggedIn } from './lib/auth'
import { useStore } from './store/useStore'
import AgentDashboard from './pages/AgentDashboard'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Loans from './pages/Loans'
import LoanDetail from './pages/LoanDetail'
import AddLoan from './pages/AddLoan'
import Payments from './pages/Payments'
import Reports from './pages/Reports'
import Sidebar from './components/Sidebar'
import MobileNav from './components/MobileNav'
import './index.css'

export default function App() {
  const [authed, setAuthed] = useState(isLoggedIn())
  const { loans, fetchLoans, subscribeToAll, theme } = useStore()

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }, [theme])

  useEffect(() => {
    if (authed) {
      fetchLoans()
      const unsubscribe = subscribeToAll()
      return () => unsubscribe()
    }
  }, [authed])

  const overdueCount = loans.filter(l => {
    if (l.status !== 'active') return false
    return new Date() > new Date(l.due_date)
  }).length

  if (!authed) return <Login onLogin={() => setAuthed(true)} />

  return (
    <HashRouter>
      <div className="app-layout">
        <Sidebar onLogout={() => setAuthed(false)} overdueCount={overdueCount} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agents" element={<AgentDashboard />} />
            <Route path="/loans" element={<Loans />} />
            <Route path="/loans/:id" element={<LoanDetail />} />
            <Route path="/add-loan" element={<AddLoan />} />
            <Route path="/edit-loan/:id" element={<AddLoan />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/reports" element={<Reports />} />
          </Routes>
        </main>
        <MobileNav />
      </div>
    </HashRouter>
  )
}
