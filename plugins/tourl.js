const { downloadMediaMessage } = require('@whiskeysockets/baileys');
// Lazy-loaded: const axios = require('axios');
// Lazy-loaded: const FormData = require('form-data');
const FileType = require('file-type');
const fs = require('fs');
const path = require('path');
const { UploadFileUgu, TelegraPh } = require('../lib/uploader');

async function getMediaBuffer(msg, sock) {
  return await downloadMediaMessage(
    msg,
    'buffer',
    {},
    {
      logger: sock.logger,
      reuploadRequest: sock.updateMediaMessage
    }
  );
}

function getQuotedMessage(message) {
  const ctx = message.message?.extendedTextMessage?.contextInfo;
  if (!ctx?.quotedMessage) return null;

  return {
    key: {
      remoteJid: message.key.remoteJid,
      fromMe: false,
      id: ctx.stanzaId,
      participant: ctx.participant
    },
    message: ctx.quotedMessage
  };
}

module.exports = {
  command: 'tourl',
  aliases: ['url', 'geturl', 'mediaurl', 'upload'],
  category: 'tools',
  description: 'Upload media (image, video, audio, sticker, document) and get a permanent URL with fallback hosters',
  usage: '.tourl (reply to media or send media with caption)',

  async handler(sock, message, args, context = {}) {
    const FormData = require('form-data');
    const axios = require('axios');
    const chatId = context.chatId || message.key.remoteJid;

    try {
      let targetMsg = null;

      if (
        message.message?.imageMessage ||
        message.message?.videoMessage ||
        message.message?.audioMessage ||
        message.message?.stickerMessage ||
        message.message?.documentMessage
      ) {
        targetMsg = message;
      }
      if (!targetMsg) {
        const quoted = getQuotedMessage(message);
        if (quoted) targetMsg = quoted;
      }
      if (!targetMsg) {
        return await sock.sendMessage(
          chatId,
          { text: 'Reply to media or send media with `.tourl`' },
          { quoted: message }
        );
      }

      const buffer = await getMediaBuffer(targetMsg, sock);
      if (!buffer) throw new Error('Failed to download media');

      if (buffer.length > 50 * 1024 * 1024) {
        return await sock.sendMessage(
          chatId,
          { text: '✴️ Media exceeds 50 MB limit.' },
          { quoted: message }
        );
      }

      const detected = await FileType.fromBuffer(buffer);
      const ext = detected ? `.${detected.ext}` : '.bin';
      let finalUrl = '';
      let provider = '';

      // Primary: Catbox
      try {
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', buffer, `upload${ext}`);

        const res = await axios.post(
          'https://catbox.moe/user/api.php',
          form,
          { headers: form.getHeaders(), timeout: 30000 }
        );

        if (typeof res.data === 'string' && res.data.startsWith('https://')) {
          finalUrl = res.data.trim();
          provider = 'Catbox';
        }
      } catch (catboxErr) {
        console.warn('Catbox upload failed, attempting fallback...', catboxErr.message);
      }

      // Fallback: Telegra.ph (images/webp) or Uguu
      if (!finalUrl) {
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const tempPath = path.join(tempDir, `${Date.now()}${ext}`);
        fs.writeFileSync(tempPath, buffer);

        try {
          if (['.jpg', '.jpeg', '.png'].includes(ext.toLowerCase())) {
            try {
              finalUrl = await TelegraPh(tempPath);
              provider = 'Telegraph';
            } catch {
              const resUgu = await UploadFileUgu(tempPath);
              finalUrl = typeof resUgu === 'string' ? resUgu : resUgu?.url;
              provider = 'Uguu';
            }
          } else {
            const resUgu = await UploadFileUgu(tempPath);
            finalUrl = typeof resUgu === 'string' ? resUgu : resUgu?.url;
            provider = 'Uguu';
          }
        } finally {
          try {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          } catch (_) {}
        }
      }

      if (!finalUrl || typeof finalUrl !== 'string' || !finalUrl.startsWith('http')) {
        throw new Error('All upload providers failed');
      }

      const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);

      await sock.sendMessage(
        chatId,
        { text: `✅ *Upload Successful*\n\n🔗 *URL:* ${finalUrl}\n💾 *Size:* ${sizeMB} MB\n🌐 *Host:* ${provider || 'Cloud'}` },
        { quoted: message }
      );

    } catch (e) {
      console.error('Media upload error:', e);
      await sock.sendMessage(
        chatId,
        { text: `❌ Upload failed: ${e.message || 'Unknown error'}` },
        { quoted: message }
      );
    }
  }
};
