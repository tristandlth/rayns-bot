const axios = require('axios');
const { EmbedBuilder } = require('discord.js');
const { getLolPlayers, getLolLastMatchId, updateLolLastMatchId } = require('./db');

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const LOL_REGION = process.env.LOL_REGION || 'EUW1';
const LOL_ROUTING = process.env.LOL_ROUTING || 'EUROPE';

const PLATFORM_BASE = `https://${LOL_REGION.toLowerCase()}.api.riotgames.com`;
const ROUTING_BASE = `https://${LOL_ROUTING.toLowerCase()}.api.riotgames.com`;

const QUEUE_NAMES = {
    420: 'Ranked Solo/Duo',
    440: 'Ranked Flex',
    400: 'Normal Draft',
    430: 'Normal Blind',
    450: 'ARAM',
    1700: 'Arena',
    1900: 'URF',
    900: 'URF',
};

const RANK_ICONS = {
    IRON: '⬛',
    BRONZE: '🟫',
    SILVER: '⬜',
    GOLD: '🟨',
    PLATINUM: '🟦',
    EMERALD: '🟩',
    DIAMOND: '💎',
    MASTER: '🔮',
    GRANDMASTER: '🔱',
    CHALLENGER: '👑',
};

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

// Récupère le PUUID depuis le Riot ID (GameName#Tag)
async function getPuuidByRiotId(gameName, tagLine) {
    const url = `${ROUTING_BASE}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    const data = await riotGet(url);
    return data?.puuid || null;
}

// Récupère les infos de rang directement par PUUID
async function getRankedInfo(puuid) {
    const url = `${PLATFORM_BASE}/lol/league/v4/entries/by-puuid/${puuid}`;
    const data = await riotGet(url);
    if (!data) return null;
    const solo = data.find(e => e.queueType === 'RANKED_SOLO_5x5');
    const flex = data.find(e => e.queueType === 'RANKED_FLEX_SR');
    return { solo, flex };
}

// Récupère les dernières parties ranked
async function getRecentMatches(puuid, count = 5) {
    const url = `${ROUTING_BASE}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=${count}`;
    const data = await riotGet(url);
    return data || [];
}

// Récupère les détails d'une partie
async function getMatchDetails(matchId) {
    const url = `${ROUTING_BASE}/lol/match/v5/matches/${matchId}`;
    return await riotGet(url);
}

// Récupère les infos de timeline (pour multikills)
async function getMatchTimeline(matchId) {
    const url = `${ROUTING_BASE}/lol/match/v5/matches/${matchId}/timeline`;
    return await riotGet(url);
}

function buildMatchEmbed(player, participant, match, rankInfo) {
    const win = participant.win;
    const champion = participant.championName;
    const kills = participant.kills;
    const deaths = participant.deaths;
    const assists = participant.assists;
    const kda = deaths === 0 ? 'Perfect' : ((kills + assists) / deaths).toFixed(2);
    const cs = participant.totalMinionsKilled + participant.neutralMinionsKilled;
    const gameDuration = Math.floor(match.info.gameDuration / 60);
    const csPerMin = (cs / gameDuration).toFixed(1);
    const queueName = QUEUE_NAMES[match.info.queueId] || `Mode ${match.info.queueId}`;

    const damageToChampions = participant.totalDamageDealtToChampions.toLocaleString('fr-FR');
    const visionScore = participant.visionScore;
    const goldEarned = participant.goldEarned.toLocaleString('fr-FR');

    let multikillText = '';
    if (participant.pentaKills > 0) multikillText = '⚔️ **PENTA KILL !** ';
    else if (participant.quadraKills > 0) multikillText = '⚔️ **QUADRA KILL** ';
    else if (participant.tripleKills > 0) multikillText = '✨ Triple Kill ';
    else if (participant.doubleKills > 0) multikillText = '🎯 Double Kill ';

    // Rang actuel
    let rankText = 'Non classé';
    if (rankInfo?.solo) {
        const r = rankInfo.solo;
        const icon = RANK_ICONS[r.tier] || '❓';
        const winrate = ((r.wins / (r.wins + r.losses)) * 100).toFixed(0);
        rankText = `${icon} ${r.tier} ${r.rank} — ${r.leaguePoints} LP\n${r.wins}V/${r.losses}D (${winrate}%)`;
    }

    // Score de performance simple
    const killParticipation = (() => {
        const teamKills = match.info.participants
            .filter(p => p.teamId === participant.teamId)
            .reduce((sum, p) => sum + p.kills, 0);
        if (teamKills === 0) return '0%';
        return `${Math.round(((kills + assists) / teamKills) * 100)}%`;
    })();

    const embed = new EmbedBuilder()
        .setColor(win ? '#2ecc71' : '#e74c3c')
        .setTitle(`${win ? '🏆 VICTOIRE' : '💀 DÉFAITE'} — ${champion}`)
        .setDescription(
            `**${player.displayName}** vient de finir une partie !\n` +
            `${multikillText}` +
            `**${queueName}** • ${gameDuration} min`
        )
        .addFields(
            {
                name: '📊 KDA',
                value: `**${kills}** / **${deaths}** / **${assists}**\nRatio: **${kda}**`,
                inline: true
            },
            {
                name: '🌾 CS',
                value: `**${cs}** (${csPerMin}/min)`,
                inline: true
            },
            {
                name: '👁️ Vision',
                value: `Score: **${visionScore}**`,
                inline: true
            },
            {
                name: '⚔️ Dégâts',
                value: `**${damageToChampions}**`,
                inline: true
            },
            {
                name: '💰 Or',
                value: `**${goldEarned}**`,
                inline: true
            },
            {
                name: '🎯 Participation',
                value: `**${killParticipation}**`,
                inline: true
            },
            {
                name: '🏅 Rang actuel',
                value: rankText,
                inline: false
            }
        )
        .setThumbnail(`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${champion}.png`)
        .setFooter({ text: `Match ID: ${match.metadata.matchId}` })
        .setTimestamp(match.info.gameEndTimestamp);

    // Ajout des items
    const items = [
        participant.item0, participant.item1, participant.item2,
        participant.item3, participant.item4, participant.item5, participant.item6
    ].filter(id => id > 0);
    if (items.length > 0) {
        embed.addFields({
            name: '🎒 Items',
            value: items.map(id => `[${id}](https://www.leagueoflegends.com/fr-fr/news/)`).join(' '),
            inline: false
        });
    }

    return embed;
}

