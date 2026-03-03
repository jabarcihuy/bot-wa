const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

const RESPONSES_PATH = path.join(__dirname, "responses.json");

function loadResponses() {
  try {
    const raw = fs.readFileSync(RESPONSES_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
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
