import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface Settings {
  event_name: string
  event_starts_at: string
  venue: string
  ticket_price: number
  capacity: number
  revenue_goal: number
  reminders_enabled: boolean
  org_name: string
  org_ein: string
  org_address: string | null
  receipt_signer_name: string
  receipt_signer_title: string | null
  tax_status_statement: string
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const reload = useCallback(async () => {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).single()
    setSettings(data as Settings)
  }, [])
  useEffect(() => {
    reload()
  }, [reload])
  return { settings, reload }
}
