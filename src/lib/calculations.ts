import { differenceInDays, parseISO } from 'date-fns'

export interface AmortRow {
  period: number
  date: string
  payment: number
  principal: number
  interest: number
  balance: number
}

// ---------- helpers ----------
function addDays(dateStr: string, days: number): string {
  const d = parseISO(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
function addWeeks(dateStr: string, weeks: number): string {
  return addDays(dateStr, weeks * 7)
}
function addMonths(dateStr: string, months: number): string {
  const d = parseISO(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

/** Daily outstanding interest up to today */
export function calcDailyInterestToDate(
  principal: number,
  ratePercent: number, // % per period
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  startDate: string,
  paidPrincipal = 0,
): number {
  const daysElapsed = differenceInDays(new Date(), parseISO(startDate))
  if (daysElapsed <= 0) return 0
  const dailyRate = toDaily(ratePercent, period)
  return (principal - paidPrincipal) * dailyRate * daysElapsed
}

function toDaily(rate: number, period: string): number {
  switch (period) {
    case 'daily':   return rate / 100
    case 'weekly':  return rate / 100 / 7
    case 'monthly': return rate / 100 / 30
    case 'yearly':  return rate / 100 / 365
    default:        return rate / 100 / 30
  }
}

// ---------- Loan type calculations ----------

/** ดอกรายวัน: interest accrues daily on remaining principal, free-form payments */
export function calcDailyFlat(
  principal: number,
  ratePercent: number,
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  days: number,
): { totalInterest: number; totalRepay: number; dailyInterest: number } {
  const dailyRate = toDaily(ratePercent, period)
  const dailyInterest = principal * dailyRate
  const totalInterest = dailyInterest * days
  return { totalInterest, totalRepay: principal + totalInterest, dailyInterest }
}

/** ดอกหน้า (Upfront): interest deducted at start, borrower receives less */
export function calcUpfront(
  principal: number,
  ratePercent: number,
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  days: number,
): { upfrontInterest: number; received: number; totalRepay: number } {
  const dailyRate = toDaily(ratePercent, period)
  const upfrontInterest = principal * dailyRate * days
  return {
    upfrontInterest,
    received: principal - upfrontInterest,
    totalRepay: principal,
  }
}

/** เงินก้อน+ดอก (Bullet): pay everything at end */
export function calcBullet(
  principal: number,
  ratePercent: number,
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  days: number,
): { totalInterest: number; totalRepay: number } {
  const dailyRate = toDaily(ratePercent, period)
  const totalInterest = principal * dailyRate * days
  return { totalInterest, totalRepay: principal + totalInterest }
}

/** ผ่อนรายอาทิตย์ flat-rate (installments weekly) */
export function calcWeeklyInstallment(
  principal: number,
  ratePercent: number, // rate per period (usually % per week)
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  installments: number,
  startDate: string,
): AmortRow[] {
  const weeklyRate = period === 'weekly' ? ratePercent / 100
    : period === 'daily' ? ratePercent / 100 * 7
    : period === 'monthly' ? ratePercent / 100 / 4.33
    : ratePercent / 100 / 52
  const totalInterest = principal * weeklyRate * installments
  const totalRepay = principal + totalInterest
  const payment = totalRepay / installments
  const principalPerPeriod = principal / installments
  const interestPerPeriod = totalInterest / installments
  const rows: AmortRow[] = []
  let balance = principal
  for (let i = 1; i <= installments; i++) {
    balance -= principalPerPeriod
    rows.push({
      period: i,
      date: addWeeks(startDate, i),
      payment: Math.round(payment * 100) / 100,
      principal: Math.round(principalPerPeriod * 100) / 100,
      interest: Math.round(interestPerPeriod * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    })
  }
  return rows
}

/** ผ่อนรายเดือน flat-rate */
export function calcMonthlyInstallment(
  principal: number,
  ratePercent: number,
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  installments: number,
  startDate: string,
): AmortRow[] {
  const monthlyRate = period === 'monthly' ? ratePercent / 100
    : period === 'daily' ? ratePercent / 100 * 30
    : period === 'weekly' ? ratePercent / 100 * 4.33
    : ratePercent / 100 / 12
  const totalInterest = principal * monthlyRate * installments
  const totalRepay = principal + totalInterest
  const payment = totalRepay / installments
  const principalPerPeriod = principal / installments
  const interestPerPeriod = totalInterest / installments
  const rows: AmortRow[] = []
  let balance = principal
  for (let i = 1; i <= installments; i++) {
    balance -= principalPerPeriod
    rows.push({
      period: i,
      date: addMonths(startDate, i),
      payment: Math.round(payment * 100) / 100,
      principal: Math.round(principalPerPeriod * 100) / 100,
      interest: Math.round(interestPerPeriod * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    })
  }
  return rows
}

/** ลดต้นลดดอก (Reducing Balance) monthly */
export function calcReducing(
  principal: number,
  ratePercent: number,
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  installments: number,
  startDate: string,
): AmortRow[] {
  const monthlyRate = period === 'monthly' ? ratePercent / 100
    : period === 'daily' ? ratePercent / 100 * 30
    : period === 'weekly' ? ratePercent / 100 * 4.33
    : ratePercent / 100 / 12
  const r = monthlyRate
  const n = installments
  const payment = r === 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  const rows: AmortRow[] = []
  let balance = principal
  for (let i = 1; i <= n; i++) {
    const interest = balance * r
    const prin = payment - interest
    balance -= prin
    rows.push({
      period: i,
      date: addMonths(startDate, i),
      payment: Math.round(payment * 100) / 100,
      principal: Math.round(prin * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      balance: Math.round(Math.max(balance, 0) * 100) / 100,
    })
  }
  return rows
}

/** Remaining balance after payments */
export function calcRemainingBalance(principal: number, paidPrincipal: number): number {
  return Math.max(principal - paidPrincipal, 0)
}

/** Expected interest for a date range */
export function calcInterestForRange(
  principal: number,
  ratePercent: number,
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  days: number,
): number {
  const dailyRate = toDaily(ratePercent, period)
  return principal * dailyRate * days
}

/** Unified accrued interest calculation for the whole app */
export function calcAccruedInterest(
  loanType: string,
  principal: number,
  rate: number,
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  startDate: string,
  dueDate: string,
  includeFirstDay = true
): number {
  const start = parseISO(startDate)
  const due = parseISO(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  if (loanType === 'bullet' || loanType === 'upfront') {
    // Fixed amount for the contract period
    const contractDays = Math.max(1, differenceInDays(due, start) + (includeFirstDay ? 1 : 0))
    const dailyRate = toDaily(rate, period)
    return principal * dailyRate * contractDays
  } else {
    // Accumulates daily until today
    const daysElapsed = Math.max(0, differenceInDays(today, start))
    const dailyRate = toDaily(rate, period)
    return principal * dailyRate * daysElapsed
  }
}
