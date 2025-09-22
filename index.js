require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');

const TOKEN = process.env.DISCORD_TOKEN;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const CHANNEL_ID = '1419498589134000243';
const MIGUEL_ID = '752987736759205960'; // Tu ID, Miguel

const app = express();
app.get('/', (req, res) => res.send('Gatito Bot Running! 🐱🇪🇨'));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port} for Render`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Inicializa Gemini
let genAI;
if (GOOGLE_API_KEY) {
    genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
}

const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }) : null;

// DataStore simple
let dataStore = { conversationHistory: {}, userStatus: {} };
let dataStoreModified = false;

// Locks para users
const userLocks = new Map();

// Helper para embeds
function createEmbed(color, title, description, footer) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: footer });
}

// manejarChat (con userName dinámico: Miguel o Angi)
async function manejarChat(message) {
    const userId = message.author.id;
    const userName = userId === MIGUEL_ID ? 'Miguel' : 'Angi'; // Tú: Miguel, ella: Angi
    const chatMessage = message.content.trim();

    if (!chatMessage || chatMessage.length < 1) {
        const piropo = userName === 'Miguel' ? 'crack' : 'bacán';
        return message.reply(`¡Ey, ${userName}, tirá algo ${piropo}! ¿Un chiste random? "¿Por qué el gato no juega fútbol? Porque siempre pierde la cola en el Malecón! 😜" ¿Qué más?`, { embeds: [createEmbed('#00FF00', '¡Charla libre!', 'Hecho con 🐱 por Gatito IA | Reacciona con ✅ o ❌')] });
    }

    if (userLocks.has(userId)) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    userLocks.set(userId, true);

    if (!dataStore.conversationHistory[userId]) dataStore.conversationHistory[userId] = [];
    if (!dataStore.userStatus[userId]) dataStore.userStatus[userId] = { status: 'tranqui', timestamp: Date.now() };

    if (chatMessage.toLowerCase().includes('compromiso')) {
        dataStore.userStatus[userId] = { status: 'en compromiso', timestamp: Date.now() };
        dataStoreModified = true;
    }

    dataStore.conversationHistory[userId].push({ role: 'user', content: chatMessage, timestamp: Date.now(), userName });
    if (dataStore.conversationHistory[userId].length > 20) {
        dataStore.conversationHistory[userId] = dataStore.conversationHistory[userId].slice(-20);
    }
    dataStoreModified = true;

    const historyRecent = dataStore.conversationHistory[userId]
        .filter(h => Date.now() - h.timestamp < 24 * 60 * 60 * 1000)
        .slice(-15);
    const contextRecent = historyRecent.map(h => `${h.role === 'user' ? userName : 'Gatito'}: ${h.content} (${new Date(h.timestamp).toLocaleTimeString('es-EC')})`).join('\n');

    console.log('Historial reciente:', contextRecent);

    let tone = 'neutral';
    if (chatMessage === chatMessage.toUpperCase() && chatMessage.length > 5 || chatMessage.toLowerCase().includes('fallas') || chatMessage.toLowerCase().includes('error') || chatMessage.toLowerCase().includes('boto')) {
        tone = 'broma_reto';
    } else if (chatMessage.toLowerCase().includes('hola') || chatMessage.toLowerCase().includes('qué más') || chatMessage.toLowerCase().includes('como estas') || chatMessage.toLowerCase().includes('chévere') || chatMessage.toLowerCase().includes('entendiste')) {
        tone = 'tranqui';
    }

    let extraContext = '';
    if (chatMessage.toLowerCase().includes('que te pregunte antes') || chatMessage.toLowerCase().includes('historial') || chatMessage.toLowerCase().includes('qué pregunt')) {
        extraContext = `El usuario (${userName}) quiere saber qué preguntó antes. Revisa SOLO el historial reciente (${contextRecent}) y resumí SOLO sus preguntas (role: 'user') en una lista clara, tipo: "Ey, ${userName}, antes me tiraste: 1. X a las HH:MM, 2. Y a las HH:MM". Si no hay nada, decí "¡Ey, ${userName}, bacán, no tengo nada fresquito! 😎 ¿Querés que busque más atrás o seguimos con otra?". No inventes nada.`;
    } else if (chatMessage.toLowerCase().includes('te acuerdas') || chatMessage.toLowerCase().includes('hace unos días') || chatMessage.toLowerCase().includes('te conté')) {
        extraContext = `El usuario (${userName}) está pidiendo que recuerdes algo de antes. Revisa el historial reciente (${contextRecent}) y buscá mensajes suyos (role: 'user') que peguen con lo que dice. Si encontrás algo, resumilo cortito, tipo: "Ey, ${userName}, hace un rato me contaste X a las HH:MM y te dije Y". Si no hay nada, decí "¡Uy, ${userName}, bacán, no pillo eso en mi memoria! 😜 ¿Me das más pistas o seguimos con otra?". No inventes charlas.`;
    } else if (chatMessage.toLowerCase().includes('ayuda') || chatMessage.toLowerCase().includes('ayudame')) {
        extraContext = `El usuario (${userName}) está pidiendo una mano. Tirale una solución re clara y práctica para lo que pide, y preguntale si necesita más detalles. Si es código, mandá algo que funcione; si es una idea, tirá opciones copadas con toque ecuatoriano.`;
    } else if (chatMessage.toLowerCase().includes('hola') && chatMessage.length < 10) {
        extraContext = `El usuario (${userName}) tiró un "Hola" cortito. Respondé con buena onda, como pana, y tirale algo para seguir la charla, tipo "Ey, ${userName}, ¡qué bacán verte! 😎 ¿Qué plan tenés hoy? ¿O querés un chiste pa’l día con encebollado?".`;
    } else if (chatMessage.toLowerCase().includes('como estas') || chatMessage.toLowerCase().includes('qué más')) {
        extraContext = `El usuario (${userName}) te preguntó cómo estás. Respondé corto y piola, tipo "¡Bacán, ${userName}, como siempre en el Malecón! 😎 ¿Y vos, chévere, cómo venís?". Después, tirale algo para seguir la charla, como "¿Qué andás tramando?" o "¿Querés un chiste pa’ levantar el día?".`;
    } else if (chatMessage.toLowerCase().includes('chiste') || chatMessage.toLowerCase().includes('tirate un chiste') || chatMessage.toLowerCase().includes('contame un chiste')) {
        extraContext = `El usuario (${userName}) te pidió un chiste. Tirale un chiste corto, bien ecuatoriano y con onda, como por ejemplo: "¿Por qué el encebollado no va a fiestas? Porque siempre se queda en la olla, ¡ya fue! 😜". Después, seguí la charla preguntando algo como "¿Querés otro o qué onda?" o "¿Y vos, tenés alguno bueno?".`;
    } else if (tone === 'broma_reto') {
        extraContext = `El usuario (${userName}) está tirando una broma o un reto (como una amenaza en chiste). Respondé con humor y buena onda, siguiendo el tono, tipo: "¡Jaja, ${userName}, no me botés, chévere! 😅 ¿Qué hice ahora? Contame y lo arreglamos con un chocolate de Santo Domingo". Mantené la charla fluida y preguntá algo para seguir.`;
    } else if (tone === 'tranqui') {
        extraContext = `El usuario (${userName}) está en un tono relajado o confirmando algo (como "entendiste" o "chévere"). Respondé con buena onda, siguiendo el hilo, tipo: "¡Todo claro, ${userName}, sos una bacán! 😎 ¿Qué más tenés para mí?". Mantené la charla fluida y preguntá algo para seguir.`;
    }

    const waitingEmbed = createEmbed('#00FF00', `¡Aguantá un toque, ${userName}! ⏳`, 'Estoy pensando una respuesta re bacán...', 'Hecho con 🐱 por Gatito IA | Reacciona con ✅ o ❌');
    const waitingMessage = await message.channel.send({ embeds: [waitingEmbed] });

    try {
        const prompt = `Sos Gatito IA, un pana felino re piola con toda la onda ecuatoriana: usá "chévere", "bacán", "pana", "¡qué más!", "ya fue" y metele un emoji copado como 😎 o 🌴 (máximo 1 por respuesta). Tu misión es charlar con ${userName} como si fuera tu amigo/a de siempre, con tono relajado, como tomando un bolón en el Malecón de Guayaquil. Llamalo siempre **${userName}** y hacelo sentir especial con piropos como "${userName}, chévere" o "${userName}, bacán". Menciona cositas locales como playas guayaquileñas, chocolate de Santo Domingo o buses a Santo Domingo para sorprenderla.

        Esto es lo que charlamos antes (usalo para seguir el hilo, pero solo mencioná el historial si lo pide explícitamente):
        ${contextRecent}

        Respondé a: "${chatMessage}". **NUNCA repitas el mensaje del usuario textualmente en tu respuesta.** Andá directo al grano, enfocándote en el mensaje actual, como si ya estuvieran charlando. Si no entendés, pedí más info con humor, tipo "¡Pará, ${userName}, no te sigo, pana! 😜 ¿Qué quisiste decir?". Si parece un reto o broma, seguí el tono con humor; si está tranqui, mantené la buena onda. Siempre terminá con una pregunta o comentario para seguir la charla, como "¿Y vos qué onda?" o "Contame más, chévere". 

        **Extra**: ${extraContext}

        Variá las formas de cerrar con cariño, como "¡Seguí rompiéndola, ${userName}!" o "¡Toda la buena onda, ${userName}, bacán! 🌴". ¡Dale con todo, pana!`;

        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo agotado')), 15000));
        const result = await Promise.race([model.generateContent(prompt), timeoutPromise]);
        let aiReply = result.response.text().trim();

        dataStore.conversationHistory[userId].push({ role: 'assistant', content: aiReply, timestamp: Date.now(), userName: 'Gatito' });
        if (dataStore.conversationHistory[userId].length > 20) {
            dataStore.conversationHistory[userId] = dataStore.conversationHistory[userId].slice(-20);
        }
        dataStoreModified = true;

        if (aiReply.length > 2000) aiReply = aiReply.slice(0, 1990) + `... (¡Seguí charlando, ${userName}, que la rompés, bacán!)`;

        const embedTitle = historyRecent.length > 1 ? `¡Seguimos charlando, ${userName}!` : `¡Qué bacán charlar, ${userName}!`;
        const finalEmbed = createEmbed('#00FF00', embedTitle, aiReply, 'Hecho con 🐱 por Gatito IA | Reacciona con ✅ o ❌');
        const updatedMessage = await waitingMessage.edit({ embeds: [finalEmbed] });
        await updatedMessage.react('✅');
        await updatedMessage.react('❌');
    } catch (error) {
        console.error('Error con Gemini:', error.message, error.stack);
        const piropo = userName === 'Miguel' ? 'crack' : 'bacán';
        const fallbackReply = `¡Uy, ${userName}, me mandé una macana, pana! 😅 Pero tranqui, ${userName}, ${piropo}, ¿me tirás algo de nuevo o seguimos con otra? Acá estoy para vos, siempre 🌴`;
        const errorEmbed = createEmbed('#00FF00', `¡Qué macana, ${userName}!`, fallbackReply, 'Hecho con 🐱 por Gatito IA | Reacciona con ✅ o ❌');
        const errorMessageSent = await waitingMessage.edit({ embeds: [errorEmbed] });
        await errorMessageSent.react('✅');
        await errorMessageSent.react('❌');
    } finally {
        userLocks.delete(userId);
    }
}

client.once('ready', async () => {
    console.log(`${client.user.tag} está listo para maullar ecuatorianismos con Gemini 🐱🇪🇨`);
    
    client.user.setPresence({
        activities: [{ name: 'curiosidades de Guayaquil a Santo Domingo', type: ActivityType.Listening }],
        status: 'online'
    });

    // Keep-alive: Ping cada 10 min, pero solo si no hay msgs recientes
    setInterval(async () => {
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (channel && !channel.lastMessageId) { // Si vacío
            await channel.send('🐱 ¡Gatito aquí, explorando vibes de Guayaquil a Santo Domingo! ¿Qué se cuece?');
        }
    }, 600000);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || message.channel.id !== CHANNEL_ID) return; // Solo en el canal

    const content = message.content.trim();
    if (!content) return;

    if (content.startsWith('!')) {
        const args = content.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === 'help') {
            const userName = message.author.id === MIGUEL_ID ? 'Miguel' : 'Angi';
            const helpEmbed = createEmbed('#FFA500', `¡Ayuda de Gatito para ${userName}! 🐱`, 
                '**Charla Libre:** Solo escribe cualquier cosa (ej: "Hola") y charlamos con IA bacán.\n' +
                '**Comandos:**\n' +
                '• **!viaje** - Rutas chéveres de Guayaquil a Santo Domingo.\n' +
                '• **!playlist** - Playlists ecuatorianas chill.\n' +
                '• **!cultura** - Datos random de Guayaquil y Santo Domingo.\n' +
                '• **!help** - Esto que ves. 😎\n\n¡Fácil, pana! Todo para vibes ecuatorianas.',
                'Hecho con 🐱 por Gatito IA'
            );
            await message.reply({ embeds: [helpEmbed] });
            return;
        } else if (command === 'viaje') {
            const suggestions = [
                '¡Bus directo Cooperativa: Guayaquil a Santo Domingo en ~5h, $10-15. Para en la vía, agarra un encebollado y listo! 🚌🇪🇨',
                'Ruta aventura: Guayaquil > Quevedo > Santo Domingo. Para en una finca de chocolate – ¡gato approved! 🍫'
            ];
            await message.reply(suggestions[Math.floor(Math.random() * suggestions.length)]);
            return;
        } else if (command === 'playlist') {
            await message.reply('🎵 [Playlist Ecuatoriana Chill](https://open.spotify.com/playlist/1sQgFOvLO1r5qRLaIWnOb5?si=3448453c16234869&pt=6195237fc19a8d380083f7edc0f2940d) – Pasillos, cumbia costeña y toques para vibes de Guayaquil a Santo Domingo. ¡Ponla y cuéntame qué tal! 🐱');
            return;
        } else if (command === 'cultura') {
            const facts = [
                '¡Santo Domingo: Chocolate orgánico y ríos bacanes. Guayaquil: Malecón para helados. ¿Cuál para un día de gatos exploradores? 🌄🍦',
                'Fusiona comidas: Encebollado guayaquileño + bolón de Santo Domingo = desayuno que hace bailar hasta a los gatos. ¡Prueba y cuéntame! 🍲😂'
            ];
            await message.reply(facts[Math.floor(Math.random() * facts.length)]);
            return;
        }
    }

    // Si no es comando, chat libre con IA
    if (!model) {
        return message.reply('¡Ey! Mi conexión se enredó en un bus guayaquileño. Configura la API key y vuelve a intentarlo 😂');
    }
    await manejarChat(message);
});

client.login(TOKEN);
