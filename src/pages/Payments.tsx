import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { formatBaht, formatDate, loanTypeLabel, loanTypeBadgeClass } from '../lib/formatters'

export default function Payments() {
  const { loans, payments, fetchLoans, fetchPayments } = useStore()
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchLoans()
    fetchPayments()
  }, [])

  const sorted = useMemo(() =>
    [...payments]
      .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
      .filter(p => {
        if (!search) return true
        const loan = loans.find(l => l.id === p.loan_id)
        return loan?.borrower_name.includes(search) || p.receipt_no?.includes(search)
      })
  , [payments, search, loans])

  const totalInterest = sorted.reduce((s, p) => s + (p.interest_paid || 0), 0)
  const totalPrincipal = sorted.reduce((s, p) => s + (p.principal_paid || 0), 0)

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>💳 ประวัติการชำระทั้งหมด</h2>
        <p>พบ {sorted.length} รายการ</p>
      </div>
      <div className="page-content">
        <div className="stats-row" style={{ marginBottom: 20 }}>
          <div className="stat-item">
            <div className="stat-value">{formatBaht(totalInterest)}</div>
            <div className="stat-label">ดอกเบี้ยรวม</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: 'var(--success)' }}>{formatBaht(totalPrincipal)}</div>
            <div className="stat-label">คืนต้นรวม</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: 'var(--info)' }}>{formatBaht(totalInterest + totalPrincipal)}</div>
            <div className="stat-label">ยอดรับรวม</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: 'var(--text-secondary)' }}>{sorted.length}</div>
            <div className="stat-label">จำนวนรายการ</div>
          </div>
        </div>

        <div className="search-bar">
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input className="form-input" placeholder="ค้นหาชื่อผู้กู้ หรือเลขใบเสร็จ..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💳</div>
            <h3>ยังไม่มีรายการชำระ</h3>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ผู้กู้</th>
                  <th>ประเภทสินเชื่อ</th>
                  <th>ยอดรวม</th>
                  <th>ดอกเบี้ย</th>
                  <th>เงินต้น</th>
                  <th>วิธีชำระ</th>
                  <th>ใบเสร็จ</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => {
                  const loan = loans.find(l => l.id === p.loan_id)
                  return (
                    <tr key={p.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(p.payment_date)}</td>
                      <td style={{ fontWeight: 600 }}>{loan?.borrower_name || '-'}</td>
                      <td>{loan ? <span className={`badge ${loanTypeBadgeClass(loan.loan_type)}`}>{loanTypeLabel(loan.loan_type)}</span> : '-'}</td>
                      <td className="td-amount td-gold">{formatBaht(p.amount)}</td>
                      <td style={{ color: 'var(--gold)' }}>{formatBaht(p.interest_paid || 0)}</td>
                      <td style={{ color: 'var(--success)' }}>{formatBaht(p.principal_paid || 0)}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        {p.payment_method === 'cash' ? '💵 เงินสด' : p.payment_method === 'transfer' ? '🏦 โอน' : '📝 อื่นๆ'}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{p.receipt_no || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
