const { EmbedBuilder } = require('discord.js');

const THEME = {
    COLOR: '#3498db',
    SUCCESS: '#2ecc71',
    ERROR: '#e74c3c',
    FOOTER: 'Rayns',
};

const createBaseEmbed = (user) => {
    const embed = new EmbedBuilder()
        .setTimestamp()
        .setFooter({ text: THEME.FOOTER });

    if (user) {
        embed.setAuthor({ name: user.username, iconURL: user.displayAvatarURL() });
    }

    return embed;
};

// petit texte motivant qui change selon le palier atteint
const getMilestoneText = (level) => {
    if (level >= 45) return `Légende du serveur. Respect. 👑`;
    if (level >= 20) return `Un habitué qui tient la distance. 🔥`;
    return `Les débuts d'une belle présence sur le serveur. 🌱`;
};

const createLevelUpEmbed = (user, newLevel, source, newXp) => {
    const emoji = source === 'Vocal' ? '🎙️' : '💬';

    // barre de progression vers le niveau suivant
    const nextLevelXp = 75 * ((newLevel + 1) ** 2);
    const filled = Math.min(Math.round((newXp / nextLevelXp) * 10), 10);
    const bar = '▓'.repeat(filled) + '░'.repeat(10 - filled);

    return createBaseEmbed(user)
        .setColor(THEME.SUCCESS)
        .setTitle(`${emoji} NIVEAU SUPÉRIEUR ! 🎉`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setDescription(`Bravo <@${user.id}> — Niveau **${newLevel}** atteint !\n${getMilestoneText(newLevel)}`)
        .addFields(
            { name: 'Niveau', value: `**${newLevel}**`, inline: true },
            { name: 'XP', value: `${newXp} / ${nextLevelXp}`, inline: true },
            { name: 'Progression', value: `\`${bar}\``, inline: false },
        );
};

module.exports = { createBaseEmbed, createLevelUpEmbed };
