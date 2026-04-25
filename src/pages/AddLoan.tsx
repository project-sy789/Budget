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
  { value: 'yearly', label: '🏦 ดอกรายปี', desc: 'คิดดอกเบี้ยเป็นรายปี' },
  { value: 'upfront', label: '💸 ดอกหน้า', desc: 'หักดอกเบี้ยล่วงหน้าตอนรับเงิน' },
  { value: 'bullet', label: '💰 เงินก้อน+ดอก', desc: 'จ่ายทั้งหมดตอนครบกำหนด' },
  { value: 'reducing', label: '📉 ลดต้นลดดอก', desc: 'ดอกคิดจากยอดต้นคงเหลือ' },
]

const PERIODS = [
  { value: 'daily', label: 'ต่อวัน' },
  { value: 'weekly', label: 'ต่ออาทิตย์' },
  { value: 'monthly', label: 'ต่อเดือน' },
  { value: 'yearly', label: 'ต่อปี' },
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
  include_first_day: boolean
}

const defaultForm: FormData = {
  borrower_name: '', borrower_phone: '', borrower_address: '', borrower_id_card: '',
  loan_type: 'daily', principal: '', interest_rate: '', interest_period: 'daily',
  start_date: new Date().toISOString().slice(0, 10), due_date: '',
  installments: '', installment_amount: '', collateral: '', guarantor_name: '', notes: '',
  include_first_day: true
}

