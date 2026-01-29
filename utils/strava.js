const axios = require('axios');
const fs = require('fs');
const { AttachmentBuilder } = require('discord.js');
const { createBaseEmbed } = require('./embeds');
const { getStravaLastId, updateStravaLastId } = require('./db'); 

const AUTH_URL = 'https://www.strava.com/oauth/token';
const CLUB_URL = `https://www.strava.com/api/v3/clubs/${process.env.STRAVA_CLUB_ID}/activities`;

const LOCAL_LOGO_PATH = './img/strava.png';
const ATTACHMENT_NAME = 'strava.png';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function ensureActivityId(activity) {
    if (activity.id) return activity; 

    const cleanName = (activity.athlete.firstname + activity.athlete.lastname).replace(/[^a-zA-Z0-9]/g, '');
    const cleanTitle = (activity.name || 'Activite').replace(/[^a-zA-Z0-9]/g, '');
    
    activity.id = `${cleanName}_${cleanTitle}_${activity.moving_time}`;
    
    return activity;
}

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
        console.error('❌ Erreur Refresh Token Strava:', error.response?.status);
        return null;
    }
}

async function sendActivityEmbed(channel, activity) {
    let logoAttachment = null;
    if (fs.existsSync(LOCAL_LOGO_PATH)) {
        const fileBuffer = fs.readFileSync(LOCAL_LOGO_PATH);
        logoAttachment = new AttachmentBuilder(fileBuffer, { name: ATTACHMENT_NAME });
    }

    let avatarUrl = logoAttachment ? `attachment://${ATTACHMENT_NAME}` : null;
    if (activity.athlete && activity.athlete.profile) {
        avatarUrl = activity.athlete.profile;
    }

    const distanceKm = (activity.distance / 1000).toFixed(2);
    const timeMin = Math.floor(activity.moving_time / 60);
    const elevation = Math.floor(activity.total_elevation_gain);
    
    const secondsPerKm = activity.distance > 0 ? activity.moving_time / (activity.distance / 1000) : 0;
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

    const payload = { embeds: [embed] };
    if (logoAttachment) payload.files = [logoAttachment];

    await channel.send(payload);
}

async function checkStravaActivities(client) {
    console.log('🔄 Vérification Strava...');
    
    const lastKnownId = await getStravaLastId();
    const token = await getAccessToken();
    
    if (!token) return;

    const channel = client.channels.cache.get(process.env.STRAVA_CHANNEL_ID);
    if (!channel) return console.error("❌ Salon Strava introuvable (Vérifie l'ID dans .env).");

    try {
        const res = await axios.get(CLUB_URL, {
            headers: { Authorization: `Bearer ${token}` },
            params: { per_page: 10 }
        });

        if (!Array.isArray(res.data)) {
            console.error("⚠️ Strava a renvoyé du HTML (Maintenance ou Erreur API).");
            return;
        }

        const activities = res.data.map(act => ensureActivityId(act));
        
        if (!activities || activities.length === 0) return;

        if (lastKnownId === '0') {
            const mostRecent = activities[0];
            console.log(`🆕 Premier lancement détecté. Envoi de l'activité : ${mostRecent.id}`);
            
            await sendActivityEmbed(channel, mostRecent);
            
            await updateStravaLastId(mostRecent.id);
            return;
        }

        const newActivities = [];
        
        for (const activity of activities) {
            if (String(activity.id) === String(lastKnownId)) {
                break;
            }
            newActivities.push(activity);
        }

        if (newActivities.length === 0) return;

        console.log(`🚀 ${newActivities.length} nouvelle(s) activité(s) à envoyer !`);

        const toSend = newActivities.reverse();

        for (const activity of toSend) {
            await sendActivityEmbed(channel, activity);
            await wait(3000);
        }

        await updateStravaLastId(activities[0].id);

    } catch (error) {
        logStravaError(error);
    }
}

async function manualSync(channel, limit = 10) {
    console.log(`⚙️ Sync manuelle demandée (${limit})...`);
    const token = await getAccessToken();
    if (!token) return channel.send("❌ Erreur token Strava.");

    try {
        const res = await axios.get(CLUB_URL, {
            headers: { Authorization: `Bearer ${token}` },
            params: { per_page: limit }
        });

        if (!Array.isArray(res.data)) return channel.send("❌ Erreur API Strava (HTML renvoyé).");

        const activities = res.data.map(act => ensureActivityId(act));

        if (!activities.length) return channel.send("ℹ️ Aucune activité trouvée.");

        channel.send(`⏳ Récupération des ${activities.length} dernières activités...`);

        const sortedActivities = [...activities].reverse();

        for (const activity of sortedActivities) {
            await sendActivityEmbed(channel, activity);
            await wait(2000);
        }
        
        channel.send("✅ Synchronisation terminée !");
        
    } catch (error) {
        logStravaError(error);
        channel.send(`❌ Erreur technique (Voir console).`);
    }
}

function logStravaError(error) {
    if (error.response) {
        console.error(`❌ Erreur Strava [${error.response.status}]: ${error.response.statusText}`);
    } else {
        console.error('❌ Erreur réseau Strava:', error.message);
    }
}

module.exports = { checkStravaActivities, manualSync };