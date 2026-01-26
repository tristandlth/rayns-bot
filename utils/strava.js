const axios = require('axios');
const { createBaseEmbed } = require('./embeds');

const AUTH_URL = 'https://www.strava.com/oauth/token';
const CLUB_URL = `https://www.strava.com/api/v3/clubs/${process.env.STRAVA_CLUB_ID}/activities`;

const INITIAL_IMPORT_MODE = true; 

let lastActivityId = null; 

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

async function checkStravaActivities(client) {
    console.log('🏃 Vérification Strava...');
    const token = await getAccessToken();
    if (!token) return;

    try {
        const res = await axios.get(CLUB_URL, {
            headers: { Authorization: `Bearer ${token}` },
            params: { per_page: 30 } 
        });

        const activities = res.data;
        if (!activities || activities.length === 0) return;

        const channel = client.channels.cache.get(process.env.STRAVA_CHANNEL_ID);
        if (!channel) return;

        if (INITIAL_IMPORT_MODE && lastActivityId === null) {
            console.log(`MODE IMPORT ACTIF : Traitement de ${activities.length} activités...`);
            
            const sortedActivities = [...activities].reverse();

            for (const activity of sortedActivities) {
                await sendActivityEmbed(channel, activity);
                
                lastActivityId = activity.id;
                
                await wait(2000); 
            }
            console.log("Import terminé ! Pense à remettre le code normal.");
            return;
        }

        const latest = activities[0];

        if (!lastActivityId) {
            lastActivityId = latest.id;
            return;
        }

        if (latest.id !== lastActivityId) {
            lastActivityId = latest.id;
            await sendActivityEmbed(channel, latest);
            console.log(`Nouvelle activité Strava postée : ${latest.name}`);
        }

    } catch (error) {
        console.error('Erreur API Strava:', error.response?.data || error.message);
    }
}

async function sendActivityEmbed(channel, activity) {
    const distanceKm = (activity.distance / 1000).toFixed(2);
    const timeMin = Math.floor(activity.moving_time / 60);

    const embed = createBaseEmbed({ 
        username: `${activity.athlete.firstname} ${activity.athlete.lastname}`, 
        displayAvatarURL: () => 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Strava_Logo.png'
    })
    .setColor('#fc4c02')
    .setTitle(`🏃 ${activity.name}`)
    .setDescription(`Activité du club`)
    .addFields(
        { name: 'Distance', value: `${distanceKm} km`, inline: true },
        { name: 'Durée', value: `${timeMin} min`, inline: true },
        { name: 'Type', value: `${activity.type}`, inline: true }
    );

    await channel.send({ embeds: [embed] });
    console.log(`Envoi : ${activity.name}`);
}

module.exports = { checkStravaActivities };