import { useState, useMemo } from 'react'
import { format, getDaysInMonth, startOfMonth, parseISO, isBefore, isAfter, isSameDay, addMonths, subMonths, isToday } from 'date-fns'
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
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))
  const [savingDate, setSavingDate] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const startDate = parseISO(loan.start_date)
  const daysInMonth = getDaysInMonth(currentMonth)
  
  // Calculate default daily amount (Interest for 'daily' loans, or just something else)
  // To keep it simple, we use calcDailyFlat to get daily interest.
  const dailyInfo = calcDailyFlat(loan.principal, loan.interest_rate, loan.interest_period, 1)
  const defaultDailyAmt = dailyInfo.dailyInterest > 0 ? dailyInfo.dailyInterest : 0

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  const daysData = useMemo(() => {
    const data = []
    const today = new Date()
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i)
      const dateStr = format(date, 'yyyy-MM-dd')
      
      const dayPayments = payments.filter(p => p.payment_date === dateStr)
      const isBeforeStart = isBefore(date, startOfMonth(startDate)) || (isSameDay(date, startDate) ? false : isBefore(date, startDate))
      const isFuture = isAfter(date, today) && !isSameDay(date, today)
      
      let symbol = ''
      if (dayPayments.length > 0) {
        symbol = '✅'.repeat(dayPayments.length)
      } else if (isBeforeStart) {
        symbol = '📍'
      } else if (!isFuture) {
        symbol = '📍'
      }

      data.push({
        day: i,
        date,
        dateStr,
        payments: dayPayments,
        symbol,
        isFuture,
        isBeforeStart
      })
    }
    return data
  }, [currentMonth, payments, startDate, daysInMonth])

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
    await addPayment({
      loan_id: loan.id,
      payment_date: dateStr,
      amount: defaultDailyAmt,
      interest_paid: defaultDailyAmt, // Assumes all goes to interest for daily loans
      principal_paid: 0,
      payment_method: 'cash',
      receipt_no: '',
      notes: 'Quick Check-in'
    })
    setSavingDate(null)
  }

  const generateReportText = () => {
    const startMonthName = format(startDate, 'MMMM', { locale: th })
    
    let text = `🌳ต้น ${loan.principal}🌳  ${format(startDate, 'd')} ${startMonthName} พ.ศ.${startDate.getFullYear() + 543}\n`
    if (defaultDailyAmt > 0) {
      text += `  🌼${defaultDailyAmt}/วัน🌼\n`
    }
    text += `.........................................\n\n`
    
    daysData.forEach(d => {
      text += `${d.day}${d.symbol}\n`
    })
    
    // Add next month header if needed (optional, keeping it simple for now)
    
    text += `\nรวมยอด ${loan.principal} 💸\n\n`
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
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, background: 'var(--bg-secondary)', padding: '8px 16px', borderRadius: 8 }}>
          <button onClick={handlePrevMonth} className="btn btn-secondary btn-sm btn-icon">◀</button>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
            {format(currentMonth, 'MMMM yyyy', { locale: th })}
          </div>
          <button onClick={handleNextMonth} className="btn btn-secondary btn-sm btn-icon">▶</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {/* We don't necessarily need a strict calendar grid, a simple list or flow is fine, 
              but a grid looks nice. Since it's just 1-31, a wrap flex or dense grid is best. */}
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {daysData.map(d => {
            const isTodayDate = isToday(d.date)
            const isSaving = savingDate === d.dateStr
            
            return (
              <button
                key={d.day}
                onClick={() => !d.isFuture && handleQuickPay(d.dateStr, d.payments.length > 0)}
                disabled={d.isFuture || isSaving}
                style={{
                  width: 'calc(14.28% - 7px)', // 7 items per row
                  minWidth: '40px',
                  height: '56px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: d.payments.length > 0 ? 'var(--success-bg)' : isTodayDate ? 'var(--gold-glow)' : 'var(--bg-secondary)',
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
          <p>📍 = ไม่มีรายการ/ยังไม่ส่ง, ✅ = ส่งยอดแล้ว</p>
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
