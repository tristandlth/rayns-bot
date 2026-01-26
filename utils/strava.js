const axios = require('axios');
const { createBaseEmbed } = require('./embeds');

const AUTH_URL = 'https://www.strava.com/oauth/token';
const CLUB_URL = `https://www.strava.com/api/v3/clubs/${process.env.STRAVA_CLUB_ID}/activities`;

let lastActivityId = null; 

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
    console.log('Verification Strava...');
    const token = await getAccessToken();
    if (!token) return;

    try {
        const res = await axios.get(CLUB_URL, {
            headers: { Authorization: `Bearer ${token}` },
            params: { per_page: 5 }
        });

        const activities = res.data;
        if (!activities || activities.length === 0) return;

        const latest = activities[0];

        if (!lastActivityId) {
            lastActivityId = latest.id;
            console.log(`Strava initialise. Derniere activite : ${latest.name}`);
            return;
        }

        if (latest.id !== lastActivityId) {
            lastActivityId = latest.id;

            const channel = client.channels.cache.get(process.env.STRAVA_CHANNEL_ID);
            if (!channel) return;

            const distanceKm = (latest.distance / 1000).toFixed(2);
            const timeMin = Math.floor(latest.moving_time / 60);
            
            const embed = createBaseEmbed({ 
                username: `${latest.athlete.firstname} ${latest.athlete.lastname}`, 
                displayAvatarURL: () => 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Strava_Logo.png'
            })
            .setColor('#fc4c02')
            .setTitle(`🏃 ${latest.name}`)
            .setDescription(`Une nouvelle activite a ete postee dans le club !`)
            .addFields(
                { name: 'Distance', value: `${distanceKm} km`, inline: true },
                { name: 'Duree', value: `${timeMin} min`, inline: true },
                { name: 'Type', value: `${latest.type}`, inline: true }
            );

            await channel.send({ embeds: [embed] });
            console.log(`Nouvelle activite Strava postee : ${latest.name}`);
        }

    } catch (error) {
        console.error('Erreur API Strava:', error.response?.data || error.message);
    }
}

module.exports = { checkStravaActivities };