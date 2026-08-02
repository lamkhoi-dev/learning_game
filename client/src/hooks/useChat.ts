'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSocket } from './useSocket'

export interface ChatMsg {
  id: string
  userId: string
  username: string
  text: string
  createdAt: string
  isAdmin: boolean
}

export function useChat() {
  const { socket } = useSocket()
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!socket) return
    const onHistory = (msgs: ChatMsg[]) => setMessages(Array.isArray(msgs) ? msgs : [])
    const onMessage = (m: ChatMsg) => setMessages((prev) => [...prev, m].slice(-100))
    const onRemove = ({ id }: { id: string }) => setMessages((prev) => prev.filter((m) => m.id !== id))
    const onError = ({ error }: { error: string }) => { setError(error); setTimeout(() => setError(null), 2500) }

    socket.on('chat:history', onHistory)
    socket.on('chat:message', onMessage)
    socket.on('chat:remove', onRemove)
    socket.on('chat:error', onError)
    return () => {
      socket.off('chat:history', onHistory)
      socket.off('chat:message', onMessage)
      socket.off('chat:remove', onRemove)
      socket.off('chat:error', onError)
    }
  }, [socket])

  const send = useCallback((text: string) => {
    const t = text.trim()
    if (t && socket) socket.emit('chat:send', { text: t.slice(0, 200) })
  }, [socket])

  const remove = useCallback((id: string) => {
    socket?.emit('chat:delete', { id })
  }, [socket])

  return { messages, send, remove, error }
}
