const Qasim = require('api-qasim');
const settings = require('../settings');
const DIVIDER = '━━━━━━━━━━━━━';

module.exports = {
  command: 'npmstalk',
  aliases: ['npmstlk'],
  category: 'stalk',
  description: 'Get details about an NPM package',
  usage: '.npmstalk <package-name>',

  async handler(sock, message, args, context = {}) {
    const { chatId, usedPrefix, channelInfo } = context;
    const botName = (settings.botName || 'PGWIZ-MD').toUpperCase();
    const prefix = usedPrefix || '.';

    if (!args[0]) {
      return await sock.sendMessage(chatId, { 
        text: `*✩ ${botName} NPM STALK ✩*\n${DIVIDER}\n⚠️ Please provide an NPM package name.\n\nExample:\n${prefix}npmstalk axios\n${DIVIDER}`,
        ...channelInfo
      }, { quoted: message });
    }

    try {
      let res = await Qasim.npmStalk(args[0]);

      if (!res || !res.result) {
        throw new Error('Package not found or API error.');
      }

      const data = res.result;
      const authorName = (typeof data.author === 'object') ? data.author.name : (data.author || 'Unknown');
      const versionCount = data.versions ? Object.keys(data.versions).length : 0;

      const te = `*✩ ${botName} NPM INFO ✩*
${DIVIDER}
📦 *Package:* ${data.name}
👤 *Author:* ${authorName}
🏷️ *Version:* ${data['dist-tags']?.latest || 'N/A'}
🔢 *Versions:* ${versionCount}
${DIVIDER}
📝 *Description:*
${data.description || 'No description'}
${DIVIDER}
🧩 *Repository:* ${data.repository?.url || 'None'}
🌐 *Homepage:* ${data.homepage || 'None'}
🔗 *Link:* https://npmjs.com/package/${data.name}
${DIVIDER}`;

      await sock.sendMessage(chatId, { text: te, ...channelInfo }, { quoted: message });

    } catch (error) {
      console.error('NPM Stalk Error:', error);
      await sock.sendMessage(chatId, { 
        text: `*✩ ${botName} NPM INFO ✩*\n${DIVIDER}\n❌ Error: Package not found or API issue.\n${DIVIDER}`,
        ...channelInfo
      }, { quoted: message });
    }
  }
};
        
