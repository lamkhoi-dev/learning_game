FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# API & socket dùng đường dẫn tương đối / same-origin (backend là cổng vào) → không cần NEXT_PUBLIC_*
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
