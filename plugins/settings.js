const isOwnerOrSudo = require('../lib/isOwner');
const store = require('../lib/lightweight_store');
const { cleanJid } = require('../lib/isOwner');

module.exports = {
    command: 'settings',
    aliases: ['config', 'setting'],
    category: 'owner',
    description: 'Show bot settings and per-group configurations',
    usage: '.settings',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const senderId = message.key.participant || message.key.remoteJid;

        try {
            const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
            const isMe = message.key.fromMe;

            if (!isMe && !isOwner) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ *Access Denied:* Only Owner/Sudo can view settings.' 
                }, { quoted: message });
            }
            
            const isGroup = chatId.endsWith('@g.us');

            const botMode = await store.getBotMode();
            
            const allSettings = await store.getAllSettings('global');
            const autoStatus = allSettings.autoStatus || { enabled: false };
            const autoread = allSettings.autoread || { enabled: false };
            const autotyping = allSettings.autotyping || { enabled: false };
            const pmblocker = allSettings.pmblocker || { enabled: false };
            const anticall = allSettings.anticall || { enabled: false };
            const autoReaction = allSettings.autoReaction || false;

            const getSt = (val) => val ? '✅' : '❌';

            const botName = (require('../settings').botName || 'PGWIZ-MD').toUpperCase();
            const DIVIDER = '━━━━━━━━━━━━━';

            let menuText = `*✩ ${botName} SETTINGS ✩*\n${DIVIDER}\n`;
            menuText += `👤 *User:* @${cleanJid(senderId)}\n`;
            menuText += `🤖 *Mode:* ${botMode.toUpperCase()}\n`;
            menuText += `${DIVIDER}\n`;
            menuText += `⚙️ *GLOBAL CONFIG:*\n`;
            menuText += `${getSt(autoStatus?.enabled)} *Auto Status*\n`;
            menuText += `${getSt(autoread?.enabled)} *Auto Read*\n`;
            menuText += `${getSt(autotyping?.enabled)} *Auto Typing*\n`;
            menuText += `${getSt(pmblocker?.enabled)} *PM Blocker*\n`;
            menuText += `${getSt(anticall?.enabled)} *Anti Call*\n`;
            menuText += `${getSt(autoReaction)} *Auto Reaction*\n`;
            menuText += `${DIVIDER}\n`;

            if (isGroup) {
                const groupSettings = await store.getAllSettings(chatId);
                
                const groupAntilink = groupSettings.antilink || { enabled: false };
                const groupBadword = groupSettings.antibadword || { enabled: false };
                const groupAntitag = groupSettings.antitag || { enabled: false };
                const groupChatbot = groupSettings.chatbot || false;
                const groupWelcome = groupSettings.welcome || false;
                const groupGoodbye = groupSettings.goodbye || false;

                menuText += `👥 *GROUP CONFIG:*\n`;
                menuText += `${getSt(groupAntilink.enabled)} *Antilink*\n`;
                menuText += `${getSt(groupBadword.enabled)} *Antibadword*\n`;
                menuText += `${getSt(groupAntitag.enabled)} *Antitag*\n`;
                menuText += `${getSt(groupChatbot)} *Chatbot*\n`;
                menuText += `${getSt(groupWelcome)} *Welcome*\n`;
                menuText += `${getSt(groupGoodbye)} *Goodbye*\n`;
                menuText += `${DIVIDER}`;
            } else {
                menuText += `💡 *Note:* _Run in group to view group configs._\n${DIVIDER}`;
            }

            await sock.sendMessage(chatId, { 
                text: menuText,
                mentions: [senderId],
                contextInfo: {
                    externalAdReply: {
                        title: "SYSTEM SETTINGS PANEL",
                        body: "Configuration Status",
                        thumbnailUrl: "https://github.com/pgwiz.png",
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: message });

        } catch (error) {
            console.error('Settings Command Error:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ Error: Failed to load settings.' 
            }, { quoted: message });
        }
    }
};
