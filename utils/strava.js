const axios = require('axios');
const fs = require('fs');
const { AttachmentBuilder } = require('discord.js');
const { createBaseEmbed } = require('./embeds');

const AUTH_URL = 'https://www.strava.com/oauth/token';
const CLUB_URL = `https://www.strava.com/api/v3/clubs/${process.env.STRAVA_CLUB_ID}/activities`;

const LOCAL_LOGO_PATH = './img/strava.png';
const ATTACHMENT_NAME = 'strava.png';

let knownActivities = new Set();
let isInitialized = false;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getAccessToken() {
    try {
        const response = await axios.post(AUTH_URL, {
            client_id: process.env.STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            refresh_token: process.env.STRAVA_REFRESH_TOKEN,
            grant_type: 'refresh_token'
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Erreur Refresh Token Strava:', error.response?.data || error.message);
        return null;
    }
}

async function sendActivityEmbed(channel, activity) {
    const fileBuffer = fs.readFileSync(LOCAL_LOGO_PATH);
    const logoAttachment = new AttachmentBuilder(fileBuffer, { name: ATTACHMENT_NAME });

    let avatarUrl = `attachment://${ATTACHMENT_NAME}`;

    if (activity.athlete && activity.athlete.profile) {
        avatarUrl = activity.athlete.profile;
    }

    const distanceKm = (activity.distance / 1000).toFixed(2);
    const timeMin = Math.floor(activity.moving_time / 60);
    const elevation = Math.floor(activity.total_elevation_gain);

    const secondsPerKm = activity.moving_time / (activity.distance / 1000);
    const paceMinutes = Math.floor(secondsPerKm / 60);
    const paceSeconds = Math.floor(secondsPerKm % 60).toString().padStart(2, '0');
    const pace = `${paceMinutes}:${paceSeconds}/km`;

    const embed = createBaseEmbed({ 
        username: `${activity.athlete.firstname} ${activity.athlete.lastname}`, 
        displayAvatarURL: () => avatarUrl 
    })
    .setColor('#fc4c02')
    .setTitle(`🏃 ${activity.name}`)
    .setDescription(`Activité du club`)
    .addFields(
        { name: 'Distance', value: `${distanceKm} km`, inline: true },
        { name: 'Duree', value: `${timeMin} min`, inline: true },
        { name: 'Allure', value: `${pace}`, inline: true },
        { name: 'Denivele', value: `${elevation} m`, inline: true }
    );

    await channel.send({ 
        embeds: [embed],
        files: [logoAttachment]
     });
}

async function checkStravaActivities(client) {
    console.log('Verification Strava...');
    const token = await getAccessToken();
    if (!token) return;

    try {
        const res = await axios.get(CLUB_URL, {
            headers: { Authorization: `Bearer ${token}` },
            params: { per_page: 10 }
        });

        const activities = res.data;
        if (!activities || activities.length === 0) return;

        if (!isInitialized) {
            activities.forEach(activity => knownActivities.add(activity.id));
            isInitialized = true;
            console.log(`Strava initialisé. ${activities.length} activités ignorées (déjà existantes).`);
            return;
        }

        const newActivities = activities.filter(activity => !knownActivities.has(activity.id));

        if (newActivities.length === 0) return;

        console.log(`${newActivities.length} nouvelle(s) activité(s) détectée(s) !`);

        const sortedNewActivities = newActivities.reverse();

        const channel = client.channels.cache.get(process.env.STRAVA_CHANNEL_ID);
        if (!channel) return console.error("Salon Strava introuvable.");

        for (const activity of sortedNewActivities) {
            await sendActivityEmbed(channel, activity);
            knownActivities.add(activity.id);
            await wait(3000);
        }

    } catch (error) {
        console.error('Erreur API Strava:', error.response?.data || error.message);
    }
}

async function manualSync(channel, limit = 10) {
    console.log(`Commande Sync lancée pour ${limit} activités...`);
    const token = await getAccessToken();
    if (!token) return channel.send("❌ Erreur de token Strava.");

    try {
        const res = await axios.get(CLUB_URL, {
            headers: { Authorization: `Bearer ${token}` },
            params: { per_page: limit }
        });

        const activities = res.data;
        if (!activities || activities.length === 0) return channel.send("Aucune activité trouvée.");

        if (limit == 1) {
            channel.send(`⏳ Récupération de la dernière activité en cours...`);
        } else {
            channel.send(`⏳ Récupération des ${activities.length} dernières activités en cours...`);
        }

        const sortedActivities = [...activities].reverse();

        for (const activity of sortedActivities) {
            await sendActivityEmbed(channel, activity);
            knownActivities.add(activity.id); 
            await wait(2000);
        }

        if(limit > 1){
            channel.send("✅ Récupération terminée !");
        }
        
    } catch (error) {
        channel.send(`❌ Erreur Strava : ${error.message}`);
    }
}

module.exports = { checkStravaActivities, manualSync };