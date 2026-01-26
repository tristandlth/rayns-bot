const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { Pool } = require('pg');
const http = require('http');

// serveur web pour dokploy
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Le bot est en ligne !');
});
server.listen(3000, () => {
    console.log('Serveur HTTP prêt sur le port 3000');
});

// connexion bd
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

db.on('error', (err) => {
    console.error('Erreur inattendue sur le client PostgreSQL', err);
});

// configuration
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
});

client.once('ready', async () => {
    console.log(`Connecté en tant que ${client.user.tag}!`);
    
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                xp_text INTEGER DEFAULT 0,
                xp_voice INTEGER DEFAULT 0,
                level INTEGER DEFAULT 0,
                last_message_date BIGINT DEFAULT 0
            );
        `);
        console.log("Base de données synchronisée.");
    } catch (err) {
        console.error("Erreur DB au démarrage :", err);
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.content === '!ping') {
        message.reply('Pong!');
    }
});

// connexion
client.login(process.env.DISCORD_TOKEN);