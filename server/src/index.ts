import 'dotenv/config'
import http from 'http'
import { createApp, nextProxy } from './app'
import { initSocket } from './socket'

const PORT = parseInt(process.env.PORT ?? '4000', 10)

const app = createApp()
const httpServer = http.createServer(app)

initSocket(httpServer)

// WebSocket upgrade: /socket.io do socket.io tự xử lý, còn lại (Next HMR) proxy sang Next
httpServer.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith('/socket.io')) return
  ;(nextProxy as unknown as { upgrade: (req: unknown, socket: unknown, head: unknown) => void }).upgrade(req, socket, head)
})

httpServer.listen(PORT, () => {
  console.log(`🚀 Server (frontend + API + socket) chạy tại http://localhost:${PORT}`)
})
