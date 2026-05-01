import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { formatBaht, formatDate, isOverdue, loanTypeLabel, loanTypeBadgeClass, statusBadgeClass, statusLabel } from '../lib/formatters'
import { calcDailyFlat, calcRemainingBalance } from '../lib/calculations'
import { differenceInDays, parseISO, addDays, format } from 'date-fns'
import PaymentModal from '../components/PaymentModal'
import DailyCheckin from '../components/DailyCheckin'
import RestructureModal from '../components/RestructureModal'

export default function LoanDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { loans, payments, fetchLoans, fetchPayments, updateLoan, deletePayment } = useStore()
  const [showPayModal, setShowPayModal] = useState(false)
  const [showRestructureModal, setShowRestructureModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<any>(null)
  const [isClosing, setIsClosing] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'payments' | 'checkin' | 'calc'>('checkin')

  const loan = useMemo(() => loans.find(l => l.id === id), [loans, id])
  const loanPayments = useMemo(() => payments.filter(p => p.loan_id === id).sort((a, b) => b.payment_date.localeCompare(a.payment_date)), [payments, id])

  useEffect(() => {
    if (loans.length === 0) fetchLoans()
    fetchPayments(id)
    
    // Check if we should auto-open the close modal
    const params = new URLSearchParams(window.location.hash.split('?')[1])
    if (params.get('close') === 'true') {
      setIsClosing(true)
      setShowPayModal(true)
    }
  }, [id])

  if (!loan) return (
    <div className="page-content fade-in">
      <div className="empty-state">
        <div className="empty-icon">🔍</div>
        <h3>ไม่พบสินเชื่อ</h3>
        <Link to="/loans" className="btn btn-secondary" style={{ marginTop: 12 }}>← กลับ</Link>
      </div>
    </div>
  )

  const paidPrincipal = loanPayments.reduce((s, p) => s + (p.principal_paid || 0), 0)
  const paidInterest = loanPayments.reduce((s, p) => s + (p.interest_paid || 0), 0)
  const remaining = calcRemainingBalance(loan.principal, paidPrincipal)
  const daysElapsed = differenceInDays(new Date(), parseISO(loan.start_date))
  const progressPct = Math.min((paidPrincipal / loan.principal) * 100, 100)
  const todayStr = new Date().toISOString().slice(0, 10)
  const hasPaidToday = loanPayments.some(p => p.payment_date === todayStr)
  const isPrincipalPaid = paidPrincipal >= loan.principal && loan.principal > 0
  const overdue = loan.status === 'active' && isOverdue(loan.due_date) && !hasPaidToday && !isPrincipalPaid
 
  // 💡 Smart Accrued Interest Calculation (Daily Accrual Logic)
  const accruedInterest = useMemo(() => {
    // For non-daily periods (weekly/monthly flat-rate with installments)
    if (loan.interest_period !== 'daily' && loan.installments && loan.installments > 0) {
      const totalInterest = (loan.principal * loan.interest_rate) / 100
      const interestPerInst = totalInterest / loan.installments
      return interestPerInst * Math.min(daysElapsed, loan.installments)
    }

    // For Daily Flat/Naive Interest (Iterate day by day to check remaining principal)
    let dailyRate = 0
    if (loan.interest_period === 'daily') dailyRate = loan.interest_rate / 100
    else if (loan.interest_period === 'weekly') dailyRate = loan.interest_rate / 100 / 7
    else if (loan.interest_period === 'monthly') dailyRate = loan.interest_rate / 100 / 30
    else if (loan.interest_period === 'yearly') dailyRate = loan.interest_rate / 100 / 365
    else dailyRate = loan.interest_rate / 100 / 30 // fallback

    // For Bullet or Upfront: Accrued interest is fixed based on the contract duration
    if (loan.loan_type === 'bullet' || loan.loan_type === 'upfront') {
      const contractDays = Math.max(1, differenceInDays(parseISO(loan.due_date), parseISO(loan.start_date)) + (loan.include_first_day ? 1 : 0))
      return loan.principal * dailyRate * contractDays
    }

    let totalAccrued = 0
    const start = parseISO(loan.start_date)

    for (let i = 0; i < daysElapsed; i++) {
      const currentDate = addDays(start, i)
      const dStr = format(currentDate, 'yyyy-MM-dd')

      // Calculate principal paid STRICTLY BEFORE this day
      // (Interest is charged for the day the borrower possesses the capital)
      const principalPaidBefore = loanPayments
        .filter(p => p.payment_date < dStr)
        .reduce((sum, p) => sum + (p.principal_paid || 0), 0)
      
      const currentPrincipal = Math.max(0, loan.principal - principalPaidBefore)
      if (currentPrincipal > 0) {
        // Option B: Interest is fixed based on initial principal until fully paid
        totalAccrued += loan.principal * dailyRate
      } else {
        // Stop accruing interest the day after the principal reaches zero
        break
      }
    }
    return totalAccrued
  }, [loan, loanPayments, daysElapsed])

  const outstandingInterest = Math.max(accruedInterest - paidInterest, 0)

  const handleStatusChange = async (status: string) => {
    await updateLoan(loan.id, { status: status as any })
  }

  const handleDeletePayment = async (payId: string) => {
    if (!confirm('ลบรายการชำระนี้?')) return
    await deletePayment(payId)
    fetchPayments(id)
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/loans')} className="btn btn-secondary btn-sm">← กลับ</button>
              <span className={`badge ${loanTypeBadgeClass(loan.loan_type)}`}>{loanTypeLabel(loan.loan_type)}</span>
              <span className={`badge ${statusBadgeClass(loan.status)}`}>{statusLabel(loan.status)}</span>
              {overdue && <span className="badge badge-danger">⚠️ เกินกำหนด</span>}
            </div>
            <h2 style={{ marginBottom: 4 }}>{loan.borrower_name}</h2>
            <p style={{ fontSize: '0.9rem' }}>{loan.borrower_phone} {loan.borrower_address && `· ${loan.borrower_address}`}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button 
              onClick={() => setShowRestructureModal(true)} 
              className="btn btn-secondary"
            >
              🔄 ปรับโครงสร้าง/เปิดใหม่
            </button>
            <button 
              onClick={() => {
                setIsClosing(true)
                setShowPayModal(true)
              }} 
              className="btn btn-success"
            >
              🏁 ปิดยอดก่อน
            </button>
            <button 
              onClick={() => {
                setIsClosing(false)
                setShowPayModal(true)
              }} 
              className="btn btn-primary"
            >
              💳 บันทึกชำระ
            </button>
            <select className="form-select" style={{ width: 160 }} value={loan.status} onChange={e => handleStatusChange(e.target.value)}>
              <option value="active">กำลังดำเนินการ</option>
              <option value="closed">ปิดบัญชี</option>
              <option value="overdue">ค้างชำระ</option>
              <option value="restructured">ปรับโครงสร้าง</option>
            </select>
          </div>
        </div>
      </div>
      <div className="page-content">
        {/* Financial Summary */}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 24 }}>
          <div className="kpi-card gold">
            <div className="kpi-label">เงินต้น</div>
            <div className="kpi-value gold" style={{ fontSize: '1.3rem' }}>{formatBaht(loan.principal)}</div>
            <div className="kpi-sub">
              {(() => {
                let daily = loan.interest_rate
                if (loan.interest_period === 'weekly') daily = loan.interest_rate / 7
                if (loan.interest_period === 'monthly') daily = loan.interest_rate / 30
                if (loan.interest_period === 'yearly') daily = loan.interest_rate / 365
                return `${daily.toFixed(2)}% / วัน`
              })()}
            </div>
          </div>
          <div className="kpi-card success">
            <div className="kpi-label">คืนต้นแล้ว</div>
            <div className="kpi-value success" style={{ fontSize: '1.3rem' }}>{formatBaht(paidPrincipal)}</div>
            <div className="kpi-sub">คงเหลือ {formatBaht(remaining)}</div>
          </div>
          <div className="kpi-card info">
            <div className="kpi-label">ดอกเบี้ยสะสม</div>
            <div className="kpi-value" style={{ fontSize: '1.3rem', color: 'var(--info)' }}>{formatBaht(accruedInterest)}</div>
            <div className="kpi-sub">{daysElapsed} วันที่ผ่านมา</div>
          </div>
          <div className="kpi-card success">
            <div className="kpi-label">รับดอกแล้ว</div>
            <div className="kpi-value success" style={{ fontSize: '1.2rem' }}>{formatBaht(paidInterest)}</div>
          </div>
          <div className="kpi-card danger">
            <div className="kpi-label">ดอกค้างรับ</div>
            <div className="kpi-value danger" style={{ fontSize: '1.2rem' }}>{formatBaht(outstandingInterest)}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ความคืบหน้าการคืนต้น</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gold)' }}>{progressPct.toFixed(1)}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>เริ่ม {formatDate(loan.start_date)}</span>
            <span style={{ color: overdue ? 'var(--danger)' : 'var(--text-muted)' }}>ครบ {formatDate(loan.due_date)}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {(['checkin', 'info', 'payments', 'calc'] as const).map(tab => (
            <button key={tab} className={`tab${activeTab === tab ? ' active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab === 'checkin' ? '📅 เช็คยอดรายวัน' : tab === 'info' ? '📋 ข้อมูล' : tab === 'payments' ? `💳 การชำระ (${loanPayments.length})` : '🧮 คำนวณ'}
            </button>
          ))}
        </div>

        {activeTab === 'checkin' && (
          <DailyCheckin loan={loan} payments={loanPayments} />
        )}

        {activeTab === 'info' && (
          <div className="card fade-in">
            <div className="info-grid">
              {[
                { label: 'ประเภทสินเชื่อ', value: loanTypeLabel(loan.loan_type) },
                { label: 'หลักประกัน', value: loan.collateral || '-' },
                { label: 'ผู้ค้ำประกัน', value: loan.guarantor_name || '-' },
                { label: 'บัตรประชาชน', value: loan.borrower_id_card || '-' },
                { label: 'จำนวนงวด', value: loan.installments ? `${loan.installments} งวด` : '-' },
                { label: 'วันที่บันทึก', value: formatDate(loan.created_at) },
              ].map(({ label, value }) => (
                <div key={label} className="info-item">
                  <div className="info-label">{label}</div>
                  <div className="info-value">{value}</div>
                </div>
              ))}
            </div>
            {loan.notes && (
              <>
                <div className="divider" />
                <div className="info-label">หมายเหตุ</div>
                <div style={{ color: 'var(--text-primary)', marginTop: 4, fontSize: '0.9rem' }}>{loan.notes}</div>
              </>
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="fade-in">
            {loanPayments.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💳</div>
                <h3>ยังไม่มีรายการชำระ</h3>
                <button onClick={() => setShowPayModal(true)} className="btn btn-primary" style={{ marginTop: 12 }}>+ บันทึกการชำระ</button>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>ยอดชำระ</th>
                      <th>ตัดดอก</th>
                      <th>ตัดต้น</th>
                      <th>วิธีชำระ</th>
                      <th>เลขที่ใบเสร็จ</th>
                      <th>หมายเหตุ</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loanPayments.map(p => (
                      <tr key={p.id}>
                        <td>{formatDate(p.payment_date)}</td>
                        <td className="td-amount td-gold">{formatBaht(p.amount)}</td>
                        <td style={{ color: 'var(--gold)' }}>{formatBaht(p.interest_paid || 0)}</td>
                        <td style={{ color: 'var(--success)' }}>{formatBaht(p.principal_paid || 0)}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{p.payment_method === 'cash' ? '💵 เงินสด' : p.payment_method === 'transfer' ? '🏦 โอน' : '📝 อื่นๆ'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{p.receipt_no || '-'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{p.notes || '-'}</td>
                        <td>
                          <button 
                            onClick={() => setEditingPayment(p)} 
                            className="btn btn-secondary btn-sm btn-icon" 
                            title="แก้ไข"
                            style={{ marginRight: 8 }}
                          >
                            ✏️
                          </button>
                          <button onClick={() => handleDeletePayment(p.id)} className="btn btn-danger btn-sm btn-icon" title="ลบ">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'calc' && (
          <div className="card fade-in">
            <div className="section-title">🧮 คำนวณดอกเบี้ยสะสม</div>
            {[
              { label: 'วันที่ผ่านมา', value: `${daysElapsed} วัน` },
              { label: 'ดอกเบี้ยต่อวัน', value: formatBaht((loan.principal * loan.interest_rate) / 100) },
              { label: 'ดอกเบี้ยสะสมทั้งหมด', value: formatBaht(accruedInterest) },
              { label: 'รับดอกไปแล้ว', value: formatBaht(paidInterest) },
              { label: 'ดอกค้างรับ', value: formatBaht(outstandingInterest) },
              { label: 'เงินต้นคงเหลือ', value: formatBaht(remaining) },
              { label: 'ยอดรวมที่ยังต้องได้รับ', value: formatBaht(remaining + outstandingInterest) },
            ].map(({ label, value }, i) => (
              <div key={i} className="receipt-row">
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontWeight: 700, color: i === 6 ? 'var(--gold)' : 'var(--text-primary)' }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* 📚 Loan History Linkage */}
        {(() => {
          const history = loans
            .filter(l => l.borrower_name === loan.borrower_name && l.id !== loan.id)
            .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())

          if (history.length === 0) return null

          return (
            <div className="card fade-in" style={{ marginTop: 24, background: 'var(--bg-secondary)', border: '1px dashed var(--border)' }}>
              <div className="section-title" style={{ fontSize: '0.9rem', opacity: 0.8 }}>📚 ประวัติสัญญาทั้งหมดของคุณ {loan.borrower_name}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {history.map(h => (
                  <div 
                    key={h.id} 
                    onClick={() => {
                      navigate(`/loans/${h.id}`)
                      window.scrollTo(0, 0)
                    }}
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'var(--bg-primary)',
                      borderRadius: 8,
                      cursor: 'pointer',
                      border: '1px solid var(--border)',
                      fontSize: '0.85rem'
                    }}
                    className="hover-scale"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className={`badge ${statusBadgeClass(h.status)}`} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>{statusLabel(h.status)}</span>
                      <strong>{formatBaht(h.principal)}</strong>
                      <span style={{ color: 'var(--text-muted)' }}>เริ่ม {formatDate(h.start_date)}</span>
                    </div>
                    <span style={{ color: 'var(--gold)' }}>ดูรายละเอียด →</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>

      {(showPayModal || editingPayment) && loan && (
        <PaymentModal
          loan={loan}
          accruedInterest={outstandingInterest}
          remainingPrincipal={remaining}
          isClosing={isClosing}
          payment={editingPayment}
          onClose={() => {
            setShowPayModal(false)
            setIsClosing(false)
            setEditingPayment(null)
          }}
          onSaved={() => {
            setShowPayModal(false)
            setIsClosing(false)
            setEditingPayment(null)
            fetchPayments(id)
            fetchLoans()
          }}
        />
      )}
      {showRestructureModal && loan && (
        <RestructureModal
          loan={loan}
          accruedInterest={outstandingInterest}
          remainingPrincipal={remaining}
          onClose={() => setShowRestructureModal(false)}
          onSaved={() => {
            setShowRestructureModal(false)
            fetchLoans()
            navigate('/agents')
          }}
        />
      )}
    </div>
  )
}
