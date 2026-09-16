// Lazy-loaded: const axios = require('axios');

// Utility to decode Unicode escapes
function decodeUnicode(str) {
  if (!str) return 'N/A';
  return str.replace(/\\u[\dA-F]{4}/gi, match =>
    String.fromCharCode(parseInt(match.replace("\\u", ""), 16))
  );
}

module.exports = {
  command: 'genshin',
  aliases: ['genshinimpact', 'gi', 'uid'],
  category: 'stalk',
  description: 'Stalk Genshin Impact UID',
  usage: '.genshin <UID>',

  async handler(sock, message, args, context = {}) {
    const axios = require('axios');
    const chatId = context.chatId || message.key.remoteJid;

    if (!args.length) {
      return await sock.sendMessage(chatId, {
        text: '*Please provide a Genshin UID.*\nExample: .genshin 826401293'
      }, { quoted: message });
    }

    const uid = args[0];

    try {
      const { data } = await axios.get(`https://discardapi.dpdns.org/api/stalk/genshin`, {
        params: { apikey: 'guru', text: uid }
      });

      if (!data?.result) {
        return await sock.sendMessage(chatId, { text: '❌ UID not found or invalid.' }, { quoted: message });
      }

      const res = data.result;

      const profile = `
🎮 *Genshin Impact Player Info* 🎮

👤 *Nickname:* ${decodeUnicode(res.playerInfo?.nickname)}
⭐ *Adventure Rank:* ${res.playerInfo?.level || 'N/A'}
🌍 *World Level:* ${res.playerInfo?.worldLevel || 'N/A'}
📝 *Signature:* ${decodeUnicode(res.playerInfo?.signature)}
🏆 *Achievements:* ${res.playerInfo?.finishAchievementNum || 'N/A'}
🗼 *Spiral Abyss:* Floor ${res.playerInfo?.towerFloorIndex || 'N/A'} - Chamber ${res.playerInfo?.towerLevelIndex || 'N/A'}
`;

      await sock.sendMessage(chatId, { text: profile }, { quoted: message });

    } catch (err) {
      console.error('Genshin stalk error:', err);
      await sock.sendMessage(chatId, { text: '❌ Failed to fetch Genshin UID info.' }, { quoted: message });
    }
  }
};
