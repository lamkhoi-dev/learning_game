'use client'
import { useEffect, useRef } from 'react'

interface Props {
  url: string
  type: 'iframe' | 'hls'
  on: boolean
  fill?: boolean // lấp đầy khung cha (kiểu TikTok live) thay vì ép tỉ lệ 16:9
}

export function LivePlayer({ url, type, on, fill = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!on || !url || type !== 'hls') return
    const video = videoRef.current
    if (!video) return

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url
      return
    }

    let hls: { destroy: () => void } | null = null
    let cancelled = false
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      if (Hls.isSupported()) {
        const inst = new Hls({
          lowLatencyMode: true,
          backBufferLength: 10,
          maxLiveSyncPlaybackRate: 1.5, // tăng tốc nhẹ để bám mép live, tránh trễ dồn
        })
        inst.loadSource(url)
        inst.attachMedia(video)
        hls = inst
      } else {
        video.src = url
      }
    }).catch(() => {})

    return () => { cancelled = true; hls?.destroy() }
  }, [url, type, on])

  const wrap = fill
    ? 'w-full h-full bg-black overflow-hidden'
    : 'glass-panel overflow-hidden aspect-video'

  if (!on || !url) {
    return (
      <div className={fill ? 'w-full h-full bg-black flex items-center justify-center' : 'glass-panel flex items-center justify-center aspect-video'}>
        <div className="text-center">
          <div className="text-3xl mb-2">🔴</div>
          <p className="font-orbitron text-sm text-[var(--text-muted)] tracking-widest">LIVE SẼ BẮT ĐẦU SỚM</p>
        </div>
      </div>
    )
  }

  return (
    <div className={wrap}>
      {type === 'iframe' ? (
        <iframe
          src={url}
          className="w-full h-full border-0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <video
          ref={videoRef}
          className={fill ? 'w-full h-full bg-black object-cover' : 'w-full h-full bg-black'}
          autoPlay
          muted
          playsInline
          controls={!fill}
        />
      )}
    </div>
  )
}
