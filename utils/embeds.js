const { EmbedBuilder } = require('discord.js');

const THEME = {
    COLOR: '#3498db',
    SUCCESS: '#2ecc71',
    ERROR: '#e74c3c',
    FOOTER: 'Le Bot du Club • Système XP',
};

/**
 * Design : base
 */
const createBaseEmbed = (user) => {
    const embed = new EmbedBuilder()
        .setTimestamp()
        .setFooter({ text: THEME.FOOTER });

    if (user) {
        embed.setAuthor({ name: user.username, iconURL: user.displayAvatarURL() });
    }
    
    return embed;
};

/**
 * Design : LEVEL UP
 */
const createLevelUpEmbed = (user, newLevel, source) => {
    const emoji = source === 'Vocal' ? '🎙️' : '💬';
    
    return createBaseEmbed(user)
        .setColor(THEME.SUCCESS)
        .setTitle(`🎉 NIVEAU SUPÉRIEUR !`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setDescription(`Bravo <@${user.id}>, tu viens de passer un cap !`)
        .addFields(
            { name: 'Nouveau Niveau', value: `**${newLevel}**`, inline: true },
            { name: 'Source XP', value: `${emoji} ${source}`, inline: true },
            { name: 'Prochain Rang', value: 'Bientôt...', inline: true }
        );
};

module.exports = { createBaseEmbed, createLevelUpEmbed };