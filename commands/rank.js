const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getUserRank } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Affiche tes statistiques complètes')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Le membre à inspecter')),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        
        const userData = await getUserRank(targetUser.id);

        if (!userData) {
            return interaction.reply({ 
                content: "Cet utilisateur n'a pas encore de stats (pas d'XP).", 
                flags: MessageFlags.Ephemeral 
            });
        }

        const nextLevelXp = 75 * Math.pow(userData.level + 1, 2);
        
        const hours = Math.floor(userData.voiceMin / 60);
        const minutes = Math.floor(userData.voiceMin % 60);
        
        let voiceString = `${minutes} min`;
        if (hours > 0) {
            voiceString = `${hours}h ${minutes.toString().padStart(2, '0')}m`;
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ name: targetUser.username, iconURL: targetUser.displayAvatarURL() })
            .setTitle(`Statistiques de Niveau`)
            .setDescription(`Rang : **#${userData.rank}**`)
            .addFields(
                { name: 'Niveau', value: `${userData.level}`, inline: true },
                { name: 'XP Total', value: `${userData.experience} / ${nextLevelXp}`, inline: true },
                { name: '\u200b', value: '\u200b', inline: true }, // Séparateur invisible
                { name: '✉️ Messages', value: `${userData.msgCount}`, inline: true },
                { name: '🎙️ Temps Vocal', value: `${voiceString}`, inline: true }
            )
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }));

        await interaction.reply({ embeds: [embed] });
    },
};