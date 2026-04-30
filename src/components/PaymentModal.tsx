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
  isClosing?: boolean
}

export default function PaymentModal({ loan, accruedInterest, remainingPrincipal, onClose, onSaved, isClosing }: Props) {
  const { addPayment, updateLoan } = useStore()
  const initialAmt = isClosing ? (remainingPrincipal + accruedInterest) : ''
  const [amount, setAmount] = useState(initialAmt.toString())
  const [interestPaid, setInterestPaid] = useState(isClosing ? accruedInterest.toFixed(2) : '0.00')
  const [principalPaid, setPrincipalPaid] = useState(isClosing ? remainingPrincipal.toFixed(2) : '0.00')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState('cash')
  const [receiptNo, setReceiptNo] = useState('')
  const [notes, setNotes] = useState(isClosing ? 'ปิดยอดก่อนกำหนด' : '')
  const [saving, setSaving] = useState(false)

  const amt = parseFloat(amount) || 0
  const interest = parseFloat(interestPaid) || 0

  const handleAmountChange = (v: string) => {
    setAmount(v)
    const a = parseFloat(v) || 0
    
    // INTEREST-FIRST LOGIC: Cut interest until it's 0
    const i = Math.min(accruedInterest, a)
    const p = Math.max(0, a - i)
    
    setPrincipalPaid(p.toFixed(2))
    setInterestPaid(i.toFixed(2))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (amt <= 0) return
    setSaving(true)
    await addPayment({
      loan_id: loan.id,
      payment_date: date,
      amount: amt,
      interest_paid: interest,
      principal_paid: parseFloat(principalPaid) || Math.max(amt - interest, 0),
      payment_method: method as any,
      receipt_no: receiptNo,
      notes,
    })

    if (isClosing) {
      await updateLoan(loan.id, { status: 'closed' })
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-in">
        <div className="modal-header">
          <h3>{isClosing ? '🏁 ปิดบัญชีสินเชื่อ' : '💳 บันทึกการชำระ'} — {loan.borrower_name}</h3>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {isClosing ? (
              <div className="alert alert-success">
                ✨ <strong>โหมดปิดยอดก่อนกำหนด:</strong> ระบบคำนวณยอดรวมที่ต้องจ่ายทั้งหมดให้แล้ว
              </div>
            ) : (
              accruedInterest > 0 && (
                <div className="alert alert-warning">
                  ⚠️ ดอกเบี้ยค้างรับ: <strong>{formatBaht(accruedInterest)}</strong>
                </div>
              )
            )}
            <div className="form-row stack-on-ipad">
              <div className="form-group">
                <label className="form-label">วันที่ชำระ</label>
                <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">วิธีชำระ</label>
                <select className="form-select" value={method} onChange={e => setMethod(e.target.value)}>
                  <option value="cash">💵 เงินสด</option>
                  <option value="transfer">🏦 โอนเงิน</option>
                  <option value="other">📝 อื่นๆ</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{isClosing ? 'ยอดปิดบัญชีสุทธิ (บาท)' : 'ยอดรับเงิน (บาท)'} <span className="required">*</span></label>
              <input
                id="payment-amount"
                className="form-input"
                type="number"
                step="0.01"
                value={amount}
                onChange={e => handleAmountChange(e.target.value)}
                placeholder="ใส่จำนวนเงินที่รับ"
                autoFocus
                required
              />
              {!isClosing && (
                <div className="form-hint" style={{ color: 'var(--success)', fontWeight: 500, marginTop: 4 }}>
                  ✨ ระบบจะนำไปหัก "ดอกเบี้ย" ให้ก่อนจนกว่าจะหมด
                </div>
              )}
            </div>
            <div className="form-row stack-on-ipad">
              <div className="form-group">
                <label className="form-label">ตัดดอกเบี้ย (บาท)</label>
                <input className="form-input" type="number" step="0.01" value={interestPaid} onChange={e => setInterestPaid(e.target.value)} />
                <div className="form-hint">ดอกที่ค้าง {formatBaht(accruedInterest)}</div>
              </div>
              <div className="form-group">
                <label className="form-label">ตัดเงินต้น (บาท)</label>
                <input className="form-input" type="number" step="0.01" value={principalPaid} onChange={e => setPrincipalPaid(e.target.value)} />
                <div className="form-hint">ต้นคงเหลือ {formatBaht(loan.principal)}</div>
              </div>
            </div>
            <div className="form-row stack-on-ipad">
              <div className="form-group">
                <label className="form-label">เลขที่ใบเสร็จ</label>
                <input className="form-input" value={receiptNo} onChange={e => setReceiptNo(e.target.value)} placeholder="REC-001" />
              </div>
              <div className="form-group">
                <label className="form-label">หมายเหตุ</label>
                <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
            {/* Summary */}
            {amt > 0 && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 14, marginTop: 4 }}>
                <div className="receipt-row">
                  <span>รับเงินทั้งหมด</span>
                  <strong className="td-gold">{formatBaht(amt)}</strong>
                </div>
                <div className="receipt-row">
                  <span style={{ color: 'var(--text-secondary)' }}>หักดอกเบี้ย</span>
                  <span style={{ color: 'var(--gold)' }}>- {formatBaht(interest)}</span>
                </div>
                <div className="receipt-row">
                  <span style={{ color: 'var(--text-secondary)' }}>ตัดเงินต้น</span>
                  <span style={{ color: 'var(--success)' }}>{formatBaht(parseFloat(principalPaid) || Math.max(amt - interest, 0))}</span>
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button>
            <button id="save-payment-btn" type="submit" className="btn btn-primary" disabled={saving || !amount}>
              {saving ? <><span className="spinner" /> กำลังบันทึก...</> : (isClosing ? '🏁 บันทึกและปิดบัญชี' : '💾 บันทึกการชำระ')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
