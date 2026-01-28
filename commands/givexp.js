const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { addXp } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('givexp')
        .setDescription('Donne (ou retire) de l\'XP à un membre (Admin uniquement)')
        .addUserOption(option => 
            option.setName('membre')
                .setDescription('Le membre à modifier')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('montant')
                .setDescription('Quantité d\'XP (mettre un nombre négatif pour en retirer)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        
    async execute(interaction) {
        const targetUser = interaction.options.getUser('membre');
        const amount = interaction.options.getInteger('montant');

        const { oldLevel, newLevel } = await addXp(targetUser.id, amount, 'bonus');

        let message = `✅ J'ai donné **${amount} XP** à <@${targetUser.id}>.`;
        
        if (newLevel > oldLevel) {
            message += `\n🎉 Il est passé au niveau **${newLevel}** !`;
        } else if (newLevel < oldLevel) {
            message += `\n📉 Aïe, il est redescendu au niveau **${newLevel}**...`;
        }

        await interaction.reply({ content: message });
    },
};