const CommandHandler = require('../lib/commandHandler');
const settings = require("../settings");

const DIVIDER = '━━━━━━━━━━━━━';

module.exports = {
  command: 'perf',
  aliases: ['metrics', 'diagnostics'],
  category: 'general',
  description: 'View command performance and error metrics',
  usage: '.perf',
  ownerOnly: 'true',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};
    const botName = (settings.botName || 'PGWIZ-MD').toUpperCase();

    try {
      const report = CommandHandler.getDiagnostics();

      if (!report || report.length === 0) {
        return await sock.sendMessage(chatId, {
          text: `*✩ ${botName} PERFORMANCE ✩*\n${DIVIDER}\n_No performance data collected yet._\n${DIVIDER}`,
          ...channelInfo
        }, { quoted: message });
      }

      let text = `*✩ ${botName} PERFORMANCE ✩*\n${DIVIDER}\n`;

      report.slice(0, 20).forEach((cmd) => {
        const errorText = cmd.errors > 0 ? `🔴 ${cmd.errors} err` : `🟢 Optimal`;
        text += `⚡ *${cmd.command.toUpperCase()}*\n`;
        text += `• Calls: ${cmd.usage} | Avg: ${cmd.average_speed} | ${errorText}\n\n`;
      });
      text += `${DIVIDER}`;

      await sock.sendMessage(chatId, {
        text: text.trim(),
        ...channelInfo
      }, { quoted: message });

    } catch (error) {
      console.error('Error in perf command:', error);
      await sock.sendMessage(chatId, { text: '❌ Failed to fetch performance metrics.' }, { quoted: message });
    }
  }
};
