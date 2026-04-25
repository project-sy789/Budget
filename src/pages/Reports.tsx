import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { formatBaht, formatDate, loanTypeLabel } from '../lib/formatters'
import { format, subMonths, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import { th } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function Reports() {
  const { loans, payments, fetchLoans, fetchPayments } = useStore()
  const [tab, setTab] = useState<'daily' | 'monthly' | 'yearly'>('monthly')
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))

  useEffect(() => {
    fetchLoans()
    fetchPayments()
  }, [])

  // Daily report for selected month
  const dailyData = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const start = startOfMonth(new Date(y, m - 1))
    const end = endOfMonth(new Date(y, m - 1))
    const days = eachDayOfInterval({ start, end })
    return days.map(d => {
      const key = format(d, 'yyyy-MM-dd')
      const dayPayments = payments.filter(p => p.payment_date === key)
      return {
        label: format(d, 'd'),
        interest: dayPayments.reduce((s, p) => s + (p.interest_paid || 0), 0),
        principal: dayPayments.reduce((s, p) => s + (p.principal_paid || 0), 0),
        count: dayPayments.length,
      }
    })
  }, [payments, selectedMonth])

  // Monthly report (last 12 months)
  const monthlyData = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(new Date(), 11 - i)
      const key = format(d, 'yyyy-MM')
      const label = format(d, 'MM/yy')
      const mp = payments.filter(p => p.payment_date?.startsWith(key))
      return {
        label,
        interest: Math.round(mp.reduce((s, p) => s + (p.interest_paid || 0), 0)),
        principal: Math.round(mp.reduce((s, p) => s + (p.principal_paid || 0), 0)),
        count: mp.length,
      }
    })
  , [payments])

  // Yearly
  const yearlyData = useMemo(() => {
    const years = new Set(payments.map(p => p.payment_date?.slice(0, 4)).filter(Boolean))
    return [...years].sort().map(year => {
      const yp = payments.filter(p => p.payment_date?.startsWith(year))
      return {
        label: year,
        interest: Math.round(yp.reduce((s, p) => s + (p.interest_paid || 0), 0)),
        principal: Math.round(yp.reduce((s, p) => s + (p.principal_paid || 0), 0)),
        count: yp.length,
      }
    })
  }, [payments])

  // Month summary totals
  const monthTotals = useMemo(() => {
    const mp = payments.filter(p => p.payment_date?.startsWith(selectedMonth))
    return {
      interest: mp.reduce((s, p) => s + (p.interest_paid || 0), 0),
      principal: mp.reduce((s, p) => s + (p.principal_paid || 0), 0),
      total: mp.reduce((s, p) => s + (p.amount || 0), 0),
      count: mp.length,
    }
  }, [payments, selectedMonth])

  // Export CSV
  const exportCSV = () => {
    const rows = [['วันที่', 'ผู้กู้', 'ยอดรวม', 'ดอกเบี้ย', 'เงินต้น', 'วิธีชำระ', 'ใบเสร็จ']]
    payments.forEach(p => {
      const loan = loans.find(l => l.id === p.loan_id)
      rows.push([p.payment_date, loan?.borrower_name || '', String(p.amount), String(p.interest_paid || 0), String(p.principal_paid || 0), p.payment_method, p.receipt_no || ''])
    })
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `loan-report-${format(new Date(), 'yyyyMMdd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Summary totals based on active tab
  const summaryTotals = useMemo(() => {
    const data = tab === 'daily' ? monthTotals : 
                 tab === 'monthly' ? monthlyData.reduce((s, m) => ({ 
                    interest: s.interest + m.interest, 
                    principal: s.principal + m.principal, 
                    total: s.interest + m.interest + s.principal + m.principal,
                    count: s.count + m.count 
                  }), { interest: 0, principal: 0, total: 0, count: 0 }) :
                 yearlyData.reduce((s, y) => ({ 
                    interest: s.interest + y.interest, 
                    principal: s.principal + y.principal, 
                    total: s.interest + y.interest + s.principal + y.principal,
                    count: s.count + y.count 
                  }), { interest: 0, principal: 0, total: 0, count: 0 });

    const label = tab === 'daily' ? `(${format(new Date(selectedMonth), 'MMM yyyy', { locale: th })})` :
                  tab === 'monthly' ? '(12 เดือนล่าสุด)' : '(ทุกปี)';
    
    return { ...data, label };
  }, [tab, monthTotals, monthlyData, yearlyData, selectedMonth])

  const chartData = tab === 'daily' ? dailyData : tab === 'monthly' ? monthlyData : yearlyData
  const xKey = 'label'

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>📊 รายงานและสถิติ</h2>
            <p>วิเคราะห์ข้อมูลรายรับและประสิทธิภาพพอร์ต</p>
          </div>
          <button onClick={exportCSV} className="btn btn-secondary">📥 ส่งออก CSV</button>
        </div>
      </div>
      <div className="page-content">
        {/* Summary Cards - Now always visible */}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 24 }}>
          <div className="kpi-card gold">
            <div className="kpi-label">ดอกเบี้ยรับ {summaryTotals.label}</div>
            <div className="kpi-value gold">{formatBaht(summaryTotals.interest)}</div>
            <div className="kpi-sub">จาก {summaryTotals.count} รายการ</div>
            <div className="kpi-icon">💰</div>
          </div>
          <div className="kpi-card success">
            <div className="kpi-label">คืนต้น</div>
            <div className="kpi-value success">{formatBaht(summaryTotals.principal)}</div>
            <div className="kpi-sub">เงินต้นที่รับคืน</div>
            <div className="kpi-icon">📥</div>
          </div>
          <div className="kpi-card info">
            <div className="kpi-label">ยอดรับรวม</div>
            <div className="kpi-value" style={{ color: 'var(--info)' }}>{formatBaht(summaryTotals.interest + summaryTotals.principal)}</div>
            <div className="kpi-sub">ดอก + ต้น</div>
            <div className="kpi-icon">💵</div>
          </div>
          <div className="kpi-card purple">
            <div className="kpi-label">จำนวนรายการ</div>
            <div className="kpi-value" style={{ color: 'var(--purple)' }}>{summaryTotals.count}</div>
            <div className="kpi-sub">ทั้งหมด</div>
            <div className="kpi-icon">📋</div>
          </div>
        </div>

        {/* Tab & Controls */}
        <div className="card-section" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div className="tabs" style={{ marginBottom: 0, border: 'none' }}>
              {(['daily', 'monthly', 'yearly'] as const).map(t => (
              <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                {t === 'daily' ? '📅 รายวัน' : t === 'monthly' ? '🗓️ รายเดือน' : '📆 รายปี'}
              </button>
            ))}
          </div>
          {tab === 'daily' && (
            <input
              type="month"
              className="form-input"
              style={{ width: 160 }}
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            />
          )}
          </div>
        </div>

        {/* Month Summary Cards - Remove duplicate */}
        {tab === 'daily' && false && (
          <div className="stats-row" style={{ marginBottom: 20 }}>
            <div className="stat-item">
              <div className="stat-value">{formatBaht(monthTotals.interest)}</div>
              <div className="stat-label">ดอกเบี้ยรับเดือนนี้</div>
            </div>
            <div className="stat-item">
              <div className="stat-value" style={{ color: 'var(--success)' }}>{formatBaht(monthTotals.principal)}</div>
              <div className="stat-label">คืนต้นเดือนนี้</div>
            </div>
            <div className="stat-item">
              <div className="stat-value" style={{ color: 'var(--info)' }}>{formatBaht(monthTotals.total)}</div>
              <div className="stat-label">รับเงินรวมเดือนนี้</div>
            </div>
            <div className="stat-item">
              <div className="stat-value" style={{ color: 'var(--text-secondary)' }}>{monthTotals.count}</div>
              <div className="stat-label">จำนวนรายการ</div>
            </div>
          </div>
        )}

        {/* Bar Chart */}
        <div className="card-section" style={{ marginBottom: 20 }}>
          <div className="section-header">
            <div>
              <div className="section-title-main">
                {tab === 'daily' ? `📊 รายรับ ${format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: th })}` : tab === 'monthly' ? '📊 รายรับ 12 เดือนล่าสุด' : '📊 รายรับรายปี'}
              </div>
              <div className="section-subtitle">เปรียบเทียบดอกเบี้ยและเงินต้นที่รับคืน</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barSize={tab === 'daily' ? 10 : 20} barGap={3}>
              <XAxis dataKey={xKey} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} formatter={(v: any) => formatBaht(Number(v))} />
              <Bar dataKey="interest" name="ดอกเบี้ย" fill="var(--gold)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="principal" name="คืนต้น" fill="var(--info)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payments Table */}
        <div className="card-section">
          <div className="section-header">
            <div>
              <div className="section-title-main">📋 รายการชำระทั้งหมด</div>
              <div className="section-subtitle">แสดง 50 รายการล่าสุด</div>
            </div>
          </div>
          {payments.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8, opacity: 0.3 }}>💳</div>
              <div>ยังไม่มีรายการชำระ</div>
            </div>
          ) : (
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>ผู้กู้</th>
                    <th>ประเภท</th>
                    <th>ยอดรวม</th>
                    <th>ดอกเบี้ย</th>
                    <th>เงินต้น</th>
                    <th>วิธี</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.slice(0, 50).map(p => {
                    const loan = loans.find(l => l.id === p.loan_id)
                    return (
                      <tr key={p.id}>
                        <td>{formatDate(p.payment_date)}</td>
                        <td style={{ fontWeight: 600 }}>{loan?.borrower_name || '-'}</td>
                        <td>{loan ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{loanTypeLabel(loan.loan_type)}</span> : '-'}</td>
                        <td className="td-amount td-gold">{formatBaht(p.amount)}</td>
                        <td style={{ color: 'var(--gold)' }}>{formatBaht(p.interest_paid || 0)}</td>
                        <td style={{ color: 'var(--success)' }}>{formatBaht(p.principal_paid || 0)}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{p.payment_method === 'cash' ? '💵 สด' : p.payment_method === 'transfer' ? '🏦 โอน' : '📝 อื่นๆ'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
