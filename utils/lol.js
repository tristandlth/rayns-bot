const axios = require('axios');
const { AttachmentBuilder } = require('discord.js');
const { getLolPlayers, getLolLastMatchId, updateLolLastMatchId } = require('./db');
const { generateMatchCard } = require('./lolCanvas');

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const LOL_REGION = process.env.LOL_REGION || 'EUW1';
const LOL_ROUTING = process.env.LOL_ROUTING || 'EUROPE';

const PLATFORM_BASE = `https://${LOL_REGION.toLowerCase()}.api.riotgames.com`;
const ROUTING_BASE = `https://${LOL_ROUTING.toLowerCase()}.api.riotgames.com`;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function riotGet(url) {
    try {
        const res = await axios.get(url, {
            headers: { 'X-Riot-Token': RIOT_API_KEY }
        });
        return res.data;
    } catch (err) {
        if (err.response?.status === 429) {
            const retryAfter = (parseInt(err.response.headers['retry-after'] || '5') + 1) * 1000;
            console.warn(`⏳ Rate limit Riot API, attente ${retryAfter}ms...`);
            await wait(retryAfter);
            return riotGet(url);
        }
        if (err.response?.status === 404) return null;
        console.error(`❌ Riot API [${err.response?.status}]: ${url}`);
        return null;
    }
}

async function getPuuidByRiotId(gameName, tagLine) {
    const url = `${ROUTING_BASE}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    const data = await riotGet(url);
    return data?.puuid || null;
}

async function getRankedInfo(puuid) {
    const url = `${PLATFORM_BASE}/lol/league/v4/entries/by-puuid/${puuid}`;
    const data = await riotGet(url);
    if (!data) return null;
    const solo = data.find(e => e.queueType === 'RANKED_SOLO_5x5');
    const flex = data.find(e => e.queueType === 'RANKED_FLEX_SR');
    return { solo, flex };
}

async function getRecentMatches(puuid, count = 5) {
    const url = `${ROUTING_BASE}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=${count}`;
    const data = await riotGet(url);
    return data || [];
}

async function getMatchDetails(matchId) {
    const url = `${ROUTING_BASE}/lol/match/v5/matches/${matchId}`;
    return await riotGet(url);
}

async function checkLolGames(client) {
    if (!RIOT_API_KEY) {
        console.error('❌ RIOT_API_KEY manquante dans .env');
        return;
    }

    const channel = client.channels.cache.get(process.env.LOL_CHANNEL_ID);
    if (!channel) {
        console.error('❌ Salon LOL introuvable (Vérifie LOL_CHANNEL_ID dans .env).');
        return;
    }

    console.log('🎮 Vérification LoL...');

    const players = await getLolPlayers();
    if (!players || players.length === 0) return;

    for (const player of players) {
        try {
            await wait(1200);

            const matches = await getRecentMatches(player.puuid, 3);
            if (!matches || matches.length === 0) continue;

            const lastKnownMatchId = await getLolLastMatchId(player.puuid);
            const newMatches = [];

            for (const matchId of matches) {
                if (matchId === lastKnownMatchId) break;
                newMatches.push(matchId);
            }

            if (newMatches.length === 0) continue;

            console.log(`🆕 ${newMatches.length} nouvelle(s) partie(s) pour ${player.display_name}`);

            const toProcess = newMatches.reverse();

            for (const matchId of toProcess) {
                await wait(1200);
                const matchData = await getMatchDetails(matchId);
                if (!matchData) continue;

                const queueId = matchData.info.queueId;
                if (![420, 440].includes(queueId)) {
                    await updateLolLastMatchId(player.puuid, matchId);
                    continue;
                }

                const participant = matchData.info.participants.find(p => p.puuid === player.puuid);
                if (!participant) continue;

                const rankInfo = await getRankedInfo(player.puuid);

                try {
                    const imageBuffer = await generateMatchCard(
                        { displayName: player.display_name },
                        participant,
                        matchData,
                        rankInfo
                    );
                    const attachment = new AttachmentBuilder(imageBuffer, { name: 'match.png' });
                    await channel.send({ files: [attachment] });
                } catch (canvasErr) {
                    console.error('❌ Erreur génération image:', canvasErr.message);
                }

                await updateLolLastMatchId(player.puuid, matchId);
                await wait(2000);
            }

        } catch (err) {
            console.error(`❌ Erreur check LoL pour ${player.display_name}:`, err.message);
        }
    }
}

async function resolvePuuid(riotId) {
    const parts = riotId.split('#');
    if (parts.length !== 2) return null;
    return await getPuuidByRiotId(parts[0], parts[1]);
}

async function getLastMatchId(puuid) {
    const matches = await getRecentMatches(puuid, 1);
    return matches?.[0] || null;
}

module.exports = { checkLolGames, resolvePuuid, getLastMatchId };