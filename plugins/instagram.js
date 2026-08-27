// Lazy-loaded: const axios = require('axios');
const settings = require('../settings');

module.exports = {
  command: 'instagram',
  aliases: ['ig', 'insta', 'igdl', 'instadl'],
  category: 'download',
  description: 'Download Instagram posts, reels, stories, or carousel albums',
  usage: '.instagram <Instagram URL>',

  async handler(sock, message, args, context = {}) {
    const axios = require('axios');
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};

    const text = args.join(' ').trim();
    if (!text) {
      return await sock.sendMessage(
        chatId,
        {
          text: '❌ *Please provide an Instagram link!*\n\n*Usage:* `.instagram https://www.instagram.com/p/...`',
          ...channelInfo
        },
        { quoted: message }
      );
    }

    const igRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv|stories)\/[A-Za-z0-9_-]+/;
    if (!igRegex.test(text)) {
      return await sock.sendMessage(
        chatId,
        {
          text: '❌ *Invalid Instagram link!* Supported formats: posts, reels, tv, stories.',
          ...channelInfo
        },
        { quoted: message }
      );
    }

    await sock.sendMessage(
      chatId,
      { text: '⏳ *Fetching Instagram media...*', ...channelInfo },
      { quoted: message }
    );

    try {
      const apiUrl = `https://api.giftedtech.web.id/api/download/instagram?apikey=gifted&url=${encodeURIComponent(text)}`;
      const { data } = await axios.get(apiUrl, { timeout: 30000 });

      let mediaList = [];

      if (data && data.status === 200 && data.result) {
        if (Array.isArray(data.result)) {
          mediaList = data.result;
        } else if (typeof data.result === 'string') {
          mediaList = [{ url: data.result, type: 'video' }];
        } else if (data.result.url) {
          mediaList = [data.result];
        }
      }

      if (!mediaList || mediaList.length === 0) {
        return await sock.sendMessage(
          chatId,
          { text: '❌ No downloadable media found.', ...channelInfo },
          { quoted: message }
        );
      }

      for (let i = 0; i < mediaList.length; i++) {
        const media = mediaList[i];
        const url = media.url || media;

        const isVideo =
          media.type === 'video' ||
          /\.(mp4|mov|webm|mkv)$/i.test(url) ||
          text.includes('/reel/') ||
          text.includes('/tv/');

        const caption = `📥 *Downloaded by ${settings.botName || "PGWIZ-MD"}*`;

        if (isVideo) {
          await sock.sendMessage(
            chatId,
            {
              video: { url },
              mimetype: 'video/mp4',
              caption,
              ...channelInfo
            },
            { quoted: message }
          );
        } else {
          await sock.sendMessage(
            chatId,
            {
              image: { url },
              caption,
              ...channelInfo
            },
            { quoted: message }
          );
        }

        if (i < mediaList.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

    } catch (err) {
      console.error('Instagram plugin error:', err);
      await sock.sendMessage(
        chatId,
        { text: '❌ Failed to download Instagram media. Please try again later.', ...channelInfo },
        { quoted: message }
      );
    }
  }
};
