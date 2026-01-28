const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Affiche la photo de profil en grand')
        .addUserOption(option => 
            option.setName('membre')
                .setDescription('Le membre dont tu veux voir l\'avatar')),
    async execute(interaction) {
        const user = interaction.options.getUser('membre') || interaction.user;

        const avatarUrl = user.displayAvatarURL({ dynamic: true, size: 1024 });

        const embed = new EmbedBuilder()
            .setColor('#2B2D31')
            .setTitle(`Avatar de ${user.username}`)
            .setImage(avatarUrl)
            .setURL(avatarUrl);

        await interaction.reply({ embeds: [embed] });
    },
};