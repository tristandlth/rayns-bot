const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sondage')
        .setDescription('Lance un sondage simple (Oui/Non)')
        .addStringOption(option => 
            option.setName('question')
                .setDescription('La question à poser')
                .setRequired(true)),
    async execute(interaction) {
        const question = interaction.options.getString('question');

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📊 Nouveau Sondage !')
            .setDescription(`**${question}**`)
            .setFooter({ text: `Proposé par ${interaction.user.username}` })
            .setTimestamp();

        const pollMessage = await interaction.reply({ embeds: [embed], fetchReply: true });

        await pollMessage.react('✅');
        await pollMessage.react('❌');
    },
};