'use client'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getSocket, disconnectSocket } from '@/lib/socket'
import { Socket } from 'socket.io-client'

export function useSocket(): { socket: Socket | null; connected: boolean } {
  const accessToken = useAuthStore((s) => s.accessToken)
  const [connected, setConnected] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    if (!accessToken) return

    const s = getSocket(accessToken)
    s.connect()
    setSocket(s)

    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))

    return () => {
      s.off('connect')
      s.off('disconnect')
    }
  }, [accessToken])

  return { socket, connected }
}
