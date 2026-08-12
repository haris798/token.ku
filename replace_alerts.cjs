const fs = require('fs');

const path = 'src/components/SettingsPanel.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/alert\('Mohon isi Supabase URL dan Public Anon Key/g, "toast.error('Mohon isi Supabase URL dan Public Anon Key");
content = content.replace(/alert\('Sinkronisasi Sukses!/g, "toast.success('Sinkronisasi Sukses!");
content = content.replace(/alert\('Sinkronisasi Sebagian!/g, "toast.success('Sinkronisasi Sebagian!");
content = content.replace(/alert\('Gagal melakukan sinkronisasi data/g, "toast.error('Gagal melakukan sinkronisasi data");
content = content.replace(/alert\('Gagal mengimpor data contoh/g, "toast.error('Gagal mengimpor data contoh");
content = content.replace(/alert\('Gagal mengekspor pengaturan/g, "toast.error('Gagal mengekspor pengaturan");
content = content.replace(/alert\(`Berhasil mengekspor \$\{mutations.length\} baris/g, "toast.success(`Berhasil mengekspor ${mutations.length} baris");
content = content.replace(/alert\('Gagal mengekspor data dari Supabase/g, "toast.error('Gagal mengekspor data dari Supabase");
content = content.replace(/alert\('Gagal mengekspor kredensial/g, "toast.error('Gagal mengekspor kredensial");
content = content.replace(/alert\('Kredensial Supabase berhasil diimpor!'\);/g, "toast.success('Kredensial Supabase berhasil diimpor!');");
content = content.replace(/alert\('Format JSON tidak valid \(harus mengandung objek "supabase"\).'\);/g, "toast.error('Format JSON tidak valid (harus mengandung objek \"supabase\").');");
content = content.replace(/alert\('Gagal membaca atau mengurai file JSON/g, "toast.error('Gagal membaca atau mengurai file JSON");
content = content.replace(/alert\('Format JSON tidak valid atau tidak memiliki data mutasi/g, "toast.error('Format JSON tidak valid atau tidak memiliki data mutasi");
content = content.replace(/alert\('Gagal membuat client Supabase/g, "toast.error('Gagal membuat client Supabase");
content = content.replace(/alert\(`Berhasil mengimpor \$\{successCount\} data/g, "toast.success(`Berhasil mengimpor ${successCount} data");
content = content.replace(/alert\('Gagal mengurai atau mengimpor file JSON/g, "toast.error('Gagal mengurai atau mengimpor file JSON");
content = content.replace(/alert\('Pengaturan berhasil dimuat dari file JSON!/g, "toast.success('Pengaturan berhasil dimuat dari file JSON!");
content = content.replace(/alert\('Gagal mengurai file JSON/g, "toast.error('Gagal mengurai file JSON");
content = content.replace(/alert\('SQL Schema Supabase berhasil disalin!'\);/g, "toast.success('SQL Schema Supabase berhasil disalin!');");

fs.writeFileSync(path, content);
console.log('Replaced successfully.');
