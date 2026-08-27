// Lazy-loaded: const axios = require('axios');

module.exports = {
  command: 'cyberimg',
  aliases: ['cyber', 'cyberspace'],
  category: 'images',
  description: 'Get a random cyberspace image',
  usage: '.cyberimg',

  async handler(sock, message, args, context = {}) {
    const axios = require('axios');
    const chatId = context.chatId || message.key.remoteJid;

    try {
      const res = await axios.get('https://discardapi.dpdns.org/api/img/cyberspace?apikey=guru');

      if (!res.data || res.data.status !== true || !res.data.result) {
        return await sock.sendMessage(chatId, { text: '❌ Failed to fetch image.' }, { quoted: message });
      }

      const imageUrl = res.data.result;

      await sock.sendMessage(chatId, { image: { url: imageUrl }, caption: '🌐 Cyberspace Image' }, { quoted: message });

    } catch (err) {
      console.error('Cyberspace image plugin error:', err);
      await sock.sendMessage(chatId, { text: '❌ Error while fetching image.' }, { quoted: message });
    }
  }
};
