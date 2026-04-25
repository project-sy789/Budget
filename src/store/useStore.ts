import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Loan, Payment } from '../lib/supabase'

interface AppState {
  loans: Loan[]
  payments: Payment[]
  loading: boolean
  fetchLoans: () => Promise<void>
  fetchPayments: (loanId?: string) => Promise<void>
  addLoan: (loan: Omit<Loan, 'id' | 'created_at'>) => Promise<Loan | null>
  updateLoan: (id: string, updates: Partial<Loan>) => Promise<void>
  deleteLoan: (id: string) => Promise<void>
  addPayment: (payment: Omit<Payment, 'id' | 'created_at'>) => Promise<void>
  deletePayment: (id: string) => Promise<void>
  subscribeToAll: () => () => void
}

export const useStore = create<AppState>((set) => ({
  loans: [],
  payments: [],
  loading: false,

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

  subscribeToAll: () => {
    const loanSub = supabase
      .channel('loans-realtime')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'loans' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          set(s => ({ loans: [payload.new as Loan, ...s.loans] }))
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
          set(s => ({ payments: [payload.new as Payment, ...s.payments] }))
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
