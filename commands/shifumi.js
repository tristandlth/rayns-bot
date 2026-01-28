const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shifumi')
        .setDescription('Joue à Pierre-Feuille-Ciseaux contre le bot'),
    async execute(interaction) {
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('pierre').setLabel('🗿 Pierre').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('feuille').setLabel('📄 Feuille').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('ciseaux').setLabel('✂️ Ciseaux').setStyle(ButtonStyle.Danger),
            );

        const reply = await interaction.reply({ 
            content: 'Choisis ton arme !', 
            components: [row],
            fetchReply: true 
        });

        const collector = reply.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 15000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: "Ce n'est pas ta partie !", ephemeral: true });
            }

            const userChoice = i.customId;
            const choices = ['pierre', 'feuille', 'ciseaux'];
            const botChoice = choices[Math.floor(Math.random() * choices.length)];

            let result = '';

            if (userChoice === botChoice) {
                result = "🤝 Égalité !";
            } else if (
                (userChoice === 'pierre' && botChoice === 'ciseaux') ||
                (userChoice === 'feuille' && botChoice === 'pierre') ||
                (userChoice === 'ciseaux' && botChoice === 'feuille')
            ) {
                result = "🏆 Tu as gagné !";
            } else {
                result = "💀 Tu as perdu";
            }

            const disabledRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('1').setLabel('🗿').setStyle(ButtonStyle.Secondary).setDisabled(true),
                    new ButtonBuilder().setCustomId('2').setLabel('📄').setStyle(ButtonStyle.Secondary).setDisabled(true),
                    new ButtonBuilder().setCustomId('3').setLabel('✂️').setStyle(ButtonStyle.Secondary).setDisabled(true),
                );

            await i.update({ 
                content: `Tu as joué **${userChoice}**, j'ai joué **${botChoice}**.\n\n${result}`, 
                components: [disabledRow] 
            });
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ content: '⏱️ Temps écoulé, tu as eu peur ?', components: [] });
            }
        });
    },
};