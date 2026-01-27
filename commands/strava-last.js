const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { manualSync } = require('../utils/strava');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('strava-last')
        .setDescription('Force la récupération de la dernière activité'),
    async execute(interaction) {
        await interaction.reply({ content: '⏳ Récupération de la dernière activité', flags: true });

        await manualSync(interaction.channel, 1);
    },
};