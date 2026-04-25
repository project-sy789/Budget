import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatBaht } from '../lib/formatters'
import { Link } from 'react-router-dom'
import { format, isToday, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'

export default function Agents() {
  const { loans, payments, addPayment } = useStore()
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [checking, setChecking] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const activeLoans = useMemo(() => loans.filter(l => l.status === 'active' || l.status === 'overdue'), [loans])
  const agents = useMemo(() => {
    const names = [...new Set(activeLoans.map(l => l.agent_name || 'ไม่มีสายส่ง'))]
    return names.sort()
  }, [activeLoans])

  // Set default agent if none selected
  useMemo(() => {
    if (!selectedAgent && agents.length > 0) {
      setSelectedAgent(agents[0])
    }
  }, [agents, selectedAgent])

  const agentLoans = useMemo(() => {
    return activeLoans.filter(l => (l.agent_name || 'ไม่มีสายส่ง') === selectedAgent)
  }, [activeLoans, selectedAgent])

  const dailyStats = useMemo(() => {
    let totalExpected = 0
    let totalReceived = 0
    const todayStr = format(new Date(), 'yyyy-MM-dd')

    agentLoans.forEach(loan => {
      const dailyAmt = loan.installment_amount || 0
      totalExpected += dailyAmt

      const todayPayment = payments.find(p => p.loan_id === loan.id && p.payment_date === todayStr)
      if (todayPayment) {
        totalReceived += todayPayment.amount
      }
    })

    return { totalExpected, totalReceived }
  }, [agentLoans, payments])

  const handleQuickPay = async (loan: any) => {
    const dailyAmt = loan.installment_amount || 0
    if (dailyAmt <= 0) return

    setChecking(loan.id)
    
    // Principal-First logic
    const loanPayments = payments.filter(p => p.loan_id === loan.id)
    const totalPaidPrincipal = Math.round(loanPayments.reduce((s, p) => s + (p.principal_paid || 0), 0))
    const remainingPrincipal = Math.max(0, loan.principal - totalPaidPrincipal)

    let principalPaid = 0
    let interestPaid = 0

    if (remainingPrincipal > 0) {
      principalPaid = Math.round(Math.min(dailyAmt, remainingPrincipal))
      interestPaid = Math.round(Math.max(0, dailyAmt - principalPaid))
    } else {
      interestPaid = Math.round(dailyAmt)
    }

    await addPayment({
      loan_id: loan.id,
      payment_date: format(new Date(), 'yyyy-MM-dd'),
      amount: dailyAmt,
      interest_paid: Number(interestPaid.toFixed(2)),
      principal_paid: Number(principalPaid.toFixed(2)),
      payment_method: 'transfer',
      receipt_no: '',
      notes: `โอนผ่านสายส่ง: ${selectedAgent}`
    })

    setChecking(null)
  }

  const generateLineReport = () => {
    const todayStr = format(new Date(), 'd MMMM', { locale: th })
    const yearTh = (new Date().getFullYear() + 543).toString()
    
    let text = `📅 สรุปยอดโอนประจำวัน (${selectedAgent})\n`
    text += `${todayStr} พ.ศ. ${yearTh}\n`
    text += `.........................................\n\n`

    agentLoans.forEach((loan, idx) => {
      const todayStrYmd = format(new Date(), 'yyyy-MM-dd')
      const hasPaid = payments.some(p => p.loan_id === loan.id && p.payment_date === todayStrYmd)
      const dailyAmt = loan.installment_amount || 0
      
      const loanDate = new Date(loan.start_date)
      const dateStr = format(loanDate, 'd เมษายน', { locale: th })
      const yearTh = (loanDate.getFullYear() + 543).toString()

      text += `${idx + 1}. ${loan.borrower_name}\n`
      text += `🌳ต้น ${loan.principal.toLocaleString()}🌳  ${dateStr}\n`
      text += `                            พ.ศ. ${yearTh}\n\n`
      text += `  🌼${dailyAmt.toLocaleString()}/วัน🌼 ${hasPaid ? '✅' : '📍'}\n`
      text += `.........................................\n\n`
    })

    text += `💰 ยอดโอนรวมวันนี้: ${formatBaht(dailyStats.totalReceived)}\n`
    text += `🕑 ยืนยันรับยอดแล้ว ณ เวลา ${format(new Date(), 'HH.mm')} น.`

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>🤝 กระดานคุมสายส่ง</h2>
        <p>จัดการยอดโอนรายวันจากตัวแทนและสายส่ง</p>
      </div>

      <div className="page-content">
        {/* Agent Selector */}
        <div className="card-section" style={{ marginBottom: 20 }}>
          <div className="loan-type-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {agents.map(agent => (
              <button
                key={agent}
                className={`loan-type-btn ${selectedAgent === agent ? 'active' : ''}`}
                onClick={() => setSelectedAgent(agent)}
              >
                <span className="label">{agent}</span>
                <span className="desc">ลูกหนี้ {loans.filter(l => (l.agent_name || 'ไม่มีสายส่ง') === agent && l.status === 'active').length} ราย</span>
              </button>
            ))}
          </div>
        </div>

        {selectedAgent && (
          <>
            {/* Stats Overview */}
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: 24 }}>
              <div className="kpi-card info">
                <div className="kpi-label">ยอดที่ต้องได้รับวันนี้ ({selectedAgent})</div>
                <div className="kpi-value" style={{ color: 'var(--info)' }}>{formatBaht(dailyStats.totalExpected)}</div>
              </div>
              <div className="kpi-card success">
                <div className="kpi-label">ยอดที่โอนมาแล้ว</div>
                <div className="kpi-value success">{formatBaht(dailyStats.totalReceived)}</div>
                <div className="kpi-sub">ค้างอีก {formatBaht(dailyStats.totalExpected - dailyStats.totalReceived)}</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ marginBottom: 20, display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={generateLineReport}>
                {copied ? '✅ คัดลอกแล้ว' : '📋 ก๊อปปี้รายงานส่งจูน'}
              </button>
            </div>

            {/* Loans Table */}
            <div className="card-section">
              <div className="section-header">
                <div className="section-title-main">📋 รายชื่อลูกหนี้ของ {selectedAgent}</div>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ลำดับ</th>
                      <th>ลูกหนี้</th>
                      <th>เงินต้น</th>
                      <th>ยอดส่ง/วัน</th>
                      <th>สถานะวันนี้</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentLoans.map((loan, idx) => {
                      const todayStr = format(new Date(), 'yyyy-MM-dd')
                      const todayPayment = payments.find(p => p.loan_id === loan.id && p.payment_date === todayStr)
                      const hasPaid = !!todayPayment
                      const isOverdue = loan.status === 'overdue' || (new Date() > new Date(loan.due_date) && loan.status === 'active')
                      
                      return (
                        <tr key={loan.id} className={`${hasPaid ? 'row-success' : ''} ${isOverdue && !hasPaid ? 'row-overdue' : ''}`}>
                          <td style={{ width: 60 }}>{idx + 1}</td>
                          <td>
                            <Link to={`/loans/${loan.id}`} style={{ textDecoration: 'none' }}>
                              <div style={{ fontWeight: 600, color: isOverdue && !hasPaid ? 'var(--danger)' : 'var(--gold)', cursor: 'pointer' }}>{loan.borrower_name}</div>
                            </Link>
                            <div className="td-sub">{loan.borrower_phone}</div>
                          </td>
                          <td>{formatBaht(loan.principal)}</td>
                          <td className="td-gold">{formatBaht(loan.installment_amount || 0)}</td>
                          <td>
                            {hasPaid ? (
                              <span className="badge badge-success">✅ รับยอดแล้ว</span>
                            ) : isOverdue ? (
                              <span className="badge badge-danger">⚠️ ค้างชำระ</span>
                            ) : (
                              <span className="badge badge-warning">📍 รอโอน</span>
                            )}
                          </td>
                          <td style={{ width: 160 }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {!hasPaid ? (
                                <button 
                                  className="btn btn-primary btn-sm"
                                  style={{ flex: 1 }}
                                  onClick={() => handleQuickPay(loan)}
                                  disabled={checking === loan.id}
                                >
                                  {checking === loan.id ? <span className="spinner" /> : '✅ ตรวจ'}
                                </button>
                              ) : (
                                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} disabled>สำเร็จ</button>
                              )}
                              <Link to={`/loans/${loan.id}?close=true`} className="btn btn-success btn-sm" title="ปิดบัญชี">
                                🏁
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
