'use client'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useChat } from '@/hooks/useChat'

interface Props {
  isAdmin: boolean
  currentUserId: string
}

function nameColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return `hsl(${h}, 85%, 72%)`
}

export function ChatOverlay({ isAdmin, currentUserId }: Props) {
  const { messages, send, remove, error } = useChat()
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    send(text)
    setText('')
  }

  const recent = messages.slice(-30)

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-end">
      {/* Tin nhắn — trong suốt, thấy live phía sau */}
      <div
        className="px-2.5 pb-1 flex flex-col justify-end gap-1 overflow-hidden"
        style={{ maxHeight: '48%', maskImage: 'linear-gradient(to top, black 72%, transparent)', WebkitMaskImage: 'linear-gradient(to top, black 72%, transparent)' }}
      >
        <AnimatePresence initial={false}>
          {recent.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="group self-start max-w-[88%] rounded-2xl px-2.5 py-1"
              style={{ background: 'rgba(0,0,0,0.34)', backdropFilter: 'blur(2px)' }}
            >
              <span className="text-[12px] leading-snug" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                <span className="font-orbitron font-bold" style={{ color: nameColor(m.username) }}>{m.username}</span>
                <span className="text-white/95">: {m.text}</span>
              </span>
              {isAdmin && (
                <button
                  onClick={() => remove(m.id)}
                  className="pointer-events-auto opacity-0 group-hover:opacity-100 text-[10px] text-[var(--crimson-xenon)] ml-1.5 align-middle"
                >×</button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      {/* Ô nhập — bám đáy video */}
      <form onSubmit={submit} className="pointer-events-auto flex items-center gap-2 px-2.5 pb-2.5 pt-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          placeholder={error ?? 'Nhắn gì đó...'}
          className="flex-1 rounded-full px-4 py-2 text-sm text-white placeholder-white/60 focus:outline-none"
          style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${error ? 'var(--crimson-xenon)' : 'rgba(255,255,255,0.18)'}`, backdropFilter: 'blur(4px)' }}
        />
        <button
          type="submit"
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-black text-lg"
          style={{ background: 'var(--gold)', boxShadow: '0 0 12px rgba(255,210,74,0.4)' }}
          aria-label="Gửi"
        >➤</button>
      </form>
    </div>
  )
}
