FROM node:20-slim

WORKDIR /app

# Prisma cần openssl
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Cài deps (giữ cả devDeps để build tsc + chạy prisma CLI/seed)
COPY package*.json ./
RUN npm ci

# Sinh Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# Mã nguồn + build TS
COPY . .
RUN npm run build

EXPOSE 4000

# Khi khởi động: áp migration → seed (idempotent) → chạy server
CMD npx prisma migrate deploy && npx ts-node prisma/seed.ts && node dist/index.js
