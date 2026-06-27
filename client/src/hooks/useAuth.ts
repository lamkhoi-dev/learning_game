'use client'
import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { User } from '@/types'

export function useAuth() {
  const { accessToken, user, setAuth, clearAuth } = useAuthStore()
  const hydrated = useRef(false)

  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    if (!accessToken) {
      api.post('/api/auth/refresh')
        .then(({ data }) => {
          api.get('/api/auth/me').then(({ data: userData }) => {
            setAuth(data.accessToken, userData as User)
          })
        })
        .catch(() => {})
    }
  }, [])

  return { accessToken, user, setAuth, clearAuth }
}
