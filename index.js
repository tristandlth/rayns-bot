require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Events, REST, Routes } = require('discord.js');
const { initDb } = require('./utils/db');
const { checkStravaActivities } = require('./utils/strava');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();
const commandsArray = [];

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commandsArray.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] La commande ${filePath} n'a pas les propriétés "data" ou "execute".`);
    }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

client.once(Events.ClientReady, async () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);

    await initDb();

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log(`🔄 Mise à jour de ${commandsArray.length} commandes (/) ...`);

        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commandsArray },
        );

        console.log('Commandes (/) enregistrées avec succès !');
    } catch (error) {
        console.error('Erreur lors du déploiement des commandes :', error);
    }

    checkStravaActivities(client);
    setInterval(() => {
        checkStravaActivities(client);
    }, 15 * 60 * 1000); 
});

client.login(process.env.DISCORD_TOKEN);