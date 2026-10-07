const CommandHandler = require('../lib/commandHandler');
const settings = require("../settings");
const fs = require('fs');
const path = require('path');

const DIVIDER = '━━━━━━━━━━━━━';

function formatTime() {
  try {
    const now = new Date();
    const options = {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: settings.timeZone || 'Africa/Nairobi'
    };
    return now.toLocaleTimeString('en-US', options);
  } catch {
    return new Date().toLocaleTimeString('en-US');
  }
}

function getUptimeString() {
  let uptime = Math.floor(process.uptime());
  const days = Math.floor(uptime / 86400);
  uptime %= 86400;
  const hours = Math.floor(uptime / 3600);
  uptime %= 3600;
  const minutes = Math.floor(uptime / 60);
  const seconds = uptime % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

module.exports = {
  command: 'smenu',
  aliases: ['shelp', 'smart', 'smartmenu'],
  category: 'general',
  description: 'Interactive smart menu with live status',
  usage: '.smenu',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};
    const prefix = settings.prefixes ? settings.prefixes[0] : '.';
    const botName = (settings.botName || 'PGWIZ-MD').toUpperCase();
    const version = settings.version || '5.2.0';

    try {
      const imagePath = path.join(__dirname, '../assets/bot_image.jpg');
      const categories = Array.from(CommandHandler.categories.keys()).sort();
      const stats = CommandHandler.getDiagnostics();
      const uptimeText = getUptimeString();
      const timeText = formatTime();
      const totalPlugins = CommandHandler.commands.size || (() => {
        try {
          return fs.readdirSync(path.join(__dirname, '../plugins')).filter(f => f.endsWith('.js')).length;
        } catch {
          return 227;
        }
      })();

      let menuText = `*✩ ${botName} SMART MENU ✩*
${DIVIDER}
🟢 *Status:* ACTIVE
⏱️ *Uptime:* ${uptimeText}
🔌 *Plugins:* ${totalPlugins}
⚙️ *Prefix:* ${prefix}
🕐 *Time:* ${timeText}
🤖 *Version:* ${version}
${DIVIDER}\n\n`;

      const topCmds = stats.slice(0, 3).filter(s => s.usage > 0);
      if (topCmds.length > 0) {
        menuText += `*✩ TOP COMMANDS ✩*\n${DIVIDER}\n`;
        topCmds.forEach((c, i) => {
          const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
          menuText += `${rank} *${prefix}${c.command}* (${c.usage} uses)\n`;
        });
        menuText += `${DIVIDER}\n\n`;
      }

      for (const cat of categories) {
        const catCmds = CommandHandler.getCommandsByCategory(cat);
        if (!catCmds || catCmds.length === 0) continue;

        menuText += `*✩ ${cat.toUpperCase()} ✩*\n${DIVIDER}\n`;
        catCmds.forEach((cmdName) => {
          const isOff = CommandHandler.disabledCommands.has(cmdName.toLowerCase());
          const dot = isOff ? '🔴' : '🟢';
          menuText += `${dot} *${prefix}${cmdName}*\n`;
        });
        menuText += `${DIVIDER}\n\n`;
      }

      menuText = menuText.trim();

      if (fs.existsSync(imagePath)) {
        await sock.sendMessage(chatId, {
          image: { url: imagePath },
          caption: menuText,
          ...channelInfo
        }, { quoted: message });
      } else {
        await sock.sendMessage(chatId, {
          text: menuText,
          ...channelInfo
        }, { quoted: message });
      }

    } catch (error) {
      console.error('Smart Menu Error:', error);
      await sock.sendMessage(chatId, {
        text: `*✩ ${botName} MENU ✩*\n${DIVIDER}\n❌ Error generating menu: ${error.message}\n${DIVIDER}`
      }, { quoted: message });
    }
  }
};
