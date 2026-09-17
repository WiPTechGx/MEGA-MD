const fs = require('fs');
const path = require('path');
const store = require('../lib/lightweight_store');

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);

const databaseDir = path.join(process.cwd(), 'data');
const warningsPath = path.join(databaseDir, 'warnings.json');

function initializeWarningsFile() {
  if (!HAS_DB) {
    if (!fs.existsSync(databaseDir)) {
      fs.mkdirSync(databaseDir, { recursive: true });
    }
    if (!fs.existsSync(warningsPath)) {
      fs.writeFileSync(warningsPath, JSON.stringify({}), 'utf8');
    }
  }
}

async function getWarnings() {
  if (HAS_DB) {
    const warnings = await store.getSetting('global', 'warnings');
    return warnings || {};
  } else {
    try {
      if (!fs.existsSync(warningsPath)) return {};
      return JSON.parse(fs.readFileSync(warningsPath, 'utf8'));
    } catch (error) {
      return {};
    }
  }
}

async function saveWarnings(warnings) {
  if (HAS_DB) {
    await store.saveSetting('global', 'warnings', warnings);
  } else {
    fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2));
  }
}

module.exports = {
  command: 'warn',
  aliases: ['warning', 'warnings', 'checkwarn', 'warncount'],
  category: 'admin',
  description: 'Warn a user (auto-kick after 3 warnings), check warning count, or reset warnings',
  usage: '.warn [@user] | .warnings [@user] | .warn reset [@user]',
  groupOnly: true,
  adminOnly: false, // Handled dynamically so any member can check their own warnings with .warnings
  
  async handler(sock, message, args, context = {}) {
    const { chatId, senderId, channelInfo, isAdmin } = context;
    const invoked = (context.invokedCmd || context.command || '').toLowerCase();
    const firstArg = (args[0] || '').toLowerCase();
    const isCheckMode = invoked === 'warnings' || invoked === 'checkwarn' || invoked === 'warncount' ||
                        firstArg === 'check' || firstArg === 'count' || firstArg === 'status';
    const isResetMode = firstArg === 'reset' || firstArg === 'clear';

    try {
      initializeWarningsFile();

      // Resolve target user
      let targetUser;
      const ctx = message.message?.extendedTextMessage?.contextInfo;
      if (ctx?.mentionedJid && ctx.mentionedJid.length > 0) {
        targetUser = ctx.mentionedJid[0];
      } else if (ctx?.participant) {
        targetUser = ctx.participant;
      } else if (args[0] && !['check', 'count', 'status', 'reset', 'clear'].includes(firstArg)) {
        const rawNum = args[0].replace(/[^0-9]/g, '');
        if (rawNum.length >= 7) targetUser = `${rawNum}@s.whatsapp.net`;
      } else if (args[1]) {
        const rawNum = args[1].replace(/[^0-9]/g, '');
        if (rawNum.length >= 7) targetUser = `${rawNum}@s.whatsapp.net`;
      }

      // If in check mode and no target specified, default to sender
      if (isCheckMode && !targetUser) {
        targetUser = senderId;
      }

      let warnings = await getWarnings();

      // --- 1. CHECK WARNINGS MODE ---
      if (isCheckMode) {
        const count = (warnings[chatId] && warnings[chatId][targetUser]) || 0;
        return await sock.sendMessage(chatId, { 
          text: `📊 *WARNING STATUS*\n\n` +
                `👤 *User:* @${targetUser.split('@')[0]}\n` +
                `⚠️ *Warnings:* ${count}/3\n` +
                `🗄️ *Storage:* ${HAS_DB ? 'Database' : 'File System'}`,
          mentions: [targetUser],
          ...channelInfo
        }, { quoted: message });
      }

      // Admin check for issuing or resetting warnings
      if (!isAdmin) {
        return await sock.sendMessage(chatId, {
          text: '❌ *Admin permission required to warn or reset warnings.*',
          ...channelInfo
        }, { quoted: message });
      }

      if (!targetUser) {
        return await sock.sendMessage(chatId, { 
          text: '❌ *Please mention a user or reply to their message.*\n\n*Examples:*\n• `.warn @user`\n• `.warnings @user`\n• `.warn reset @user`',
          ...channelInfo
        }, { quoted: message });
      }

      // --- 2. RESET WARNINGS MODE ---
      if (isResetMode) {
        if (warnings[chatId] && warnings[chatId][targetUser]) {
          delete warnings[chatId][targetUser];
          await saveWarnings(warnings);
        }
        return await sock.sendMessage(chatId, {
          text: `✅ *Warnings reset for @${targetUser.split('@')[0]}!*`,
          mentions: [targetUser],
          ...channelInfo
        }, { quoted: message });
      }

      // --- 3. ISSUE WARNING MODE ---
      if (!warnings[chatId]) warnings[chatId] = {};
      if (!warnings[chatId][targetUser]) warnings[chatId][targetUser] = 0;

      warnings[chatId][targetUser]++;
      await saveWarnings(warnings);

      const count = warnings[chatId][targetUser];
      const warningMessage = `*『 WARNING ALERT 』*\n\n` +
        `👤 *Warned User:* @${targetUser.split('@')[0]}\n` +
        `⚠️ *Warning Count:* ${count}/3\n` +
        `👑 *Warned By:* @${senderId.split('@')[0]}\n` +
        `🗄️ *Storage:* ${HAS_DB ? 'Database' : 'File System'}\n\n` +
        `📅 *Date:* ${new Date().toLocaleString()}`;

      await sock.sendMessage(chatId, { 
        text: warningMessage,
        mentions: [targetUser, senderId],
        ...channelInfo
      });

      // Auto-kick if threshold reached
      if (count >= 3) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          await sock.groupParticipantsUpdate(chatId, [targetUser], "remove");
          delete warnings[chatId][targetUser];
          await saveWarnings(warnings);
          
          const kickMessage = `*『 AUTO-KICK 』*\n\n` +
            `@${targetUser.split('@')[0]} has been removed from the group after receiving 3 warnings! ⚠️`;

          await sock.sendMessage(chatId, { 
            text: kickMessage,
            mentions: [targetUser],
            ...channelInfo
          });
        } catch (kickErr) {
          console.error('Auto-kick failed:', kickErr);
        }
      }

    } catch (error) {
      console.error('Error in warn command:', error);
      await sock.sendMessage(chatId, { 
        text: '❌ Failed to process warning action.',
        ...channelInfo
      }, { quoted: message });
    }
  }
};
