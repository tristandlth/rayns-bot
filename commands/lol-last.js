const { SlashCommandBuilder } = require('discord.js');
const { AttachmentBuilder } = require('discord.js');
const { resolvePuuid } = require('../utils/lol');
const { generateMatchCard } = require('../utils/lolCanvas');
const axios = require('axios');

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const LOL_REGION = process.env.LOL_REGION || 'EUW1';
const LOL_ROUTING = process.env.LOL_ROUTING || 'EUROPE';
const PLATFORM_BASE = `https://${LOL_REGION.toLowerCase()}.api.riotgames.com`;
const ROUTING_BASE = `https://${LOL_ROUTING.toLowerCase()}.api.riotgames.com`;

async function riotGet(url) {
    try {
        const res = await axios.get(url, { headers: { 'X-Riot-Token': RIOT_API_KEY } });
        return res.data;
    } catch (err) {
        if (err.response?.status === 404) return null;
        console.error(`❌ Riot API [${err.response?.status}]: ${url}`);
        return null;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lol-last')
        .setDescription('Affiche la dernière partie ranked d\'un joueur')
        .addStringOption(opt =>
            opt.setName('riot_id')
                .setDescription('Riot ID du joueur (ex: Pseudo#EUW)')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const riotId = interaction.options.getString('riot_id').trim();

        if (!riotId.includes('#')) {
            return interaction.editReply('❌ Format invalide. Utilise `Pseudo#TAG`');
        }

        const puuid = await resolvePuuid(riotId);
        if (!puuid) {
            return interaction.editReply(`❌ Joueur introuvable : **${riotId}**`);
        }

        const matchIds = await riotGet(
            `${ROUTING_BASE}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=1`
        );

        if (!matchIds || matchIds.length === 0) {
            return interaction.editReply(`❌ Aucune partie ranked trouvée pour **${riotId}**`);
        }

        const matchData = await riotGet(`${ROUTING_BASE}/lol/match/v5/matches/${matchIds[0]}`);
        if (!matchData) {
            return interaction.editReply('❌ Impossible de récupérer les détails de la partie.');
        }

        const participant = matchData.info.participants.find(p => p.puuid === puuid);
        if (!participant) {
            return interaction.editReply('❌ Joueur introuvable dans la partie.');
        }

        const rankData = await riotGet(`${PLATFORM_BASE}/lol/league/v4/entries/by-puuid/${puuid}`);
        const rankInfo = rankData ? {
            solo: rankData.find(e => e.queueType === 'RANKED_SOLO_5x5'),
            flex: rankData.find(e => e.queueType === 'RANKED_FLEX_SR'),
        } : null;

        try {
            const displayName = riotId.split('#')[0];
            const imageBuffer = await generateMatchCard(
                { displayName },
                participant,
                matchData,
                rankInfo
            );
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'match.png' });
            await interaction.editReply({ files: [attachment] });
        } catch (err) {
            console.error('❌ Erreur génération image:', err.message);
            await interaction.editReply('❌ Erreur lors de la génération de l\'image.');
        }
    }
};