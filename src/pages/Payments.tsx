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
  const [interestMode, setInterestMode] = useState<'percent' | 'amount' | 'total'>('percent')
  const [interestAmount, setInterestAmount] = useState('1000')
  const [totalRepayInput, setTotalRepayInput] = useState('11000')
  const [period, setPeriod] = useState('monthly')
  const [installments, setInstallments] = useState('20')
  const [installmentAmt, setInstallmentAmt] = useState('')

  // Sync rate when interestMode or inputs change
  useMemo(() => {
    const p = parseFloat(principal) || 0
    if (p <= 0) return

    if (interestMode === 'amount') {
      const amt = parseFloat(interestAmount) || 0
      const calculatedRate = (amt / p) * 100
      setRate(calculatedRate.toString())
    } else if (interestMode === 'total') {
      const total = parseFloat(totalRepayInput) || 0
      const amt = Math.max(0, total - p)
      const calculatedRate = (amt / p) * 100
      setRate(calculatedRate.toString())
    }
  }, [interestMode, interestAmount, totalRepayInput, principal])

  const analysis = useMemo(() => {
    const p = parseFloat(principal) || 0
    const r = parseFloat(rate) || 0
    const instCount = parseInt(installments) || 1
    const pPeriod = period as any

    if (p <= 0) return null

    // 1. Calculate Standard Values
    const dailyRate = (r / 100) / (pPeriod === 'daily' ? 1 : pPeriod === 'weekly' ? 7 : pPeriod === 'monthly' ? 30 : 365)
    const totalDays = type === 'daily' ? instCount : type === 'weekly' ? instCount * 7 : type === 'monthly' ? instCount * 30 : type === 'yearly' ? instCount * 365 : instCount
    
    let perAmt = 0
    let initialProfit = 0
    let investmentCost = p

    if (type === 'daily' || type === 'weekly' || type === 'monthly' || type === 'yearly') {
      const totalInterest = p * dailyRate * totalDays
      const totalRepay = p + totalInterest
      perAmt = totalRepay / instCount
    } else if (type === 'upfront') {
      const upfrontInterest = p * dailyRate * totalDays
      initialProfit = upfrontInterest
      investmentCost = p - upfrontInterest
      perAmt = p / instCount
    } else if (type === 'bullet') {
      const totalInterest = p * dailyRate * totalDays
      perAmt = p + totalInterest
    } else if (type === 'reducing') {
      const monthlyRate = r / 100 / (pPeriod === 'monthly' ? 1 : pPeriod === 'daily' ? 1/30 : pPeriod === 'weekly' ? 7/30 : 1/12)
      perAmt = monthlyRate === 0 ? p / instCount : (p * monthlyRate * Math.pow(1 + monthlyRate, instCount)) / (Math.pow(1 + monthlyRate, instCount) - 1)
    }

    if (parseFloat(installmentAmt) > 0) {
      perAmt = parseFloat(installmentAmt)
    }

    const rows = []
    let remainingPrincipal = p
    let totalReceivedFromInstallments = 0
    let breakEvenPeriod = null

    // For Upfront, we've already received some "profit" but we are recovering the full "investmentCost"
    // However, to keep it consistent with "Principal First", we always recover the CONTRACT PRINCIPAL first.
    
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

      totalReceivedFromInstallments += payment

      rows.push({
        period: i,
        payment,
        principalPaid: prinPaid,
        interestPaid: intPaid,
        remainingPrincipal: Math.max(0, remainingPrincipal),
        isBreakEven: i === breakEvenPeriod
      })
    }

    const totalProfit = initialProfit + (totalReceivedFromInstallments - p)

    return { 
      rows, 
      totalReceived: initialProfit + totalReceivedFromInstallments, 
      breakEvenPeriod, 
      totalProfit,
      investmentCost,
      initialProfit
    }
  }, [principal, rate, installments, type, period, installmentAmt])

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>📉 วิเคราะห์และจำลองการคืนทุน</h2>
        <p>ตรวจสอบความคุ้มค่าและจุดคุ้มทุน (กฎ: ต้นหักหมดก่อนดอก)</p>
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
              <label className="form-label">เงินต้นในสัญญา (บาท)</label>
              <input className="form-input" type="number" value={principal} onChange={e => setPrincipal(e.target.value)} />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>อัตราดอกเบี้ย</label>
                <div className="segmented-control" style={{ width: 150 }}>
                  <button type="button" className={`segment-btn ${interestMode === 'percent' ? 'active' : ''}`} onClick={() => setInterestMode('percent')}>%</button>
                  <button type="button" className={`segment-btn ${interestMode === 'amount' ? 'active' : ''}`} onClick={() => setInterestMode('amount')}>บาท</button>
                  <button type="button" className={`segment-btn ${interestMode === 'total' ? 'active' : ''}`} onClick={() => setInterestMode('total')}>รวม</button>
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                {interestMode === 'percent' ? (
                  <>
                    <input className="form-input" type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value)} style={{ paddingRight: 36 }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>%</span>
                  </>
                ) : interestMode === 'amount' ? (
                  <>
                    <input className="form-input" type="number" step="0.01" value={interestAmount} onChange={e => setInterestAmount(e.target.value)} style={{ paddingRight: 36 }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>฿</span>
                  </>
                ) : (
                  <>
                    <input className="form-input" type="number" step="0.01" value={totalRepayInput} onChange={e => setTotalRepayInput(e.target.value)} style={{ paddingRight: 36 }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>฿</span>
                  </>
                )}
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>ระยะเวลาดอกเบี้ย</label>
              <select className="form-select" value={period} onChange={e => setPeriod(e.target.value)}>
                {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{type === 'bullet' ? 'จำนวนวันทั้งหมด' : 'จำนวนงวดที่ต้องการจำลอง'}</label>
              <input className="form-input" type="number" value={installments} onChange={e => setInstallments(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">ปรับแต่งยอดส่งต่องวด (ถ้ามี)</label>
              <input className="form-input" type="number" placeholder="คำนวณให้อัตโนมัติ" value={installmentAmt} onChange={e => setInstallmentAmt(e.target.value)} />
            </div>

            {analysis && (
              <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>📊 สรุปผลวิเคราะห์</div>
                {type === 'upfront' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>เงินที่ควักออกจริง:</span>
                    <span style={{ fontWeight: 700, color: 'var(--info)' }}>{formatBaht(analysis.investmentCost)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>จุดคืนทุน:</span>
                  <span style={{ fontWeight: 700, color: 'var(--success)' }}>งวดที่ {analysis.breakEvenPeriod || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>ยอดรับรวมทั้งหมด:</span>
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
                <div className="section-title-main">📋 ตารางคำนวณรายงวด (ต้นหักหมดก่อนดอก)</div>
                <div className="section-subtitle">จำลองกระแสเงินสดเพื่อหาจุดคุ้มทุนที่แท้จริง</div>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>งวดที่</th>
                    <th>ยอดรับ</th>
                    <th>หักเงินต้น</th>
                    <th>นับเป็นดอกเบี้ย</th>
                    <th>ต้นคงเหลือ</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {type === 'upfront' && analysis && (
                    <tr style={{ background: 'rgba(212, 175, 55, 0.05)' }}>
                      <td style={{ color: 'var(--text-muted)' }}>0</td>
                      <td className="td-amount">{formatBaht(analysis.initialProfit)}</td>
                      <td>-</td>
                      <td style={{ color: 'var(--gold)' }}>{formatBaht(analysis.initialProfit)}</td>
                      <td>{formatBaht(parseFloat(principal))}</td>
                      <td><span className="badge badge-gold">💰 ดอกหน้า</span></td>
                    </tr>
                  )}
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
                          <span className="badge badge-warning" style={{ opacity: 0.8 }}>⏳ ตามทุน</span>
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
