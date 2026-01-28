const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Lance une pièce (Pile ou Face)'),
    async execute(interaction) {
        const result = Math.random() > 0.5 ? 'Pile' : 'Face';
        
        const color = result === 'Pile' ? '#FFD700' : '#C0C0C0';
        
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`🪙 La pièce est tombée sur... **${result}** !`);

        await interaction.reply({ embeds: [embed] });
    },
};