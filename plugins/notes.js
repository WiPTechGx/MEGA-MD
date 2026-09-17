const store = require('../lib/lightweight_store');

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);

let notesDB = {};

async function getUserNotes(userId) {
  if (HAS_DB) {
    const notes = await store.getSetting(userId, 'notes');
    return notes || [];
  } else {
    return notesDB[userId] || [];
  }
}

async function saveUserNotes(userId, notes) {
  if (HAS_DB) {
    await store.saveSetting(userId, 'notes', notes);
  } else {
    notesDB[userId] = notes;
  }
}

module.exports = {
  command: 'notes',
  aliases: ['note', 'save', 'saved'],
  category: 'menu',
  description: 'Store, view, and delete personal notes or save snippets',
  usage: '.notes <add|all|del|delall> [text|ID] | .save <text> | reply with .save',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const sender = message.key.participant || message.key.remoteJid;

    try {
      const firstArg = args[0] ? args[0].toLowerCase() : null;

      const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedText =
        quoted?.conversation ||
        quoted?.extendedTextMessage?.text ||
        quoted?.imageMessage?.caption ||
        quoted?.videoMessage?.caption ||
        quoted?.documentMessage?.caption ||
        '';

      const menuText = `
╭───── *『 NOTES & SAVED 』* ───◆
┃ Store notes & messages for later
┃ Storage: ${HAS_DB ? 'Database 🗄️' : 'Memory 📁'}
┃
┃ ● Save Note / Message
┃    .save your text here
┃    (or reply to any message with .save)
┃
┃ ● View All Notes
┃    .notes all (or .save list)
┃
┃ ● Delete Note
┃    .notes del <noteID>
┃
┃ ● Delete All Notes
┃    .notes delall
╰━━━━━━━━━━━━━━━━━──⊷`.trim();

      // 1. List All Notes
      if (firstArg === 'all' || firstArg === 'list') {
        const userNotes = await getUserNotes(sender);
        if (userNotes.length === 0) {
          return await sock.sendMessage(chatId, { text: "*You have no notes saved.*" }, { quoted: message });
        }

        const list = userNotes.map(n => `*${n.id}.* ${n.text}`).join("\n");
        return await sock.sendMessage(chatId, { 
          text: `*📝 Your Saved Notes:*\n\n${list}\n\n_Total: ${userNotes.length} notes_` 
        }, { quoted: message });
      }

      // 2. Delete Single Note
      if (firstArg === 'del' || firstArg === 'delete' || firstArg === 'remove') {
        const id = parseInt(args[1], 10);
        const userNotes = await getUserNotes(sender);
        
        if (!id || !userNotes.find(n => n.id === id)) {
          return await sock.sendMessage(chatId, {
            text: "❌ Invalid note ID.\nExample: .notes del 1"
          }, { quoted: message });
        }
        
        const filteredNotes = userNotes.filter(n => n.id !== id).map((item, index) => ({
          ...item,
          id: index + 1
        }));
        await saveUserNotes(sender, filteredNotes);
        
        return await sock.sendMessage(chatId, { text: `✅ *Note ID ${id} deleted.*` }, { quoted: message });
      }

      // 3. Delete All Notes
      if (firstArg === 'delall' || firstArg === 'clearall' || firstArg === 'wipe') {
        const userNotes = await getUserNotes(sender);
        if (userNotes.length === 0) {
          return await sock.sendMessage(chatId, { text: "*You have no notes to delete.*" }, { quoted: message });
        }
        
        await saveUserNotes(sender, []);
        return await sock.sendMessage(chatId, { text: "*✅ All notes deleted successfully.*" }, { quoted: message });
      }

      // 4. Add Note (either explicit "add" or direct text / quoted text)
      let textToSave = '';
      if (firstArg === 'add') {
        textToSave = args.slice(1).join(" ").trim() || quotedText;
      } else if (quotedText) {
        textToSave = quotedText;
      } else if (args.length > 0) {
        textToSave = args.join(" ").trim();
      }

      if (!textToSave) {
        return await sock.sendMessage(chatId, { text: menuText }, { quoted: message });
      }

      const userNotes = await getUserNotes(sender);
      const newID = userNotes.length + 1;
      userNotes.push({ id: newID, text: textToSave, createdAt: Date.now() });
      await saveUserNotes(sender, userNotes);

      return await sock.sendMessage(chatId, {
        text: `✅ *Note saved!*\n\n📝 *ID:* ${newID}\n📄 *Content:* ${textToSave}\n🗄️ *Storage:* ${HAS_DB ? 'Database' : 'Memory'}`
      }, { quoted: message });

    } catch (err) {
      console.error("Notes Command Error:", err);
      await sock.sendMessage(chatId, { text: "❌ Error in notes module." }, { quoted: message });
    }
  }
};
