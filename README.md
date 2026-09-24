# Sistem Maklumat Pertanian Sabah (SMPS)

Mockup paparan pengurusan (MIS) untuk **Jabatan Pertanian Sabah**.

Sistem ini mengubah data ladang daerah yang dikemukakan dua kali sebulan
menjadi papan pemuka strategik untuk Pengarah dan Menteri.

> **Ini mockup sahaja.** Tiada pelayan, tiada pangkalan data, tiada
> pengesahan pengguna sebenar. Semua data adalah data contoh yang
> dikodkan dalam `assets/js/data.js`.

---

## 1. Cara Membuka

**Klik dua kali `index.html`.** Itu sahaja.

- Tiada pemasangan (install)
- Tiada `npm`, tiada proses build
- Tiada sambungan internet diperlukan — Chart.js disalin ke dalam projek

Sistem diuji pada pelayar moden (Chrome, Edge, Firefox). Buka terus dari cakera
(`file://`) atau melalui pelayan web tempatan — kedua-duanya berfungsi.

---

## 2. Apa Yang Boleh Diklik

### Langkah 1 — `index.html` (Log Masuk)

| Untuk buat apa | Caranya |
|---|---|
| Masuk sebagai Operator | Taip sebarang ID, sebarang kata laluan, pilih **daerah**, pilih **Operator Daerah**, tekan **Masuk** |
| Masuk sebagai Pentadbir | Taip apa-apa, pilih **Pentadbir Sistem**, tekan **Masuk** |
| Masuk sebagai Pengurusan | Taip apa-apa, pilih **Pengurusan Atasan**, tekan **Masuk** |

- Kotak **Daerah** hanya muncul apabila *Operator Daerah* dipilih.
- Mana-mana ID dan kata laluan diterima — ini mockup. Syaratnya hanya kedua-dua
  medan **tidak boleh kosong**; sebarang nilai lain diterima, termasuk satu aksara.
- Cuba tekan **Masuk** dengan medan kosong: ralat merah akan muncul.

**ID Pengguna ada kesannya.** Ia disimpan sebagai identiti anda dan dirakam
dalam lajur *Dihantar Oleh* (`entry.html`) serta **jejak audit** setiap
suntingan (`verify.html`). Kata laluan tidak disimpan dan tidak digunakan
langsung.

### Langkah 2a — `entry.html` (Operator Daerah)

| Untuk buat apa | Caranya |
|---|---|
| Rekod data baharu | Isi borang di kiri, tekan **Hantar untuk Semakan** |
| Simpan tanpa hantar | Tekan **Simpan Draf** — rekod kekal setempat |
| Lihat amaran luar biasa | Taip luas yang terlalu besar (cth. `9000`) — kotak kuning "Nilai luar biasa" muncul. Ia **tidak** menyekat penghantaran |
| Sunting / padam | Butang hanya muncul untuk rekod berstatus **Draf** |
| Lihat rekod lama | Tukar **Tempoh Pelaporan** — tempoh lampau dikunci (baca sahaja) |

### Langkah 2b — `verify.html` (Pentadbir Sistem)

| Untuk buat apa | Caranya |
|---|---|
| Tapis rekod | Guna baris penapis: Daerah, Tanaman, Status, Carian |
| Baca satu amaran | Tekan **Check** pada baris Anomali — butiran muncul dalam tetingkap |
| Lihat butiran rekod | Tekan **View** pada baris Menunggu Semakan |
| Sunting rekod | Tekan **Edit** → ubah nilai → isi **Sebab Suntingan** (wajib) → **Simpan** |
| Luluskan satu rekod | Tekan **Approve** |
| Luluskan banyak sekali gus | Tanda kotak di kiri, tekan **Approve Selected** |
| Tolak rekod | Tekan **Reject** (pada baris Menunggu Semakan) |
| Tanda amaran selesai | Tekan **Reject** (pada baris Anomali) |
| Batalkan kelulusan | Tekan **Cancel Approval** pada senarai Diluluskan |
| Tutup tetingkap | Tekan **Esc**, **Close**, atau **X** |

Setiap suntingan direkodkan dalam **jejak audit** bersama sebabnya. Tetingkap Edit
juga memaparkan **nama operator yang menghantar** dan **tarikh ia dihantar**.

> **Nota bahasa.** Tujuh label tindakan adalah dalam Bahasa Inggeris mengikut
> permintaan pemilik projek: `System Admin`, `Check`, `Edit`, `View`, `Reject`,
> `Approve`, `Cancel Approval` (berserta kelanjutannya `Approve Selected` dan
> `Reject Selected`). Semua teks lain kekal Bahasa Malaysia, termasuk nilai
> status data (Dihantar / Diluluskan / Ditolak) yang muncul dalam jadual dan
> lencana.

