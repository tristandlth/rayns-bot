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
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Il y a eu une erreur en exécutant cette commande !', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Il y a eu une erreur en exécutant cette commande !', ephemeral: true });
            }
        }
    },
};