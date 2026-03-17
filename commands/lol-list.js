const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLolPlayers } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lol-list')
        .setDescription('Voir la liste des joueurs LoL suivis'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const players = await getLolPlayers();

        if (!players || players.length === 0) {
            return interaction.editReply(
                '📋 Aucun joueur suivi pour le moment.\n' +
                'Utilise `/lol-add NomJoueur#TAG` pour en ajouter un !'
            );
        }

        const embed = new EmbedBuilder()
            .setColor('#c89b3c')
            .setTitle('🎮 Joueurs LoL suivis')
            .setDescription(
                players.map((p, i) =>
                    `**${i + 1}.** ${p.display_name} — \`${p.riot_id}\``
                ).join('\n')
            )
            .setFooter({ text: `${players.length} joueur(s) • Annonces dans #lol-games` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