// Fonction principale de vérification
async function checkLolGames(client) {
    if (!RIOT_API_KEY) {
        console.error('❌ RIOT_API_KEY manquante dans .env');
        return;
    }

    const channel = client.channels.cache.get(process.env.LOL_CHANNEL_ID);
    if (!channel) {
        console.error("❌ Salon LOL introuvable (Vérifie LOL_CHANNEL_ID dans .env).");
        return;
    }

    console.log('🎮 Vérification LoL...');

    const players = await getLolPlayers();
    if (!players || players.length === 0) return;

    for (const player of players) {
        try {
            await wait(1200); // Respect rate limit entre joueurs

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

            // Traite les parties du plus ancien au plus récent
            const toProcess = newMatches.reverse();

            for (const matchId of toProcess) {
                await wait(1200);
                const matchData = await getMatchDetails(matchId);
                if (!matchData) continue;

                // Vérifie que c'est une partie ranked (Solo ou Flex)
                const queueId = matchData.info.queueId;
                if (![420, 440].includes(queueId)) {
                    // Met quand même à jour le last match pour ne pas re-poster des non-ranked
                    await updateLolLastMatchId(player.puuid, matchId);
                    continue;
                }

                const participant = matchData.info.participants.find(p => p.puuid === player.puuid);
                if (!participant) continue;

                // Récupère le rang directement par PUUID
                const rankInfo = await getRankedInfo(player.puuid);

                const embed = buildMatchEmbed(
                    { displayName: player.display_name },
                    participant,
                    matchData,
                    rankInfo
                );

                await channel.send({ embeds: [embed] });
                await updateLolLastMatchId(player.puuid, matchId);
                await wait(2000);
            }

        } catch (err) {
            console.error(`❌ Erreur check LoL pour ${player.display_name}:`, err.message);
        }
    }
}

// Résout un Riot ID en PUUID (pour l'ajout)
async function resolvePuuid(riotId) {
    const parts = riotId.split('#');
    if (parts.length !== 2) return null;
    return await getPuuidByRiotId(parts[0], parts[1]);
}

module.exports = { checkLolGames, resolvePuuid };
