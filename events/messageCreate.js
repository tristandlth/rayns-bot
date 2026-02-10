const { addXp } = require('../utils/db');
const { createLevelUpEmbed } = require('../utils/embeds');

const cooldowns = new Set();
const XP_COOLDOWN = 5000;

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot || !message.guild) return;

        if (cooldowns.has(message.author.id)) return;
        cooldowns.add(message.author.id);
        setTimeout(() => cooldowns.delete(message.author.id), XP_COOLDOWN);

        const xpGain = Math.floor(Math.random() * 11) + 15;

        const { oldLevel, newLevel } = await addXp(message.author.id, xpGain, 'text');

        if (newLevel > oldLevel && newLevel % 5 === 0) {
            const embed = createLevelUpEmbed(message.author, newLevel, 'Texte');
            const alertChannel = message.guild.channels.cache.get(process.env.LEVEL_CHANNEL_ID) || message.channel;

            alertChannel.send({
                embeds: [embed] 
            });
        }
    },
};