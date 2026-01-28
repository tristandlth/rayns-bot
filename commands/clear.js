const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Supprime un nombre défini de messages (max 100).')
        .addIntegerOption(option =>
            option.setName('nombre')
                .setDescription('Le nombre de messages à supprimer')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
        
    async execute(interaction) {
        const amount = interaction.options.getInteger('nombre');

        try {
            const deleted = await interaction.channel.bulkDelete(amount, true);

            await interaction.reply({ 
                content: `🧹 **${deleted.size}** messages ont été supprimés avec succès.`, 
                ephemeral: true 
            });

        } catch (error) {
            console.error(error);
            await interaction.reply({ 
                content: '❌ Une erreur est survenue. Impossible de supprimer les messages (ils sont peut-être trop anciens).', 
                ephemeral: true 
            });
        }
    },
};