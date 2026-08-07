# Token.ku

Token.ku adalah aplikasi web inovatif bergaya modern untuk melacak, mengelola, dan memprediksi konsumsi token listrik (kWh) rumah atau properti Anda. Aplikasi ini dibangun dengan arsitektur **Offline-First**, memastikan Anda dapat mencatat dan melihat sisa saldo bahkan tanpa koneksi internet.

## Fitur Utama

- **Dashboard & Analitik Interaktif**: Pantau sisa saldo kWh, rata-rata konsumsi harian, serta ringkasan pengeluaran bulanan.
- **Prediksi Cerdas**: Dapatkan estimasi (proyeksi) tanggal kapan saldo token listrik Anda diperkirakan akan habis berdasarkan tren pemakaian rata-rata 30 hari terakhir.
- **Arsitektur Offline-First Canggih**: Kini didukung penuh oleh **RxDB** sebagai basis data lokal yang kuat dan reaktif, memungkinkan sinkronisasi otomatis dan performa bebas *lag*.
- **Notifikasi Telegram**: Terima peringatan otomatis ke Telegram Anda ketika sisa kWh menyentuh ambang batas kritis (*Low Threshold*).
- **PWA & Android App**: Dukungan penuh Progressive Web App (PWA) agar bisa di-instal langsung di *browser* (PC/Mobile), serta terintegrasi dengan Capacitor CI/CD untuk otomatisasi *build* APK Android.
- **Personalisasi Tema**: Dukungan penuh untuk mode Terang (*Light*) dan mode Gelap (*Dark*).
- **Desain Modern**: Antarmuka responsif, rapi, dan cepat dengan animasi menggunakan Tailwind CSS dan Framer Motion.

## Tumpukan Teknologi (Tech Stack)

Aplikasi telah dimigrasikan menggunakan tumpukan teknologi modern untuk skalabilitas dan performa maksimal:
- **Frontend**: React (Vite) + TypeScript
- **Manajemen State**: Zustand
- **Pengelolaan Data**: TanStack Query (React Query)
- **Database Lokal**: RxDB (Dexie Storage Adapter)
- **Styling**: Tailwind CSS v4, Lucide Icons
- **Visualisasi Data**: Recharts
- **Animasi**: Framer Motion
- **Native & PWA**: Vite PWA + Capacitor Android

## Cara Penggunaan

1. Buka halaman pengaturan (Settings) dan atur tarif listrik per kWh (default: Rp 1444.70).
2. Tentukan ambang batas minimum (*Low Threshold*) kapan aplikasi harus memberikan status *Warning/Critical*.
3. (Opsional) Masukkan Telegram Bot Token dan Chat ID untuk menyalakan fitur peringatan otomatis.
4. Masukkan catatan (Input) setiap kali meteran berkurang atau ketika Anda melakukan pengisian ulang (Top-Up).
5. Lihat analisis lengkap dan prediksi sisa hari dari layar utama (Dashboard).

## Menjalankan Aplikasi secara Lokal

Pastikan Anda memiliki Node.js (versi >= 20 disarankan) terinstal, kemudian jalankan perintah berikut:

```bash
# Install seluruh dependensi
npm install

# Jalankan development server
npm run dev

# Membangun (Build) aplikasi untuk production
npm run build
```

### Membuat Build Android (APK)

Proyek ini telah dikonfigurasi dengan **GitHub Actions** untuk menghasilkan *file* APK secara otomatis pada setiap *push* atau *pull request* ke *branch* utama. 
Jika ingin mem-build APK secara lokal menggunakan Capacitor:

```bash
# Tambahkan platform Android (jika belum)
npx cap add android

# Sinkronisasi web asset ke folder Android
npm run build
npx cap sync android

# Buka Android Studio untuk mem-build APK
npx cap open android
```

Aplikasi ini siap digunakan dan diakses melalui *browser* atau diinstal di *smartphone* Anda!
