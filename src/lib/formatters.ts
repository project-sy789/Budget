import { format, differenceInDays, parseISO, isAfter } from 'date-fns'
import { th } from 'date-fns/locale'

export function formatBaht(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(n: number, decimals = 2): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    return format(parseISO(dateStr), 'd MMM yyyy', { locale: th })
  } catch {
    return dateStr
  }
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    return format(parseISO(dateStr), 'dd/MM/yy')
  } catch {
    return dateStr
  }
}

export function daysDiff(from: string, to: string): number {
  try {
    return differenceInDays(parseISO(to), parseISO(from))
  } catch {
    return 0
  }
}

export function isOverdue(dueDateStr: string): boolean {
  try {
    return isAfter(new Date(), parseISO(dueDateStr))
  } catch {
    return false
  }
}

export function loanTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    daily: '📅 ดอกรายวัน',
    weekly: '📆 ผ่อนรายอาทิตย์',
    monthly: '🗓️ ผ่อนรายเดือน',
    upfront: '💸 ดอกหน้า',
    bullet: '💰 เงินก้อน+ดอก',
    reducing: '📉 ลดต้นลดดอก',
  }
  return labels[type] || type
}

export function loanTypeBadgeClass(type: string): string {
  const classes: Record<string, string> = {
    daily: 'badge-gold',
    weekly: 'badge-info',
    monthly: 'badge-success',
    upfront: 'badge-purple',
    bullet: 'badge-warning',
    reducing: 'badge-muted',
  }
  return classes[type] || 'badge-muted'
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'กำลังดำเนินการ',
    closed: 'ปิดบัญชีแล้ว',
    overdue: 'ค้างชำระ',
    restructured: 'ปรับโครงสร้างหนี้',
  }
  return labels[status] || status
}

export function statusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    active: 'badge-success',
    closed: 'badge-muted',
    overdue: 'badge-danger',
    restructured: 'badge-warning',
  }
  return classes[status] || 'badge-muted'
}

export function periodLabel(period: string): string {
  const labels: Record<string, string> = {
    daily: 'ต่อวัน',
    weekly: 'ต่ออาทิตย์',
    monthly: 'ต่อเดือน',
    yearly: 'ต่อปี',
  }
  return labels[period] || period
}
