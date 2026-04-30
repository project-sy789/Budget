import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { isLoggedIn } from './lib/auth'
import { useStore } from './store/useStore'
import Agents from './pages/Agents'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Loans from './pages/Loans'
import LoanDetail from './pages/LoanDetail'
import AddLoan from './pages/AddLoan'
import Payments from './pages/Payments'
import Reports from './pages/Reports'
import RepairData from './pages/RepairData'
import Sidebar from './components/Sidebar'
import MobileNav from './components/MobileNav'
import './index.css'

export default function App() {
  const [authed, setAuthed] = useState(isLoggedIn())
  const { loans, payments, fetchLoans, fetchPayments, fetchAgents, subscribeToAll, theme } = useStore()
  const [todayStr] = useState(new Date().toISOString().slice(0, 10))

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
      fetchPayments()
      fetchAgents?.()
      const unsubscribe = subscribeToAll()
      return () => unsubscribe()
    }
  }, [authed])

  const overdueCount = loans.filter(l => {
    if (l.status !== 'active' && l.status !== 'overdue') return false
    
    // Check if principal is already fully paid
    const loanPayments = payments.filter(p => p.loan_id === l.id)
    const paidPrincipal = loanPayments.reduce((s, p) => s + (p.principal_paid || 0), 0)
    const isPrincipalPaid = paidPrincipal >= l.principal && l.principal > 0
    if (isPrincipalPaid) return false

    // Overdue logic: Today is on or after due date, and hasn't paid today
    const isPastDue = todayStr >= l.due_date
    const hasPaidToday = loanPayments.some(p => p.payment_date === todayStr)
    
    return isPastDue && !hasPaidToday
  }).length

  if (!authed) return <Login onLogin={() => setAuthed(true)} />

  return (
    <HashRouter>
      <div className="app-layout">
        <Sidebar onLogout={() => setAuthed(false)} overdueCount={overdueCount} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/loans" element={<Loans />} />
            <Route path="/loans/:id" element={<LoanDetail />} />
            <Route path="/add-loan" element={<AddLoan />} />
            <Route path="/edit-loan/:id" element={<AddLoan />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/repair" element={<RepairData />} />
          </Routes>
        </main>
        <MobileNav />
      </div>
    </HashRouter>
  )
}
