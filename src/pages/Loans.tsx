import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { formatBaht, formatDate, isOverdue, loanTypeLabel, loanTypeBadgeClass, statusBadgeClass, statusLabel } from '../lib/formatters'

export default function Loans() {
  const { loans, payments, fetchLoans, fetchPayments, deleteLoan } = useStore()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [searchParams] = useSearchParams()

  useEffect(() => {
    fetchLoans()
    fetchPayments()
    const s = searchParams.get('status')
    if (s) setFilterStatus(s)
  }, [])

  const filtered = useMemo(() => {
    return loans.filter(l => {
      const matchSearch = !search || l.borrower_name.includes(search) || l.borrower_phone?.includes(search)
      const matchStatus = !filterStatus || l.status === filterStatus
      const matchType = !filterType || l.loan_type === filterType
      return matchSearch && matchStatus && matchType
    })
  }, [loans, search, filterStatus, filterType])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ลบสินเชื่อของ "${name}" ออกหรือไม่?\n(ประวัติการชำระทั้งหมดจะถูกลบด้วย)`)) return
    await deleteLoan(id)
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>📋 รายการสินเชื่อทั้งหมด</h2>
            <p>พบ {filtered.length} รายการจากทั้งหมด {loans.length} รายการ</p>
          </div>
          <Link to="/add-loan" className="btn btn-primary">➕ เพิ่มสินเชื่อใหม่</Link>
        </div>
      </div>
      <div className="page-content">
        {/* Search & Filters */}
        <div className="card-section" style={{ marginBottom: 20 }}>
          <div className="search-bar" style={{ marginBottom: 0 }}>
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                className="form-input"
                placeholder="ค้นหาชื่อ หรือเบอร์โทร..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="form-select" style={{ width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">ทุกสถานะ</option>
              <option value="active">กำลังส่ง</option>
              <option value="overdue">ค้างส่ง</option>
              <option value="closed">จบยอดแล้ว</option>
              <option value="restructured">ปรับยอด</option>
            </select>
            <select className="form-select" style={{ width: 180 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">ทุกประเภท</option>
              <option value="daily">ดอกรายวัน</option>
              <option value="weekly">ผ่อนรายอาทิตย์</option>
              <option value="monthly">ผ่อนรายเดือน</option>
              <option value="upfront">ดอกหน้า</option>
              <option value="bullet">เงินก้อน+ดอก</option>
              <option value="reducing">ลดต้นลดดอก</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>ไม่พบรายการสินเชื่อ</h3>
            <p>ลองเปลี่ยนคำค้นหา หรือ <Link to="/add-loan" style={{ color: 'var(--gold)' }}>เพิ่มสินเชื่อใหม่</Link></p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ชื่อผู้กู้</th>
                  <th>ประเภท</th>
                  <th>เงินต้น</th>
                  <th>อัตราดอก</th>
                  <th>วันเริ่ม</th>
                  <th>ครบกำหนด</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(loan => {
                  const overdueByDate = isOverdue(loan.due_date)
                  
                  // Calculate paid principal for this loan
                  const loanPayments = payments.filter(p => p.loan_id === loan.id)
                  const paidPrincipal = loanPayments.reduce((s, p) => s + (p.principal_paid || 0), 0)
                  const isPrincipalPaid = paidPrincipal >= loan.principal && loan.principal > 0

                  // Check if missed daily payment yesterday
                  let missedYesterday = false
                  if (loan.status === 'active' && loan.loan_type === 'daily' && !isPrincipalPaid) {
                    const yesterday = new Date()
                    yesterday.setDate(yesterday.getDate() - 1)
                    const yesterdayStr = yesterday.toISOString().slice(0, 10)
                    
                    if (loan.start_date <= yesterdayStr) {
                      const hasPaidYesterday = loanPayments.some(p => p.payment_date === yesterdayStr)
                      if (!hasPaidYesterday) missedYesterday = true
                    }
                  }

                  const isActuallyOverdue = loan.status === 'overdue' || (loan.status === 'active' && (overdueByDate || missedYesterday))
                  
                  const rowClass = isActuallyOverdue ? 'row-overdue' 
                    : loan.status === 'closed' ? 'row-closed' 
                    : loan.status === 'restructured' ? 'row-restructured' 
                    : isPrincipalPaid ? 'row-success'
                    : ''
                  
                  return (
                    <tr key={loan.id} className={rowClass}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{loan.borrower_name}</div>
                        {loan.borrower_phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{loan.borrower_phone}</div>}
                        
                        {/* Principal Progress Bar */}
                        <div style={{ marginTop: 8, width: '120px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>คืนต้นแล้ว</span>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: isPrincipalPaid ? 'var(--success)' : 'var(--gold)' }}>
                              {((paidPrincipal / loan.principal) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="progress-bar" style={{ height: 4, marginTop: 0 }}>
                            <div 
                              className="progress-fill" 
                              style={{ 
                                width: `${Math.min((paidPrincipal / loan.principal) * 100, 100)}%`,
                                background: isPrincipalPaid ? 'var(--success)' : 'var(--gold)'
                              }} 
                            />
                          </div>
                        </div>
                      </td>
                      <td><span className={`badge ${loanTypeBadgeClass(loan.loan_type)}`}>{loanTypeLabel(loan.loan_type)}</span></td>
                      <td className="td-amount td-gold">{formatBaht(loan.principal)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{loan.interest_rate}% / {loan.interest_period === 'daily' ? 'วัน' : loan.interest_period === 'weekly' ? 'อาทิตย์' : loan.interest_period === 'monthly' ? 'เดือน' : 'ปี'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{formatDate(loan.start_date)}</td>
                      <td style={{ color: isActuallyOverdue ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: isActuallyOverdue ? 700 : 400 }}>
                        {formatDate(loan.due_date)}
                        {isActuallyOverdue && <div style={{ fontSize: '0.72rem' }}>⚠️ ค้างชำระ</div>}
                      </td>
                      <td>
                        <span className={`badge ${isActuallyOverdue ? 'badge-danger' : statusBadgeClass(loan.status)}`}>
                          {isActuallyOverdue ? '⚠️ ค้างชำระ' : statusLabel(loan.status)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Link to={`/loans/${loan.id}`} className="btn btn-secondary btn-sm" title="ดูรายละเอียด">👁️</Link>
                          <Link to={`/edit-loan/${loan.id}`} className="btn btn-secondary btn-sm btn-icon" title="แก้ไข">✏️</Link>
                          <button onClick={() => handleDelete(loan.id, loan.borrower_name)} className="btn btn-danger btn-sm btn-icon" title="ลบ">🗑️</button>
                        </div>
                      </td>
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
