# ⚡ Token.ku

**Token.ku** adalah aplikasi *Progressive Web App* (PWA) cerdas untuk mencatat, memantau, dan menganalisis saldo kWh meter listrik prabayar Anda. Didesain dengan arsitektur *Offline-First*, aplikasi ini menjamin kecepatan interaksi tanpa hambatan serta keamanan pencadangan data ke Cloud.

## ✨ Fitur Utama

- 📡 **Offline-First & Auto-Sync**: Catat sisa meteran kapan saja meski tanpa koneksi internet. Data akan tersimpan di lokal dan disinkronkan otomatis ke Supabase di latar belakang saat internet kembali aktif.
- 📊 **Dashboard Analitik**: Pantau riwayat pemakaian listrik dan histori pengisian token Anda melalui grafik interaktif yang indah.
- 🚨 **Notifikasi Telegram**: Jangan pernah kehabisan listrik di tengah malam! Dapatkan peringatan otomatis via Telegram ketika sisa saldo kWh menyentuh batas kritis (dapat dikonfigurasi).
- 💾 **Ekspor & Impor JSON**: Pegang kendali penuh atas data Anda. Ekspor log pemakaian, pengaturan aplikasi, hingga kredensial database ke dalam file JSON, dan impor kapan saja.
- 📱 **PWA (Progressive Web App)**: Instal aplikasi langsung ke *Home Screen* Android, iOS, atau Desktop Anda untuk pengalaman aplikasi *native*.

## 🛠️ Teknologi yang Digunakan

- **Frontend**: React (Vite), TypeScript, Tailwind CSS, Framer Motion
- **Visualisasi Data**: Recharts
- **Database & Cloud Sync**: Supabase (PostgreSQL), Local Storage
- **Notifikasi**: React Hot Toast, Telegram Bot API

## 🚀 Panduan Setup (Cloud & Notifikasi)

Agar fitur Cloud Backup dan Notifikasi berjalan maksimal, lakukan pengaturan berikut di dalam tab **Settings** pada aplikasi:

### 1. Setup Supabase (Cloud Sync)
1. Buat proyek baru di [Supabase](https://supabase.com/).
2. Masuk ke **SQL Editor** dan jalankan *script* skema pembuatan tabel yang tersedia di dalam menu pengaturan aplikasi Token.ku (Bagian *Supabase Documentation*).
3. Salin **Project URL** dan **anon public key** dari Supabase ke dalam pengaturan aplikasi Token.ku.

### 2. Setup Telegram Bot (Alert)
1. Buka Telegram dan cari **@BotFather**.
2. Buat bot baru menggunakan perintah `/newbot` dan simpan **Bot Token** yang diberikan.
3. Kirim pesan `/start` ke bot yang baru Anda buat.
4. Gunakan bot seperti **@userinfobot** untuk mendapatkan **Chat ID** Anda.
5. Masukkan Bot Token dan Chat ID tersebut ke dalam pengaturan aplikasi Token.ku.

## 📦 Keunggulan Arsitektur Data
Aplikasi ini dilengkapi algoritma **De-duplikasi Pintar** yang memastikan tidak ada data ganda (berdasarkan *timestamp* dan *sisa kWh*) yang terkirim ke Supabase ketika Anda melakukan sinkronisasi *offline-to-online* secara berulang.
