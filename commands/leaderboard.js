const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Affiche le top 10 du serveur 🏆'),
    async execute(interaction) {
        const topUsers = await getLeaderboard(10);

        if (topUsers.length === 0) {
            return interaction.reply('Le classement est vide pour le moment !');
        }

        const leaderboardString = topUsers.map((user, index) => {
            let rankEmoji = `**${index + 1}.**`;
            if (index === 0) rankEmoji = '🥇';
            if (index === 1) rankEmoji = '🥈';
            if (index === 2) rankEmoji = '🥉';

            return `${rankEmoji} <@${user.userId}> — **Niveau ${user.level}** \`(${user.experience} XP)\``;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 Classement du Serveur')
            .setDescription(leaderboardString)
            .setFooter({ text: 'Continuez à parler pour monter dans le classement !' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};