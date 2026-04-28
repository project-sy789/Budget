import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  loans: Loan
  payments: Payment
  agents: Agent
}

export interface Agent {
  id: string
  name: string
  created_at: string
}

export interface Loan {
  id: string
  borrower_name: string
  borrower_phone: string
  borrower_address: string
  borrower_id_card: string
  loan_type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'upfront' | 'bullet' | 'reducing'
  principal: number
  interest_rate: number
  interest_period: 'daily' | 'weekly' | 'monthly' | 'yearly'
  start_date: string
  due_date: string
  installments: number | null
  installment_amount: number | null
  include_first_day: boolean
  collateral: string
  guarantor_name: string
  status: 'active' | 'closed' | 'overdue' | 'restructured'
  agent_name: string
  notes: string
  created_at: string
}

export interface Payment {
  id: string
  loan_id: string
  payment_date: string
  amount: number
  principal_paid: number
  interest_paid: number
  payment_method: 'cash' | 'transfer' | 'other'
  receipt_no: string
  notes: string
  created_at: string
}