export default function AddLoan() {
  const navigate = useNavigate()
  const { addLoan } = useStore()
  const [form, setForm] = useState<FormData>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [interestMode, setInterestMode] = useState<'percent' | 'amount' | 'total'>('percent')
  const [interestAmount, setInterestAmount] = useState('')
  const [totalRepay, setTotalRepay] = useState('')
  const [dueMode, setDueMode] = useState<'date' | 'days'>('date')
  const [dueDays, setDueDays] = useState('')

  const set = (key: keyof FormData, val: string | boolean) => {
    setForm(f => {
      const newForm = { ...f, [key]: val }
      
      // Auto-sync interest_period when loan_type changes
      if (key === 'loan_type' && typeof val === 'string') {
        if (val === 'daily') newForm.interest_period = 'daily'
        else if (val === 'weekly') newForm.interest_period = 'weekly'
        else if (val === 'monthly') newForm.interest_period = 'monthly'
        else if (val === 'yearly') newForm.interest_period = 'yearly'
        else if (val === 'reducing') newForm.interest_period = 'monthly'
        else if (val === 'upfront') newForm.interest_period = 'daily'
        else if (val === 'bullet') newForm.interest_period = 'daily'
      }

      // Sync interest if mode is amount and principal or rate changes
      if (interestMode === 'amount' && key === 'principal' && typeof val === 'string') {
        const p = parseFloat(val) || 0
        const amt = parseFloat(interestAmount) || 0
        if (p > 0) {
          newForm.interest_rate = ((amt / p) * 100).toFixed(4)
        }
      }

      // Sync interest if mode is total and principal/dates change
      if (interestMode === 'total' && (key === 'principal' || key === 'due_date' || key === 'start_date')) {
        setTimeout(() => syncFromTotal(newForm), 0)
      }

      return newForm
    })
    setErrors(e => ({ ...e, [key]: '' }))
  }

  const syncFromTotal = (currentForm: FormData) => {
    const total = parseFloat(totalRepay) || 0
    const p = parseFloat(currentForm.principal) || 0
    if (p > 0 && total > p && currentForm.start_date && currentForm.due_date) {
      const start = new Date(currentForm.start_date)
      const end = new Date(currentForm.due_date)
      const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
      
      const totalInterest = total - p
      let dailyAmt = 0
      
      // Calculate daily/weekly/monthly based on interest_period
      if (currentForm.interest_period === 'daily') dailyAmt = totalInterest / diffDays
      else if (currentForm.interest_period === 'weekly') dailyAmt = totalInterest / (diffDays / 7)
      else if (currentForm.interest_period === 'monthly') dailyAmt = totalInterest / (diffDays / 30)
      else dailyAmt = totalInterest / (diffDays / 365)

      setInterestAmount(dailyAmt.toFixed(2))
      setForm(f => ({ ...f, interest_rate: ((dailyAmt / p) * 100).toFixed(4) }))
    }
  }

  const handleInterestAmountChange = (val: string) => {
    setInterestAmount(val)
    const amt = parseFloat(val) || 0
    const p = parseFloat(form.principal) || 0
    if (p > 0) {
      set('interest_rate', ((amt / p) * 100).toFixed(4))
    }
  }

  const handleTotalRepayChange = (val: string) => {
    setTotalRepay(val)
    const total = parseFloat(val) || 0
    const p = parseFloat(form.principal) || 0
    if (p > 0 && total > p && form.start_date && form.due_date) {
      const start = new Date(form.start_date)
      const end = new Date(form.due_date)
      const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
      
      const totalInterest = total - p
      let dailyAmt = 0
      if (form.interest_period === 'daily') dailyAmt = totalInterest / diffDays
      else if (form.interest_period === 'weekly') dailyAmt = totalInterest / (diffDays / 7)
      else if (form.interest_period === 'monthly') dailyAmt = totalInterest / (diffDays / 30)
      else dailyAmt = totalInterest / (diffDays / 365)

      setInterestAmount(dailyAmt.toFixed(2))
      setForm(f => ({ ...f, interest_rate: ((dailyAmt / p) * 100).toFixed(4) }))
    }
  }

  const handleDueDaysChange = (val: string) => {
    setDueDays(val)
    const days = parseInt(val) || 0
    if (days > 0 && form.start_date) {
      const d = new Date(form.start_date)
      d.setDate(d.getDate() + days)
      const newDueDate = d.toISOString().split('T')[0]
      set('due_date', newDueDate)
    }
  }

  const setInterestModeWrapper = (mode: 'percent' | 'amount' | 'total') => {
    setInterestMode(mode)
    const p = parseFloat(form.principal) || 0
    const r = parseFloat(form.interest_rate) || 0
    
    if (mode === 'amount') {
      setInterestAmount(((r / 100) * p).toFixed(2))
    } else if (mode === 'total') {
      if (preview?.summary) {
        // Try to get totalRepay from current preview
        const totalObj = preview.summary.find((s: any) => s.isTotal)
        if (totalObj) setTotalRepay(totalObj.value.replace(/[^0-9.]/g, ''))
      }
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

    const diffDays = form.due_date
      ? Math.ceil((new Date(form.due_date).getTime() - new Date(start).getTime()) / 86400000)
      : 30
    const daysToDate = form.include_first_day ? diffDays + 1 : diffDays

    const periodLabel = PERIODS.find(px => px.value === period)?.label.replace('% ต่อ', '') || 'วัน'
    const rateFormatted = `${parseFloat(form.interest_rate).toFixed(2)}%`

    switch (form.loan_type) {
      case 'daily':
      case 'yearly': {
        const res = calcDailyFlat(p, r, period, daysToDate)
        const displayInstallment = form.installment_amount ? parseFloat(form.installment_amount) : res.dailyInterest
        return { summary: [
          { label: 'เงินต้น', value: formatBaht(p) },
          { label: `อัตราดอกเบี้ย (${periodLabel})`, value: rateFormatted },
          { label: `ยอดส่งต่อ${periodLabel}`, value: formatBaht(displayInstallment), isHighlight: true },
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
  }, [form.loan_type, form.principal, form.interest_rate, form.interest_period, form.start_date, form.due_date, form.installments, form.include_first_day, form.installment_amount])

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
      include_first_day: form.include_first_day,
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
        <p>สร้างบันทึกการปล่อยกู้ใหม่ในระบบ</p>
      </div>

      <div className="page-content">
        <div className="add-loan-grid">
          {/* Main Form Section */}
          <form onSubmit={handleSubmit}>
            {/* Loan Type Section */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title">ประเภทการปล่อยกู้</div>
              <div className="loan-type-grid">
                {LOAN_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set('loan_type', t.value)}
                    className={`loan-type-btn ${form.loan_type === t.value ? 'active' : ''}`}
                  >
                    <span className="label">{t.label}</span>
                    <span className="desc">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Borrower Section */}
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
                <textarea className="form-input" value={form.borrower_address} onChange={e => set('borrower_address', e.target.value)} placeholder="ที่อยู่ผู้กู้" style={{ minHeight: 60 }} />
              </div>
            </div>

            {/* Loan Details Section */}
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

              <div className="form-row responsive-row" style={{ marginBottom: 20 }}>
                {/* Interest Rate Column */}
                <div className="form-group" style={{ flex: 1 }}>
                  <div style={{ height: 36, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <label className="form-label" style={{ marginBottom: 0, opacity: 0.9 }}>อัตราดอกเบี้ย <span className="required">*</span></label>
                    <div className="segmented-control" style={{ width: 170 }}>
                      <button type="button" className={`segment-btn ${interestMode === 'percent' ? 'active' : ''}`} onClick={() => setInterestModeWrapper('percent')}>%</button>
                      <button type="button" className={`segment-btn ${interestMode === 'amount' ? 'active' : ''}`} onClick={() => setInterestModeWrapper('amount')}>บาท</button>
                      <button type="button" className={`segment-btn ${interestMode === 'total' ? 'active' : ''}`} onClick={() => setInterestModeWrapper('total')}>รวม</button>
                    </div>
                  </div>
                  <div style={{ position: 'relative' }}>
                    {interestMode === 'percent' ? (
                      <>
                        <input id="rate-input" className="form-input" type="number" step="0.01" value={form.interest_rate} onChange={e => set('interest_rate', e.target.value)} placeholder="1" style={{ paddingRight: 36 }} />
                        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>%</span>
                      </>
                    ) : interestMode === 'amount' ? (
                      <>
                        <input id="rate-amt-input" className="form-input" type="number" step="0.01" value={interestAmount} onChange={e => handleInterestAmountChange(e.target.value)} placeholder="500" style={{ paddingRight: 36 }} />
                        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>฿</span>
                      </>
                    ) : (
                      <>
                        <input id="total-repay-input" className="form-input" type="number" step="0.01" value={totalRepay} onChange={e => handleTotalRepayChange(e.target.value)} placeholder="12000" style={{ paddingRight: 36 }} />
                        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>฿</span>
                      </>
                    )}
                  </div>
                  {errors.interest_rate && <div className="form-error">{errors.interest_rate}</div>}
                  {interestMode !== 'percent' && (
                    <div className="form-hint-pill" style={{ marginTop: 10 }}>
                      ≈ {parseFloat(form.interest_rate) ? parseFloat(form.interest_rate).toFixed(2) : '0.00'}% {PERIODS.find(px => px.value === form.interest_period)?.label || 'ต่อรอบ'}
                    </div>
                  )}
                </div>

                {/* Dates Column */}
                <div className="form-group" style={{ flex: 1.2 }}>
                  <div style={{ height: 36, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <label className="form-label" style={{ marginBottom: 0, opacity: 0.9 }}>วันที่กู้ / ครบกำหนด <span className="required">*</span></label>
                    <div className="segmented-control" style={{ width: 150 }}>
                      <button type="button" className={`segment-btn ${dueMode === 'date' ? 'active' : ''}`} onClick={() => setDueMode('date')}>วันที่</button>
                      <button type="button" className={`segment-btn ${dueMode === 'days' ? 'active' : ''}`} onClick={() => setDueMode('days')}>วัน</button>
                    </div>
                  </div>
                  <div className="form-row stack-on-ipad">
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <input className="form-input" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      {dueMode === 'date' ? (
                        <input className="form-input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <input className="form-input" type="number" value={dueDays} onChange={e => handleDueDaysChange(e.target.value)} placeholder="30" style={{ paddingRight: 40 }} />
                          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>วัน</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {errors.due_date && <div className="form-error">{errors.due_date}</div>}
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label className="switch-container" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
                      <input type="checkbox" checked={form.include_first_day} onChange={e => set('include_first_day', e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>นับวันแรกเป็นวันที่ 1</span>
                    </label>
                  </div>
                  {dueMode === 'days' && form.due_date && (
                    <div className="form-hint-pill" style={{ marginTop: 10 }}>📅 ครบกำหนด: {new Date(form.due_date).toLocaleDateString('th-TH')}</div>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">ระยะเวลาคิดดอก</label>
                  <select className="form-select" value={form.interest_period} onChange={e => set('interest_period', e.target.value)}>
                    {PERIODS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                {needsInstallments && (
                  <div className="form-group">
                    <label className="form-label">จำนวนงวด</label>
                    <input className="form-input" type="number" value={form.installments} onChange={e => set('installments', e.target.value)} min="1" max="360" />
                  </div>
                )}
              </div>
              
              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">หมายเหตุ</label>
                <textarea className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="หมายเหตุเพิ่มเติม" style={{ minHeight: 60 }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button id="save-loan-btn" type="submit" className="btn btn-primary btn-lg" style={{ flex: 1 }} disabled={saving}>
                {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกสินเชื่อ'}
              </button>
              <button type="button" className="btn btn-secondary btn-lg" onClick={() => navigate('/loans')}>ยกเลิก</button>
            </div>
          </form>

          {/* Preview Panel Section */}
          <div className="summary-sidebar">
            <div className="card sticky-summary">
              <div className="section-title">📊 ตัวอย่างการคำนวณ</div>
              {!preview ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 12 }}>📊</div>
                  กรอกข้อมูลเงินต้นและดอกเบี้ย<br />เพื่อดูตัวอย่าง
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {preview.summary.map((s: any, i: number) => (
                      <div key={i} className={`receipt-row ${s.isTotal ? 'total-row' : ''} ${s.isHighlight ? 'highlight-row' : ''}`}>
                        <span className="label" style={{ color: s.isTotal ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.85rem' }}>{s.label}</span>
                        <span className="value" style={{ fontWeight: 700, color: s.isTotal ? 'var(--gold)' : 'var(--text-primary)' }}>{s.value}</span>
                      </div>
                    ))}
                  </div>

                  {preview.rows && preview.rows.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>ตารางผ่อนชำระ</div>
                      <div className="amort-table-mini">
                        {preview.rows.slice(0, 5).map((row: AmortRow, i: number) => (
                          <div key={i} className="amort-row-mini">
                            <span className="no">{row.period}</span>
                            <span className="date">{new Date(row.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                            <span className="amt">{formatBaht(row.payment)}</span>
                          </div>
                        ))}
                        {preview.rows.length > 5 && (
                          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                            ... และอีก {preview.rows.length - 5} งวด ...
                          </div>
                        )}
                      </div>
                    </div>
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
