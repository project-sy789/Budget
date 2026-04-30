import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Loan, Payment, Agent } from '../lib/supabase'
import { calcAccruedInterest } from '../lib/calculations'

interface AppState {
  theme: 'dark' | 'light'
  loans: Loan[]
  payments: Payment[]
  agents: Agent[]
  loading: boolean
  toggleTheme: () => void
  fetchLoans: () => Promise<void>
  fetchPayments: (loanId?: string) => Promise<void>
  fetchAgents: () => Promise<void>
  addLoan: (loan: Omit<Loan, 'id' | 'created_at'>) => Promise<Loan | null>
  updateLoan: (id: string, updates: Partial<Loan>) => Promise<void>
  deleteLoan: (id: string) => Promise<void>
  addPayment: (payment: Omit<Payment, 'id' | 'created_at'>) => Promise<void>
  deletePayment: (id: string) => Promise<void>
  addAgent: (name: string) => Promise<Agent | null>
  updateAgent: (id: string, name: string) => Promise<void>
  deleteAgent: (id: string) => Promise<void>
  restructureLoan: (oldLoanId: string, data: {
    closing_amount: number,
    closing_date: string,
    new_principal: number,
    new_loan_type: string,
    new_interest_rate: number,
    new_installments: number | null,
    new_installment_amount: number | null,
    new_due_date: string,
    new_interest_period?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  }) => Promise<void>
  subscribeToAll: () => () => void
}

export const useStore = create<AppState>((set) => ({
  theme: (localStorage.getItem('theme') as 'dark' | 'light') || 'dark',
  loans: [],
  payments: [],
  agents: [],
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
    
    if (data) {
      set({ loans: data, loading: false })
      // Proactively check for loans that should be closed but aren't
      // This heals data that was paid before auto-close logic was added
      const { payments } = useStore.getState()
      if (payments.length > 0) {
        data.forEach(async (l) => {
          const loanPayments = payments.filter(p => p.loan_id === l.id)
          const paidPrincipal = loanPayments.reduce((s, p) => s + (p.principal_paid || 0), 0)
          const paidInterest = loanPayments.reduce((s, p) => s + (p.interest_paid || 0), 0)
          const accruedInt = calcAccruedInterest(l.loan_type, l.principal, l.interest_rate, l.interest_period, l.start_date, l.due_date, l.include_first_day, loanPayments)

          if (l.status === 'active' || l.status === 'overdue') {
            // จบยอดคือจ่ายครบต้นดอก (Allow 1 baht rounding error)
            if (paidPrincipal >= l.principal && paidInterest >= (accruedInt - 1) && l.principal > 0) {
              await supabase.from('loans').update({ status: 'closed' }).eq('id', l.id)
              set(s => ({ loans: s.loans.map(loan => loan.id === l.id ? { ...loan, status: 'closed' } : loan) }))
            }
          } else if (l.status === 'closed') {
            // Re-open ONLY if principal is missing. 
            // We trust the 'closed' status for interest because interest stops on the day of closing.
            if (paidPrincipal < l.principal && l.principal > 0) {
              await supabase.from('loans').update({ status: 'active' }).eq('id', l.id)
              set(s => ({ loans: s.loans.map(loan => loan.id === l.id ? { ...loan, status: 'active' } : loan) }))
            }
          }
        })
      }
    } else {
      set({ loading: false })
    }
  },

  fetchPayments: async (loanId?: string) => {
    let query = supabase.from('payments').select('*').order('payment_date', { ascending: false })
    if (loanId) query = query.eq('loan_id', loanId)
    const { data } = await query
    set({ payments: data || [] })
  },

  fetchAgents: async () => {
    const { data } = await supabase.from('agents').select('*').order('name')
    set({ agents: data || [] })
  },

  addAgent: async (name) => {
    const { data } = await supabase.from('agents').insert([{ name }]).select().single()
    if (data) set(s => ({ agents: [...s.agents, data].sort((a, b) => a.name.localeCompare(b.name)) }))
    return data
  },

  updateAgent: async (id, name) => {
    const { data } = await supabase.from('agents').update({ name }).eq('id', id).select().single()
    if (data) set(s => ({ agents: s.agents.map(a => a.id === id ? data : a) }))
  },

  deleteAgent: async (id) => {
    await supabase.from('agents').delete().eq('id', id)
    set(s => ({ agents: s.agents.filter(a => a.id !== id) }))
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
    if (data) {
      set(s => ({ payments: [data, ...s.payments] }))
      
      // 🏁 Auto-close loan if principal + interest is fully paid
      const { loans, payments } = useStore.getState()
      const loan = loans.find(l => l.id === payment.loan_id)
      if (loan && (loan.status === 'active' || loan.status === 'overdue')) {
        const loanPayments = [data, ...payments.filter(p => p.loan_id === loan.id)]
        const paidPrincipal = loanPayments.reduce((s, p) => s + (p.principal_paid || 0), 0)
        const paidInterest = loanPayments.reduce((s, p) => s + (p.interest_paid || 0), 0)
        
        const accruedInt = calcAccruedInterest(loan.loan_type, loan.principal, loan.interest_rate, loan.interest_period, loan.start_date, loan.due_date, loan.include_first_day, loanPayments)

        // จบยอดคือจ่ายครบต้นดอก
        if (paidPrincipal >= loan.principal && paidInterest >= (accruedInt - 1)) {
          await supabase.from('loans').update({ status: 'closed' }).eq('id', loan.id)
          set(s => ({ loans: s.loans.map(l => l.id === loan.id ? { ...l, status: 'closed' } : l) }))
        }
      }
    }
  },

  deletePayment: async (id) => {
    await supabase.from('payments').delete().eq('id', id)
    set(s => ({ payments: s.payments.filter(p => p.id !== id) }))
  },
  
  restructureLoan: async (oldId, data) => {
    const { loans } = useStore.getState()
    const oldLoan = loans.find(l => l.id === oldId)
    if (!oldLoan) return

    // 1. Record closing payment for old loan (PRINCIPAL-FIRST to ensure closure)
    if (data.closing_amount > 0) {
      const loanPayments = payments.filter(p => p.loan_id === oldId)
      const paidPrincipalBefore = loanPayments.reduce((s, p) => s + (p.principal_paid || 0), 0)
      const neededPrincipal = Math.max(0, oldLoan.principal - paidPrincipalBefore)
      
      const pPaid = Math.min(data.closing_amount, neededPrincipal)
      const iPaid = Math.max(0, data.closing_amount - pPaid)

      await supabase.from('payments').insert([{
        loan_id: oldId,
        amount: data.closing_amount,
        payment_date: data.closing_date,
        principal_paid: pPaid,
        interest_paid: iPaid,
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
      interest_period: data.new_interest_period || 'daily',
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
    
    const agentSub = supabase
      .channel('agents-realtime')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'agents' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          set(s => ({ agents: [...s.agents, payload.new as Agent].sort((a, b) => a.name.localeCompare(b.name)) }))
        } else if (payload.eventType === 'UPDATE') {
          set(s => ({ agents: s.agents.map(a => a.id === payload.new.id ? payload.new as Agent : a) }))
        } else if (payload.eventType === 'DELETE') {
          set(s => ({ agents: s.agents.filter(a => a.id !== payload.old.id) }))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(loanSub)
      supabase.removeChannel(paymentSub)
      supabase.removeChannel(agentSub)
    }
  },
}))
