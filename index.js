require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const TOKEN = process.env.DISCORD_TOKEN;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const ANGI_ID = '1367897147865042954';
const CHANNEL_ID = '1419498589134000243';

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

// DataStore simple (global para simplicidad; para prod, usa JSON file o DB)
let dataStore = { conversationHistory: {}, userStatus: {} };
let dataStoreModified = false;

// Locks para users
const userLocks = new Map();

// Función helper para embeds (adaptada a ecuatoriano)
function createEmbed(color, title, description, footer) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: footer });
}

// Función manejarChat (adaptada de tu código: ecuatoriana, para Angi)
async function manejarChat(message) {
    const userId = message.author.id;
    const userName = 'Angi'; // Personalizado para ella
    const chatMessage = message.content.startsWith('!chat') ? message.content.slice(5).trim() : message.content.slice(3).trim();

    if (!chatMessage) {
        return message.reply(`¡Ey, ${userName}, tirá algo después de "!chat", bacán! No me dejes colgado 😜`, { embeds: [createEmbed('#00FF00', '¡Listo para charlar!', 'Hecho con 🐱 por Gatito IA | Reacciona con ✅ o ❌')] });
    }

    if (userLocks.has(userId)) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    userLocks.set(userId, true);

    if (!dataStore.conversationHistory) dataStore.conversationHistory = {};
    if (!dataStore.conversationHistory[userId]) dataStore.conversationHistory[userId] = [];
    if (!dataStore.userStatus) dataStore.userStatus = {};
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

    // Últimos 5-15 msgs para contexto
    const historyRecent = dataStore.conversationHistory[userId]
        .filter(h => Date.now() - h.timestamp < 24 * 60 * 60 * 1000)
        .slice(-15);
    const contextRecent = historyRecent.map(h => `${h.role === 'user' ? userName : 'Gatito'}: ${h.content} (${new Date(h.timestamp).toLocaleTimeString('es-EC')})`).join('\n');

    console.log('Historial reciente:', contextRecent); // Debug

    // Detectar tono (adaptado)
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
        extraContext = `El usuario (${userName}) está tirando una broma o un reto (como una amenaza en chiste). Respondé con humor y buena onda, siguiendo el tono, tipo: "¡Jaja, ${userName}, no me botés, chévere! 😅 ¿Qué hice ahora? Contame y lo arreglamos con un chocolate tsáchila". Mantené la charla fluida y preguntá algo para seguir.`;
    } else if (tone === 'tranqui') {
        extraContext = `El usuario (${userName}) está en un tono relajado o confirmando algo (como "entendiste" o "chévere"). Respondé con buena onda, siguiendo el hilo, tipo: "¡Todo claro, ${userName}, sos una bacán! 😎 ¿Qué más tenés para mí?". Mantené la charla fluida y preguntá algo para seguir.`;
    }

    const waitingEmbed = createEmbed('#00FF00', `¡Aguantá un toque, ${userName}! ⏳`, 'Estoy pensando una respuesta re bacán...', 'Hecho con 🐱 por Gatito IA | Reacciona con ✅ o ❌');
    const waitingMessage = await message.channel.send({ embeds: [waitingEmbed] });

    try {
        const prompt = `Sos Gatito IA, un pana felino re piola con toda la onda ecuatoriana: usá "chévere", "bacán", "pana", "¡qué más!", "ya fue" y metele un emoji copado como 😎 o 🌴 (máximo 1 por respuesta). Tu misión es charlar con ${userName} como si fuera tu amiga de siempre, con tono relajado, como tomando un bolón en el Malecón de Guayaquil. Llamala siempre **${userName}** y hacela sentir especial con piropos como "${userName}, chévere" o "${userName}, bacán". Menciona cositas locales como playas guayaquileñas, chocolate tsáchila o buses a Santo Domingo para sorprenderla.

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

        // Título variado
        const embedTitle = historyRecent.length > 1 ? `¡Seguimos charlando, ${userName}!` : `¡Qué bacán charlar, ${userName}!`;
        const finalEmbed = createEmbed('#00FF00', embedTitle, aiReply, 'Hecho con 🐱 por Gatito IA | Reacciona con ✅ o ❌');
        const updatedMessage = await waitingMessage.edit({ embeds: [finalEmbed] });
        await updatedMessage.react('✅');
        await updatedMessage.react('❌');
    } catch (error) {
        console.error('Error con Gemini:', error.message, error.stack);
        const fallbackReply = `¡Uy, ${userName}, me mandé una macana, pana! 😅 Pero tranqui, ${userName}, bacán, ¿me tirás el mensaje de nuevo o seguimos con otra? Acá estoy para vos, siempre 🌴`;
        const errorEmbed = createEmbed('#00FF00', `¡Qué macana, ${userName}!`, fallbackReply, 'Hecho con 🐱 por Gatito IA | Reacciona con ✅ o ❌');
        const errorMessageSent = await waitingMessage.edit({ embeds: [errorEmbed] });
        await errorMessageSent.react('✅');
        await errorMessageSent.react('❌');
    } finally {
        userLocks.delete(userId);
    }
}

client.once('ready', async () => {
    console.log(`${client.user.tag} está listo para maullar ecuatorianismos con 🐱🇪🇨`);
    
    client.user.setPresence({
        activities: [{ name: 'curiosidades de Guayaquil a Tsáchilas', type: ActivityType.Listening }],
        status: 'online'
    });

    setInterval(async () => {
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (channel) {
            await channel.send('🐱 ¡Gatito aquí, explorando vibes de Guayas a Tsáchilas! ¿Qué se cuece?');
        }
    }, 600000);
});

client.on('guildMemberAdd', async (member) => {
    if (member.id === ANGI_ID) {
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle('🐱 ¡Bienvenida, Angi! Un maullido desde Guayaquil 🇪🇨🚌🌄 Tsáchilas')
                .setDescription('¡Hola, Angi! Soy Gatito, un bot felino para charlas random y locuras ecuatorianas entre Guayaquil y Santo Domingo de los Tsáchilas. (Un regalito geek para pasar el rato). Aquí va un tour rápido de lo que puedo hacer:')
                .setColor(0xFFA500)
                .addFields(
                    { name: '💬 **Chat IA Curioso**', value: 'Di `!chat ¿Qué hay de bueno en Tsáchilas?` y platicamos con toques de gatos y Gemini de Google – ¡puro flow local, bacán!', inline: false },
                    { name: '🗺️ **!viaje**', value: 'Ideas de rutas divertidas: de Guayaquil a Santo Domingo, con paradas en buses y memes de encebollado.', inline: false },
                    { name: '🎶 **!playlist**', value: 'Playlists chill: pasillos ecuatorianos y ritmos costeños para un mood relax.', inline: false },
                    { name: '🌍 **!cultura**', value: 'Datos random: ¿Chocolate tsáchila + Malecón guayaquileño? ¡Una fiesta que ni los gatos resisten!', inline: false },
                    { name: '🐾 **Truco Gatuno**', value: 'Estoy para lo que sea – ¡lanza un mensaje y veamos qué sale en este servidor nuestro!', inline: false }
                )
                .setFooter({ text: 'Creado en Guayaquil para vibes tsáchilas – ¡sin dramas, solo Ecuador!' });

            await channel.send({ embeds: [embed] });
            await channel.send('¡Ey, Angi! Si quieres probar, di `!chat Hola Gatito` y arrancamos. ¿Qué tal el día en Santo Domingo? 🐱');
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'chat') {
        if (!model) {
            return message.reply('¡Ey! Mi conexión se enredó en un bus guayaquileño. Configura la API key y vuelve a intentarlo 😂');
        }
        await manejarChat(message);
    } else if (command === 'viaje') {
        const suggestions = [
            '¡Bus directo Cooperativa Tsáchila: Guayaquil a Santo Domingo en ~5h, $10-15. Para en la vía, agarra un encebollado y listo! 🚌🇪🇨',
            'Ruta aventura: Guayaquil > Quevedo > Santo Domingo. Para en una finca de chocolate – ¡gato approved! 🍫'
        ];
        await message.reply(suggestions[Math.floor(Math.random() * suggestions.length)]);
    } else if (command === 'playlist') {
        await message.reply('🎵 [Playlist Ecuatoriana Chill](https://open.spotify.com/intl-es/album/27B59xVc1hlrxn23uGph23?si=003eca1b38ef43f9) – Pasillos, cumbia costeña y toques andinos para vibes de Guayas a Tsáchilas. ¡Ponla y cuéntame qué tal! 🐱');
    } else if (command === 'cultura') {
        const facts = [
            '¡Santo Domingo: Capital tsáchila con ríos y chocolate orgánico. Guayaquil: Malecón para helados. ¿Cuál para un día de gatos exploradores? 🌄🍦',
            'Fusiona comidas: Encebollado guayaquileño + bolón tsáchila = desayuno que hace bailar hasta a los gatos. ¡Prueba y cuéntame! 🍲😂'
        ];
        await message.reply(facts[Math.floor(Math.random() * facts.length)]);
    }
});

client.login(TOKEN);