### Langkah 2c — `dashboard.html` (Pengurusan Atasan)

Lima tab di tengah skrin:

| Tab | Apa yang ditunjukkan |
|---|---|
| **Ringkasan** | 4 kad KPI, carta donat kategori, carta garisan 6 tempoh, carta palang Top 5 daerah |
| **Peta** | **Peta sebenar Sabah** dengan 27 daerah boleh klik. Warna mengikut tahap aktiviti. Tukar **Lapisan**. Jadual ringkasan 27 daerah di bawah peta |
| **Tanaman** | Jadual boleh isih. Klik baris → pecahan daerah. Warna % Matang: hijau >80, kuning 50–80, merah <50 |
| **Daerah** | Kedudukan 27 daerah. Klik nama daerah → terus ke tab Tanaman |
| **Amaran** | Amaran dikelompokkan: Tinggi / Sederhana / Rendah. Tekan **Tanda Selesai** |

Butang lain:

- **Cetak PDF** — buka dialog cetak pelayar (guna "Save as PDF"). Hanya tab aktif dicetak.
- **Bandingkan dengan** — tukar tempoh perbandingan pada kad KPI.
- **Tempoh** — tukar tempoh pelaporan.
- **EN / BM** — togol bahasa (stub sahaja, belum menterjemah teks).

---

## 3. Struktur Fail

```
/
├── index.html              Log masuk / pemilih peranan
├── entry.html              Portal Operator Daerah
├── verify.html             Konsol Pentadbir Sistem
├── dashboard.html          Papan pemuka (5 tab)
├── README.md               Fail ini
└── assets/
    ├── css/
    │   ├── base.css        Token warna, reset, tipografi
    │   ├── layout.css      Grid, header, sidebar, cetakan
    │   └── components.css  Butang, jadual, lencana, modal
    ├── js/
    │   ├── data.js         SEMUA data contoh (satu sumber)
    │   ├── auth.js         Peranan + pengawal halaman
    │   ├── shared.js       Simpanan setempat, pembantu DOM
    │   ├── sabah-map.js    Peta Sabah: warna aktiviti + label daerah
    │   ├── chart.js        Pembalut Chart.js (muat malas)
    │   ├── entry.js        Logik borang operator
    │   ├── verify.js       Logik konsol pentadbir
    │   └── dashboard.js    Logik 5 tab papan pemuka
    ├── img/
    │   ├── logo.svg        Jata pertanian (placeholder)
    │   └── sabah-map.svg   Geometri 27 daerah Sabah (SVG, 11 KB)
    └── vendor/
        └── chart.umd.js    Chart.js v4.4.7 (salinan tempatan)
```

**Urutan muat skrip mesti dipatuhi:** `data.js` → `auth.js` → `shared.js` →
`chart.umd.js` (papan pemuka sahaja) → `chart.js` → skrip halaman.
`data.js` mesti dimuatkan dahulu kerana fail lain membaca pemalarnya.

---

## 4. Tiga Peranan

| Peranan | Halaman | Boleh akses |
|---|---|---|
| Operator Daerah | `entry.html` | Data daerah sendiri sahaja |
| Pentadbir Sistem | `verify.html` | Semua 27 daerah, sunting/lulus |
| Pengurusan Atasan | `dashboard.html` | Papan pemuka sahaja (baca) |

Peranan disimpan dalam `localStorage` di bawah kunci **`smps_role`**.
Setiap halaman menyemak peranan semasa dimuatkan; peranan yang salah akan
dihalakan ke halaman yang betul. Tekan **Log Keluar** untuk keluar.

---

## 5. Data Contoh

Semua data berada dalam **`assets/js/data.js`** — satu sumber sahaja.
Tiada nombor dikodkan dalam HTML.

| Pemboleh ubah | Kandungan |
|---|---|
| `CROP_MASTER` | 10 tanaman, 3 kategori |
| `DISTRICTS` | 27 daerah Sabah sebenar |
| `PERIODS` | 6 tempoh (dua kali sebulan) |
| `DISTRICT_ALLOCATIONS` | 25 daerah penyerah × 3 tanaman = 75 baris |
| `SUBMISSIONS` | 450 rekod (75 baris × 6 tempoh) |
| `ALERTS` | 23 amaran sejarah + amaran terbitan langsung |
| `KPI` / `TREND` | Diterbitkan daripada `SUBMISSIONS` |

Ciri data yang menjadikannya realistik:

- **Kelapa Sawit ≈ 59%** daripada jumlah luas (tanaman dominan Sabah)
- **Tawau > Lahad Datu > Kinabatangan** — tiga daerah teratas
- **Padi** tertumpu di Papar, Kota Belud, Kota Marudu
- **Kunak dan Kalabakan** sengaja tidak menyerah data — inilah yang
  menjadikan amaran "Tiada penyerahan" benar-benar berlaku
