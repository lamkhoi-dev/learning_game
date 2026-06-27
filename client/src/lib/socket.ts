import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

function resolveSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL
  if (typeof window === 'undefined') return 'http://localhost:4000'
  // Dev mở trực tiếp Next ở cổng 3000 → socket nối THẲNG tới backend 4000
  // (Next proxy không xử lý được WebSocket). Khi vào qua 4000/ngrok thì dùng same-origin.
  if (window.location.port === '3000') {
    return `${window.location.protocol}//${window.location.hostname}:4000`
  }
  return window.location.origin
}

export function getSocket(token?: string): Socket {
  if (!socket) {
    const url = resolveSocketUrl()
    socket = io(url, {
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    })
  }
  if (token) socket.auth = { token }
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
