# Deploy lên VPS bằng Docker

Toàn bộ chạy bằng `docker compose`: **db (Postgres) + server (API+Socket) + client (Next)**.
Backend là cổng vào duy nhất (port 80) — nó phục vụ giao diện, API và WebSocket. Một cổng lo hết.

---

## A. Lần đầu (setup)

### 1. Đẩy code lên GitHub (làm ở máy bạn)
```bash
cd /path/to/project
git init
git add .
git commit -m "Initial"
git branch -M main
git remote add origin https://github.com/<tài-khoản>/<repo>.git
git push -u origin main
```
> `.env`, `node_modules`, `.next`, `dist` đã được .gitignore — không bị đẩy lên.

### 2. SSH vào VPS
```bash
ssh -p <PORT> root@<VPS-IP>
```

### 3. Cài Docker (Ubuntu/Debian)
```bash
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version
```

### 4. Lấy code về
```bash
cd /opt
git clone https://github.com/<tài-khoản>/<repo>.git game
cd game
```
> Repo private? Dùng SSH deploy key hoặc personal access token khi clone.

### 5. Tạo file `.env`
```bash
cp .env.example .env
nano .env
```
Điền:
- `POSTGRES_PASSWORD`: mật khẩu DB mạnh
- `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`: tạo bằng `openssl rand -base64 48`
- `PUBLIC_URL=https://<domain-của-bạn>`
- `COOKIE_SECURE=false` (vì đang chạy HTTP)

### 6. Mở firewall cổng 80 (nếu có ufw)
```bash
ufw allow 80/tcp
ufw allow <PORT>/tcp   # giữ SSH
```

### 7. Chạy
```bash
docker compose up -d --build
```
Lần đầu build ~vài phút. Sau đó vào domain đã cấu hình

Tài khoản admin mặc định: `void_admin` / `Admin@1234` (đổi ngay — xem mục E).

---

## B. Update sau này (CỰC NHANH)
Mỗi lần sửa code ở máy → push → trên VPS chỉ cần:
```bash
cd /opt/game
git pull
docker compose up -d --build
```
Chỉ service nào đổi mới build lại. DB giữ nguyên dữ liệu (volume `pgdata`).

> Mẹo: tạo alias trên VPS cho gọn:
> ```bash
> echo "alias deploy='cd /opt/game && git pull && docker compose up -d --build'" >> ~/.bashrc && source ~/.bashrc
> ```
> Từ đó chỉ cần gõ `deploy`.

---

## C. Lệnh hay dùng
```bash
docker compose ps                 # trạng thái 3 service
docker compose logs -f server     # xem log backend
docker compose logs -f client     # xem log frontend
docker compose restart server     # khởi động lại 1 service
docker compose down               # tắt hết (DB vẫn còn dữ liệu)
```

## D. Sao lưu / phục hồi DB
```bash
# Backup
docker compose exec db pg_dump -U void_user voidprotocol > backup_$(date +%F).sql
# Restore
cat backup.sql | docker compose exec -T db psql -U void_user voidprotocol
```

---

## E. Bảo mật (làm sớm)
1. **Đổi mật khẩu root VPS** — bấm "Reset mật khẩu" trên trang quản trị.
2. **Đổi mật khẩu admin game**: vào Admin → Cài đặt → mục "ĐỔI MẬT KHẨU".
3. Khuyến nghị dùng **SSH key** thay mật khẩu.

---

## F. Lên HTTPS + domain (khi sẵn sàng — nên làm cho game public)
Đã cấu hình xong: Caddy tự cấp SSL (Let's Encrypt) theo domain trỏ về VPS,
`PUBLIC_URL=https://...` và `COOKIE_SECURE=true`, WebSocket chạy `wss://` an toàn.
