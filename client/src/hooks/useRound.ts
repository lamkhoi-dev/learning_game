'use client'
import { useEffect, useState } from 'react'
import { Round } from '@/types'
import { useSocket } from './useSocket'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'

export function useRound() {
  const { socket } = useSocket()
  const accessToken = useAuthStore((s) => s.accessToken)
  const [round, setRound] = useState<Round | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!accessToken) return // chờ khôi phục phiên xong mới gọi
    api.get('/api/game/round/current')
      .then(({ data }) => setRound(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [accessToken])

  useEffect(() => {
    if (!socket) return
    const handler = (r: Round) => setRound(r)
    socket.on('round:state', handler)
    return () => { socket.off('round:state', handler) }
  }, [socket])

  return { round, loading, setRound }
}
