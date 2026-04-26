import { useState, useMemo } from 'react'
import { formatBaht } from '../lib/formatters'

const LOAN_TYPES = [
  { value: 'daily', label: '📅 ดอกรายวัน' },
  { value: 'weekly', label: '📆 ผ่อนรายอาทิตย์' },
  { value: 'monthly', label: '🗓️ ผ่อนรายเดือน' },
  { value: 'yearly', label: '🏦 ดอกรายปี' },
  { value: 'upfront', label: '💸 ดอกหน้า' },
  { value: 'bullet', label: '💰 เงินก้อน+ดอก' },
  { value: 'reducing', label: '📉 ลดต้นลดดอก' },
]

const PERIODS = [
  { value: 'daily', label: 'ต่อวัน' },
  { value: 'weekly', label: 'ต่ออาทิตย์' },
  { value: 'monthly', label: 'ต่อเดือน' },
  { value: 'yearly', label: 'ต่อปี' },
]

export default function Payments() {
  const [type, setType] = useState('daily')
  const [principal, setPrincipal] = useState('10000')
  const [rate, setRate] = useState('10')
  const [period, setPeriod] = useState('daily')
  const [installments, setInstallments] = useState('20')
  const [installmentAmt, setInstallmentAmt] = useState('')

  const analysis = useMemo(() => {
    const p = parseFloat(principal) || 0
    const r = parseFloat(rate) || 0
    const instCount = parseInt(installments) || 1
    const pPeriod = period as any

    if (p <= 0) return null

    // 1. Calculate Total Repayment & Installment Amount based on Type
    let perAmt = 0

    if (type === 'daily' || type === 'weekly' || type === 'monthly' || type === 'yearly') {
      // Fixed interest for the whole period (total interest = principal * rate * installments)
      const totalInterest = p * (r / 100) * instCount
      const totalRepay = p + totalInterest
      perAmt = totalRepay / instCount
    } else if (type === 'upfront') {
      // Interest is taken upfront, installments only cover principal
      perAmt = p / instCount
    } else if (type === 'bullet') {
      // One single payment at the end
      const totalInterest = p * (r / 100) * instCount
      perAmt = p + totalInterest
    } else if (type === 'reducing') {
      // Reducing balance monthly
      const monthlyRate = r / 100 / 12
      perAmt = monthlyRate === 0 ? p / instCount : (p * monthlyRate * Math.pow(1 + monthlyRate, instCount)) / (Math.pow(1 + monthlyRate, instCount) - 1)
    }

    // Override with manual input if provided
    if (parseFloat(installmentAmt) > 0) {
      perAmt = parseFloat(installmentAmt)
    }

    const rows = []
    let remainingPrincipal = p
    let totalReceived = 0
    let breakEvenPeriod = null

    // Simulation loop based on "Principal First" logic
    for (let i = 1; i <= instCount; i++) {
      const payment = (type === 'bullet' && i < instCount) ? 0 : perAmt
      let prinPaid = 0
      let intPaid = 0

      if (remainingPrincipal > 0) {
        prinPaid = Math.min(payment, remainingPrincipal)
        intPaid = payment - prinPaid
        remainingPrincipal -= prinPaid
        if (remainingPrincipal <= 0 && breakEvenPeriod === null) {
          breakEvenPeriod = i
        }
      } else {
        intPaid = payment
      }

      totalReceived += payment

      rows.push({
        period: i,
        payment,
        principalPaid: prinPaid,
        interestPaid: intPaid,
        remainingPrincipal: Math.max(0, remainingPrincipal),
        isBreakEven: i === breakEvenPeriod
      })
    }

    return { rows, totalReceived, breakEvenPeriod, totalProfit: totalReceived - p }
  }, [principal, rate, installments, type, period, installmentAmt])

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>📉 วิเคราะห์และจำลองการคืนทุน</h2>
        <p>คำนวณแผนการจ่ายเงินและจุดคุ้มทุน (กฎ: ต้นหักหมดก่อนดอก)</p>
      </div>

      <div className="page-content">
        <div className="add-loan-grid" style={{ gridTemplateColumns: '320px 1fr', gap: '24px' }}>
          {/* Left: Controls */}
          <div className="card-section" style={{ height: 'fit-content' }}>
            <div className="section-title-main" style={{ marginBottom: 20 }}>⚙️ ตั้งค่าการจำลอง</div>
            
            <div className="form-group">
              <label className="form-label">ประเภทสินเชื่อ</label>
              <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                {LOAN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">เงินต้น (บาท)</label>
              <input className="form-input" type="number" value={principal} onChange={e => setPrincipal(e.target.value)} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">ดอกเบี้ย (%)</label>
                <input className="form-input" type="number" value={rate} onChange={e => setRate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">ต่อระยะเวลา</label>
                <select className="form-select" value={period} onChange={e => setPeriod(e.target.value)}>
                  {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">จำนวนงวดที่ต้องการจำลอง</label>
              <input className="form-input" type="number" value={installments} onChange={e => setInstallments(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">ปรับแต่งยอดส่งต่องวด (ถ้ามี)</label>
              <input className="form-input" type="number" placeholder="คำนวณให้อัตโนมัติ" value={installmentAmt} onChange={e => setInstallmentAmt(e.target.value)} />
              <div className="form-hint" style={{ marginTop: 4 }}>ถ้าเว้นว่างไว้ ระบบจะคำนวณยอดส่งมาตรฐานให้ตามประเภทครับ</div>
            </div>

            {analysis && (
              <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>สรุปการวิเคราะห์</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>จุดคืนทุน:</span>
                  <span style={{ fontWeight: 700, color: 'var(--success)' }}>งวดที่ {analysis.breakEvenPeriod || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>ยอดรับรวม:</span>
                  <span style={{ fontWeight: 700 }}>{formatBaht(analysis.totalReceived)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>กำไรสุทธิ:</span>
                  <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{formatBaht(analysis.totalProfit)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Table */}
          <div className="card-section">
            <div className="section-header" style={{ marginBottom: 20 }}>
              <div>
                <div className="section-title-main">📊 ตารางแผนการรับเงินและหักเงินต้น</div>
                <div className="section-subtitle">จำลองการหักเงินต้นให้หมดก่อนแล้วจึงนับเป็นดอกเบี้ย</div>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>งวดที่</th>
                    <th>ยอดส่ง</th>
                    <th>หักเงินต้น</th>
                    <th>นับเป็นดอกเบี้ย</th>
                    <th>เงินต้นคงเหลือ</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis?.rows.map(row => (
                    <tr key={row.period} className={row.isBreakEven ? 'row-success' : ''} style={row.isBreakEven ? { background: 'rgba(34, 197, 94, 0.1)' } : {}}>
                      <td style={{ fontWeight: row.isBreakEven ? 700 : 400 }}>{row.period}</td>
                      <td className="td-amount">{formatBaht(row.payment)}</td>
                      <td style={{ color: 'var(--success)' }}>{row.principalPaid > 0 ? formatBaht(row.principalPaid) : '-'}</td>
                      <td style={{ color: 'var(--gold)' }}>{row.interestPaid > 0 ? formatBaht(row.interestPaid) : '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{formatBaht(row.remainingPrincipal)}</td>
                      <td>
                        {row.isBreakEven ? (
                          <span className="badge badge-success">✅ คืนต้นครบ!</span>
                        ) : row.remainingPrincipal > 0 ? (
                          <span className="badge badge-warning" style={{ opacity: 0.8 }}>⏳ กำลังคืนทุน</span>
                        ) : (
                          <span className="badge badge-gold">💰 กำไร</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
