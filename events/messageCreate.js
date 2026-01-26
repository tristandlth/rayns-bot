const { db, getLevelFromXp } = require('../utils/db');
const { createLevelUpEmbed } = require('../utils/embeds');

const cooldowns = new Set();
const XP_COOLDOWN = 5000;

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot || !message.guild) return;

        // anti-spam
        if (cooldowns.has(message.author.id)) return;
        cooldowns.add(message.author.id);
        setTimeout(() => cooldowns.delete(message.author.id), XP_COOLDOWN);

        const xpGain = Math.floor(Math.random() * 10) + 15;

        try {
            const query = `
                INSERT INTO users (user_id, xp_text, level) VALUES ($1, $2, 1)
                ON CONFLICT (user_id) DO UPDATE 
                SET xp_text = users.xp_text + $2
                RETURNING xp_text, xp_voice, level;
            `;
            const res = await db.query(query, [message.author.id, xpGain]);
            const user = res.rows[0];

            const totalXp = user.xp_text + user.xp_voice;
            const newLevel = getLevelFromXp(totalXp);

            if (newLevel > user.level) {
                await db.query('UPDATE users SET level = $1 WHERE user_id = $2', [newLevel, message.author.id]);
                const embed = createLevelUpEmbed(message.author, newLevel, 'Texte');

                const alertChannel = message.guild.channels.cache.get(process.env.LEVEL_CHANNEL_ID);

                if (alertChannel) {
                    alertChannel.send({ content: `<@${message.author.id}>`, embeds: [embed] });
                } else {
                    message.channel.send({ content: `<@${message.author.id}>`, embeds: [embed] });
                }
            }
        } catch (err) {
            console.error(err);
        }
    },
};