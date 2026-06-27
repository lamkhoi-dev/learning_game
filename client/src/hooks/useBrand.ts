'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'

export function useBrand() {
  const [brandName, setBrandName] = useState('VOID PROTOCOL')
  useEffect(() => {
    api.get('/api/settings')
      .then(({ data }) => setBrandName(data.brandName || 'VOID PROTOCOL'))
      .catch(() => {})
  }, [])
  return brandName
}
