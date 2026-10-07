const settings = require('../settings');
const commandHandler = require('../lib/commandHandler');
const path = require('path');
const fs = require('fs');

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
  command: 'menu',
  aliases: ['help', 'commands', 'h', 'list'],
  category: 'general',
  description: 'Show bot commands and categorized menu',
  usage: '.menu [command]',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};
    const prefix = settings.prefixes ? settings.prefixes[0] : '.';
    const botName = (settings.botName || 'PGWIZ-MD').toUpperCase();
    const version = settings.version || '5.2.0';
    const imagePath = path.join(__dirname, '../assets/bot_image.jpg');

    // 1. Single Command Info Lookup
    if (args.length) {
      const searchTerm = args[0].toLowerCase();
      
      let cmd = commandHandler.commands.get(searchTerm);
      if (!cmd && commandHandler.aliases.has(searchTerm)) {
        const mainCommand = commandHandler.aliases.get(searchTerm);
        cmd = commandHandler.commands.get(mainCommand);
      }
      
      if (!cmd) {
        return await sock.sendMessage(chatId, { 
          text: `*✩ ${botName} HELP ✩*\n${DIVIDER}\n❌ Command *${args[0]}* not found.\nUse *${prefix}menu* to see all commands.\n${DIVIDER}`,
          ...channelInfo
        }, { quoted: message });
      }

      const text = `*✩ ${botName} COMMAND INFO ✩*
${DIVIDER}
⚡ *Command:* ${prefix}${cmd.command}
📝 *Description:* ${cmd.description || 'No description provided'}
📖 *Usage:* ${cmd.usage || `${prefix}${cmd.command}`}
🏷️ *Category:* ${cmd.category || 'general'}
🔖 *Aliases:* ${cmd.aliases?.length ? cmd.aliases.map(a => prefix + a).join(', ') : 'None'}
${DIVIDER}`;

      if (fs.existsSync(imagePath)) {
        return await sock.sendMessage(chatId, {
          image: { url: imagePath },
          caption: text,
          ...channelInfo
        }, { quoted: message });
      }

      return await sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });
    }

    // 2. Full Categorized Menu
    const uptimeText = getUptimeString();
    const timeText = formatTime();
    const totalPlugins = commandHandler.commands.size;

    let text = `*✩ ${botName} MENU ✩*
${DIVIDER}
🟢 *Status:* ACTIVE
⏱️ *Uptime:* ${uptimeText}
🔌 *Plugins:* ${totalPlugins}
⚙️ *Prefix:* ${prefix}
🕐 *Time:* ${timeText}
🤖 *Version:* ${version}
${DIVIDER}\n\n`;

    const categories = Array.from(commandHandler.categories.keys()).sort();

    for (const cat of categories) {
      const cmds = commandHandler.categories.get(cat) || [];
      if (cmds.length === 0) continue;

      text += `*✩ ${cat.toUpperCase()} ✩*\n${DIVIDER}\n`;
      for (const c of cmds) {
        const isOff = commandHandler.disabledCommands.has(c.toLowerCase());
        const dot = isOff ? '🔴' : '🟢';
        text += `${dot} *${prefix}${c}*\n`;
      }
      text += `${DIVIDER}\n\n`;
    }

    text = text.trim();

    if (fs.existsSync(imagePath)) {
      await sock.sendMessage(chatId, {
        image: { url: imagePath },
        caption: text,
        ...channelInfo
      }, { quoted: message });
    } else {
      await sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });
    }
  }
};
