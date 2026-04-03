const { addXp } = require('../utils/db');
const { createLevelUpEmbed } = require('../utils/embeds');

const voiceTracker = new Map();
const XP_PER_MINUTE = 15;

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        const userId = newState.member.id;
        if (newState.member.user.bot) return;

        // démarre le timer si l'utilisateur rejoint et est actif (pas muté, pas sourd)
        const isActive = newState.channelId
            && !newState.selfMute && !newState.serverMute
            && !newState.selfDeaf && !newState.serverDeaf;

        if (isActive && !voiceTracker.has(userId)) {
            voiceTracker.set(userId, Date.now());
        }

        // arrête le timer si l'utilisateur quitte, se mute ou se rend sourd
        const hasLeft = !newState.channelId
            || newState.selfMute || newState.serverMute
            || newState.selfDeaf || newState.serverDeaf;

        if (hasLeft && voiceTracker.has(userId)) {
            const startTime = voiceTracker.get(userId);
            const minutes = Math.floor((Date.now() - startTime) / 60000);
            voiceTracker.delete(userId);

            if (minutes < 1) return;

            const xpGain = minutes * XP_PER_MINUTE;
            const { oldLevel, newLevel, newXp } = await addXp(userId, xpGain, 'voice');

            if (newLevel > oldLevel && newLevel % 5 === 0) {
                let channel = newState.guild.channels.cache.get(process.env.LEVEL_CHANNEL_ID);

                // fallback sur le premier salon texte dispo si LEVEL_CHANNEL_ID n'est pas défini
                if (!channel) {
                    channel = newState.guild.channels.cache.find(c => c.type === 0);
                }

                if (channel) {
                    const embed = createLevelUpEmbed(newState.member.user, newLevel, 'Vocal', newXp);
                    channel.send({ embeds: [embed] });
                }
            }
        }
    },
};
