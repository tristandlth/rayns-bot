const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Fait parler le bot (Admin uniquement)')
        .addStringOption(option => 
            option.setName('message')
                .setDescription('Le message à envoyer')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
        
    async execute(interaction) {
        const message = interaction.options.getString('message');

        await interaction.channel.send(message);

        await interaction.reply({ content: '✅ Message envoyé !', ephemeral: true });
    },
};