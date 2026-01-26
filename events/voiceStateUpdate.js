const { db, getLevelFromXp } = require('../utils/db');
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
            console.log(`XP Vocal : +${xpGain} pour ${newState.member.user.tag}`);

            try {
                const query = `
                    INSERT INTO users (user_id, xp_voice, level) VALUES ($1, $2, 1)
                    ON CONFLICT (user_id) DO UPDATE 
                    SET xp_voice = users.xp_voice + $2
                    RETURNING xp_text, xp_voice, level;
                `;
                const res = await db.query(query, [userId, xpGain]);
                const user = res.rows[0];

                const totalXp = user.xp_text + user.xp_voice;
                const newLevel = getLevelFromXp(totalXp);

                if (newLevel > user.level) {
                    await db.query('UPDATE users SET level = $1 WHERE user_id = $2', [newLevel, userId]);

                    let channel = newState.guild.channels.cache.get(process.env.LEVEL_CHANNEL_ID);

                    if (!channel) {
                        channel = newState.guild.channels.cache.find(c => c.type === 0);
                    }
                    
                    if (channel) {
                        const userObj = newState.member.user;
                        
                        const embed = createLevelUpEmbed(userObj, newLevel, 'Vocal');
                        
                        channel.send({ content: `<@${userId}>`, embeds: [embed] });
                    }
                }
            } catch (err) {
                console.error(err);
            }
        }
    },
};