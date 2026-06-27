'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'

export default function Home() {
  const router = useRouter()
  const { setAuth, accessToken } = useAuthStore()

  useEffect(() => {
    if (accessToken) {
      router.replace('/game')
      return
    }
    api.post('/api/auth/refresh')
      .then(async ({ data }) => {
        const { data: user } = await api.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        })
        setAuth(data.accessToken, user)
        if (user.role === 'ADMIN') router.replace('/admin/dashboard')
        else if (user.status === 'PENDING') router.replace('/pending')
        else router.replace('/game')
      })
      .catch(() => router.replace('/login'))
  }, [])

  return (
    <div className="void-grid min-h-screen flex items-center justify-center">
      <div className="font-orbitron text-2xl neon-text-gold animate-pulse">
        VOID PROTOCOL
      </div>
    </div>
  )
}
