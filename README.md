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

## Catatan penting

- Ini memakai library tidak resmi (`whatsapp-web.js`), jadi tetap ada risiko akun dibatasi oleh WhatsApp.
- Supaya bot bisa membalas di grup, nomor bot harus ada di grup yang sama.
