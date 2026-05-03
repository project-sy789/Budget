import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useStore } from '../store/useStore'
import { formatBaht, formatDate, isOverdue, loanTypeLabel } from '../lib/formatters'
import { calcDailyFlat } from '../lib/calculations'
import { differenceInDays, parseISO, format, subMonths } from 'date-fns'
import { th } from 'date-fns/locale'

const PIE_COLORS = ['#f5a623', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#20d9d2']

export default function Dashboard() {
  const { loans, payments, fetchLoans, fetchPayments } = useStore()

  useEffect(() => {
    fetchLoans()
    fetchPayments()
  }, [])

  const stats = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    
    const active = loans.filter(l => {
      return l.status === 'active' || l.status === 'overdue'
    })
    
    const overdue = active.filter(l => {
      const loanPayments = payments.filter(p => p.loan_id === l.id)
      const paidPrincipal = loanPayments.reduce((s, p) => s + (p.principal_paid || 0), 0)
      const isPrincipalPaid = paidPrincipal >= l.principal && l.principal > 0
      if (isPrincipalPaid) return false

      const isPastDue = todayStr > l.due_date
      const hasPaidToday = loanPayments.some(p => p.payment_date === todayStr)
      return isPastDue && !hasPaidToday
    })

    const totalPrincipal = active.reduce((s, l) => s + l.principal, 0)

    const todayInterest = active.reduce((s, l) => {
      // If principal is already paid, no interest for today (standardizing)
      const loanPayments = payments.filter(p => p.loan_id === l.id)
      const paidPrincipal = loanPayments.reduce((sum, p) => sum + (p.principal_paid || 0), 0)
      if (paidPrincipal >= l.principal && l.principal > 0) return s

      const r = calcDailyFlat(l.principal, l.interest_rate, l.interest_period, 1)
      return s + r.dailyInterest
    }, 0)

    const todayPayments = payments.filter(p => p.payment_date === todayStr)
    const todayRealizedInterest = todayPayments.reduce((s, p) => s + (p.interest_paid || 0), 0)

    const now = new Date()
    const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd')
    const yearStart = format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd')

    const monthPayments = payments.filter(p => p.payment_date >= monthStart)
    const monthInterest = monthPayments.reduce((s, p) => s + (p.interest_paid || 0), 0)
    const monthPrincipal = monthPayments.reduce((s, p) => s + (p.principal_paid || 0), 0)
    const yearInterest = payments.filter(p => p.payment_date >= yearStart).reduce((s, p) => s + (p.interest_paid || 0), 0)

    return { 
      active: active.length, 
      overdue: overdue.length, 
      totalPrincipal, 
      todayInterest, 
      todayRealizedInterest,
      monthInterest, 
      monthPrincipal, 
      yearInterest, 
      total: loans.length 
    }
  }, [loans, payments])

  const monthlyData = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i)
      const key = format(d, 'yyyy-MM')
      const label = format(d, 'MMM', { locale: th })
      const interest = payments.filter(p => p.payment_date?.startsWith(key)).reduce((s, p) => s + (p.interest_paid || 0), 0)
      const principal = payments.filter(p => p.payment_date?.startsWith(key)).reduce((s, p) => s + (p.principal_paid || 0), 0)
      return { label, interest: Math.round(interest), principal: Math.round(principal) }
    })
  , [payments])

  const typeData = useMemo(() => {
    const map: Record<string, number> = {}
    loans.filter(l => l.status === 'active').forEach(l => {
      map[l.loan_type] = (map[l.loan_type] || 0) + l.principal
    })
    return Object.entries(map).map(([type, value]) => ({
      name: loanTypeLabel(type).replace(/^\S+\s/, ''),
      value,
    }))
  }, [loans])

  const dueSoon = useMemo(() =>
    loans
      .filter(l => l.status === 'active')
      .filter(l => {
        const d = differenceInDays(parseISO(l.due_date), new Date())
        return d >= 0 && d <= 7
      })
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 5)
  , [loans])

  const overdueLoans = useMemo(() =>
    loans.filter(l => {
      if (l.status !== 'active' && l.status !== 'overdue') return false
      const loanPayments = payments.filter(p => p.loan_id === l.id)
      const paidPrincipal = loanPayments.reduce((s, p) => s + (p.principal_paid || 0), 0)
      const isPrincipalPaid = paidPrincipal >= l.principal && l.principal > 0
      if (isPrincipalPaid) return false

      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const hasPaidToday = loanPayments.some(p => p.payment_date === todayStr)
      const overdueByDate = isOverdue(l.due_date)
      
      return (l.status === 'overdue' || overdueByDate) && !hasPaidToday
    }).slice(0, 5)
  , [loans, payments])

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>📊 ภาพรวมพอร์ตสินเชื่อ</h2>
        <p>ข้อมูล ณ วันที่ {format(new Date(), 'd MMMM yyyy', { locale: th })}</p>
      </div>
      <div className="page-content">

        {/* KPIs */}
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          <div className="kpi-card gold">
            <div className="kpi-label">เงินต้นคงค้างทั้งหมด</div>
            <div className="kpi-value gold">{formatBaht(stats.totalPrincipal)}</div>
            <div className="kpi-sub">{stats.active} รายที่ active</div>
            <div className="kpi-icon">💼</div>
          </div>
          <div className="kpi-card success">
            <div className="kpi-label">ดอกเบี้ยรับจริงวันนี้</div>
            <div className="kpi-value success">{formatBaht(stats.todayRealizedInterest)}</div>
            <div className="kpi-sub">เฉลี่ยตามสัดส่วน: {formatBaht(stats.todayInterest)}/วัน</div>
            <div className="kpi-icon">📅</div>
          </div>
          <div className="kpi-card info">
            <div className="kpi-label">ดอกเบี้ยรับเดือนนี้</div>
            <div className="kpi-value" style={{ color: 'var(--info)' }}>{formatBaht(stats.monthInterest)}</div>
            <div className="kpi-sub">+ คืนต้น {formatBaht(stats.monthPrincipal)}</div>
            <div className="kpi-icon">🗓️</div>
          </div>
          <div className="kpi-card purple">
            <div className="kpi-label">ดอกเบี้ยรับปีนี้</div>
            <div className="kpi-value" style={{ color: 'var(--purple)' }}>{formatBaht(stats.yearInterest)}</div>
            <div className="kpi-sub">ตั้งแต่ต้นปี</div>
            <div className="kpi-icon">📆</div>
          </div>
          <div className="kpi-card danger">
            <div className="kpi-label">รายการค้างชำระ</div>
            <div className="kpi-value danger">{stats.overdue}</div>
            <div className="kpi-sub">จาก {stats.total} รายการทั้งหมด</div>
            <div className="kpi-icon">⚠️</div>
          </div>
        </div>

        {/* Charts */}
        <div className="dashboard-charts">
          <div className="card-section">
            <div className="section-header">
              <div>
                <div className="section-title-main">📈 รายรับดอกเบี้ย 6 เดือนล่าสุด</div>
                <div className="section-subtitle">เปรียบเทียบดอกเบี้ยและเงินต้นที่รับคืน</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} barSize={20} barGap={4}>
                <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} formatter={(v: any) => formatBaht(Number(v))} />
                <Bar dataKey="interest" name="ดอกเบี้ย" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="principal" name="คืนต้น" fill="var(--info)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card-section">
            <div className="section-header">
              <div>
                <div className="section-title-main">🥧 สัดส่วนพอร์ต</div>
                <div className="section-subtitle">แบ่งตามประเภทสินเชื่อ</div>
              </div>
            </div>
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={typeData} cx="50%" cy="45%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {typeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                  <Tooltip formatter={(v: any) => formatBaht(Number(v))} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ padding: 40 }}>
                <div style={{ fontSize: '2rem', marginBottom: 8, opacity: 0.3 }}>📊</div>
                <div>ยังไม่มีข้อมูล</div>
              </div>
            )}
          </div>
        </div>

        {/* Due Soon & Overdue */}
        <div className="dashboard-alerts">
          <div className="card-section">
            <div className="section-header">
              <div>
                <div className="section-title-main">⏰ ใกล้ครบกำหนด</div>
                <div className="section-subtitle">รายการที่จะครบกำหนดใน 7 วัน</div>
              </div>
            </div>
            {dueSoon.length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8, opacity: 0.3 }}>✅</div>
                <div style={{ color: 'var(--text-secondary)' }}>ไม่มีรายการใกล้ครบกำหนด</div>
              </div>
            ) : dueSoon.map(l => (
              <Link key={l.id} to={`/loans/${l.id}`} style={{ textDecoration: 'none' }}>
                <div className="receipt-row" style={{ cursor: 'pointer', transition: 'all 0.2s' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{l.borrower_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>ครบ {formatDate(l.due_date)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="amount" style={{ color: 'var(--warning)', fontSize: '0.95rem' }}>{formatBaht(l.principal)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      อีก {differenceInDays(parseISO(l.due_date), new Date())} วัน
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="card-section">
            <div className="section-header">
              <div>
                <div className="section-title-main">🔴 ค้างชำระ</div>
                <div className="section-subtitle">รายการที่เกินกำหนดชำระ</div>
              </div>
            </div>
            {overdueLoans.length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8, opacity: 0.3 }}>✅</div>
                <div style={{ color: 'var(--text-secondary)' }}>ไม่มีรายการค้างชำระ</div>
              </div>
            ) : (
              <>
                {overdueLoans.map(l => (
                  <Link key={l.id} to={`/loans/${l.id}`} style={{ textDecoration: 'none' }}>
                    <div className="receipt-row" style={{ cursor: 'pointer', transition: 'all 0.2s' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{l.borrower_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: 2 }}>
                          เกินกำหนด {Math.abs(differenceInDays(parseISO(l.due_date), new Date()))} วัน
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="amount" style={{ color: 'var(--danger)', fontSize: '0.95rem' }}>{formatBaht(l.principal)}</div>
                      </div>
                    </div>
                  </Link>
                ))}
                <Link to="/loans?status=overdue" className="btn btn-danger btn-sm btn-full" style={{ marginTop: 16 }}>
                  ดูทั้งหมด →
                </Link>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
