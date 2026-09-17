const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

async function downloadMediaMessage(message, mediaType) {
  const stream = await downloadContentFromMessage(message, mediaType);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const filePath = path.join(tempDir, `tag_${Date.now()}.${mediaType}`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

module.exports = {
  command: 'tag',
  aliases: ['tagall', 'everyone', 'all', 'tagallmembers', 'mentionall', 'groupmention'],
  category: 'admin',
  description: 'Tag all group members with optional message, media, or formatted mention list',
  usage: '.tag [message] | .tagall | reply to media with .tag',
  groupOnly: true,
  adminOnly: true,
  
  async handler(sock, message, args, context = {}) {
    const { chatId, channelInfo } = context;
    
    try {
      const groupMetadata = await sock.groupMetadata(chatId);
      const participants = groupMetadata.participants || [];

      if (participants.length === 0) {
        await sock.sendMessage(chatId, { 
          text: '❌ No participants found in the group.',
          ...channelInfo
        }, { quoted: message });
        return;
      }

      const mentionedJidList = participants.map(p => p.id);
      const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const tagText = (args || []).join(' ').trim();
      let tempFiles = [];

      if (replyMessage) {
        let messageContent = {};

        if (replyMessage.imageMessage) {
          const filePath = await downloadMediaMessage(replyMessage.imageMessage, 'image');
          tempFiles.push(filePath);
          messageContent = {
            image: { url: filePath },
            caption: tagText || replyMessage.imageMessage.caption || '',
            mentions: mentionedJidList,
            ...channelInfo
          };
        } else if (replyMessage.videoMessage) {
          const filePath = await downloadMediaMessage(replyMessage.videoMessage, 'video');
          tempFiles.push(filePath);
          messageContent = {
            video: { url: filePath },
            caption: tagText || replyMessage.videoMessage.caption || '',
            mentions: mentionedJidList,
            ...channelInfo
          };
        } else if (replyMessage.documentMessage) {
          const filePath = await downloadMediaMessage(replyMessage.documentMessage, 'document');
          tempFiles.push(filePath);
          messageContent = {
            document: { url: filePath },
            fileName: replyMessage.documentMessage.fileName,
            caption: tagText || '',
            mentions: mentionedJidList,
            ...channelInfo
          };
        } else if (replyMessage.conversation || replyMessage.extendedTextMessage) {
          const replyText = replyMessage.conversation || replyMessage.extendedTextMessage.text || '';
          messageContent = {
            text: tagText ? `${tagText}\n\n> ${replyText}` : replyText,
            mentions: mentionedJidList,
            ...channelInfo
          };
        }

        if (Object.keys(messageContent).length > 0) {
          await sock.sendMessage(chatId, messageContent);
          tempFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });
          return;
        }
      }

      // If user passed a custom text message (e.g. .tag meeting in 5 minutes)
      if (tagText) {
        await sock.sendMessage(chatId, {
          text: `📢 *Announcement:*\n\n${tagText}`,
          mentions: mentionedJidList,
          ...channelInfo
        });
        return;
      }

      // If no text and no reply (e.g. .tagall or bare .tag), list all usernames
      let messageText = '🔊 *Hello Everyone:*\n\n';
      participants.forEach(participant => {
        messageText += `@${participant.id.split('@')[0]}\n`;
      });

      await sock.sendMessage(chatId, {
        text: messageText.trim(),
        mentions: mentionedJidList,
        ...channelInfo
      });

    } catch (error) {
      console.error('Error in tag command:', error);
      await sock.sendMessage(chatId, { 
        text: '❌ Failed to tag group members.',
        ...channelInfo
      }, { quoted: message });
    }
  }
};
