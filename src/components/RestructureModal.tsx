import React, { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import type { Loan } from '../lib/supabase'
import { formatBaht } from '../lib/formatters'
import { Link, useNavigate } from 'react-router-dom'

interface Props {
  loan: Loan
  accruedInterest: number
  remainingPrincipal: number
  onClose: () => void
  onSaved: () => void
}

export default function RestructureModal({ loan, accruedInterest, remainingPrincipal, onClose, onSaved }: Props) {
  const { restructureLoan } = useStore()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [closingAmount, setClosingAmount] = useState('0')
  const [closingDate, setClosingDate] = useState(new Date().toISOString().slice(0, 10))
  
  // New Loan Part
  const [newPrincipal, setNewPrincipal] = useState(remainingPrincipal.toString())
  const [newType, setNewType] = useState(loan.loan_type)
  const [newRate, setNewRate] = useState(loan.interest_rate.toString())
  const [newInstallmentAmt, setNewInstallmentAmt] = useState(loan.installment_amount?.toString() || '1000')
  const [newInstallments, setNewInstallments] = useState(loan.installments?.toString() || '20')
  const [newDueDate, setNewDueDate] = useState('')

  useEffect(() => {
    updateDueDate(newInstallments)
  }, [])

  const updateDueDate = (inst: string) => {
    const count = parseInt(inst) || 0
    if (count > 0) {
      const d = new Date()
      d.setDate(d.getDate() + count)
      setNewDueDate(d.toISOString().slice(0, 10))
    }
  }

  const updateInstallmentsFromDate = (dateStr: string) => {
    const start = new Date()
    const end = new Date(dateStr)
    const diff = end.getTime() - start.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
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
      await restructureLoan(
        loan.id,
        {
          closing_amount: parseFloat(closingAmount) || 0,
          closing_date: closingDate,
          new_principal: principal,
          new_loan_type: newType,
          new_interest_rate: parseFloat(newRate) || 0,
          new_installments: installments,
          new_installment_amount: installmentAmt,
          new_due_date: newDueDate
        }
      )
      onSaved()
    } catch (err) {
      console.error(err)
      alert('เกิดข้อผิดพลาดในการปรับโครงสร้าง')
    } finally {
      setSaving(false)
    }
  }

  const installmentAmt = parseFloat(newInstallmentAmt) || 0
  const installments = parseInt(newInstallments) || 0
  const principal = parseFloat(newPrincipal) || 0
  const totalRepayment = installmentAmt * installments
  const totalInterest = totalRepayment - principal

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 1000, width: '95%' }}>
        <div className="modal-header">
          <h3>🔄 ปรับโครงสร้าง / เปิดยอดใหม่</h3>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', gap: 24, padding: 0 }}>
            <div className="modal-scroll-area" style={{ flex: 1, padding: 24, display: 'flex', gap: 24 }}>
              
              {/* Left: Closing Old Loan */}
              <div className="card-section" style={{ flex: 1, background: 'var(--bg-secondary)' }}>
                <div className="section-title-main" style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>🏁 1. ปิดจบยอดเดิม</div>
                <div className="form-group">
                  <label className="form-label">วันที่ปิดยอด</label>
                  <input className="form-input" type="date" value={closingDate} onChange={e => setClosingDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">ยอดที่ได้รับจริง (บาท)</label>
                  <input className="form-input" type="number" step="0.01" value={closingAmount} onChange={e => setClosingAmount(e.target.value)} required />
                  <div className="form-hint" style={{ fontWeight: 600 }}>ยอดค้างในระบบ: {formatBaht(remainingPrincipal + accruedInterest)}</div>
                </div>
                <div className="alert alert-info" style={{ marginTop: 12, padding: '8px 12px', fontSize: '0.8rem' }}>
                  📢 สัญญาเดิมจะถูกเปลี่ยนสถานะเป็น <strong>"จบยอดแล้ว"</strong> ทันที
                </div>
              </div>

              {/* Center: Opening New Loan */}
              <div className="card-section" style={{ flex: 1.5, background: 'var(--success-bg)', borderColor: 'rgba(34, 197, 94, 0.2)' }}>
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
                        calculateRate(newPrincipal, newInstallmentAmt, e.target.value)
                      }} 
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">วันครบกำหนด</label>
                    <input className="form-input" type="date" value={newDueDate} onChange={e => {
                      setNewDueDate(e.target.value)
                      updateInstallmentsFromDate(e.target.value)
                    }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ดอกเบี้ยเฉลี่ย/วัน (%)</label>
                    <input className="form-input" value={`${newRate}%`} readOnly style={{ background: 'rgba(255,255,255,0.5)' }} />
                  </div>
                </div>
              </div>

              {/* Right: Summary Sidebar */}
              <div className="summary-sidebar" style={{ width: 280, borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
                <div className="section-title-main" style={{ marginBottom: 16 }}>📊 สรุปยอดใหม่</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="receipt-row">
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>เงินต้นใหม่</span>
                    <span style={{ fontWeight: 700 }}>{formatBaht(principal)}</span>
                  </div>
                  <div className="receipt-row">
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ยอดส่งต่อวัน</span>
                    <span style={{ fontWeight: 700 }}>{formatBaht(installmentAmt)}</span>
                  </div>
                  <div className="receipt-row">
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>จำนวน {installments} วัน</span>
                  </div>
                  <div className="divider" style={{ margin: '8px 0' }} />
                  <div className="receipt-row">
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>กำไรรวมทั้งหมด</span>
                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>{formatBaht(totalInterest)}</span>
                  </div>
                  <div className="receipt-row total-row" style={{ marginTop: 8, background: 'var(--gold-glow)', padding: '12px 8px', borderRadius: 8 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>ยอดรวมที่ต้องได้รับ</span>
                    <span style={{ fontWeight: 800, color: 'var(--gold)', fontSize: '1.1rem' }}>{formatBaht(totalRepayment)}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '⏳ กำลังบันทึก...' : '🚀 ยืนยันการปรับโครงสร้าง'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
