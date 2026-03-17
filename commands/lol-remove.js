const { SlashCommandBuilder } = require('discord.js');
const { removeLolPlayer, getLolPlayers } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lol-remove')
        .setDescription('Retirer un joueur du suivi LoL')
        .addStringOption(opt =>
            opt.setName('riot_id')
                .setDescription('Riot ID du joueur à retirer (ex: Faker#KR1)')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const riotId = interaction.options.getString('riot_id').trim();

        const players = await getLolPlayers();
        const player = players.find(p => p.riot_id.toLowerCase() === riotId.toLowerCase());

        if (!player) {
            return interaction.editReply(`❌ **${riotId}** n'est pas dans la liste de suivi.`);
        }

        const success = await removeLolPlayer(player.puuid);

        if (success) {
            await interaction.editReply(`✅ **${player.display_name}** (**${riotId}**) retiré du suivi LoL.`);
        } else {
            await interaction.editReply('❌ Erreur lors de la suppression.');
        }
    }
};
