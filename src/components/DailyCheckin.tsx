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
  const defaultDailyAmt = useMemo(() => {
    if (loan.loan_type === 'bullet') {
      const contractDays = Math.max(1, differenceInDays(dueDate, startDate) + (loan.include_first_day ? 1 : 0))
      // dailyInfo.dailyInterest is (principal * rate / 100 / period)
      return loan.principal + (dailyInfo.dailyInterest * contractDays)
    }
    return loan.installment_amount || (dailyInfo.dailyInterest > 0 ? dailyInfo.dailyInterest : 0)
  }, [loan, dailyInfo, startDate, dueDate])

  const daysData = useMemo(() => {
    const data = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    let curr = new Date(startDate)
    curr.setHours(0, 0, 0, 0)
    const contractualEnd = new Date(dueDate)
    contractualEnd.setHours(0, 0, 0, 0)
    
    // Show up to today only if the loan is NOT closed
    const isClosed = loan.status === 'closed'
    const displayEnd = (!isClosed && isAfter(today, contractualEnd)) ? today : contractualEnd
    displayEnd.setHours(0, 0, 0, 0)
    
    let lastMonth = -1
    let count = 0
    while (curr <= displayEnd && count < 366) {
      const month = curr.getMonth()
      if (month !== lastMonth) {
        data.push({ isMonthHeader: true, label: format(curr, 'MMMM', { locale: th }), id: `m-${month}-${curr.getFullYear()}` })
        lastMonth = month
      }
      
      const dateStr = format(curr, 'yyyy-MM-dd')
      const dayPayments = payments.filter(p => p.payment_date === dateStr)
      const isPast = !isAfter(curr, today) && !isToday(curr)
      const isFuture = isAfter(curr, today)
      
      let symbol = ''
      if (dayPayments.length > 0) {
        symbol = '✅'.repeat(dayPayments.length)
      } else if (isPast) {
        symbol = '❌' // Use ❌ only for the report text
      }

      data.push({
        day: curr.getDate(),
        date: new Date(curr),
        dateStr,
        payments: dayPayments,
        symbol,
        isPast,
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
    if (hasPayments) return
    const totalPaidPrincipal = payments.reduce((s, p) => s + (p.principal_paid || 0), 0)
    const remainingPrincipal = Math.max(0, loan.principal - totalPaidPrincipal)
    // Calculate total interest owed based on loan type
    let totalOwedInterest = 0
    if (loan.loan_type === 'bullet' || loan.loan_type === 'upfront') {
      const contractDays = Math.max(1, differenceInDays(dueDate, startDate) + (loan.include_first_day ? 1 : 0))
      totalOwedInterest = loan.principal * (dailyInfo.dailyInterest / loan.principal) * contractDays
    } else {
      const daysElapsed = Math.max(0, differenceInDays(new Date(), startDate))
      totalOwedInterest = loan.principal * (dailyInfo.dailyInterest / loan.principal) * daysElapsed
    }

    const totalPaidInterest = payments.reduce((s, p) => s + (p.interest_paid || 0), 0)
    const outstandingInterest = Math.max(0, totalOwedInterest - totalPaidInterest)

    // For Bullet loans, always pay the full remaining balance
    const amountToPay = loan.loan_type === 'bullet' ? (remainingPrincipal + outstandingInterest) : defaultDailyAmt
    if (amountToPay <= 0) return

    if (!confirm(`บันทึกชำระเงินสด ${formatBaht(amountToPay)} สำหรับวันที่ ${format(parseISO(dateStr), 'd MMM', { locale: th })} ใช่หรือไม่?`)) return
    
    setSavingDate(dateStr)
    
    let interestPaid = 0
    let principalPaid = 0

    // INTEREST-FIRST ALLOCATION
    if (outstandingInterest > 0) {
      interestPaid = Math.min(amountToPay, outstandingInterest)
      principalPaid = Math.max(0, amountToPay - interestPaid)
    } else {
      interestPaid = 0
      principalPaid = amountToPay
    }

    await addPayment({
      loan_id: loan.id,
      payment_date: dateStr,
      amount: amountToPay,
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
    
    let text = `🌳ต้น ${loan.principal.toLocaleString()}🌳\n${format(startDate, 'd')} ${startMonthName} พ.ศ. ${startDate.getFullYear() + 543}\n\n`
    if (defaultDailyAmt > 0) {
      text += `  🌼${defaultDailyAmt.toLocaleString()}/วัน🌼\n`
    }
    text += `.........................................\n`
    
    daysData.forEach(d => {
      if (d.isMonthHeader) {
        text += `\n${d.label}\n`
      } else {
        text += `${d.day}${d.symbol || ''}\n`
      }
    })
    
    text += `\nรวมยอด ${loan.principal.toLocaleString()} 💸\n\n`
    text += `🕑ส่งยอด 20.30 น.`
    
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
            const hasPaid = d.payments!.length > 0
            
            // UI Background Logic
            let bgColor = 'var(--bg-secondary)'
            let borderColor = 'var(--border)'
            
            if (hasPaid) {
              bgColor = 'var(--success-bg)'
            } else if (isTodayDate) {
              bgColor = 'var(--gold-glow)'
              borderColor = 'var(--gold)'
            } else if (d.isPast) {
              bgColor = 'rgba(239, 68, 68, 0.1)' // Light red for missed days
              borderColor = 'rgba(239, 68, 68, 0.2)'
            }

            return (
              <button
                key={d.id}
                onClick={() => !d.isFuture && handleQuickPay(d.dateStr!, hasPaid)}
                disabled={d.isFuture || isSaving}
                style={{
                  width: 'calc(14.28% - 7px)', 
                  minWidth: '40px',
                  height: '56px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: bgColor,
                  border: `1px solid ${borderColor}`,
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
                  {isSaving ? (
                    <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  ) : (
                    d.symbol?.includes('✅') ? d.symbol : '' // Only show ✅ in UI, hide ❌
                  )}
                </div>
              </button>
            )
          })}
        </div>
        
        <div style={{ marginTop: 16, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <p>💡 <b>วิธีใช้:</b> กดที่วันที่เพื่อบันทึกการส่งยอด ({formatBaht(defaultDailyAmt)}) อัตโนมัติ</p>
          <p>✅ = ส่งยอดแล้ว</p>
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
