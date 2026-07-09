'use client'
import { useEffect, useState } from 'react'
import { useSocket } from './useSocket'
import api from '@/lib/api'

export interface SiteSettings {
  brandName: string
  streamUrl: string
  streamType: 'iframe' | 'hls'
  streamOn: boolean
}

const DEFAULTS: SiteSettings = { brandName: 'VOID PROTOCOL', streamUrl: '', streamType: 'iframe', streamOn: false }

export function useSettings(): SiteSettings {
  const { socket } = useSocket()
  const [settings, setSettings] = useState<SiteSettings>(DEFAULTS)

  useEffect(() => {
    api.get('/api/settings')
      .then(({ data }) => setSettings({ ...DEFAULTS, ...data }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!socket) return
    const handler = (s: Partial<SiteSettings>) => setSettings((prev) => ({ ...prev, ...s }))
    socket.on('settings:update', handler)
    return () => { socket.off('settings:update', handler) }
  }, [socket])

  return settings
}

// Tương thích ngược: một số nơi chỉ cần tên thương hiệu
export function useBrand(): string {
  return useSettings().brandName
}
