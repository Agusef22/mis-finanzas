// Tipos compartidos de la DB. Si agregás tablas nuevas, actualizalos a mano.
// (Para autogeneración, correr `supabase gen types typescript --local > types/supabase.ts`)

export type Currency = 'ARS' | 'USD' | 'EUR' | 'BRL' | 'CLP' | 'UYU' | string

export type AccountType = 'cash' | 'bank' | 'credit_card' | 'savings' | 'investment' | 'wallet' | 'other'
export type CategoryKind = 'expense' | 'income' | 'both'
export type TransactionType = 'expense' | 'income' | 'transfer'
export type TransactionSource = 'manual' | 'whatsapp' | 'telegram' | 'import' | 'recurring' | 'api'
export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly'
export type ChatProvider = 'whatsapp' | 'telegram'
export type RateType = 'oficial' | 'blue' | 'mep' | 'ccl' | 'tarjeta' | 'mayorista'

export interface Profile {
  id: string
  display_name: string | null
  default_currency: Currency
  default_rate_type: RateType
  locale: string
  created_at: string
  updated_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  currency: Currency
  initial_balance: number
  icon: string | null
  color: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface AccountBalance {
  account_id: string
  user_id: string
  name: string
  currency: Currency
  type: AccountType
  initial_balance: number
  balance: number
}

export interface Category {
  id: string
  user_id: string
  parent_id: string | null
  name: string
  icon: string | null
  color: string | null
  kind: CategoryKind
  is_system: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  type: TransactionType
  amount: number
  currency: Currency
  exchange_rate_to_ars: number | null
  occurred_at: string
  description: string | null
  notes: string | null
  source: TransactionSource
  source_metadata: Record<string, unknown> | null
  client_uuid: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface TransactionWithRelations extends Transaction {
  account?: Account | null
  category?: Category | null
}

export interface Budget {
  id: string
  user_id: string
  category_id: string | null
  name: string | null
  period: BudgetPeriod
  amount: number
  currency: Currency
  starts_at: string
  ends_at: string | null
}

export interface ExchangeRate {
  date: string
  from_currency: Currency
  to_currency: Currency
  rate_type: RateType
  rate: number
  fetched_at: string
}

export interface ChatIdentity {
  id: string
  user_id: string
  provider: ChatProvider
  external_id: string
  display_name: string | null
  is_active: boolean
  linked_at: string
  last_message_at: string | null
}

export interface MonthlyCategorySummary {
  user_id: string
  month: string
  category_id: string | null
  category_name: string | null
  category_icon: string | null
  category_color: string | null
  type: 'expense' | 'income'
  currency: Currency
  total: number
  count: number
}
