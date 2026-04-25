import React, { useState } from 'react'
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
  const [newPrincipal, setNewPrincipal] = useState(loan.principal.toString())
  const [newType, setNewType] = useState(loan.loan_type)
  const [newRate, setNewRate] = useState(loan.interest_rate.toString())
  const [newInstallmentAmt, setNewInstallmentAmt] = useState(loan.installment_amount?.toString() || '1000')
  const [newInstallments, setNewInstallments] = useState(loan.installments?.toString() || '24')
  
  const [saving, setSaving] = useState(false)

  // Auto-calculate Rate from Installments
  const calculateRateFromInstallments = (p: string, amt: string, count: string) => {
    const principal = parseFloat(p) || 0
    const installmentAmt = parseFloat(amt) || 0
    const installments = parseInt(count) || 0
    
    if (principal > 0 && installmentAmt > 0 && installments > 0) {
      const totalPayback = installmentAmt * installments
      const totalInterest = totalPayback - principal
      const rate = (totalInterest / principal) * 100
      setNewRate(rate.toFixed(2))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const principal = parseFloat(newPrincipal) || 0
    const installments = parseInt(newInstallments) || 0
    const installmentAmt = parseFloat(newInstallmentAmt) || 0

    // Calculate due date based on installments
    const startDate = new Date(closingDate)
    const dueDate = new Date(startDate)
    if (newType === 'daily') dueDate.setDate(startDate.getDate() + installments)
    if (newType === 'weekly') dueDate.setDate(startDate.getDate() + (installments * 7))
    if (newType === 'monthly') dueDate.setMonth(startDate.getMonth() + installments)

    try {
      // 1. Close the current loan
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

      // 2. Create the new loan
      if (principal > 0) {
        await addLoan({
          borrower_name: loan.borrower_name,
          borrower_phone: loan.borrower_phone,
          borrower_id_card: loan.borrower_id_card,
          borrower_address: loan.borrower_address,
          agent_name: loan.agent_name,
          principal: principal,
          interest_rate: parseFloat(newRate) || 0,
          interest_period: 'daily', // Always daily for this calculation style
          loan_type: newType as any,
          start_date: closingDate,
          due_date: dueDate.toISOString().slice(0, 10),
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              
              {/* Part 1: Close Old Loan */}
              <div className="card-section" style={{ background: 'var(--danger-bg)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                <div className="section-title-main" style={{ color: 'var(--danger)', marginBottom: 16 }}>🏁 1. ปิดจบยอดเดิม</div>
                <div className="form-group">
                  <label className="form-label">วันที่ปิดยอด</label>
                  <input className="form-input" type="date" value={closingDate} onChange={e => setClosingDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">ยอดที่ได้รับจริง (บาท)</label>
                  <input className="form-input" type="number" step="0.01" value={closingAmount} onChange={e => setClosingAmount(e.target.value)} required />
                  <div className="form-hint">ยอดค้างรวม: {formatBaht(remainingPrincipal + accruedInterest)}</div>
                </div>
              </div>

              {/* Part 2: Open New Loan */}
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
                      calculateRateFromInstallments(e.target.value, newInstallmentAmt, newInstallments)
                    }} 
                    required 
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">ยอดส่ง (บาท/วัน)</label>
                    <input 
                      className="form-input" 
                      type="number" 
                      step="0.01" 
                      value={newInstallmentAmt} 
                      onChange={e => {
                        setNewInstallmentAmt(e.target.value)
                        calculateRateFromInstallments(newPrincipal, e.target.value, newInstallments)
                      }} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">จำนวนวัน (งวด)</label>
                    <input 
                      className="form-input" 
                      type="number" 
                      value={newInstallments} 
                      onChange={e => {
                        setNewInstallments(e.target.value)
                        calculateRateFromInstallments(newPrincipal, newInstallmentAmt, e.target.value)
                      }} 
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">ดอกเบี้ยคำนวณได้ (%)</label>
                    <input className="form-input" type="number" value={newRate} readOnly style={{ background: 'var(--bg-secondary)', opacity: 0.8 }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ประเภท</label>
                    <select className="form-select" value={newType} onChange={e => setNewType(e.target.value as any)}>
                      <option value="daily">รายวัน (Flat)</option>
                      <option value="weekly">รายอาทิตย์</option>
                      <option value="monthly">รายเดือน</option>
                    </select>
                  </div>
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
