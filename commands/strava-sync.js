const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { manualSync } = require('../utils/strava');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('strava-sync')
        .setDescription('Force la récupération des dernières activités (Admin uniquement)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.reply({ content: '⏳ Lancement de la synchronisation...', ephemeral: true });

        await manualSync(interaction.channel, 10);
    },
};