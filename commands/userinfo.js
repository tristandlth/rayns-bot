const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Affiche les informations sur un utilisateur')
        .addUserOption(option => 
            option.setName('membre')
                .setDescription('Le membre à inspecter')),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('membre') || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id);

        const joinedAt = `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`;
        const createdAt = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`;

        const embed = new EmbedBuilder()
            .setColor(member.displayHexColor)
            .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL() })
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                { name: '🆔 ID', value: targetUser.id, inline: true },
                { name: '🎭 Surnom', value: member.nickname || 'Aucun', inline: true },
                { name: '📅 A rejoint le serveur', value: joinedAt, inline: false },
                { name: '🎂 Compte créé', value: createdAt, inline: false },
                { name: `🔰 Rôles [${member.roles.cache.size - 1}]`, value: member.roles.cache.map(r => r).join(' ').replace('@everyone', '') || 'Aucun' }
            )
            .setFooter({ text: `Demandé par ${interaction.user.username}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};