// Lazy-loaded: const axios = require('axios');

module.exports = {
  command: 'joke',
  aliases: ['jokes', 'funny', 'joke2', 'jokes2', 'funny2', 'dadjoke'],
  category: 'fun',
  description: 'Get a random joke (dad jokes, general jokes, with dual API fallback)',
  usage: '.joke [dad|general]',
  async handler(sock, message, args, context = {}) {
    const axios = require('axios');
    const chatId = context.chatId || message.key.remoteJid;
    const body = (message.body || '').toLowerCase().trim();
    const arg0 = (args[0] || '').toLowerCase().trim();

    const prefersGeneral = body.includes('joke2') || body.includes('funny2') || arg0 === 'general';

    async function fetchGeneralJoke() {
      const res = await axios.get('https://discardapi.dpdns.org/api/joke/general?apikey=guru', { timeout: 10000 });
      if (!res.data || res.data.status !== true) throw new Error('Invalid API response');
      const setup = res.data.result?.setup || '';
      const punchline = res.data.result?.punchline || '';
      if (!setup && !punchline) throw new Error('Empty joke result');
      return `😂 *Joke*\n\n${setup}\n\n👉 ${punchline}`;
    }

    async function fetchDadJoke() {
      const res = await axios.get('https://icanhazdadjoke.com/', {
        headers: { Accept: 'application/json' },
        timeout: 10000
      });
      const joke = res.data?.joke;
      if (!joke) throw new Error('Empty dad joke');
      return `😂 ${joke}`;
    }

    try {
      let jokeText = '';
      if (prefersGeneral) {
        try {
          jokeText = await fetchGeneralJoke();
        } catch (e1) {
          jokeText = await fetchDadJoke();
        }
      } else {
        try {
          jokeText = await fetchDadJoke();
        } catch (e2) {
          jokeText = await fetchGeneralJoke();
        }
      }

      await sock.sendMessage(chatId, { text: jokeText }, { quoted: message });
    } catch (error) {
      console.error('Error fetching joke:', error);
      await sock.sendMessage(chatId, { 
        text: '❌ Sorry, I could not fetch a joke right now. Please try again later.', 
        quoted: message 
      });
    }
  }
};
