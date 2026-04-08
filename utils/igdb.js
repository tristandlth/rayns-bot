const axios = require('axios');

let cachedToken = null;
let tokenExpiry = 0;

async function getTwitchToken() {
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    const res = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
            client_id: process.env.TWITCH_CLIENT_ID,
            client_secret: process.env.TWITCH_CLIENT_SECRET,
            grant_type: 'client_credentials',
        },
    });

    cachedToken = res.data.access_token;
    // expires_in est en secondes, on enlève 60s de marge
    tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000;
    return cachedToken;
}

async function igdbRequest(endpoint, body) {
    const token = await getTwitchToken();
    const res = await axios.post(`https://api.igdb.com/v4/${endpoint}`, body, {
        headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/plain',
        },
    });
    return res.data;
}

function normalizeCoverUrl(url) {
    if (!url) return null;
    // IGDB retourne parfois des URLs sans protocole
    const withProtocol = url.startsWith('//') ? `https:${url}` : url;
    return withProtocol.replace('t_thumb', 't_cover_big');
}

async function searchGames(query, limit = 10) {
    const escaped = query.replace(/"/g, '\\"');
    // On utilise `where name ~` plutôt que `search` pour l'autocomplete :
    // - supporte le prefix matching (partiel)
    // - compatible avec `sort` et `where category`
    // category : 0=jeu principal, 4=standalone expansion, 8=remake, 9=remaster, 10=expanded game
    // version_parent = null : exclut les éditions GOTY/Deluxe/etc.
    const body = `
        fields id, name, cover.url, first_release_date;
        where name ~ *"${escaped}"* & category = (0,4,8,9,10) & version_parent = null;
        sort first_release_date desc;
        limit ${limit};
    `;
    const games = await igdbRequest('games', body);
    return games.map(g => ({
        id: g.id,
        name: g.name,
        coverUrl: g.cover ? normalizeCoverUrl(g.cover.url) : null,
        year: g.first_release_date
            ? new Date(g.first_release_date * 1000).getFullYear()
            : null,
    }));
}

async function getGame(gameId) {
    const body = `
        fields id, name, cover.url, first_release_date;
        where id = ${gameId};
        limit 1;
    `;
    const games = await igdbRequest('games', body);
    if (!games.length) return null;
    const g = games[0];
    return {
        id: g.id,
        name: g.name,
        coverUrl: g.cover ? normalizeCoverUrl(g.cover.url) : null,
        year: g.first_release_date
            ? new Date(g.first_release_date * 1000).getFullYear()
            : null,
    };
}

module.exports = { searchGames, getGame };
