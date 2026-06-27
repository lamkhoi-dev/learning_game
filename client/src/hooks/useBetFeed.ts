'use client'
import { useEffect, useState } from 'react'
import { BetFeedEntry } from '@/types'
import { useSocket } from './useSocket'

export function useBetFeed() {
  const { socket } = useSocket()
  const [bets, setBets] = useState<BetFeedEntry[]>([])

  useEffect(() => {
    if (!socket) return
    const onAdd = (entry: BetFeedEntry) => {
      setBets((prev) => [entry, ...prev].slice(0, 50))
    }
    const onRemove = ({ username, roundId }: { username: string; roundId: string }) => {
      setBets((prev) => prev.filter(b => !(b.username === username && b.roundId === roundId)))
    }
    socket.on('bet:feed', onAdd)
    socket.on('bet:feed:remove', onRemove)
    return () => {
      socket.off('bet:feed', onAdd)
      socket.off('bet:feed:remove', onRemove)
    }
  }, [socket])

  return bets
}
