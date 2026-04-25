import React, { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { formatBaht } from '../lib/formatters'
import type { Loan } from '../lib/supabase'

interface Props {
  loan: Loan
  accruedInterest: number
  remainingPrincipal: number
  onClose: () => void
  onSaved: () => void
}

export default function RestructureModal({ loan, accruedInterest, remainingPrincipal, onClose, onSaved }: Props) {
  const { addPayment, updateLoan, addLoan } = useStore()
  
  // Closing Part
  const [closingAmount, setClosingAmount] = useState((remainingPrincipal + accruedInterest).toString())
  const [closingDate, setClosingDate] = useState(new Date().toISOString().slice(0, 10))
  
  // New Loan Part
  const [newPrincipal, setNewPrincipal] = useState(remainingPrincipal.toString())
  const [newType, setNewType] = useState(loan.loan_type)
  const [newRate, setNewRate] = useState(loan.interest_rate.toString())
  const [newInstallmentAmt, setNewInstallmentAmt] = useState(loan.installment_amount?.toString() || '1000')
  const [newInstallments, setNewInstallments] = useState(loan.installments?.toString() || '24')
  const [newDueDate, setNewDueDate] = useState('')
  
  const [saving, setSaving] = useState(false)

  // Initialize Due Date
  useEffect(() => {
    updateDueDate(newInstallments)
  }, [])

  // 🔄 Sync: Installments -> Due Date
  const updateDueDate = (countStr: string) => {
    const days = parseInt(countStr) || 0
    const start = new Date(closingDate)
    const end = new Date(start)
    end.setDate(start.getDate() + days)
    setNewDueDate(end.toISOString().slice(0, 10))
    calculateRate(newPrincipal, newInstallmentAmt, countStr)
  }

  // 🔄 Sync: Due Date -> Installments
  const updateInstallmentsFromDate = (dateStr: string) => {
    setNewDueDate(dateStr)
    const start = new Date(closingDate)
    const end = new Date(dateStr)
    const diffTime = end.getTime() - start.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const days = Math.max(0, diffDays)
    setNewInstallments(days.toString())
    calculateRate(newPrincipal, newInstallmentAmt, days.toString())
  }

  // 🧮 Logic: Calculate Rate (%)
  const calculateRate = (p: string, amt: string, count: string) => {
    const principal = parseFloat(p) || 0
    const instAmt = parseFloat(amt) || 0
    const instCount = parseInt(count) || 0
    
    if (principal > 0 && instAmt > 0 && instCount > 0) {
      const totalPayback = instAmt * instCount
      const profit = totalPayback - principal
      const totalRate = (profit / principal) * 100
      
      // Calculate daily rate because we save it with interest_period = 'daily'
      const dailyRate = totalRate / instCount
      setNewRate(dailyRate.toFixed(4)) // Use more precision for small daily rates
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const principal = parseFloat(newPrincipal) || 0
    const installments = parseInt(newInstallments) || 0
    const installmentAmt = parseFloat(newInstallmentAmt) || 0

    try {
      // 1. Close current loan
      const amt = parseFloat(closingAmount) || 0
      const pPaid = Math.min(remainingPrincipal, amt)
      const iPaid = Math.max(0, amt - pPaid)

      await addPayment({
        loan_id: loan.id,
        payment_date: closingDate,
        amount: amt,
        interest_paid: iPaid,
        principal_paid: pPaid,
        payment_method: 'transfer',
        receipt_no: '',
        notes: 'ปิดยอดเพื่อปรับโครงสร้าง/เปิดใหม่',
      })
      await updateLoan(loan.id, { status: 'closed' })

      // 2. Open new loan
      if (principal > 0) {
        await addLoan({
          borrower_name: loan.borrower_name,
          borrower_phone: loan.borrower_phone,
          borrower_id_card: loan.borrower_id_card,
          borrower_address: loan.borrower_address,
          agent_name: loan.agent_name,
          principal: principal,
          interest_rate: parseFloat(newRate) || 0,
          interest_period: 'daily',
          loan_type: newType as any,
          start_date: closingDate,
          due_date: newDueDate,
          status: 'active',
          collateral: loan.collateral,
          guarantor_name: loan.guarantor_name,
          include_first_day: true,
          installments: installments,
          installment_amount: installmentAmt,
          notes: `ปรับโครงสร้างจากสัญญาเดิม #${loan.id.slice(0, 8)}`
        })
      }

      onSaved()
    } catch (error) {
      console.error(error)
      alert('เกิดข้อผิดพลาดในการปรับโครงสร้าง')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg fade-in">
        <div className="modal-header">
          <h3>🔄 ปรับโครงสร้าง / เปิดยอดใหม่ — {loan.borrower_name}</h3>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="restructure-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
              
              {/* Left: Closing Old Loan */}
              <div className="card-section" style={{ background: 'var(--danger-bg)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                <div className="section-title-main" style={{ color: 'var(--danger)', marginBottom: 16 }}>🏁 1. ปิดจบยอดเดิม</div>
                <div className="form-group">
                  <label className="form-label">วันที่ปิดยอด</label>
                  <input className="form-input" type="date" value={closingDate} onChange={e => { setClosingDate(e.target.value); updateDueDate(newInstallments); }} required />
                </div>
                <div className="form-group">
                  <label className="form-label">ยอดที่ได้รับจริง (บาท)</label>
                  <input className="form-input" type="number" step="0.01" value={closingAmount} onChange={e => setClosingAmount(e.target.value)} required />
                  <div className="form-hint" style={{ fontWeight: 600 }}>ยอดค้างในระบบ: {formatBaht(remainingPrincipal + accruedInterest)}</div>
                </div>
                <div className="alert alert-info" style={{ marginTop: 12, padding: '8px 12px', fontSize: '0.8rem' }}>
                  📢 เงินก้อนเดิมจะถูกเปลี่ยนสถานะเป็น <strong>"ปิดบัญชี"</strong> ทันทีหลังบันทึก
                </div>
              </div>

              {/* Right: Opening New Loan */}
              <div className="card-section" style={{ background: 'var(--success-bg)', borderColor: 'rgba(34, 197, 94, 0.2)' }}>
                <div className="section-title-main" style={{ color: 'var(--success)', marginBottom: 16 }}>🌳 2. ตั้งยอดใหม่ทันที</div>
                
                <div className="form-group">
                  <label className="form-label">เงินต้นก้อนใหม่ (บาท)</label>
                  <input 
                    className="form-input" 
                    type="number" 
                    step="0.01" 
                    value={newPrincipal} 
                    onChange={e => {
                      setNewPrincipal(e.target.value)
                      calculateRate(e.target.value, newInstallmentAmt, newInstallments)
                    }} 
                    required 
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">ยอดส่ง (บาท/งวด)</label>
                    <input 
                      className="form-input" 
                      type="number" 
                      step="0.01" 
                      value={newInstallmentAmt} 
                      onChange={e => {
                        setNewInstallmentAmt(e.target.value)
                        calculateRate(newPrincipal, e.target.value, newInstallments)
                      }} 
                      placeholder="เช่น 1000"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">จำนวนงวด (วัน)</label>
                    <input 
                      className="form-input" 
                      type="number" 
                      value={newInstallments} 
                      onChange={e => {
                        setNewInstallments(e.target.value)
                        updateDueDate(e.target.value)
                      }} 
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">วันครบกำหนด (ปฏิทิน)</label>
                    <input 
                      className="form-input" 
                      type="date" 
                      value={newDueDate} 
                      onChange={e => updateInstallmentsFromDate(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ดอกเบี้ยคำนวณได้ (%)</label>
                    <div style={{ position: 'relative' }}>
                      <input className="form-input" type="number" value={newRate} readOnly style={{ background: 'rgba(255,255,255,0.5)', fontWeight: 700, color: 'var(--success)' }} />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--success)' }}>%</span>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">ประเภทการส่ง</label>
                  <select className="form-select" value={newType} onChange={e => setNewType(e.target.value as any)}>
                    <option value="daily">รายวัน (Flat)</option>
                    <option value="weekly">รายอาทิตย์</option>
                    <option value="monthly">รายเดือน</option>
                  </select>
                </div>
              </div>

            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> กำลังดำเนินการ...</> : '🚀 ยืนยันปิดยอดเดิมและเปิดยอดใหม่'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
