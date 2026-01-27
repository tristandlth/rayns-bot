const { MessageFlags } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`Aucune commande trouvée pour ${interaction.commandName}`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            const errorPayload = { 
                content: 'Erreur à l\'exécution de la commande !', 
                flags: MessageFlags.Ephemeral 
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorPayload);
            } else {
                await interaction.reply(errorPayload);
            }
        }
    },
};