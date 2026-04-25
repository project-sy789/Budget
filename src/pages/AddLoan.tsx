import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import {
  calcDailyFlat, calcUpfront, calcBullet,
  calcWeeklyInstallment, calcMonthlyInstallment, calcReducing
} from '../lib/calculations'
import type { AmortRow } from '../lib/calculations'
import { formatBaht } from '../lib/formatters'

const LOAN_TYPES = [
  { value: 'daily', label: '📅 ดอกรายวัน', desc: 'คิดดอกเบี้ยรายวันบนยอดต้นคงเหลือ' },
  { value: 'weekly', label: '📆 ผ่อนรายอาทิตย์', desc: 'ผ่อนทุกอาทิตย์ ดอกคงที่' },
  { value: 'monthly', label: '🗓️ ผ่อนรายเดือน', desc: 'ผ่อนทุกเดือน ดอกคงที่' },
  { value: 'upfront', label: '💸 ดอกหน้า', desc: 'หักดอกเบี้ยล่วงหน้าตอนรับเงิน' },
  { value: 'bullet', label: '💰 เงินก้อน+ดอก', desc: 'จ่ายทั้งหมดตอนครบกำหนด' },
  { value: 'reducing', label: '📉 ลดต้นลดดอก', desc: 'ดอกคิดจากยอดต้นคงเหลือ' },
]

const PERIODS = [
  { value: 'daily', label: '% ต่อวัน' },
  { value: 'weekly', label: '% ต่ออาทิตย์' },
  { value: 'monthly', label: '% ต่อเดือน' },
  { value: 'yearly', label: '% ต่อปี' },
]

interface FormData {
  borrower_name: string
  borrower_phone: string
  borrower_address: string
  borrower_id_card: string
  loan_type: string
  principal: string
  interest_rate: string
  interest_period: string
  start_date: string
  due_date: string
  installments: string
  installment_amount: string
  collateral: string
  guarantor_name: string
  notes: string
}

const defaultForm: FormData = {
  borrower_name: '', borrower_phone: '', borrower_address: '', borrower_id_card: '',
  loan_type: 'daily', principal: '', interest_rate: '', interest_period: 'daily',
  start_date: new Date().toISOString().slice(0, 10), due_date: '',
  installments: '', installment_amount: '', collateral: '', guarantor_name: '', notes: ''
}

