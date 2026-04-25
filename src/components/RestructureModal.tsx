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
  const [newPeriod, setNewPeriod] = useState(loan.interest_period)
  
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

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
      const principal = parseFloat(newPrincipal) || 0
      if (principal > 0) {
        await addLoan({
          borrower_name: loan.borrower_name,
          borrower_phone: loan.borrower_phone,
          borrower_id_card: loan.borrower_id_card,
          borrower_address: loan.borrower_address,
          agent_name: loan.agent_name,
          principal: principal,
          interest_rate: parseFloat(newRate) || 0,
          interest_period: newPeriod as any,
          loan_type: newType as any,
          start_date: closingDate,
          due_date: new Date(new Date(closingDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // Default 30 days
          status: 'active',
          collateral: loan.collateral,
          guarantor_name: loan.guarantor_name,
          guarantor_phone: loan.guarantor_phone,
          include_first_day: true
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
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  * เมื่อกดบันทึก สินเชื่อก้อนเดิมจะเปลี่ยนสถานะเป็น "ปิดบัญชี" ทันที
                </div>
              </div>

              {/* Part 2: Open New Loan */}
              <div className="card-section" style={{ background: 'var(--success-bg)', borderColor: 'rgba(34, 197, 94, 0.2)' }}>
                <div className="section-title-main" style={{ color: 'var(--success)', marginBottom: 16 }}>🌳 2. ตั้งยอดใหม่ทันที</div>
                <div className="form-group">
                  <label className="form-label">เงินต้นก้อนใหม่ (บาท)</label>
                  <input className="form-input" type="number" step="0.01" value={newPrincipal} onChange={e => setNewPrincipal(e.target.value)} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">ประเภท</label>
                    <select className="form-select" value={newType} onChange={e => setNewType(e.target.value as any)}>
                      <option value="daily">รายวัน (Flat)</option>
                      <option value="weekly">รายอาทิตย์</option>
                      <option value="monthly">รายเดือน</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">ดอกเบี้ย (%)</label>
                    <input className="form-input" type="number" value={newRate} onChange={e => setNewRate(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">รอบดอกเบี้ย</label>
                  <select className="form-select" value={newPeriod} onChange={e => setNewPeriod(e.target.value as any)}>
                    <option value="daily">ต่อวัน</option>
                    <option value="weekly">ต่ออาทิตย์</option>
                    <option value="monthly">ต่อเดือน</option>
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
