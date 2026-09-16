// Lazy-loaded: const axios = require('axios');

module.exports = {
  command: 'quote',
  aliases: ['quotes', 'quotetext', 'quote2', 'quotes2', 'randomquote', 'inspirational'],
  category: 'quotes',
  description: 'Get a random inspirational quote with dual API fallback',
  usage: '.quote',
  async handler(sock, message, args, context = {}) {
    const axios = require('axios');
    const chatId = context.chatId || message.key.remoteJid;

    async function fetchQuote1() {
      const res = await axios.get('https://shizoapi.onrender.com/api/texts/quotes?apikey=shizo', { timeout: 10000 });
      const quote = res.data?.result;
      if (!quote || typeof quote !== 'string') throw new Error('Invalid response from quote API 1');
      return quote.trim();
    }

    async function fetchQuote2() {
      const res = await axios.get('https://discardapi.dpdns.org/api/quotes/random?apikey=guru', { timeout: 10000 });
      if (!res.data || res.data.status !== true) throw new Error('Invalid response from quote API 2');
      const quote = res.data.result?.quote;
      if (!quote || typeof quote !== 'string') throw new Error('Empty quote in API 2');
      return quote.trim();
    }

    try {
      let quoteText = '';
      try {
        quoteText = await fetchQuote2();
      } catch (err1) {
        quoteText = await fetchQuote1();
      }

      await sock.sendMessage(chatId, { 
        text: `💬 *Random Quote*\n\n${quoteText}` 
      }, { quoted: message });
    } catch (error) {
      console.error('Quote Command Error:', error);
      await sock.sendMessage(chatId, {
        text: '❌ Failed to get quote. Please try again later!'
      }, { quoted: message });
    }
  }
};
