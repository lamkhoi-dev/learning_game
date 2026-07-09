'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChat } from '@/hooks/useChat'

interface Props {
  isAdmin: boolean
  currentUserId: string
}

function nameColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return `hsl(${h}, 70%, 65%)`
}

function fmt(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

export function ChatWidget({ isAdmin, currentUserId }: Props) {
  const { messages, send, remove, error } = useChat()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [seen, setSeen] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Tự cuộn xuống cuối khi có tin mới (lúc đang mở)
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
    if (open) setSeen(messages.length)
  }, [messages, open])

  const unread = Math.max(0, messages.length - seen)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    send(text)
    setText('')
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="glass-panel mb-3 flex flex-col w-[86vw] max-w-[360px] h-[60vh] max-h-[460px] overflow-hidden"
            style={{ background: 'rgba(18,17,12,0.96)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--glass-border)]">
              <span className="font-orbitron text-sm font-bold neon-text-gold tracking-widest">CHAT</span>
              <button onClick={() => setOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none">✕</button>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1.5">
              {messages.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] text-center py-6">Chưa có tin nhắn — chat ngay!</p>
              )}
              {messages.map((m) => (
                <div key={m.id} className="group text-sm leading-snug break-words">
                  <span className="font-orbitron text-xs" style={{ color: nameColor(m.username) }}>{m.username}</span>
                  <span className="text-[10px] text-[var(--text-muted)] ml-1.5">{fmt(m.createdAt)}</span>
                  {isAdmin && (
                    <button
                      onClick={() => remove(m.id)}
                      className="opacity-0 group-hover:opacity-100 text-[10px] text-[var(--crimson-xenon)] ml-2 transition-opacity"
                    >xóa</button>
                  )}
                  <div className="text-[var(--text-primary)]" style={{ color: m.userId === currentUserId ? 'var(--gold)' : undefined }}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <form onSubmit={submit} className="p-2 border-t border-[var(--glass-border)] flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={200}
                placeholder={error ?? 'Nhập tin nhắn...'}
                className="flex-1 bg-[rgba(255,255,255,0.06)] border border-[var(--glass-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)]"
                style={error ? { borderColor: 'var(--crimson-xenon)' } : undefined}
              />
              <button type="submit" className="px-4 rounded-lg font-orbitron text-xs font-bold text-black" style={{ background: 'var(--gold)' }}>GỬI</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bubble */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative ml-auto flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{ background: 'var(--gold)', boxShadow: '0 0 20px rgba(255,210,74,0.45)' }}
        aria-label="Chat"
      >
        <span className="text-2xl">💬</span>
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[var(--crimson-xenon)] text-white text-[11px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
    </div>
  )
}
