const { SlashCommandBuilder } = require('discord.js');
const { resolvePuuid } = require('../utils/lol');
const { addLolPlayer, getLolPlayerByRiotId } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lol-add')
        .setDescription('Ajouter un joueur à suivre en LoL ranked')
        .addStringOption(opt =>
            opt.setName('riot_id')
                .setDescription('Riot ID du joueur (ex: Faker#KR1)')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('surnom')
                .setDescription('Surnom affiché dans les annonces (ex: Faker)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const riotId = interaction.options.getString('riot_id').trim();
        const displayName = interaction.options.getString('surnom') || riotId.split('#')[0];

        if (!riotId.includes('#')) {
            return interaction.editReply('❌ Format invalide. Utilise `NomJoueur#TAG` (ex: `Faker#KR1`)');
        }

        const existing = await getLolPlayerByRiotId(riotId);
        if (existing) {
            return interaction.editReply(`⚠️ **${riotId}** est déjà dans la liste de suivi (surnom: ${existing.display_name})`);
        }

        await interaction.editReply('🔍 Résolution du Riot ID...');
        const puuid = await resolvePuuid(riotId);

        if (!puuid) {
            return interaction.editReply(`❌ Riot ID introuvable : **${riotId}**\nVérifie le nom et le tag.`);
        }

        const success = await addLolPlayer(puuid, riotId, displayName);

        if (success) {
            await interaction.editReply(
                `✅ **${displayName}** (**${riotId}**) ajouté au suivi LoL !\n` +
                `Les prochaines parties ranked seront annoncées dans <#${process.env.LOL_CHANNEL_ID}>.`
            );
        } else {
            await interaction.editReply('❌ Erreur lors de l\'ajout en base de données.');
        }
    }
};