export default function AddLoan() {
  const navigate = useNavigate()
  const { addLoan } = useStore()
  const [form, setForm] = useState<FormData>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [interestMode, setInterestMode] = useState<'percent' | 'amount'>('percent')
  const [interestAmount, setInterestAmount] = useState('')
  const [dueMode, setDueMode] = useState<'date' | 'days'>('date')
  const [dueDays, setDueDays] = useState('')

  const set = (key: keyof FormData, val: string) => {
    setForm(f => {
      const newForm = { ...f, [key]: val }
      
      // Auto-sync interest_period when loan_type changes
      if (key === 'loan_type') {
        if (val === 'daily') newForm.interest_period = 'daily'
        else if (val === 'weekly') newForm.interest_period = 'weekly'
        else if (val === 'monthly') newForm.interest_period = 'monthly'
        else if (val === 'reducing') newForm.interest_period = 'monthly'
        else if (val === 'upfront') newForm.interest_period = 'daily'
        else if (val === 'bullet') newForm.interest_period = 'daily'
      }

      // Sync interest if mode is amount and principal or rate changes
      if (interestMode === 'amount' && key === 'principal') {
        const p = parseFloat(val) || 0
        const amt = parseFloat(interestAmount) || 0
        if (p > 0) {
          newForm.interest_rate = ((amt / p) * 100).toFixed(4)
        }
      }
      return newForm
    })
    setErrors(e => ({ ...e, [key]: '' }))
  }

  const handleInterestAmountChange = (val: string) => {
    setInterestAmount(val)
    const amt = parseFloat(val) || 0
    const p = parseFloat(form.principal) || 0
    if (p > 0) {
      set('interest_rate', ((amt / p) * 100).toFixed(4))
    }
  }

  const handleDueDaysChange = (val: string) => {
    setDueDays(val)
    const days = parseInt(val) || 0
    if (days > 0 && form.start_date) {
      const d = new Date(form.start_date)
      d.setDate(d.getDate() + days)
      set('due_date', d.toISOString().split('T')[0])
    }
  }


  const toggleInterestMode = () => {
    const newMode = interestMode === 'percent' ? 'amount' : 'percent'
    setInterestMode(newMode)
    if (newMode === 'amount') {
      const p = parseFloat(form.principal) || 0
      const r = parseFloat(form.interest_rate) || 0
      setInterestAmount(((r / 100) * p).toFixed(2))
    }
  }

  // Preview calculations
  const preview = useMemo(() => {
    const p = parseFloat(form.principal) || 0
    const r = parseFloat(form.interest_rate) || 0
    const period = form.interest_period as any
    const inst = parseInt(form.installments) || 4
    const start = form.start_date || new Date().toISOString().slice(0, 10)

    if (p <= 0 || r <= 0) return null

    const daysToDate = form.due_date
      ? Math.max(1, Math.ceil((new Date(form.due_date).getTime() - new Date(start).getTime()) / 86400000))
      : 30

    const periodLabel = PERIODS.find(px => px.value === period)?.label.replace('% ต่อ', '') || 'วัน'
    const rateFormatted = `${parseFloat(form.interest_rate).toFixed(2)}%`

    switch (form.loan_type) {
      case 'daily': {
        const res = calcDailyFlat(p, r, period, daysToDate)
        return { summary: [
          { label: 'เงินต้น', value: formatBaht(p) },
          { label: `อัตราดอกเบี้ย (${periodLabel})`, value: rateFormatted },
          { label: `ดอกเบี้ยต่อ${periodLabel}`, value: formatBaht(res.dailyInterest) },
          { label: `ระยะเวลากู้`, value: `${daysToDate} วัน` },
          { label: `ดอกเบี้ยรวมทั้งหมด`, value: formatBaht(res.totalInterest) },
          { label: 'ยอดรวมที่ต้องได้รับ', value: formatBaht(res.totalRepay), isTotal: true },
        ], rows: null }
      }
      case 'upfront': {
        const res = calcUpfront(p, r, period, daysToDate)
        return { summary: [
          { label: 'เงินต้น', value: formatBaht(p) },
          { label: `ดอกเบี้ยหักล่วงหน้า`, value: formatBaht(res.upfrontInterest) },
          { label: 'ผู้กู้รับเงินจริง', value: formatBaht(res.received), isHighlight: true },
          { label: `ระยะเวลากู้`, value: `${daysToDate} วัน` },
          { label: 'ยอดที่ต้องคืน (ต้น)', value: formatBaht(res.totalRepay), isTotal: true },
        ], rows: null }
      }
      case 'bullet': {
        const res = calcBullet(p, r, period, daysToDate)
        return { summary: [
          { label: 'เงินต้น', value: formatBaht(p) },
          { label: `ดอกเบี้ยต่อ${periodLabel}`, value: formatBaht(p * (r/100)) },
          { label: `ระยะเวลากู้`, value: `${daysToDate} วัน` },
          { label: `ดอกเบี้ยรวม (จ่ายตอนจบ)`, value: formatBaht(res.totalInterest) },
          { label: 'ยอดจ่ายรวมตอนครบกำหนด', value: formatBaht(res.totalRepay), isTotal: true },
        ], rows: null }
      }
      case 'weekly': {
        const rows = calcWeeklyInstallment(p, r, period, inst, start)
        const total = rows.reduce((s, r) => s + r.payment, 0)
        return { summary: [
          { label: 'เงินต้น', value: formatBaht(p) },
          { label: `อัตราดอกเบี้ยต่อสัปดาห์`, value: rateFormatted },
          { label: 'ยอดผ่อนต่องวด', value: formatBaht(rows[0]?.payment || 0), isHighlight: true },
          { label: `จำนวนงวดทั้งหมด`, value: `${inst} งวด (รายสัปดาห์)` },
          { label: 'ดอกเบี้ยรวม', value: formatBaht(total - p) },
          { label: 'ยอดรวมทั้งหมดที่ต้องได้รับ', value: formatBaht(total), isTotal: true },
        ], rows }
      }
      case 'monthly': {
        const rows = calcMonthlyInstallment(p, r, period, inst, start)
        const total = rows.reduce((s, r) => s + r.payment, 0)
        return { summary: [
          { label: 'เงินต้น', value: formatBaht(p) },
          { label: `อัตราดอกเบี้ยต่อเดือน`, value: rateFormatted },
          { label: 'ยอดผ่อนต่องวด', value: formatBaht(rows[0]?.payment || 0), isHighlight: true },
          { label: `จำนวนงวดทั้งหมด`, value: `${inst} งวด (รายเดือน)` },
          { label: 'ดอกเบี้ยรวม', value: formatBaht(total - p) },
          { label: 'ยอดรวมทั้งหมดที่ต้องได้รับ', value: formatBaht(total), isTotal: true },
        ], rows }
      }
      case 'reducing': {
        const rows = calcReducing(p, r, period, inst, start)
        const total = rows.reduce((s, r) => s + r.payment, 0)
        return { summary: [
          { label: 'เงินต้น', value: formatBaht(p) },
          { label: `อัตราดอกเบี้ยต่อปี`, value: rateFormatted },
          { label: 'ยอดผ่อนงวดแรก (ประมาณ)', value: formatBaht(rows[0]?.payment || 0), isHighlight: true },
          { label: `จำนวนงวดทั้งหมด`, value: `${inst} งวด (ลดต้นลดดอก)` },
          { label: 'ดอกเบี้ยรวมโดยประมาณ', value: formatBaht(total - p) },
          { label: 'ยอดรวมทั้งหมดที่ต้องได้รับ', value: formatBaht(total), isTotal: true },
        ], rows }
      }
      default: return null
    }
  }, [form.loan_type, form.principal, form.interest_rate, form.interest_period, form.start_date, form.due_date, form.installments])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.borrower_name.trim()) e.borrower_name = 'กรุณากรอกชื่อผู้กู้'
    if (!form.principal || parseFloat(form.principal) <= 0) e.principal = 'กรุณากรอกจำนวนเงิน'
    if (!form.interest_rate || parseFloat(form.interest_rate) <= 0) e.interest_rate = 'กรุณากรอกอัตราดอกเบี้ย'
    if (!form.start_date) e.start_date = 'กรุณาเลือกวันเริ่มกู้'
    if (!form.due_date) e.due_date = 'กรุณาเลือกวันครบกำหนด'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    const loan = await addLoan({
      borrower_name: form.borrower_name.trim(),
      borrower_phone: form.borrower_phone,
      borrower_address: form.borrower_address,
      borrower_id_card: form.borrower_id_card,
      loan_type: form.loan_type as any,
      principal: parseFloat(form.principal),
      interest_rate: parseFloat(form.interest_rate),
      interest_period: form.interest_period as any,
      start_date: form.start_date,
      due_date: form.due_date,
      installments: form.installments ? parseInt(form.installments) : null,
      installment_amount: form.installment_amount ? parseFloat(form.installment_amount) : null,
      collateral: form.collateral,
      guarantor_name: form.guarantor_name,
      status: 'active',
      notes: form.notes,
    })
    setSaving(false)
    if (loan) navigate(`/loans/${loan.id}`)
  }

  const needsInstallments = ['weekly', 'monthly', 'reducing'].includes(form.loan_type)

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>➕ เพิ่มสินเชื่อใหม่</h2>
        <p>กรอกข้อมูลการปล่อยกู้</p>
      </div>
      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Loan Type */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title">ประเภทการปล่อยกู้</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {LOAN_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set('loan_type', t.value)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${form.loan_type === t.value ? 'var(--gold)' : 'var(--border)'}`,
                      background: form.loan_type === t.value ? 'var(--gold-glow)' : 'var(--bg-input)',
                      color: form.loan_type === t.value ? 'var(--gold)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{t.label}</div>
                    <div style={{ fontSize: '0.72rem', marginTop: 2, opacity: 0.8 }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Borrower */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title">ข้อมูลผู้กู้</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">ชื่อ-นามสกุล <span className="required">*</span></label>
                  <input id="borrower-name" className="form-input" value={form.borrower_name} onChange={e => set('borrower_name', e.target.value)} placeholder="ชื่อผู้กู้" />
                  {errors.borrower_name && <div className="form-error">{errors.borrower_name}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">เบอร์โทรศัพท์</label>
                  <input className="form-input" value={form.borrower_phone} onChange={e => set('borrower_phone', e.target.value)} placeholder="08X-XXX-XXXX" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">เลขบัตรประชาชน</label>
                  <input className="form-input" value={form.borrower_id_card} onChange={e => set('borrower_id_card', e.target.value)} placeholder="X-XXXX-XXXXX-XX-X" />
                </div>
                <div className="form-group">
                  <label className="form-label">ผู้ค้ำประกัน</label>
                  <input className="form-input" value={form.guarantor_name} onChange={e => set('guarantor_name', e.target.value)} placeholder="ชื่อผู้ค้ำ" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">ที่อยู่</label>
                <textarea className="form-textarea" value={form.borrower_address} onChange={e => set('borrower_address', e.target.value)} placeholder="ที่อยู่ผู้กู้" style={{ minHeight: 60 }} />
              </div>
            </div>

            {/* Loan Details */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title">รายละเอียดสินเชื่อ</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">เงินต้น (บาท) <span className="required">*</span></label>
                  <input id="principal-input" className="form-input" type="number" value={form.principal} onChange={e => set('principal', e.target.value)} placeholder="10000" min="1" />
                  {errors.principal && <div className="form-error">{errors.principal}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">หลักประกัน</label>
                  <input className="form-input" value={form.collateral} onChange={e => set('collateral', e.target.value)} placeholder="โฉนด, ทะเบียนรถ, ฯลฯ" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <div style={{ height: 36, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>อัตราดอกเบี้ย <span className="required">*</span></label>
                    <div className="segmented-control" style={{ width: 140 }}>
                      <button type="button" className={`segment-btn ${interestMode === 'percent' ? 'active' : ''}`} onClick={() => interestMode !== 'percent' && toggleInterestMode()}>%</button>
                      <button type="button" className={`segment-btn ${interestMode === 'amount' ? 'active' : ''}`} onClick={() => interestMode !== 'amount' && toggleInterestMode()}>บาท</button>
                    </div>
                  </div>
                  {interestMode === 'percent' ? (
                    <div style={{ position: 'relative' }}>
                      <input id="rate-input" className="form-input" type="number" step="0.01" value={form.interest_rate} onChange={e => set('interest_rate', e.target.value)} placeholder="1" style={{ paddingRight: 36 }} />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>%</span>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input id="rate-amt-input" className="form-input" type="number" step="0.01" value={interestAmount} onChange={e => handleInterestAmountChange(e.target.value)} placeholder="500" style={{ paddingRight: 36 }} />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>฿</span>
                    </div>
                  )}
                  {errors.interest_rate && <div className="form-error">{errors.interest_rate}</div>}
                  {interestMode === 'amount' && (
                    <div className="form-hint-pill">
                      ≈ {parseFloat(form.interest_rate) ? parseFloat(form.interest_rate).toFixed(2) : '0.00'}% {PERIODS.find(px => px.value === form.interest_period)?.label.replace('% ', '') || 'ต่อรอบ'}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <div style={{ height: 36, display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>ระยะเวลาคิดดอก</label>
                  </div>
                  <select className="form-select" value={form.interest_period} onChange={e => set('interest_period', e.target.value)}>
                    {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <div style={{ height: 36, display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>วันเริ่มกู้ <span className="required">*</span></label>
                  </div>
                  <input className="form-input" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
                  {errors.start_date && <div className="form-error">{errors.start_date}</div>}
                </div>
                <div className="form-group">
                  <div style={{ height: 36, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>วันครบกำหนด <span className="required">*</span></label>
                    <div className="segmented-control" style={{ width: 140 }}>
                      <button type="button" className={`segment-btn ${dueMode === 'date' ? 'active' : ''}`} onClick={() => setDueMode('date')}>วันที่</button>
                      <button type="button" className={`segment-btn ${dueMode === 'days' ? 'active' : ''}`} onClick={() => setDueMode('days')}>จำนวนวัน</button>
                    </div>
                  </div>
                  {dueMode === 'date' ? (
                    <input className="form-input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input className="form-input" type="number" value={dueDays} onChange={e => handleDueDaysChange(e.target.value)} placeholder="เช่น 30" style={{ paddingRight: 40 }} />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>วัน</span>
                    </div>
                  )}
                  {errors.due_date && <div className="form-error">{errors.due_date}</div>}
                  {dueMode === 'days' && form.due_date && (
                    <div className="form-hint-pill">📅 ครบกำหนด: {new Date(form.due_date).toLocaleDateString('th-TH')}</div>
                  )}
                </div>
              </div>
              {needsInstallments && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">จำนวนงวด</label>
                    <input className="form-input" type="number" value={form.installments} onChange={e => set('installments', e.target.value)} min="1" max="360" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ยอดส่งต่องวด (บาท)</label>
                    <input className="form-input" type="number" step="0.01" value={form.installment_amount} onChange={e => set('installment_amount', e.target.value)} placeholder="ระบบจะคำนวณให้อัตโนมัติถ้าเว้นว่าง" />
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">หมายเหตุ</label>
                <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="หมายเหตุเพิ่มเติม" style={{ minHeight: 60 }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button id="save-loan-btn" type="submit" className="btn btn-primary btn-lg" disabled={saving}>
                {saving ? <><span className="spinner" /> กำลังบันทึก...</> : '💾 บันทึกสินเชื่อ'}
              </button>
              <button type="button" className="btn btn-secondary btn-lg" onClick={() => navigate('/loans')}>ยกเลิก</button>
            </div>
          </form>

          {/* Preview Panel */}
          <div>
            <div className="card" style={{ position: 'sticky', top: 20 }}>
              <div className="section-title">📊 ตัวอย่างการคำนวณ</div>
              {!preview ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: 20 }}>
                  กรอกข้อมูลเงินต้นและดอกเบี้ย<br />เพื่อดูตัวอย่าง
                </div>
              ) : (
                <>
                  {preview.summary.map((s: any, i) => (
                    <div key={i} className={s.isTotal ? 'receipt-total' : 'receipt-row'} style={s.isHighlight ? { borderLeft: '3px solid var(--gold)', paddingLeft: 10, background: 'var(--gold-glow)', margin: '4px -10px', borderRadius: '0 4px 4px 0' } : {}}>
                      <span style={{ color: s.isTotal || s.isHighlight ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.85rem' }}>{s.label}</span>
                      <span style={{ fontWeight: 700, color: s.isTotal ? 'var(--gold)' : 'var(--text-primary)' }}>{s.value}</span>
                    </div>
                  ))}
                  {preview.rows && preview.rows.length > 0 && (
                    <>
                      <div className="divider" />
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>ตารางผ่อนชำระ</div>
                      <div className="amort-table-wrap">
                        <table style={{ fontSize: '0.78rem' }}>
                          <thead>
                            <tr>
                              <th>งวด</th>
                              <th>วันที่</th>
                              <th>ดอก</th>
                              <th>ต้น</th>
                              <th>คงเหลือ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.rows.slice(0, 24).map((r: AmortRow) => (
                              <tr key={r.period}>
                                <td>{r.period}</td>
                                <td>{r.date.slice(5)}</td>
                                <td style={{ color: 'var(--gold)' }}>{r.interest.toLocaleString()}</td>
                                <td>{r.principal.toLocaleString()}</td>
                                <td style={{ color: 'var(--text-muted)' }}>{r.balance.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
