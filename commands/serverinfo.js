const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Affiche les informations du serveur'),
    async execute(interaction) {
        const guild = interaction.guild;
        await guild.fetch();

        const owner = await guild.fetchOwner();
        const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);

        const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Info sur ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '👑 Propriétaire', value: `${owner.user.tag}`, inline: true },
                { name: '👥 Membres', value: `${guild.memberCount}`, inline: true },
                { name: '🎂 Création', value: `<t:${createdTimestamp}:D>`, inline: true },
                { name: '💬 Salons', value: `📝 Texte: ${textChannels}\n🔊 Vocal: ${voiceChannels}`, inline: false },
                { name: '🚀 Boosts', value: `Niveau ${guild.premiumTier} (${guild.premiumSubscriptionCount} boosts)`, inline: false }
            )
            .setFooter({ text: `ID: ${guild.id}` });

        await interaction.reply({ embeds: [embed] });
    },
};