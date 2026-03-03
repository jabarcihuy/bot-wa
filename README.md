# WhatsApp Keyword Bot

Bot WhatsApp sederhana untuk membalas otomatis berdasarkan kata kunci pada:
- chat pribadi
- chat grup (asal bot ada di grup tersebut)

## 1) Install

```bash
npm install
```

## 2) Jalankan

```bash
npm start
```

Saat pertama kali jalan, terminal akan menampilkan QR. Scan dari WhatsApp kamu:
- WhatsApp -> Linked Devices -> Link a Device

## 3) Atur balasan

Edit file `responses.json`:

```json
[
  { "keyword": "halo", "reply": "Halo juga!" },
  { "keyword": "promo", "reply": "Promo hari ini: diskon 20%." }
]
```

Aturan:
- `keyword` dicocokkan dengan metode `contains` (tidak case sensitive).
- Jika ada beberapa keyword cocok, bot pilih keyword terpanjang dulu.

## 4) Atur admin (tambah produk via WhatsApp)

Edit file `admins.json` lalu isi nomor admin:

```json
[
  "6281234567890"
]
```

Format bisa nomor saja (`628xxx`) atau jid (`628xxx@c.us`).

Command yang bisa dikirim admin:
- `admin addproduk keyword|balasan`
- `admin hapusproduk keyword`
- `admin listproduk`
- `admin help`
- `admin whoami` (cek ID pengirim yang terbaca bot)

Contoh:
- `admin addproduk gemini|Gemini premium ready`
- `admin whoami`

## Catatan penting

- Ini memakai library tidak resmi (`whatsapp-web.js`), jadi tetap ada risiko akun dibatasi oleh WhatsApp.
- Supaya bot bisa membalas di grup, nomor bot harus ada di grup yang sama.
