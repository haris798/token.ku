# Token.ku

Token.ku adalah aplikasi web inovatif bergaya modern untuk melacak, mengelola, dan memprediksi konsumsi token listrik (kWh) rumah atau properti Anda. Aplikasi ini dibangun dengan arsitektur **Offline-First**, memastikan Anda dapat mencatat dan melihat sisa saldo bahkan tanpa koneksi internet, sambil tetap menjaga data tersinkronisasi di cloud saat Anda kembali online.

## Fitur Utama

- **Dashboard & Analitik Interaktif**: Pantau sisa saldo kWh, rata-rata konsumsi harian, serta ringkasan pengeluaran bulanan.
- **Prediksi Cerdas**: Dapatkan estimasi (proyeksi) tanggal kapan saldo token listrik Anda diperkirakan akan habis berdasarkan tren pemakaian rata-rata 30 hari terakhir.
- **Offline-First & Sinkronisasi Supabase**: Bekerja mulus secara lokal (menggunakan LocalStorage / Room Database). Saat koneksi tersedia, sinkronkan log dan pengaturan Anda ke database cloud Supabase dengan aman.
- **Notifikasi Telegram**: Terima peringatan otomatis ke Telegram Anda ketika sisa kWh menyentuh ambang batas kritis (Low Threshold).
- **Ekspor & Cadangan Data**: Unduh laporan pemakaian per bulan ke format CSV, atau ekspor seluruh konfigurasi aplikasi Anda dalam format JSON.
- **Personalisasi Tema**: Dukungan penuh untuk mode Terang (Light) dan mode Gelap (Dark).
- **Desain Modern**: Antarmuka responsif, rapi, dan cepat dengan animasi menggunakan Tailwind CSS dan Framer Motion.

## Tumpukan Teknologi (Tech Stack)

- **Frontend**: React (Vite) + TypeScript
- **Styling**: Tailwind CSS, Lucide Icons
- **Visualisasi Data**: Recharts
- **Animasi**: Framer Motion
- **Database Lokal**: LocalStorage & integrasi Room Database 
- **Database Cloud**: Supabase (REST API)
- **Notifikasi**: Telegram Bot API

## Cara Penggunaan

1. Buka halaman pengaturan (Settings) dan atur tarif listrik per kWh (default: Rp 1444.70).
2. Tentukan ambang batas minimum (Low Threshold) kapan aplikasi harus memberikan status *Warning/Critical*.
3. (Opsional) Masukkan kredensial Supabase URL dan Anon Key untuk mengaktifkan sinkronisasi cloud.
4. (Opsional) Masukkan Telegram Bot Token dan Chat ID untuk menyalakan fitur peringatan otomatis.
5. Masukkan catatan (Input) setiap kali meteran berkurang atau ketika Anda melakukan pengisian ulang (Top-Up).
6. Lihat analisis lengkap dan prediksi sisa hari dari layar utama (Dashboard).

## Menjalankan Aplikasi secara Lokal

Pastikan Anda memiliki Node.js terinstal, kemudian jalankan perintah berikut:

```bash
# Install seluruh dependensi
npm install

# Jalankan development server
npm run dev
```

Aplikasi ini siap digunakan dan diakses melalui browser Anda!
