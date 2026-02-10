const { addXp } = require('../utils/db');
const { createLevelUpEmbed } = require('../utils/embeds');

const voiceTracker = new Map();
const XP_PER_MINUTE = 10;

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        const userId = newState.member.id;
        if (newState.member.user.bot) return;

        if (newState.channelId && !newState.selfMute && !newState.serverMute) {
            if (!voiceTracker.has(userId)) {
                voiceTracker.set(userId, Date.now());
            }
        }

        if ((!newState.channelId || newState.selfMute || newState.serverMute) && voiceTracker.has(userId)) {
            const startTime = voiceTracker.get(userId);
            const duration = Date.now() - startTime;
            voiceTracker.delete(userId);

            const minutes = Math.floor(duration / 60000);
            if (minutes < 1) return;

            const xpGain = minutes * XP_PER_MINUTE;
            
            const { oldLevel, newLevel } = await addXp(userId, xpGain, 'voice');

            if (newLevel > oldLevel && newLevel % 5 === 0) {
                let channel = newState.guild.channels.cache.get(process.env.LEVEL_CHANNEL_ID);

                if (!channel) {
                    channel = newState.guild.channels.cache.find(c => c.type === 0);
                }
                
                if (channel) {
                    const embed = createLevelUpEmbed(newState.member.user, newLevel, 'Vocal');
                    
                    channel.send({
                        embeds: [embed] 
                    });
                }
            }
        }
    },
};