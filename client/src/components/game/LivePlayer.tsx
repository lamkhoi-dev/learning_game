'use client'
import { useEffect, useRef } from 'react'

interface Props {
  url: string
  type: 'iframe' | 'hls' | 'webrtc'
  on: boolean
  fill?: boolean // lấp đầy khung cha (kiểu TikTok live) thay vì ép tỉ lệ 16:9
}

// Chấp nhận cả link HLS (.../hls/live/index.m3u8) lẫn WHEP (.../whep/live/whep),
// suy ra link còn lại để WebRTC có thể tự rớt về HLS khi mạng chặn UDP.
function deriveUrls(u: string): { hls: string; whep: string } {
  if (u.includes('/hls/')) {
    return { hls: u, whep: u.replace('/hls/', '/whep/').replace(/\/index\.m3u8(\?.*)?$/, '/whep$1') }
  }
  if (u.includes('/whep/')) {
    return { hls: u.replace('/whep/', '/hls/').replace(/\/whep(\?.*)?$/, '/index.m3u8$1'), whep: u }
  }
  return { hls: u, whep: u }
}

export function LivePlayer({ url, type, on, fill = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!on || !url || (type !== 'hls' && type !== 'webrtc')) return
    const video = videoRef.current
    if (!video) return

    let cancelled = false
    let hls: { destroy: () => void } | null = null
    let pc: RTCPeerConnection | null = null
    const ctrl = new AbortController()

    // ---- HLS (dùng cho type 'hls' và làm dự phòng cho 'webrtc') ----
    const startHls = (src: string) => {
      if (cancelled) return
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src
        return
      }
      import('hls.js').then(({ default: Hls }) => {
        if (cancelled) return
        if (Hls.isSupported()) {
          const inst = new Hls({
            lowLatencyMode: true,
            backBufferLength: 10,
            maxLiveSyncPlaybackRate: 1.5, // tăng tốc nhẹ để bám mép live, tránh trễ dồn
          })
          inst.loadSource(src)
          inst.attachMedia(video)
          hls = inst
        } else {
          video.src = src
        }
      }).catch(() => {})
    }

    // ---- WebRTC (WHEP) — độ trễ ~0.5s; rớt về HLS nếu lỗi/chặn UDP ----
    const startWebRTC = async (whepUrl: string, hlsUrl: string) => {
      let fellBack = false
      const fallback = () => {
        if (fellBack || cancelled) return
        fellBack = true
        try { pc?.close() } catch {}
        pc = null
        startHls(hlsUrl)
      }
      try {
        const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
        pc = peer
        peer.addTransceiver('video', { direction: 'recvonly' })
        peer.addTransceiver('audio', { direction: 'recvonly' })
        const stream = new MediaStream()
        peer.ontrack = (e) => {
          stream.addTrack(e.track)
          if (video.srcObject !== stream) video.srcObject = stream
        }
        peer.oniceconnectionstatechange = () => {
          if (['failed', 'disconnected', 'closed'].includes(peer.iceConnectionState)) fallback()
        }
        const offer = await peer.createOffer()
        await peer.setLocalDescription(offer)
        // gom ICE xong rồi mới gửi (non-trickle) — tối đa 1.5s
        await new Promise<void>((resolve) => {
          if (peer.iceGatheringState === 'complete') return resolve()
          const t = setTimeout(resolve, 1500)
          peer.addEventListener('icegatheringstatechange', () => {
            if (peer.iceGatheringState === 'complete') { clearTimeout(t); resolve() }
          })
        })
        if (cancelled) return
        const res = await fetch(whepUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: peer.localDescription?.sdp ?? '',
          signal: ctrl.signal,
        })
        if (!res.ok) throw new Error('WHEP ' + res.status)
        const answer = await res.text()
        if (cancelled) return
        await peer.setRemoteDescription({ type: 'answer', sdp: answer })
        // nếu 5s vẫn chưa có hình => rớt về HLS
        setTimeout(() => { if (!cancelled && !video.videoWidth) fallback() }, 5000)
      } catch {
        fallback()
      }
    }

    if (type === 'webrtc') {
      const { hls: hlsUrl, whep: whepUrl } = deriveUrls(url)
      startWebRTC(whepUrl, hlsUrl)
    } else {
      startHls(url)
    }

    return () => {
      cancelled = true
      ctrl.abort()
      try { pc?.close() } catch {}
      hls?.destroy()
    }
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
