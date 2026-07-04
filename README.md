# NavLock

Smart door lock ESP32 + React dashboard dengan HiveMQ untuk MQTT realtime dan Supabase PostgreSQL untuk database.

## Setup Supabase

1. Buat project Supabase.
2. Salin `.env.example` menjadi `.env`, lalu isi:
   - `DATABASE_URL`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_HIVEMQ_HOST`
   - `VITE_HIVEMQ_WS_PORT`
3. Push schema Prisma ke Supabase:

```bash
npx prisma db push
```

Schema ada di `prisma/schema.prisma` dengan table:
- `door_states`
- `rfid_cards`
- `access_logs`

## Setup HiveMQ

Gunakan HiveMQ public broker:
- MQTT ESP32: `broker.hivemq.com`, port `1883`
- MQTT WebSocket dashboard: `broker.hivemq.com`, port `8000`, path `/mqtt`
- Username/password dikosongkan.

Topic yang dipakai:
- `navlock/variruujpdsivihzfcjo/door/command`
- `navlock/variruujpdsivihzfcjo/door/status`
- `navlock/variruujpdsivihzfcjo/door/online`
- `navlock/variruujpdsivihzfcjo/access/log`

## Setup Arduino

Install library Arduino:
- `MFRC522`
- `PubSubClient`
- `ArduinoJson`

Edit `arduino/code.ino`:
- `WIFI_SSID`
- `WIFI_PASSWORD`
- `HIVEMQ_HOST`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Development

```bash
npm install
npm run dev
```

Build production:

```bash
npm run build
```
