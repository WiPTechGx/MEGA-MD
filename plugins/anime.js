// Lazy-loaded: const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const webp = require('node-webpmux');
const crypto = require('crypto');

const ANIMU_BASE = 'https://api.some-random-api.com/animu';

const supportedActions = ['nom', 'poke', 'cry', 'kiss', 'pat', 'hug', 'wink', 'face-palm', 'quote'];

const supportedCharacters = [
  'akira','akiyama','anna','asuna','ayuzawa','boruto','chiho','chitoge',
  'deidara','erza','elaina','eba','emilia','hestia','hinata','inori',
  'isuzu','itachi','itori','kaga','kagura','kaori','keneki','kotori',
  'kurumi','madara','mikasa','miku','minato','naruto','nezuko','sagiri',
  'sasuke','sakura'
];

function normalizeAction(input) {
  const lower = (input || '').toLowerCase().trim();
  if (lower === 'facepalm' || lower === 'face_palm') return 'face-palm';
  if (lower === 'animu-quote' || lower === 'animuquote') return 'quote';
  return lower;
}

function pickRandom(arr, count = 1) {
  const shuffled = arr.slice().sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function convertMediaToSticker(mediaBuffer, isAnimated) {
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const inputExt = isAnimated ? 'gif' : 'jpg';
  const input = path.join(tmpDir, `animu_${Date.now()}.${inputExt}`);
  const output = path.join(tmpDir, `animu_${Date.now()}.webp`);
  fs.writeFileSync(input, mediaBuffer);

  const ffmpegCmd = isAnimated
    ? `ffmpeg -y -i "${input}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,fps=15" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 60 -compression_level 6 "${output}"`
    : `ffmpeg -y -i "${input}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${output}"`;

  await new Promise((resolve, reject) => {
    exec(ffmpegCmd, (err) => (err ? reject(err) : resolve()));
  });

  let webpBuffer = fs.readFileSync(output);
  const img = new webp.Image();
  await img.load(webpBuffer);

  const json = {
    'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
    'sticker-pack-name': 'Anime Stickers',
    'emojis': ['🎌']
  };
  const exifAttr = Buffer.from([0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,0x00,0x00,0x16,0x00,0x00,0x00]);
  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
  const exif = Buffer.concat([exifAttr, jsonBuffer]);
  exif.writeUIntLE(jsonBuffer.length, 14, 4);
  img.exif = exif;

  const finalBuffer = await img.save(null);

  try { fs.unlinkSync(input); } catch {}
  try { fs.unlinkSync(output); } catch {}
  return finalBuffer;
}

async function sendAnimuAction(sock, chatId, message, action) {
  const axios = require('axios');
  try {
    const res = await axios.get(`${ANIMU_BASE}/${action}`, { timeout: 15000 });
    const data = res.data || {};

    if (data.link) {
      const link = data.link;
      const lower = link.toLowerCase();
      const isGif = lower.endsWith('.gif');
      const isImage = lower.match(/\.(jpg|jpeg|png|webp)$/);

      if (isGif || isImage) {
        const resp = await axios.get(link, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const stickerBuf = await convertMediaToSticker(Buffer.from(resp.data), isGif);
        return await sock.sendMessage(chatId, { sticker: stickerBuf }, { quoted: message });
      }

      return await sock.sendMessage(chatId, { image: { url: link }, caption: `anime: ${action}` }, { quoted: message });
    }

    if (data.quote) {
      return await sock.sendMessage(chatId, { text: `🎌 *Anime Quote:*\n\n"${data.quote}"` }, { quoted: message });
    }

    return await sock.sendMessage(chatId, { text: '❌ Failed to fetch anime action.' }, { quoted: message });

  } catch (err) {
    console.error('Error sending anime action:', err);
    await sock.sendMessage(chatId, { text: '❌ An error occurred while fetching anime action.' }, { quoted: message });
  }
}

async function sendAnimeCharacter(sock, chatId, message, character) {
  const axios = require('axios');
  try {
    const apiUrl = `https://raw.githubusercontent.com/Guru322/api/Guru/BOT-JSON/anime-${character}.json`;
    const res = await axios.get(apiUrl, { timeout: 15000, validateStatus: s => s < 500 });
    const images = res.data;
    if (!Array.isArray(images) || images.length === 0) throw new Error('No images found');
    const randomImages = pickRandom(images, Math.min(3, images.length));

    for (const img of randomImages) {
      try {
        const imageData = await axios.get(img, { responseType: 'arraybuffer', timeout: 15000 });
        await sock.sendMessage(chatId, { image: Buffer.from(imageData.data), caption: `_${character}_` }, { quoted: message });
      } catch {}
    }
  } catch (err) {
    console.error('Error sending anime character:', err);
    await sock.sendMessage(chatId, { text: '❌ Failed to fetch anime images. Please try again later.' }, { quoted: message });
  }
}

module.exports = {
  command: 'anime',
  aliases: ['animu', 'animes', 'animeimg', 'animepic'],
  category: 'menu',
  description: 'Send anime action stickers/quotes or character images',
  usage: '.anime <action | character_name>',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const input = (args[0] || '').toLowerCase().trim();
    const actionNormalized = normalizeAction(input);

    // 1. Reaction Action Check
    if (supportedActions.includes(actionNormalized)) {
      await sock.sendMessage(chatId, { react: { text: '🎌', key: message.key } });
      return await sendAnimuAction(sock, chatId, message, actionNormalized);
    }

    // 2. Character Image Check
    if (supportedCharacters.includes(input)) {
      await sock.sendMessage(chatId, { react: { text: '🌸', key: message.key } });
      return await sendAnimeCharacter(sock, chatId, message, input);
    }

    // 3. Display Comprehensive Menu
    const menuText =
      `🎀 *ANIME HUB* 🎀\n\n` +
      `🎭 *Action Stickers & Quotes:*\n` +
      `• ${supportedActions.join(', ')}\n\n` +
      `🖼️ *Character Pictures:*\n` +
      `• ${supportedCharacters.join(', ')}\n\n` +
      `📌 *Usage:*\n` +
      `• \`.anime hug\` (Send anime reaction sticker)\n` +
      `• \`.anime naruto\` (Send anime character pictures)\n` +
      `• \`.anime quote\` (Send anime quote)`;

    const errorPrefix = input ? `❌ *Unknown option:* "${input}"\n\n` : '';
    await sock.sendMessage(chatId, { text: errorPrefix + menuText }, { quoted: message });
  }
};
