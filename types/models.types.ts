export interface Home {
  id: string
  name: string
  created_at: string
}

export interface Member {
  id: string
  name: string
  home_id: string
  created_at: string
}

export interface Bill {
  id: string
  home_id: string
  title: string
  total_cents: number
  created_at: string
}

export interface Share {
  id: string
  member_id: string
  bill_id: string
  paid_at: string
  amount_cents: number
  payment_key: string
}
