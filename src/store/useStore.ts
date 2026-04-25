import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Loan, Payment } from '../lib/supabase'

interface AppState {
  theme: 'dark' | 'light'
  loans: Loan[]
  payments: Payment[]
  loading: boolean
  toggleTheme: () => void
  fetchLoans: () => Promise<void>
  fetchPayments: (loanId?: string) => Promise<void>
  addLoan: (loan: Omit<Loan, 'id' | 'created_at'>) => Promise<Loan | null>
  updateLoan: (id: string, updates: Partial<Loan>) => Promise<void>
  deleteLoan: (id: string) => Promise<void>
  addPayment: (payment: Omit<Payment, 'id' | 'created_at'>) => Promise<void>
  deletePayment: (id: string) => Promise<void>
  restructureLoan: (oldLoanId: string, data: {
    closing_amount: number,
    closing_date: string,
    new_principal: number,
    new_loan_type: string,
    new_interest_rate: number,
    new_installments: number,
    new_installment_amount: number,
    new_due_date: string
  }) => Promise<void>
  subscribeToAll: () => () => void
}

export const useStore = create<AppState>((set) => ({
  theme: (localStorage.getItem('theme') as 'dark' | 'light') || 'dark',
  loans: [],
  payments: [],
  loading: false,

  toggleTheme: () => set(s => {
    const newTheme = s.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', newTheme)
    if (newTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    return { theme: newTheme }
  }),

  fetchLoans: async () => {
    set({ loading: true })
    const { data } = await supabase
      .from('loans')
      .select('*')
      .order('created_at', { ascending: false })
    set({ loans: data || [], loading: false })
  },

  fetchPayments: async (loanId?: string) => {
    let query = supabase.from('payments').select('*').order('payment_date', { ascending: false })
    if (loanId) query = query.eq('loan_id', loanId)
    const { data } = await query
    set({ payments: data || [] })
  },

  addLoan: async (loan) => {
    const { data, error } = await supabase.from('loans').insert([loan]).select().single()
    if (error || !data) return null
    set(s => ({ loans: [data, ...s.loans] }))
    return data
  },

  updateLoan: async (id, updates) => {
    const { data } = await supabase.from('loans').update(updates).eq('id', id).select().single()
    if (data) set(s => ({ loans: s.loans.map(l => l.id === id ? data : l) }))
  },

  deleteLoan: async (id) => {
    await supabase.from('loans').delete().eq('id', id)
    set(s => ({ loans: s.loans.filter(l => l.id !== id) }))
  },

  addPayment: async (payment) => {
    const { data } = await supabase.from('payments').insert([payment]).select().single()
    if (data) set(s => ({ payments: [data, ...s.payments] }))
  },

  deletePayment: async (id) => {
    await supabase.from('payments').delete().eq('id', id)
    set(s => ({ payments: s.payments.filter(p => p.id !== id) }))
  },
  
  restructureLoan: async (oldId, data) => {
    const { loans } = useStore.getState()
    const oldLoan = loans.find(l => l.id === oldId)
    if (!oldLoan) return

    // 1. Record closing payment for old loan
    if (data.closing_amount > 0) {
      await supabase.from('payments').insert([{
        loan_id: oldId,
        amount: data.closing_amount,
        payment_date: data.closing_date,
        payment_method: 'transfer',
        notes: 'ปิดยอดเพื่อปรับโครงสร้าง/เปิดใหม่'
      }])
    }

    // 2. Mark old loan as restructured
    await supabase.from('loans').update({ status: 'restructured' }).eq('id', oldId)

    // 3. Create new loan
    const newLoan = {
      borrower_name: oldLoan.borrower_name,
      borrower_phone: oldLoan.borrower_phone,
      borrower_address: oldLoan.borrower_address,
      borrower_id_card: oldLoan.borrower_id_card,
      agent_name: oldLoan.agent_name,
      principal: data.new_principal,
      loan_type: data.new_loan_type as any,
      interest_rate: data.new_interest_rate,
      interest_period: 'daily',
      installments: data.new_installments,
      installment_amount: data.new_installment_amount,
      start_date: data.closing_date,
      due_date: data.new_due_date,
      status: 'active',
      collateral: oldLoan.collateral,
      guarantor_name: oldLoan.guarantor_name,
      notes: `ปรับโครงสร้างมาจากยอดเดิม (${oldLoan.borrower_name})`
    }

    await supabase.from('loans').insert([newLoan])
    
    // Refresh local state
    const { fetchLoans, fetchPayments } = useStore.getState()
    await fetchLoans()
    await fetchPayments()
  },

  subscribeToAll: () => {
    const loanSub = supabase
      .channel('loans-realtime')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'loans' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          set(s => {
            const exists = s.loans.some(l => l.id === payload.new.id)
            if (exists) return s
            return { loans: [payload.new as Loan, ...s.loans] }
          })
        } else if (payload.eventType === 'UPDATE') {
          set(s => ({ loans: s.loans.map(l => l.id === payload.new.id ? payload.new as Loan : l) }))
        } else if (payload.eventType === 'DELETE') {
          set(s => ({ loans: s.loans.filter(l => l.id !== payload.old.id) }))
        }
      })
      .subscribe()

    const paymentSub = supabase
      .channel('payments-realtime')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'payments' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          set(s => {
            const exists = s.payments.some(p => p.id === payload.new.id)
            if (exists) return s
            return { payments: [payload.new as Payment, ...s.payments] }
          })
        } else if (payload.eventType === 'DELETE') {
          set(s => ({ payments: s.payments.filter(p => p.id !== payload.old.id) }))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(loanSub)
      supabase.removeChannel(paymentSub)
    }
  },
}))
