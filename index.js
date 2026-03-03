const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

const RESPONSES_PATH = path.join(__dirname, "responses.json");
const ADMINS_PATH = path.join(__dirname, "admins.json");

function readJsonArray(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function normalizeToJid(value) {
  if (!value) return null;
  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  if (text.endsWith("@c.us") || text.endsWith("@g.us") || text.endsWith("@lid")) {
    return text;
  }

  const digitsOnly = text.replace(/\D/g, "");
  if (!digitsOnly) return null;
  return `${normalizePhoneDigits(digitsOnly)}@c.us`;
}

function extractDigits(value) {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return null;
  return normalizePhoneDigits(digits);
}

function normalizePhoneDigits(digits) {
  if (!digits) return null;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

async function getSenderCandidates(message) {
  const rawCandidates = [];

  if (message.from && message.from.endsWith("@g.us")) {
    rawCandidates.push(message.author, message.id?.participant, message.from);
  } else {
    rawCandidates.push(message.fromMe ? message.to : message.from, message.from);
  }

  try {
    const contact = await message.getContact();
    rawCandidates.push(
      contact?.number,
      contact?.id?._serialized,
      contact?.id?.user,
      contact?.userid
    );
  } catch (error) {
    // Ignore contact lookup errors and continue with available message fields.
  }

  const jidCandidates = Array.from(
    new Set(rawCandidates.map(normalizeToJid).filter(Boolean))
  );
  const digitCandidates = Array.from(
    new Set(rawCandidates.map(extractDigits).filter(Boolean))
  );

  return { jidCandidates, digitCandidates };
}

function loadAdmins() {
  const fileAdmins = readJsonArray(ADMINS_PATH);
  const envAdmins = String(process.env.ADMIN_NUMBERS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const allAdmins = [...fileAdmins, ...envAdmins]
    .map(normalizeToJid)
    .filter(Boolean);

  return {
    jidSet: new Set(allAdmins),
    digitSet: new Set([...fileAdmins, ...envAdmins].map(extractDigits).filter(Boolean)),
  };
}

function isSenderAdmin(senderCandidates, admins) {
  const jidMatch = senderCandidates.jidCandidates.some((jid) => admins.jidSet.has(jid));
  if (jidMatch) return true;

  const digitMatch = senderCandidates.digitCandidates.some((digits) =>
    admins.digitSet.has(digits)
  );
  return digitMatch;
}

function readResponsesRaw() {
  const parsed = readJsonArray(RESPONSES_PATH);
  return parsed.filter((item) => item && item.keyword && item.reply);
}

function saveResponsesRaw(responses) {
  fs.writeFileSync(RESPONSES_PATH, `${JSON.stringify(responses, null, 2)}\n`, "utf8");
}

function loadResponses() {
  try {
    return readResponsesRaw()
      .filter((item) => item && item.keyword && item.reply)
      .map((item) => ({
        keyword: String(item.keyword).toLowerCase().trim(),
        reply: String(item.reply),
      }))
      .sort((a, b) => b.keyword.length - a.keyword.length);
  } catch (error) {
    console.error("Gagal membaca responses.json:", error.message);
    return [];
  }
}

function findReply(messageText, responses) {
  const text = messageText.toLowerCase().trim();

  for (const rule of responses) {
    if (!rule.keyword) continue;
    if (text.includes(rule.keyword)) {
      return rule.reply;
    }
  }

  return null;
}

async function handleAdminCommand(message) {
  const text = String(message.body || "").trim();
  if (!/^admin\b/i.test(text)) return false;

  const senderCandidates = await getSenderCandidates(message);
  const admins = loadAdmins();

  if (/^admin\s+whoami$/i.test(text)) {
    const jidText =
      senderCandidates.jidCandidates.length > 0
        ? senderCandidates.jidCandidates.join(", ")
        : "-";
    const digitText =
      senderCandidates.digitCandidates.length > 0
        ? senderCandidates.digitCandidates.join(", ")
        : "-";
    const adminStatus = isSenderAdmin(senderCandidates, admins) ? "YA" : "TIDAK";

    await message.reply(
      `Deteksi pengirim:\nJID: ${jidText}\nNomor: ${digitText}\nAdmin: ${adminStatus}`
    );
    return true;
  }

  if (!isSenderAdmin(senderCandidates, admins)) {
    const detectedId =
      senderCandidates.jidCandidates[0] || senderCandidates.digitCandidates[0] || "unknown";
    await message.reply(
      `Perintah admin ditolak. ID terdeteksi: ${detectedId}\n` +
        "Tambahkan nomor/JID ini ke admins.json lalu restart bot."
    );
    return true;
  }

  if (/^admin\s+help$/i.test(text)) {
    await message.reply(
      "Command admin:\n" +
        "1) admin addproduk keyword|balasan\n" +
        "2) admin hapusproduk keyword\n" +
        "3) admin listproduk"
    );
    return true;
  }

  const addMatch = text.match(/^admin\s+addproduk\s+([\s\S]+)$/i);
  if (addMatch) {
    const payload = addMatch[1].trim();
    const separatorIndex = payload.indexOf("|");

    if (separatorIndex < 1) {
      await message.reply("Format salah. Contoh: admin addproduk gemini|Gemini premium ready");
      return true;
    }

    const keyword = payload.slice(0, separatorIndex).trim().toLowerCase();
    const reply = payload.slice(separatorIndex + 1).trim();

    if (!keyword || !reply) {
      await message.reply("Keyword dan balasan wajib diisi.");
      return true;
    }

    const responses = readResponsesRaw();
    const existingIndex = responses.findIndex(
      (item) => String(item.keyword).toLowerCase().trim() === keyword
    );

    if (existingIndex >= 0) {
      responses[existingIndex].reply = reply;
      saveResponsesRaw(responses);
      await message.reply(`Berhasil update produk: ${keyword}`);
      return true;
    }

    responses.push({ keyword, reply });
    saveResponsesRaw(responses);
    await message.reply(`Berhasil tambah produk: ${keyword}`);
    return true;
  }

  const deleteMatch = text.match(/^admin\s+hapusproduk\s+(.+)$/i);
  if (deleteMatch) {
    const keyword = deleteMatch[1].trim().toLowerCase();
    if (!keyword) {
      await message.reply("Format salah. Contoh: admin hapusproduk gemini");
      return true;
    }

    const responses = readResponsesRaw();
    const nextResponses = responses.filter(
      (item) => String(item.keyword).toLowerCase().trim() !== keyword
    );

    if (responses.length === nextResponses.length) {
      await message.reply(`Keyword tidak ditemukan: ${keyword}`);
      return true;
    }

    saveResponsesRaw(nextResponses);
    await message.reply(`Berhasil hapus produk: ${keyword}`);
    return true;
  }

  if (/^admin\s+listproduk$/i.test(text)) {
    const responses = readResponsesRaw();
    if (responses.length === 0) {
      await message.reply("Belum ada produk/respon.");
      return true;
    }

    const lines = responses.map(
      (item, index) => `${index + 1}. ${String(item.keyword).trim()}`
    );

    await message.reply(`Daftar produk/respon:\n${lines.join("\n")}`);
    return true;
  }

  await message.reply("Command admin tidak dikenal. Kirim: admin help");
  return true;
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  console.log("Scan QR ini di WhatsApp (Linked Devices):");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Bot aktif. Menunggu pesan...");
});

client.on("message", async (message) => {
  try {
    if (!message.body || typeof message.body !== "string") return;

    const commandHandled = await handleAdminCommand(message);
    if (commandHandled) return;

    if (message.fromMe) return;

    const responses = loadResponses();
    if (responses.length === 0) return;

    const reply = findReply(message.body, responses);
    if (!reply) return;

    await message.reply(reply);
    const chatType = message.from.endsWith("@g.us") ? "GRUP" : "PRIVATE";
    console.log(`[${chatType}] Trigger: "${message.body}" -> "${reply}"`);
  } catch (error) {
    console.error("Error saat memproses pesan:", error.message);
  }
});

client.initialize();
