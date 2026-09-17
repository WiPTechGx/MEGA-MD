// Lazy-loaded: const QRCode = require('qrcode');
// Lazy-loaded: const axios = require('axios');

function parseColorToHex(input) {
  if (!input) return '#000000';
  const clean = input.trim();
  if (clean.startsWith('#')) return clean;
  // Handle "255-0-0" or "255,0,0" format
  const rgbParts = clean.split(/[-,\s]+/).map(n => parseInt(n, 10));
  if (rgbParts.length >= 3 && rgbParts.every(n => !isNaN(n) && n >= 0 && n <= 255)) {
    const toHex = (n) => n.toString(16).padStart(2, '0');
    return `#${toHex(rgbParts[0])}${toHex(rgbParts[1])}${toHex(rgbParts[2])}`;
  }
  return clean;
}

module.exports = {
  command: 'qrcode',
  aliases: ['qr', 'customqr', 'makeqr', 'qrgen'],
  category: 'tools',
  description: 'Generate a standard or custom-colored QR code from text',
  usage: '.qrcode <text> [| size | color] (e.g. .qrcode Hello | 400 | #ff0000)',

  async handler(sock, message, args, context = {}) {
    const QRCode = require('qrcode');
    const chatId = context.chatId || message.key.remoteJid;
    const rawInput = (args || []).join(' ');

    if (!rawInput.trim()) {
      return await sock.sendMessage(chatId, {
        text: `📱 *QR Code Generator*\n\n` +
              `*Usage:*\n` +
              `• \`.qrcode <text>\` - Standard QR Code\n` +
              `• \`.qrcode <text> | <size> | <color>\` - Custom Color/Size QR\n\n` +
              `*Examples:*\n` +
              `• \`.qrcode https://github.com/pgwiz\`\n` +
              `• \`.customqr PGWIZ | 400 | #00ff00\`\n` +
              `• \`.makeqr Qasim | 300 | 255-0-0\``
      }, { quoted: message });
    }

    const parts = rawInput.split('|').map(s => s.trim());
    const text = parts[0];
    const sizePart = parts[1] || '300';
    const colorPart = parts[2] || '';

    if (!text) {
      return await sock.sendMessage(chatId, { text: '❌ Please provide text to encode.' }, { quoted: message });
    }

    await sock.sendMessage(chatId, { react: { text: '🧩', key: message.key } });

    // 1. Primary: Fast local QR generation using npm 'qrcode'
    try {
      const darkColor = colorPart ? parseColorToHex(colorPart) : '#000000';
      const numSize = parseInt(sizePart.replace(/[^0-9]/g, ''), 10) || 300;
      const scale = Math.max(4, Math.min(16, Math.floor(numSize / 35)));

      const qrDataUrl = await QRCode.toDataURL(text.slice(0, 2048), {
        errorCorrectionLevel: 'H',
        scale: scale,
        color: {
          dark: darkColor,
          light: '#ffffff'
        }
      });

      const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      const caption = colorPart
        ? `✅ *QR Code Generated*\n\n📝 *Text:* ${text}\n📐 *Size:* ${numSize}x${numSize}\n🎨 *Color:* ${darkColor}\n\n> Powered by MEGA-MD`
        : `✅ *QR Code Generated*\n\n📝 *Text:* ${text}\n\n> Powered by MEGA-MD`;

      await sock.sendMessage(chatId, {
        image: imageBuffer,
        caption
      }, { quoted: message });
      return;

    } catch (localErr) {
      console.warn('Local QRCode generation failed, attempting API fallback:', localErr.message);
    }

    // 2. Fallback: DiscardAPI customqr endpoint
    try {
      const axios = require('axios');
      const sizeStr = sizePart.includes('x') || sizePart.includes('×') ? sizePart : `${sizePart}×${sizePart}`;
      const colorStr = colorPart || '255-0-0';
      const apiUrl = `https://discardapi.dpdns.org/api/maker/customqr?apikey=guru&text=${encodeURIComponent(text)}&size=${encodeURIComponent(sizeStr)}&color=${encodeURIComponent(colorStr)}`;

      const res = await axios.get(apiUrl, { timeout: 30000, responseType: 'arraybuffer' });
      if (res.data) {
        await sock.sendMessage(chatId, {
          image: Buffer.from(res.data),
          caption: `✅ *QR Code Generated (Fallback)*\n\n📝 *Text:* ${text}\n\n> Powered by MEGA-MD`
        }, { quoted: message });
        return;
      }
    } catch (apiErr) {
      console.error('QR API Fallback Error:', apiErr.message);
    }

    await sock.sendMessage(chatId, { text: '❌ Failed to generate QR code. Please try again.' }, { quoted: message });
  }
};
