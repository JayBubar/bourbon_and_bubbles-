import { useEffect, useState } from 'react'
import { supabase, type AllowedUser } from './supabase'

// The allowlist is tiny and rarely changes; share one fetch across components.
let cache: Promise<AllowedUser[]> | null = null

export function loadUsers(force = false): Promise<AllowedUser[]> {
  if (!cache || force) {
    cache = Promise.resolve(
      supabase
        .from('allowed_users')
        .select('*')
        .order('name')
        .then(({ data }) => (data as AllowedUser[]) ?? []),
    )
  }
  return cache
}

export function useUsers() {
  const [users, setUsers] = useState<AllowedUser[]>([])
  useEffect(() => {
    loadUsers().then(setUsers)
  }, [])
  return users
}

export function firstName(name: string | null | undefined) {
  return name ? name.split(' ')[0] : ''
}
