const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const request = require('request');

// Replace with your actual Firebase service account key file
const serviceAccount = require('./key.json');

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore();
const token = '7820421196:AAGUW5-uwbpXv4RazyPTjb8CbEcho7iog7c';
const bot = new TelegramBot(token, { polling: true });

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userInput = msg.text.split(' ');

  if (userInput[0] === 'movie') {
    const movieName = userInput.slice(1).join(' '); // Get full movie title

    if (!movieName) {
      bot.sendMessage(chatId, '❌ Please enter a movie name. Example: movie Inception');
      return;
    }

    request(`http://www.omdbapi.com/?t=${movieName}&apikey=12bd2b2f`, async (error, response, body) => {
      if (error) {
        bot.sendMessage(chatId, '❌ Error fetching movie details. Try again.');
        return;
      }

      const data = JSON.parse(body);

      if (data.Response === 'True') {
        const movieData = {
          title: data.Title,
          releaseDate: data.Released,
          actors: data.Actors,
          rating: data.Ratings.length > 0 ? data.Ratings[0].Value : 'N/A',
          userId: msg.from.id,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        };

        // Save movie details in Firebase Firestore
        await db.collection('Movies').add(movieData);

        bot.sendMessage(chatId, `🎬 *Title:* ${data.Title}\n📅 *Release Date:* ${data.Released}\n🎭 *Actors:* ${data.Actors}\n⭐ *Rating:* ${movieData.rating}`, { parse_mode: "Markdown" });
      } else {
        bot.sendMessage(chatId, '❌ Movie not found. Try another title.');
      }
    });

  } else if (userInput[0] === 'getMovies') {
    try {
      const snapshot = await db.collection('Movies').where('userId', '==', msg.from.id).get();

      if (snapshot.empty) {
        bot.sendMessage(chatId, '📭 You have not searched for any movies yet.');
        return;
      }

      let movieList = '🎥 *Your Searched Movies:*\n';
      snapshot.forEach(doc => {
        const data = doc.data();
        movieList += `🎬 *${data.title}* - ⭐ ${data.rating}\n`;
      });

      bot.sendMessage(chatId, movieList, { parse_mode: "Markdown" });

    } catch (error) {
      bot.sendMessage(chatId, '❌ Error retrieving your movie list.');
      console.error(error);
    }

  } else {
    bot.sendMessage(chatId, '🤖 Commands:\n🎬 *movie <title>* - Get movie details\n📜 *getMovies* - Retrieve your searched movies', { parse_mode: "Markdown" });
  }
});
