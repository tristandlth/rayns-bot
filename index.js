const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, Collection, REST, Routes } = require('discord.js');
const http = require('http');
const { checkStravaActivities } = require('./utils/strava');

http.createServer((req, res) => {
    res.writeHead(200); res.end('Bot en ligne');
}).listen(3000);

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

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const commandsToRegister = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commandsToRegister.push(command.data.toJSON());
    } else {
        console.log(`[AVERTISSEMENT] La commande ${filePath} manque de "data" ou "execute".`);
    }
}

const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

client.once('clientReady', async () => {
    console.log('🏃 Service Strava prêt à démarrer...');
    
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    try {
        console.log(`Mise à jour de ${commandsToRegister.length} commandes (/) ...`);
        
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commandsToRegister },
        );
        console.log('✅ Commandes (/) enregistrées avec succès !');
    } catch (error) {
        console.error(error);
    }

    setTimeout(() => { checkStravaActivities(client); }, 5000);
    setInterval(() => { checkStravaActivities(client); }, 900000);
});

client.login(process.env.DISCORD_TOKEN);