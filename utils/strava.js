const axios = require('axios');
const fs = require('fs');
const { AttachmentBuilder } = require('discord.js');
const { createBaseEmbed } = require('./embeds');
const { getSeenStravaIds, markStravaIdsAsSeen } = require('./db');

const AUTH_URL = 'https://www.strava.com/oauth/token';
const CLUB_URL = `https://www.strava.com/api/v3/clubs/${process.env.STRAVA_CLUB_ID}/activities`;

const LOCAL_LOGO_PATH = './img/strava.png';
const ATTACHMENT_NAME = 'strava.png';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function ensureActivityId(activity) {
    const cleanFirst = (activity.athlete.firstname || '').replace(/[^a-zA-Z0-9]/g, '');
    const cleanLast = (activity.athlete.lastname || '').replace(/[^a-zA-Z0-9]/g, '');
    activity.id = `${cleanFirst}${cleanLast}_${activity.moving_time}_${Math.round(activity.distance)}_${activity.elapsed_time}`;
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
    const elevation = Math.floor(activity.total_elevation_gain);

    // format "1h 23min" plutôt que "83 min"
    const totalMinutes = Math.floor(activity.moving_time / 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const timeFormatted = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;

    const secondsPerKm = activity.distance > 0 ? activity.moving_time / (activity.distance / 1000) : 0;
    const paceMinutes = Math.floor(secondsPerKm / 60);
    const paceSeconds = Math.floor(secondsPerKm % 60).toString().padStart(2, '0');
    const pace = `${paceMinutes}:${paceSeconds}/km`;

    const ACTIVITY_EMOJI = { Run: '🏃', Ride: '🚴', VirtualRide: '🚴', Walk: '🚶', Swim: '🏊', Hike: '🥾' };
    const activityEmoji = ACTIVITY_EMOJI[activity.type] || '🏅';

    const embed = createBaseEmbed({
        username: `${activity.athlete.firstname} ${activity.athlete.lastname}`,
        displayAvatarURL: () => avatarUrl
    })
    .setColor('#fc4c02')
    .setTitle(`${activityEmoji} ${activity.name}`)
    .addFields(
        { name: 'Distance', value: `${distanceKm} km`, inline: true },
        { name: 'Durée', value: timeFormatted, inline: true },
        { name: 'Allure', value: pace, inline: true },
        { name: 'Dénivelé', value: `${elevation} m`, inline: true }
    );

    const payload = { embeds: [embed] };
    if (logoAttachment) payload.files = [logoAttachment];

    await channel.send(payload);
}

async function checkStravaActivities(client) {
    console.log('🔄 Vérification Strava...');

    const [seenIds, token] = await Promise.all([getSeenStravaIds(), getAccessToken()]);

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
        if (!activities.length) return;

        const fetchedIds = activities.map(a => a.id);

        if (seenIds.size === 0) {
            console.log(`🆕 Premier lancement détecté. Envoi de l'activité la plus récente.`);
            await sendActivityEmbed(channel, activities[0]);
            await markStravaIdsAsSeen(fetchedIds);
            return;
        }

        const newActivities = activities.filter(a => !seenIds.has(a.id)).reverse();

        if (newActivities.length === 0) return;

        console.log(`🚀 ${newActivities.length} nouvelle(s) activité(s) à envoyer !`);

        for (const activity of newActivities) {
            await sendActivityEmbed(channel, activity);
            await wait(3000);
        }

        await markStravaIdsAsSeen(fetchedIds);

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