'use client'
import { useEffect, useState } from 'react'
import { useSocket } from './useSocket'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'

export function useStats() {
  const { socket } = useSocket()
  const accessToken = useAuthStore((s) => s.accessToken)
  const [stats, setStats] = useState<{ online: number; totalBettors: number }>({ online: 0, totalBettors: 0 })

  useEffect(() => {
    if (!accessToken) return
    api.get('/api/game/stats').then(({ data }) => setStats(data)).catch(() => {})
  }, [accessToken])

  useEffect(() => {
    if (!socket) return
    const handler = (s: { online: number; totalBettors: number }) => setStats(s)
    socket.on('stats:update', handler)
    return () => { socket.off('stats:update', handler) }
  }, [socket])

  return stats
}
