import React, { useState, useEffect, useMemo } from 'react'
import { useStore } from '../store/useStore'
import type { Loan } from '../lib/supabase'
import { formatBaht } from '../lib/formatters'
import { calcDailyFlat, calcUpfront, calcBullet } from '../lib/calculations'

const LOAN_TYPES = [
  { value: 'daily', label: '📅 ดอกรายวัน', desc: 'คิดดอกเบี้ยรายวัน' },
  { value: 'weekly', label: '📆 ผ่อนรายอาทิตย์', desc: 'ผ่อนทุกอาทิตย์' },
  { value: 'monthly', label: '🗓️ ผ่อนรายเดือน', desc: 'ผ่อนทุกเดือน' },
  { value: 'upfront', label: '💸 ดอกหน้า', desc: 'หักดอกล่วงหน้า' },
  { value: 'bullet', label: '💰 เงินก้อน+ดอก', desc: 'จ่ายตอนจบ' },
]

interface Props {
  loan: Loan
  accruedInterest: number
  remainingPrincipal: number
  onClose: () => void
  onSaved: () => void
}

export default function RestructureModal({ loan, accruedInterest, remainingPrincipal, onClose, onSaved }: Props) {
  const { restructureLoan } = useStore()
  const [saving, setSaving] = useState(false)
  
  // Step 1: Closing Old Loan
  const [closingAmount, setClosingAmount] = useState('0')
  const [closingDate, setClosingDate] = useState(new Date().toISOString().slice(0, 10))
  
  // Step 2: Opening New Loan
  const [newType, setNewType] = useState(loan.loan_type)
  const [newPrincipal, setNewPrincipal] = useState(remainingPrincipal.toString())
  const [newRate, setNewRate] = useState(loan.interest_rate.toString())
  const [newPeriod, setNewPeriod] = useState(loan.interest_period)
  const [newInstallmentAmt, setNewInstallmentAmt] = useState(loan.installment_amount?.toString() || '')
  const [newInstallments, setNewInstallments] = useState(loan.installments?.toString() || '20')
  const [newDueDate, setNewDueDate] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    // Default due date calculation for daily
    if (newType === 'daily') {
      const d = new Date(startDate)
      const count = parseInt(newInstallments) || 20
      d.setDate(d.getDate() + count)
      setNewDueDate(d.toISOString().slice(0, 10))
    }
  }, [newType, startDate])

  const preview = useMemo(() => {
    const p = parseFloat(newPrincipal) || 0
    const r = parseFloat(newRate) || 0
    const inst = parseInt(newInstallments) || 1
    
    if (p <= 0 || r <= 0) return null

    const diffDays = newDueDate ? Math.ceil((new Date(newDueDate).getTime() - new Date(startDate).getTime()) / 86400000) : 30
    const daysToDate = diffDays + 1

    switch (newType) {
      case 'daily': {
        const res = calcDailyFlat(p, r, newPeriod as any, daysToDate)
        const dispInst = newInstallmentAmt ? parseFloat(newInstallmentAmt) : res.dailyInterest
        const totalRepay = newInstallmentAmt ? (dispInst * daysToDate) : res.totalRepay
        return {
          total: totalRepay,
          profit: totalRepay - p,
          installment: dispInst,
          periodLabel: `ระยะเวลา ${daysToDate} วัน`
        }
      }
      case 'upfront': {
        const res = calcUpfront(p, r, newPeriod as any, daysToDate)
        return {
          total: p,
          profit: res.upfrontInterest,
          installment: null,
          periodLabel: `หักดอกหน้า รับจริง ${formatBaht(res.received)}`
        }
      }
      case 'bullet': {
        const res = calcBullet(p, r, newPeriod as any, daysToDate)
        return {
          total: res.totalRepay,
          profit: res.totalInterest,
          installment: null,
          periodLabel: `จ่ายก้อนเดียวตอนครบกำหนด`
        }
      }
      default: return null
    }
  }, [newType, newPrincipal, newRate, newPeriod, newInstallments, newDueDate, startDate, newInstallmentAmt])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      await restructureLoan(loan.id, {
        closing_amount: parseFloat(closingAmount) || 0,
        closing_date: closingDate,
        new_principal: parseFloat(newPrincipal) || 0,
        new_loan_type: newType as any,
        new_interest_rate: parseFloat(newRate) || 0,
        new_installments: parseInt(newInstallments) || null,
        new_installment_amount: newInstallmentAmt ? parseFloat(newInstallmentAmt) : 
          (newType === 'daily' && preview) ? preview.installment : null,
        new_due_date: newDueDate,
        new_interest_period: newPeriod as any
      })
      onSaved()
    } catch (err) {
      console.error(err)
      alert('เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 1100, width: '98%', maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3>🔄 ปรับโครงสร้าง / เปิดยอดใหม่</h3>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column' }}>
          <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
            <div className="restructure-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px', height: '100%' }}>
              
              {/* Column 1: Close Old */}
              <div style={{ padding: 24, borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <div className="section-title-main" style={{ marginBottom: 20, color: 'var(--text-secondary)' }}>🏁 1. ปิดจบยอดเดิม</div>
                <div className="form-group">
                  <label className="form-label">วันที่ปิดยอด</label>
                  <input className="form-input" type="date" value={closingDate} onChange={e => setClosingDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">ยอดที่ได้รับจริงวันนี้ (บาท)</label>
                  <input className="form-input" type="number" step="0.01" value={closingAmount} onChange={e => setClosingAmount(e.target.value)} required />
                  <div className="form-hint" style={{ fontWeight: 600, marginTop: 12, padding: '12px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ยอดค้างรวมดอกปัจจุบัน</div>
                    <div style={{ fontSize: '1.1rem', color: 'var(--gold)' }}>{formatBaht(remainingPrincipal + accruedInterest)}</div>
                  </div>
                </div>
              </div>

              {/* Column 2: Open New */}
              <div style={{ padding: 24, borderRight: '1px solid var(--border)' }}>
                <div className="section-title-main" style={{ marginBottom: 20, color: 'var(--success)' }}>🌳 2. ตั้งยอดใหม่ทันที</div>
                
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label">ประเภทสินเชื่อใหม่</label>
                  <div className="loan-type-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                    {LOAN_TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        className={`loan-type-btn ${newType === t.value ? 'active' : ''}`}
                        style={{ padding: '8px', fontSize: '0.85rem' }}
                        onClick={() => {
                          setNewType(t.value)
                          if (['daily', 'weekly', 'monthly'].includes(t.value)) setNewPeriod(t.value)
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{t.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">เงินต้นก้อนใหม่ (บาท)</label>
                  <input className="form-input" type="number" step="0.01" value={newPrincipal} onChange={e => setNewPrincipal(e.target.value)} required />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">อัตราดอกเบี้ย (%)</label>
                    <input className="form-input" type="number" step="0.01" value={newRate} onChange={e => setNewRate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ต่อระยะเวลา</label>
                    <select className="form-select" value={newPeriod} onChange={e => setNewPeriod(e.target.value)}>
                      <option value="daily">ต่อวัน</option>
                      <option value="weekly">ต่ออาทิตย์</option>
                      <option value="monthly">ต่อเดือน</option>
                      <option value="yearly">ต่อปี</option>
                    </select>
                  </div>
                </div>

                {newType === 'daily' && (
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">ยอดส่ง (บาท/งวด)</label>
                      <input className="form-input" type="number" step="0.01" value={newInstallmentAmt} onChange={e => setNewInstallmentAmt(e.target.value)} placeholder="ทิ้งว่างเพื่อคำนวณตามดอก" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">จำนวนงวด (วัน)</label>
                      <input className="form-input" type="number" value={newInstallments} onChange={e => setNewInstallments(e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">วันเริ่มสัญญา</label>
                    <input className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">วันครบกำหนด</label>
                    <input className="form-input" type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Column 3: Summary Sidebar */}
              <div style={{ padding: 24, background: 'var(--bg-card)' }}>
                <div className="section-title-main" style={{ marginBottom: 20 }}>📊 สรุปยอดใหม่</div>
                {!preview ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>กรอกข้อมูลเพื่อดูตัวอย่าง</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="receipt-row">
                      <span className="label">เงินต้นใหม่</span>
                      <span className="value" style={{ fontWeight: 700 }}>{formatBaht(parseFloat(newPrincipal))}</span>
                    </div>
                    <div className="receipt-row">
                      <span className="label">ประเภท</span>
                      <span className="value">{LOAN_TYPES.find(t => t.value === newType)?.label}</span>
                    </div>
                    {preview.installment && (
                      <div className="receipt-row highlight-row">
                        <span className="label">ยอดส่งต่องวด</span>
                        <span className="value" style={{ fontWeight: 700 }}>{formatBaht(preview.installment)}</span>
                      </div>
                    )}
                    <div className="receipt-row">
                      <span className="label">คำอธิบาย</span>
                      <span className="value" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{preview.periodLabel}</span>
                    </div>
                    <div className="divider" />
                    <div className="receipt-row">
                      <span className="label">กำไรรวม</span>
                      <span className="value" style={{ color: 'var(--success)', fontWeight: 700 }}>{formatBaht(preview.profit)}</span>
                    </div>
                    <div className="receipt-row total-row" style={{ marginTop: 10, background: 'var(--gold-glow)', padding: '16px 12px', borderRadius: 12 }}>
                      <span className="label" style={{ fontWeight: 600 }}>ยอดรวมที่จะได้รับ</span>
                      <span className="value" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--gold)' }}>{formatBaht(preview.total)}</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          <div className="modal-footer" style={{ background: 'var(--bg-card)', padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary" style={{ minWidth: 200 }} disabled={saving}>
              {saving ? <><span className="spinner" /> กำลังบันทึก...</> : '🚀 ยืนยันปรับโครงสร้าง'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
