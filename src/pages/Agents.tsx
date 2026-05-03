import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { formatBaht } from '../lib/formatters'
import { Link } from 'react-router-dom'
import { format, isToday, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { calcDailyFlat, calcAccruedInterest } from '../lib/calculations'

export default function Agents() {
  const { loans, payments, addPayment, agents: storeAgents, updateAgent, deleteAgent } = useStore()
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [checking, setChecking] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showManageModal, setShowManageModal] = useState(false)
  const [editingAgent, setEditingAgent] = useState<{ id: string, name: string } | null>(null)

  const activeLoans = useMemo(() => loans.filter(l => l.status === 'active' || l.status === 'overdue'), [loans])
  
  // Use centralized agents from store
  const agentsList = useMemo(() => {
    return storeAgents.map(a => a.name).sort()
  }, [storeAgents])

  // Set default agent if none selected
  useMemo(() => {
    if (!selectedAgent && agentsList.length > 0) {
      setSelectedAgent(agentsList[0])
    }
  }, [agentsList, selectedAgent])

  const agentLoans = useMemo(() => {
    return activeLoans.filter(l => (l.agent_name || 'ไม่มีสายส่ง') === selectedAgent)
  }, [activeLoans, selectedAgent])

  const dailyStats = useMemo(() => {
    let totalExpected = 0
    let totalReceived = 0
    const todayStr = format(new Date(), 'yyyy-MM-dd')

    agentLoans.forEach(loan => {
      const isBullet = loan.loan_type === 'bullet' || loan.loan_type === 'upfront'
      let expectedAmt = 0

      if (isBullet) {
        if (todayStr >= loan.due_date) {
          const contractDays = Math.max(1, differenceInDays(parseISO(loan.due_date), parseISO(loan.start_date)) + (loan.include_first_day ? 1 : 0))
          const info = calcDailyFlat(loan.principal, loan.interest_rate, loan.interest_period, 1)
          expectedAmt = (loan.total_target && loan.total_target > 0) 
            ? loan.total_target 
            : loan.principal + (info.dailyInterest * contractDays)
          
          const priorPayments = payments.filter(p => p.loan_id === loan.id && p.payment_date < todayStr)
          const priorTotal = priorPayments.reduce((s, p) => s + p.amount, 0)
          expectedAmt = Math.max(0, expectedAmt - priorTotal)
        }
      } else {
        expectedAmt = loan.installment_amount || 0
        if (expectedAmt <= 0) {
          const info = calcDailyFlat(loan.principal, loan.interest_rate, loan.interest_period, 1)
          expectedAmt = info.dailyInterest
        }
      }

      if (expectedAmt > 0) {
        totalExpected += expectedAmt
      }

      const todayPayment = payments.find(p => p.loan_id === loan.id && p.payment_date === todayStr)
      if (todayPayment) {
        totalReceived += todayPayment.amount
      }
    })

    return { totalExpected, totalReceived }
  }, [agentLoans, payments])

  const handleQuickPay = async (loan: any) => {
    let amountToPay = 0
    const isBullet = loan.loan_type === 'bullet' || loan.loan_type === 'upfront'

    if (isBullet) {
      const contractDays = Math.max(1, differenceInDays(parseISO(loan.due_date), parseISO(loan.start_date)) + (loan.include_first_day ? 1 : 0))
      const info = calcDailyFlat(loan.principal, loan.interest_rate, loan.interest_period, 1)
      const target = (loan.total_target && loan.total_target > 0) 
        ? loan.total_target 
        : loan.principal + (info.dailyInterest * contractDays)
      
      const priorTotal = payments.filter(p => p.loan_id === loan.id).reduce((s, p) => s + p.amount, 0)
      amountToPay = Math.max(0, target - priorTotal)
    } else {
      amountToPay = loan.installment_amount || 0
      if (amountToPay <= 0) {
        const info = calcDailyFlat(loan.principal, loan.interest_rate, loan.interest_period, 1)
        amountToPay = info.dailyInterest
      }
    }

    if (amountToPay <= 0) return

    setChecking(loan.id)
    
    // INTEREST-FIRST logic (Standardized)
    const loanPayments = payments.filter(p => p.loan_id === loan.id)
    const paidInterest = loanPayments.reduce((s, p) => s + (p.interest_paid || 0), 0)
    
    // Total interest accrued up to today
    const accruedAtDate = calcAccruedInterest(
      loan.loan_type, 
      loan.principal, 
      loan.interest_rate, 
      loan.interest_period, 
      loan.start_date, 
      format(new Date(), 'yyyy-MM-dd'), 
      loan.include_first_day,
      loanPayments
    )
    
    const outstandingInterest = Math.max(0, accruedAtDate - paidInterest)

    let principalPaid = 0
    let interestPaid = 0

    if (outstandingInterest > 0) {
      interestPaid = Math.min(amountToPay, outstandingInterest)
      principalPaid = Math.max(0, amountToPay - interestPaid)
    } else {
      interestPaid = 0
      principalPaid = amountToPay
    }

    await addPayment({
      loan_id: loan.id,
      payment_date: format(new Date(), 'yyyy-MM-dd'),
      amount: amountToPay,
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
      const isBullet = loan.loan_type === 'bullet' || loan.loan_type === 'upfront'
      
      const loanDate = new Date(loan.start_date)
      const dateStr = format(loanDate, 'd MMMM', { locale: th })
      const yearThStr = (loanDate.getFullYear() + 543).toString()

      text += `${idx + 1}. ${loan.borrower_name}\n`
      text += `🌳ต้น ${loan.principal.toLocaleString()}🌳  ${dateStr}\n`
      text += `                            พ.ศ. ${yearThStr}\n\n`
      if (isBullet) {
        text += `  🌼ก้อนเดียว🌼 ${hasPaid ? '✅' : '📍'}\n`
      } else {
        let dailyAmt = loan.installment_amount || 0
        if (dailyAmt <= 0) {
          const info = calcDailyFlat(loan.principal, loan.interest_rate, loan.interest_period, 1)
          dailyAmt = info.dailyInterest
        }
        text += `  🌼${dailyAmt.toLocaleString()}/วัน🌼 ${hasPaid ? '✅' : '📍'}\n`
      }
      text += `.........................................\n\n`
    })

    text += `💰 ยอดโอนรวมวันนี้: ${formatBaht(dailyStats.totalReceived)}\n`
    text += `🕑 ยืนยันรับยอดแล้ว ณ เวลา ${format(new Date(), 'HH.mm')} น.`

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleUpdateAgentName = async () => {
    if (!editingAgent || !editingAgent.name.trim()) return
    const oldName = storeAgents.find(a => a.id === editingAgent.id)?.name
    const newName = editingAgent.name.trim()

    if (oldName === newName) {
      setEditingAgent(null)
      return
    }

    // 1. Update in agents table
    await updateAgent(editingAgent.id, newName)

    // 2. Update in all loans (to keep history/sync correctly)
    if (oldName) {
      await supabase.from('loans').update({ agent_name: newName }).eq('agent_name', oldName)
    }

    // Update selection if needed
    if (selectedAgent === oldName) setSelectedAgent(newName)
    
    setEditingAgent(null)
  }

  const handleDeleteAgent = async (id: string, name: string) => {
    if (!confirm(`ยืนยันการลบสายส่ง "${name}"? สัญญาที่เกี่ยวข้องจะไม่ถูกลบ แต่จะไม่มีชื่อคนดูแลระบุไว้`)) return
    
    // 1. Delete from agents table
    await deleteAgent(id)

    // 2. Clear from loans (Optional: set to empty string)
    await supabase.from('loans').update({ agent_name: '' }).eq('agent_name', name)

    if (selectedAgent === name) setSelectedAgent(null)
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>🤝 กระดานคุมสายส่ง</h2>
          <p>จัดการยอดโอนรายวันจากตัวแทนและสายส่ง</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowManageModal(true)}>
          ⚙️ จัดการรายชื่อสายส่ง
        </button>
      </div>

      <div className="page-content">
        {/* Agent Selector */}
        <div className="card-section" style={{ marginBottom: 20 }}>
          <div className="loan-type-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {agentsList.map(agent => (
              <button
                key={agent}
                className={`loan-type-btn ${selectedAgent === agent ? 'active' : ''}`}
                onClick={() => setSelectedAgent(agent)}
              >
                <span className="label">{agent}</span>
                <span className="desc">ลูกหนี้ {loans.filter(l => (l.agent_name || 'ไม่มีสายส่ง') === agent && (l.status === 'active' || l.status === 'overdue')).length} ราย</span>
              </button>
            ))}
          </div>
        </div>

        {selectedAgent ? (
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
                {copied ? '✅ คัดลอกแล้ว' : `📋 ก๊อปปี้รายงานส่ง${selectedAgent}`}
              </button>
            </div>

            {/* Loans Table */}
            <div className="card-section">
              <div className="section-header">
                <div className="section-title-main">📋 รายชื่อลูกหนี้ของ {selectedAgent}</div>
              </div>
              <div className="table-wrap">
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
                      const isOverdue = loan.status === 'overdue' || (todayStr > loan.due_date && loan.status === 'active')
                      
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
                          <td className="td-gold">
                            {(() => {
                              if (loan.loan_type === 'bullet' || loan.loan_type === 'upfront') return <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ก้อนเดียว</span>
                              if (loan.installment_amount && loan.installment_amount > 0) return formatBaht(loan.installment_amount)
                              const info = calcDailyFlat(loan.principal, loan.interest_rate, loan.interest_period, 1)
                              return formatBaht(info.dailyInterest)
                            })()}
                          </td>
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
        ) : (
          <div className="card-section" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16, opacity: 0.3 }}>🤝</div>
            <h3>ไม่พบข้อมูลสายส่ง</h3>
            <p>กรุณาเพิ่มสายส่งใหม่ในขั้นตอนการเพิ่มสินเชื่อ</p>
          </div>
        )}
      </div>

      {/* Management Modal */}
      {showManageModal && (
        <div className="modal-overlay" onClick={() => setShowManageModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>⚙️ จัดการรายชื่อสายส่ง</h3>
              <button className="modal-close" onClick={() => setShowManageModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="agent-list-manage">
                {storeAgents.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>ยังไม่มีข้อมูลสายส่ง</p>}
                {storeAgents.map(agent => (
                  <div key={agent.id} className="agent-manage-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    {editingAgent?.id === agent.id ? (
                      <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                        <input 
                          className="form-input" 
                          value={editingAgent.name} 
                          onChange={e => setEditingAgent({ ...editingAgent, name: e.target.value })}
                          autoFocus
                        />
                        <button className="btn btn-primary btn-sm" onClick={handleUpdateAgentName}>บันทึก</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingAgent(null)}>ยกเลิก</button>
                      </div>
                    ) : (
                      <>
                        <span style={{ fontWeight: 600 }}>{agent.name}</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingAgent({ id: agent.id, name: agent.name })}>✏️ แก้ไข</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteAgent(agent.id, agent.name)}>🗑️ ลบ</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowManageModal(false)}>ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
