'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '@/lib/api'

export default function SettingsPage() {
  const [brandName, setBrandName] = useState('')
  const [streamUrl, setStreamUrl] = useState('')
  const [streamType, setStreamType] = useState<'iframe' | 'hls' | 'webrtc'>('iframe')
  const [streamOn, setStreamOn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    api.get('/api/admin/settings')
      .then(({ data }) => {
        setBrandName(data.brandName || '')
        setStreamUrl(data.streamUrl || '')
        setStreamType(data.streamType === 'hls' || data.streamType === 'webrtc' ? data.streamType : 'iframe')
        setStreamOn(!!data.streamOn)
      })
      .catch(() => {})
  }, [])

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  async function save() {
    setLoading(true)
    try {
      await api.put('/api/admin/settings', {
        brandName: brandName.trim(),
        streamUrl: streamUrl.trim(),
        streamType,
        streamOn,
      })
      flash('Đã lưu cài đặt')
    } catch (err: unknown) {
      flash((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại', false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h2 className="font-orbitron text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-wide">CÀI ĐẶT</h2>

      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="font-orbitron text-xs px-4 py-3 rounded-lg"
            style={{
              color: msg.ok ? 'var(--gold)' : 'var(--crimson-xenon)',
              background: msg.ok ? 'rgba(255,210,74,0.08)' : 'rgba(255,23,68,0.08)',
              border: `1px solid ${msg.ok ? 'rgba(255,210,74,0.25)' : 'rgba(255,23,68,0.2)'}`,
            }}
          >
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thương hiệu */}
      <div className="glass-panel p-6 space-y-4">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1.5 tracking-widest font-orbitron uppercase">
            Tên thương hiệu (alt logo / SEO)
          </label>
          <input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            maxLength={40}
            placeholder="VOID PROTOCOL"
            className="w-full bg-[rgba(255,255,255,0.05)] border border-[var(--glass-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)] transition-colors"
          />
          <p className="text-[10px] text-[var(--text-muted)] mt-1.5">Tối đa 40 ký tự.</p>
        </div>
      </div>

      {/* Video Live */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-orbitron text-sm text-[var(--text-primary)] tracking-widest">VIDEO LIVE</span>
          <button
            onClick={() => setStreamOn((v) => !v)}
            className="font-orbitron text-xs px-4 py-2 rounded-lg tracking-widest transition-all"
            style={streamOn
              ? { background: '#22c55e', color: '#000' }
              : { border: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}
          >
            {streamOn ? '● ĐANG BẬT' : '○ ĐANG TẮT'}
          </button>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1.5 tracking-widest font-orbitron uppercase">Loại nguồn</label>
          <div className="flex gap-2 flex-wrap">
            {(['iframe', 'hls', 'webrtc'] as const).map((t) => (
              <button key={t} onClick={() => setStreamType(t)}
                className="font-orbitron text-xs px-4 py-2 rounded-lg tracking-widest transition-all"
                style={streamType === t
                  ? { background: 'var(--gold)', color: '#000' }
                  : { border: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                {t === 'iframe' ? 'IFRAME EMBED' : t === 'hls' ? 'HLS (~5s)' : 'WEBRTC (~0.5s)'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1.5 tracking-widest font-orbitron uppercase">
            {streamType === 'iframe' ? 'URL nhúng (iframe src)' : 'Link HLS (.m3u8)'}
          </label>
          <input
            value={streamUrl}
            onChange={(e) => setStreamUrl(e.target.value)}
            maxLength={1000}
            placeholder={streamType === 'iframe' ? 'https://…embed…' : 'https://an1307.vn/hls/live/index.m3u8'}
            className="w-full bg-[rgba(255,255,255,0.05)] border border-[var(--glass-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)] transition-colors"
          />
          <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
            {streamType === 'webrtc'
              ? 'Dán CHÍNH link HLS (…/hls/live/index.m3u8). WebRTC tự suy ra để phát ~0.5s; mạng nào chặn UDP sẽ tự rớt về HLS.'
              : 'Host dùng OBS bắn về server (RTMP → HLS/WebRTC) rồi dán URL vào đây.'}
          </p>
        </div>
      </div>

      <button
        onClick={save}
        disabled={loading || !brandName.trim()}
        className="font-orbitron text-xs px-6 py-2.5 rounded-lg text-black tracking-widest disabled:opacity-40 transition-all"
        style={{ background: 'var(--gold)', boxShadow: '0 0 16px rgba(255,210,74,0.3)' }}
      >
        {loading ? '...' : 'LƯU CÀI ĐẶT'}
      </button>
    </div>
  )
}