- % Matang bermusim: ada daerah 18% (baru disemai), ada 93% (sedia dituai)

---

## 6. Peta Sabah — Cara Ia Dibuat dan Hadnya

Peta pada tab **Peta** ialah SVG sebenar (11 KB, boleh dizum tanpa kabur), bukan
imej. Ia dihasilkan daripada peta pentadbiran Sabah yang diberikan pemilik projek:

1. Jisim daratan Sabah (443,365 piksel) diasingkan daripada imej mengikut warna.
2. Garis pantai ditelusuri (marching squares) dan diringkaskan daripada 8,992
   titik kepada 1,144 titik.
3. **Had penting:** peta sumber tidak melukis sempadan antara daerah yang
   berkongsi warna bahagian yang sama — Tawau, Kunak, Semporna dan Kalabakan
   semuanya satu jisim hijau. Piksel tidak boleh memisahkannya. Oleh itu
   sempadan dalaman daerah ditempatkan secara anggaran, kemudian dipotong
   kepada garis pantai sebenar.

**Kesimpulan:** garis besar negeri dan kumpulan pulau adalah tepat; sempadan
antara daerah adalah **anggaran**. Memadai untuk mockup, tidak memadai untuk
tujuan survei atau undang-undang. Jadual **Ringkasan Daerah** di bawah peta
sentiasa memberi angka penuh 27 daerah tanpa bergantung pada saiz label peta.

---

## 7. Lima Ambang Amaran

Dikodkan dalam `data.js`, dikongsi oleh borang, konsol dan papan pemuka:

| # | Peraturan | Tahap |
|---|---|---|
| 1 | Luas > 5× purata tempoh lepas | Tinggi |
| 2 | % Matang < 30 pada musim tuaian | Sederhana |
| 3 | Tiada penyerahan menjelang tarikh akhir | Tinggi |
| 4 | Rekod bertindih (daerah + tanaman + area) | Rendah |
| 5 | Luas menurun mendadak berbanding tempoh lepas | Sederhana |

**Ambang 1 dikira secara langsung.** Jika anda taip luas 9000 ha di
`entry.html` dan hantar, amaran Tinggi baharu akan muncul sendiri di
`dashboard.html` dan `verify.html`. Peraturan ini bukan sekadar baris
yang dikodkan tetap.

---

## 8. Reset Data

Mockup ini menyimpan suntingan anda dalam `localStorage` supaya ia kekal
selepas muat semula. Untuk kembali kepada data asal:

1. Buka Alat Pembangun Pelayar (F12)
2. Pergi ke **Application → Local Storage**
3. Padam kunci ini:
   - `smps_data_v1` — suntingan dan rekod baharu
   - `smps_alert_v1` — status amaran
   - `smps_draft_v1` — draf operator
4. Muat semula halaman

Atau jalankan di Console:

```js
["smps_data_v1", "smps_alert_v1", "smps_draft_v1"].forEach(k => localStorage.removeItem(k));
location.reload();
```

Peranan (`smps_role`) tidak dipadam, jadi anda kekal log masuk.

---

## 9. Apa Yang Sengaja TIDAK Dibina

Mengikut skop projek, perkara berikut sengaja dikecualikan:

- Pengesahan sebenar, JWT, sesi pelayan
- Pangkalan data atau API
- Peta GIS sebenar (Leaflet/Mapbox) — diganti dengan 27 jubin berlabel
- Pustaka eksport PDF sebenar — menggunakan `window.print()`
- Rangka kerja i18n sebenar — togol bahasa hanyalah stub
- Notifikasi, e-mel, SMS
- Pengurusan pengguna (CRUD)
- Muat naik fail (gambar, dokumen)

---

## 10. Nota Teknikal

- **HTML + CSS + JavaScript asas sahaja.** Tiada React/Vue/jQuery,
  tiada Tailwind/Bootstrap, tiada pemproses CSS.
- **Tiada panggilan rangkaian.** Chart.js disalin ke `assets/vendor/`.
- **Carta dimuatkan secara malas** — hanya dibina apabila tabnya dibuka.
- **Tiada gaya sebaris** dan **tiada `onclick=""`** — semua pengendali
  menggunakan `addEventListener`.
- **Kebolehcapaian:** setiap input ada `<label for>`, butang ikon ada
  `aria-label`, kontras ≥ 4.5:1, fokus papan kekunci kelihatan.
- **Konsol bersih** — tiada ralat atau amaran semasa dimuatkan.

---

Versi: **1.0 (mockup)** · Jabatan Pertanian Sabah

