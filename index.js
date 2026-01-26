const fs = require('fs');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const http = require('http');
const { checkStravaActivities } = require('./utils/strava');

// Serveur HTTP pour Dokploy
http.createServer((req, res) => {
    res.writeHead(200); 
    res.end('Bot en ligne');
}).listen(3000);

// configuration du client Discord
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

// chargement des events
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// lancement du service Strava
client.once('ready', () => {
    console.log('🏃 Service Strava prêt à démarrer...');
    
    setTimeout(() => {
        checkStravaActivities(client);
    }, 5000);

    setInterval(() => {
        checkStravaActivities(client);
    }, 900000); // 15 minutes
});

client.login(process.env.DISCORD_TOKEN);