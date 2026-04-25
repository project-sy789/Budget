import { useState, useMemo } from 'react'
import { format, parseISO, isAfter, isToday, differenceInDays } from 'date-fns'
import { th } from 'date-fns/locale'
import type { Loan, Payment } from '../lib/supabase'
import { useStore } from '../store/useStore'
import { formatBaht } from '../lib/formatters'
import { calcDailyFlat } from '../lib/calculations'

interface Props {
  loan: Loan
  payments: Payment[]
}

export default function DailyCheckin({ loan, payments }: Props) {
  const { addPayment } = useStore()
  const [savingDate, setSavingDate] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const startDate = parseISO(loan.start_date)
  const dueDate = parseISO(loan.due_date)
  
  // Calculate default daily amount
  const dailyInfo = calcDailyFlat(loan.principal, loan.interest_rate, loan.interest_period, 1)
  const defaultDailyAmt = loan.installment_amount || (dailyInfo.dailyInterest > 0 ? dailyInfo.dailyInterest : 0)

  const daysData = useMemo(() => {
    const data = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    let curr = new Date(startDate)
    curr.setHours(0, 0, 0, 0)
    const end = new Date(dueDate)
    end.setHours(0, 0, 0, 0)
    
    let lastMonth = -1
    let count = 0
    while (curr <= end && count < 366) {
      const month = curr.getMonth()
      if (month !== lastMonth) {
        data.push({ isMonthHeader: true, label: format(curr, 'MMMM', { locale: th }), id: `m-${month}-${curr.getFullYear()}` })
        lastMonth = month
      }
      
      const dateStr = format(curr, 'yyyy-MM-dd')
      const dayPayments = payments.filter(p => p.payment_date === dateStr)
      const isFuture = isAfter(curr, today)
      
      let symbol = ''
      if (dayPayments.length > 0) {
        symbol = '✅'.repeat(dayPayments.length)
      } else if (!isFuture) {
        symbol = '📍'
      }

      data.push({
        day: curr.getDate(),
        date: new Date(curr),
        dateStr,
        payments: dayPayments,
        symbol,
        isFuture,
        isMonthHeader: false,
        id: dateStr
      })
      
      curr.setDate(curr.getDate() + 1)
      count++
    }
    return data
  }, [startDate, dueDate, payments])

  const handleQuickPay = async (dateStr: string, hasPayments: boolean) => {
    if (hasPayments) {
      // If already paid, maybe don't do anything or show a message
      return
    }
    if (defaultDailyAmt <= 0) {
      alert('ไม่สามารถเพิ่มอัตโนมัติได้ เนื่องจากไม่พบยอดส่งรายวันที่ชัดเจน')
      return
    }
    
    if (!confirm(`บันทึกชำระเงินสด ${formatBaht(defaultDailyAmt)} สำหรับวันที่ ${format(parseISO(dateStr), 'd MMM', { locale: th })} ใช่หรือไม่?`)) return
    
    setSavingDate(dateStr)
    
    let interestPaid = 0
    let principalPaid = 0

    // Intelligent split based on loan type and duration
    const dailyRateVal = (rate: number, period: string) => {
      switch (period) {
        case 'daily': return rate / 100
        case 'weekly': return rate / 100 / 7
        case 'monthly': return rate / 100 / 30
        case 'yearly': return rate / 100 / 365
        default: return rate / 100 / 30
      }
    }
    
    const dRate = dailyRateVal(loan.interest_rate, loan.interest_period)

    if (loan.due_date && loan.start_date) {
      // Calculate total term in days
      const totalDays = Math.max(differenceInDays(parseISO(loan.due_date), parseISO(loan.start_date)), 1)
      const totalInterest = loan.principal * dRate * totalDays
      const totalRepay = loan.principal + totalInterest
      
      // If we are paying a fixed amount, split it by the ratio of principal to total repay
      const ratio = loan.principal / totalRepay
      principalPaid = defaultDailyAmt * ratio
      interestPaid = defaultDailyAmt - principalPaid
    } else if (['weekly', 'monthly', 'reducing'].includes(loan.loan_type) && loan.installments) {
      const daysCount = loan.loan_type === 'weekly' ? loan.installments * 7 : loan.installments * 30
      const totalInterest = loan.principal * dRate * daysCount
      const totalRepay = loan.principal + totalInterest
      const ratio = loan.principal / totalRepay
      
      principalPaid = defaultDailyAmt * ratio
      interestPaid = defaultDailyAmt - principalPaid
    } else {
      // For daily/flat loans without a fixed term, cover interest first, then principal
      interestPaid = Math.min(dailyInfo.dailyInterest, defaultDailyAmt)
      principalPaid = Math.max(defaultDailyAmt - dailyInfo.dailyInterest, 0)
    }

    await addPayment({
      loan_id: loan.id,
      payment_date: dateStr,
      amount: defaultDailyAmt,
      interest_paid: Number(interestPaid.toFixed(2)),
      principal_paid: Number(principalPaid.toFixed(2)),
      payment_method: 'cash',
      receipt_no: '',
      notes: 'Quick Check-in'
    })
    setSavingDate(null)
  }

  const generateReportText = () => {
    const startMonthName = format(startDate, 'MMMM', { locale: th })
    
    let text = `🌳ต้น ${loan.principal.toLocaleString()}🌳  ${format(startDate, 'd')} ${startMonthName} พ.ศ.${startDate.getFullYear() + 543}\n\n`
    if (defaultDailyAmt > 0) {
      text += `  🌼${defaultDailyAmt.toLocaleString()}/วัน🌼\n`
    }
    text += `.........................................\n\n`
    
    daysData.forEach(d => {
      if (d.isMonthHeader) {
        text += `\n${d.label}\n`
      } else {
        text += `${d.day}${d.symbol || ''}\n`
      }
    })
    
    text += `\nรวมยอด ${loan.principal.toLocaleString()} 💸\n\n`
    text += `🕑ส่งยอด20.30น.`
    
    return text
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(generateReportText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>📅 ตารางส่งยอด (LINE Report)</div>
          <button onClick={handleCopy} className="btn btn-primary btn-sm">
            {copied ? '✅ คัดลอกแล้ว' : '📋 คัดลอกข้อความส่ง LINE'}
          </button>
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {daysData.map(d => {
            if (d.isMonthHeader) {
              return (
                <div key={d.id} style={{ width: '100%', padding: '12px 0 8px', fontWeight: 700, fontSize: '1rem', borderBottom: '1px solid var(--border)', marginBottom: 8, color: 'var(--gold)' }}>
                  {d.label}
                </div>
              )
            }
            
            const isTodayDate = isToday(d.date!)
            const isSaving = savingDate === d.dateStr
            
            return (
              <button
                key={d.id}
                onClick={() => !d.isFuture && handleQuickPay(d.dateStr!, d.payments!.length > 0)}
                disabled={d.isFuture || isSaving}
                style={{
                  width: 'calc(14.28% - 7px)', // 7 items per row
                  minWidth: '40px',
                  height: '56px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: d.payments!.length > 0 ? 'var(--success-bg)' : isTodayDate ? 'var(--gold-glow)' : 'var(--bg-secondary)',
                  border: `1px solid ${isTodayDate ? 'var(--gold)' : 'var(--border)'}`,
                  borderRadius: 8,
                  cursor: d.isFuture ? 'default' : 'pointer',
                  opacity: d.isFuture ? 0.5 : 1,
                  transition: '0.2s',
                  padding: 4
                }}
              >
                <div style={{ fontSize: '0.8rem', color: isTodayDate ? 'var(--gold)' : 'var(--text-secondary)' }}>
                  {d.day}
                </div>
                <div style={{ fontSize: '1.1rem', marginTop: 2 }}>
                  {isSaving ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : d.symbol}
                </div>
              </button>
            )
          })}
        </div>
        
        <div style={{ marginTop: 16, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <p>💡 <b>วิธีใช้:</b> กดที่วันที่เพื่อบันทึกการส่งยอด ({formatBaht(defaultDailyAmt)}) อัตโนมัติ</p>
          <p>📍 = รอส่ง/ว่าง, ✅ = ส่งยอดแล้ว</p>
        </div>
      </div>
      
      {/* Text Preview */}
      <div className="card">
        <div className="section-title">📝 ตัวอย่างข้อความที่จะส่ง</div>
        <pre style={{ 
          background: 'var(--bg-secondary)', 
          padding: 16, 
          borderRadius: 8, 
          border: '1px solid var(--border)',
          whiteSpace: 'pre-wrap',
          fontFamily: 'inherit',
          fontSize: '0.9rem',
          lineHeight: 1.5
        }}>
          {generateReportText()}
        </pre>
      </div>
    </div>
  )
}
