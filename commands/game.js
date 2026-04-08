const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const { searchGames } = require('../utils/igdb');
const {
    addGameReview,
    removeGameReview,
    getUserGameReview,
    getUserGames,
    setTopGame,
    getUserTop,
} = require('../utils/db');

const STARS = ['', '★☆☆☆☆', '★★☆☆☆', '★★★☆☆', '★★★★☆', '★★★★★'];

// Encode les infos d'un jeu dans la value de l'autocomplete
function encodeGameValue(game) {
    return `${game.id}|${game.name}|${game.coverUrl || ''}`;
}

// Décode la value de l'autocomplete
function decodeGameValue(value) {
    const [idStr, name, coverUrl] = value.split('|');
    return { id: parseInt(idStr), name, coverUrl: coverUrl || null };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('game')
        .setDescription('Système de suivi de jeux vidéo')
        // ── ADD ──────────────────────────────────────────────────────────────
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Ajouter/modifier un avis sur un jeu')
                .addStringOption(opt =>
                    opt.setName('jeu')
                        .setDescription('Nom du jeu (recherche IGDB)')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addIntegerOption(opt =>
                    opt.setName('note')
                        .setDescription('Note de 1 à 5')
                        .setRequired(true)
                        .addChoices(
                            { name: '★☆☆☆☆ (1)', value: 1 },
                            { name: '★★☆☆☆ (2)', value: 2 },
                            { name: '★★★☆☆ (3)', value: 3 },
                            { name: '★★★★☆ (4)', value: 4 },
                            { name: '★★★★★ (5)', value: 5 },
                        )
                )
                .addStringOption(opt =>
                    opt.setName('review')
                        .setDescription('Ta review (optionnel)')
                        .setRequired(false)
                )
        )
        // ── REMOVE ───────────────────────────────────────────────────────────
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Supprimer un avis')
                .addStringOption(opt =>
                    opt.setName('jeu')
                        .setDescription('Jeu à supprimer de ta liste')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        // ── CHECK ────────────────────────────────────────────────────────────
        .addSubcommand(sub =>
            sub.setName('check')
                .setDescription("Voir l'avis d'un membre sur un jeu")
                .addUserOption(opt =>
                    opt.setName('utilisateur')
                        .setDescription('Le membre dont voir l\'avis')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('jeu')
                        .setDescription('Nom du jeu')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        // ── TOP ──────────────────────────────────────────────────────────────
        .addSubcommand(sub =>
            sub.setName('top')
                .setDescription('Voir le top 5 d\'un membre')
                .addUserOption(opt =>
                    opt.setName('utilisateur')
                        .setDescription('Le membre (toi par défaut)')
                        .setRequired(false)
                )
        )
        // ── SETTOP ───────────────────────────────────────────────────────────
        .addSubcommand(sub =>
            sub.setName('settop')
                .setDescription('Placer un jeu dans ton top 5')
                .addStringOption(opt =>
                    opt.setName('jeu')
                        .setDescription('Nom du jeu (recherche IGDB)')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addIntegerOption(opt =>
                    opt.setName('position')
                        .setDescription('Position dans le top (1 à 5)')
                        .setRequired(true)
                        .addChoices(
                            { name: '🥇 Position 1', value: 1 },
                            { name: '🥈 Position 2', value: 2 },
                            { name: '🥉 Position 3', value: 3 },
                            { name: '4️⃣ Position 4', value: 4 },
                            { name: '5️⃣ Position 5', value: 5 },
                        )
                )
        ),

    // ── AUTOCOMPLETE ─────────────────────────────────────────────────────────
    async autocomplete(interaction) {
        const sub = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused(true);

        if (focused.name !== 'jeu') {
            return interaction.respond([]);
        }

        const query = focused.value.trim();

        try {
            if (sub === 'remove') {
                // Autocomplete depuis les jeux de l'utilisateur en BDD
                const games = await getUserGames(interaction.user.id, query);
                return interaction.respond(
                    games.slice(0, 25).map(g => ({
                        name: g.game_name,
                        value: `${g.game_id}|${g.game_name}|${g.game_cover_url || ''}`,
                    }))
                );
            }

            if (sub === 'check') {
                // Autocomplete depuis les jeux de l'utilisateur ciblé en BDD
                const targetUser = interaction.options.getUser('utilisateur');
                if (!targetUser || !query) return interaction.respond([]);
                const games = await getUserGames(targetUser.id, query);
                return interaction.respond(
                    games.slice(0, 25).map(g => ({
                        name: g.game_name,
                        value: `${g.game_id}|${g.game_name}|${g.game_cover_url || ''}`,
                    }))
                );
            }

            // add / settop → recherche IGDB
            if (!query) return interaction.respond([]);
            const games = await searchGames(query, 10);
            return interaction.respond(
                games.map(g => ({
                    name: g.year ? `${g.name} (${g.year})` : g.name,
                    value: encodeGameValue(g),
                }))
            );
        } catch (err) {
            console.error('❌ Erreur autocomplete /game:', err);
            return interaction.respond([]);
        }
    },

    // ── EXECUTE ───────────────────────────────────────────────────────────────
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        // ── /game add ─────────────────────────────────────────────────────────
        if (sub === 'add') {
            const rawGame = interaction.options.getString('jeu');
            const note = interaction.options.getInteger('note');
            const review = interaction.options.getString('review');

            let gameId, gameName, coverUrl;
            try {
                ({ id: gameId, name: gameName, coverUrl } = decodeGameValue(rawGame));
            } catch {
                return interaction.reply({
                    content: '❌ Jeu invalide. Utilise l\'autocomplete pour sélectionner un jeu.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply();

            const ok = await addGameReview(interaction.user.id, gameId, gameName, coverUrl, note, review);
            if (!ok) {
                return interaction.editReply('❌ Erreur lors de l\'enregistrement. Réessaie plus tard.');
            }

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(gameName)
                .addFields({ name: 'Note', value: STARS[note], inline: true });

            if (review) embed.addFields({ name: 'Review', value: review, inline: false });
            if (coverUrl) embed.setThumbnail(coverUrl);
            embed.setFooter({ text: `Avis de ${interaction.user.displayName}` }).setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // ── /game remove ──────────────────────────────────────────────────────
        if (sub === 'remove') {
            const rawGame = interaction.options.getString('jeu');

            let gameId, gameName;
            try {
                ({ id: gameId, name: gameName } = decodeGameValue(rawGame));
            } catch {
                return interaction.reply({
                    content: '❌ Jeu invalide. Utilise l\'autocomplete.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`game_remove_confirm_${gameId}`)
                    .setLabel('Confirmer')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('game_remove_cancel')
                    .setLabel('Annuler')
                    .setStyle(ButtonStyle.Secondary),
            );

            await interaction.reply({
                content: `Supprimer **${gameName}** de ta liste ?`,
                components: [row],
                flags: MessageFlags.Ephemeral,
            });

            const filter = i => i.user.id === interaction.user.id;
            let confirmed;
            try {
                confirmed = await interaction.channel.awaitMessageComponent({ filter, time: 15_000 });
            } catch {
                return interaction.editReply({ content: '⏱️ Temps écoulé.', components: [] });
            }

            if (confirmed.customId === 'game_remove_cancel') {
                return confirmed.update({ content: '❌ Suppression annulée.', components: [] });
            }

            const ok = await removeGameReview(interaction.user.id, gameId);
            if (!ok) {
                return confirmed.update({ content: '❌ Ce jeu n\'est pas dans ta liste.', components: [] });
            }
            return confirmed.update({ content: `✅ **${gameName}** supprimé de ta liste.`, components: [] });
        }

        // ── /game check ───────────────────────────────────────────────────────
        if (sub === 'check') {
            const targetUser = interaction.options.getUser('utilisateur');
            const rawGame = interaction.options.getString('jeu');

            let gameId, gameName;
            try {
                ({ id: gameId, name: gameName } = decodeGameValue(rawGame));
            } catch {
                return interaction.reply({
                    content: '❌ Jeu invalide. Utilise l\'autocomplete.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply();

            const entry = await getUserGameReview(targetUser.id, gameId);
            if (!entry) {
                return interaction.editReply(`**${targetUser.displayName}** n'a pas encore noté **${gameName}**.`);
            }

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(entry.game_name)
                .addFields({ name: 'Note', value: STARS[entry.rating], inline: true });

            if (entry.review) embed.addFields({ name: 'Review', value: entry.review, inline: false });
            if (entry.game_cover_url) embed.setThumbnail(entry.game_cover_url);

            const date = new Date(Number(entry.added_at));
            embed.setFooter({ text: `Avis de ${targetUser.displayName}` }).setTimestamp(date);

            return interaction.editReply({ embeds: [embed] });
        }

        // ── /game top ─────────────────────────────────────────────────────────
        if (sub === 'top') {
            const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
            await interaction.deferReply();

            const top = await getUserTop(targetUser.id);
            if (!top.length) {
                return interaction.editReply(`**${targetUser.displayName}** n'a pas encore de top 5. Utilise \`/game settop\` pour en créer un.`);
            }

            const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`🎮 Top 5 de ${targetUser.displayName}`)
                .setThumbnail(targetUser.displayAvatarURL());

            for (const entry of top) {
                embed.addFields({
                    name: `${MEDALS[entry.position - 1]} #${entry.position}`,
                    value: entry.game_name,
                    inline: false,
                });
            }

            // Thumbnail = cover du jeu #1
            const first = top.find(t => t.position === 1);
            if (first?.game_cover_url) embed.setImage(first.game_cover_url);

            embed.setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // ── /game settop ──────────────────────────────────────────────────────
        if (sub === 'settop') {
            const rawGame = interaction.options.getString('jeu');
            const position = interaction.options.getInteger('position');

            let gameId, gameName, coverUrl;
            try {
                ({ id: gameId, name: gameName, coverUrl } = decodeGameValue(rawGame));
            } catch {
                return interaction.reply({
                    content: '❌ Jeu invalide. Utilise l\'autocomplete.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const ok = await setTopGame(interaction.user.id, position, gameId, gameName, coverUrl);
            if (!ok) {
                return interaction.editReply('❌ Erreur lors de l\'enregistrement. Réessaie plus tard.');
            }

            const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            return interaction.editReply(`✅ **${gameName}** placé en ${MEDALS[position - 1]} position ${position} de ton top !`);
        }
    },
};
