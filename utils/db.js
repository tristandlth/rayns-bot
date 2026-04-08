const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

const initDb = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS levels (
                user_id VARCHAR(255) PRIMARY KEY,
                experience INTEGER DEFAULT 0,
                level INTEGER DEFAULT 0,
                msg_count INTEGER DEFAULT 0,
                voice_min INTEGER DEFAULT 0,
                last_message_date BIGINT DEFAULT 0
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS bot_settings (
                key VARCHAR(50) PRIMARY KEY,
                value TEXT
            );
        `);

        await client.query(`
            INSERT INTO bot_settings (key, value) 
            VALUES ('strava_last_id', '0') 
            ON CONFLICT (key) DO NOTHING;
        `);

        console.log("✅ Tables 'levels' et 'bot_settings' vérifiées.");
    } catch (err) {
        console.error("❌ Erreur init DB:", err);
    } finally {
        client.release();
    }
};


const addXp = async (userId, xpToAdd, type = 'text') => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT * FROM levels WHERE user_id = $1', [userId]);
        let user = res.rows[0];

        if (!user) {
            user = { experience: 0, level: 0, msg_count: 0, voice_min: 0 };
        }

        const newXp = user.experience + xpToAdd;
        const currentLevel = user.level;
        let newLevel = currentLevel;

        // on avance tant qu'on dépasse le seuil — gère les sauts de plusieurs niveaux d'un coup
        while (newXp >= 75 * ((newLevel + 1) ** 2)) {
            newLevel++;
        }

        const msgIncrement = type === 'text' ? 1 : 0;
        const voiceIncrement = type === 'voice' ? (xpToAdd / 15) : 0;

        await client.query(`
            INSERT INTO levels (user_id, experience, level, msg_count, voice_min, last_message_date)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                experience = excluded.experience,
                level = excluded.level,
                msg_count = levels.msg_count + excluded.msg_count,
                voice_min = levels.voice_min + excluded.voice_min,
                last_message_date = excluded.last_message_date;
        `, [
            userId, newXp, newLevel, msgIncrement, voiceIncrement, Date.now()
        ]);

        return { oldLevel: currentLevel, newLevel, newXp };

    } catch (err) {
        console.error("Erreur addXp:", err);
        return { oldLevel: 0, newLevel: 0, newXp: 0 };
    } finally {
        client.release();
    }
};

const getLeaderboard = async (limit = 10) => {
    try {
        const res = await pool.query('SELECT * FROM levels ORDER BY experience DESC LIMIT $1', [limit]);
        return res.rows.map(row => ({
            userId: row.user_id,
            experience: row.experience,
            level: row.level
        }));
    } catch (err) {
        console.error(err);
        return [];
    }
};

const getUserRank = async (userId) => {
    try {
        const res = await pool.query('SELECT * FROM levels WHERE user_id = $1', [userId]);
        const user = res.rows[0];
        
        if (!user) return null;

        const rankRes = await pool.query('SELECT COUNT(*) as count FROM levels WHERE experience > $1', [user.experience]);
        const rank = parseInt(rankRes.rows[0].count) + 1;

        return { 
            userId: user.user_id,
            experience: user.experience,
            level: user.level,
            msgCount: user.msg_count,
            voiceMin: user.voice_min,
            rank 
        };
    } catch (err) {
        console.error(err);
        return null;
    }
};


const getStravaLastId = async () => {
    try {
        const res = await pool.query("SELECT value FROM bot_settings WHERE key = 'strava_last_id'");
        if (res.rows.length > 0) return res.rows[0].value;
        return '0';
    } catch (err) {
        console.error("❌ Erreur lecture DB Strava:", err);
        return '0';
    }
};

const updateStravaLastId = async (newId) => {
    try {
        await pool.query("UPDATE bot_settings SET value = $1 WHERE key = 'strava_last_id'", [String(newId)]);
        console.log(`💾 ID Strava sauvegardé : ${newId}`);
    } catch (err) {
        console.error("❌ Erreur sauvegarde DB Strava:", err);
    }
};

// LOL TRACKING
const initLolTables = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS lol_players (
                puuid VARCHAR(100) PRIMARY KEY,
                display_name VARCHAR(100) NOT NULL,
                riot_id VARCHAR(100) NOT NULL,
                added_at BIGINT DEFAULT 0
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS lol_last_match (
                puuid VARCHAR(100) PRIMARY KEY,
                match_id VARCHAR(50) DEFAULT NULL
            );
        `);
        console.log("✅ Tables LoL vérifiées.");
    } catch (err) {
        console.error("❌ Erreur init tables LoL:", err);
    } finally {
        client.release();
    }
};

const getLolPlayers = async () => {
    try {
        const res = await pool.query('SELECT * FROM lol_players ORDER BY added_at ASC');
        return res.rows;
    } catch (err) {
        console.error("❌ Erreur getLolPlayers:", err);
        return [];
    }
};

const addLolPlayer = async (puuid, riotId, displayName) => {
    try {
        await pool.query(`
            INSERT INTO lol_players (puuid, display_name, riot_id, added_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (puuid) DO UPDATE SET display_name = $2, riot_id = $3;
        `, [puuid, displayName, riotId, Date.now()]);
        return true;
    } catch (err) {
        console.error("❌ Erreur addLolPlayer:", err);
        return false;
    }
};

const removeLolPlayer = async (puuid) => {
    try {
        const res = await pool.query('DELETE FROM lol_players WHERE puuid = $1 RETURNING *', [puuid]);
        await pool.query('DELETE FROM lol_last_match WHERE puuid = $1', [puuid]);
        return res.rowCount > 0;
    } catch (err) {
        console.error("❌ Erreur removeLolPlayer:", err);
        return false;
    }
};

const getLolLastMatchId = async (puuid) => {
    try {
        const res = await pool.query('SELECT match_id FROM lol_last_match WHERE puuid = $1', [puuid]);
        return res.rows[0]?.match_id || null;
    } catch (err) {
        console.error("❌ Erreur getLolLastMatchId:", err);
        return null;
    }
};

const updateLolLastMatchId = async (puuid, matchId) => {
    try {
        await pool.query(`
            INSERT INTO lol_last_match (puuid, match_id)
            VALUES ($1, $2)
            ON CONFLICT (puuid) DO UPDATE SET match_id = $2;
        `, [puuid, matchId]);
    } catch (err) {
        console.error("❌ Erreur updateLolLastMatchId:", err);
    }
};

const getLolPlayerByRiotId = async (riotId) => {
    try {
        const res = await pool.query('SELECT * FROM lol_players WHERE LOWER(riot_id) = LOWER($1)', [riotId]);
        return res.rows[0] || null;
    } catch (err) {
        console.error("❌ Erreur getLolPlayerByRiotId:", err);
        return null;
    }
};

// GAME TRACKING
const initGameTables = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS game_reviews (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                game_id INTEGER NOT NULL,
                game_name VARCHAR(255) NOT NULL,
                game_cover_url TEXT,
                rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
                review TEXT,
                added_at BIGINT DEFAULT 0,
                UNIQUE(user_id, game_id)
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS game_top (
                user_id VARCHAR(255) NOT NULL,
                position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 5),
                game_id INTEGER NOT NULL,
                game_name VARCHAR(255) NOT NULL,
                game_cover_url TEXT,
                PRIMARY KEY (user_id, position)
            );
        `);
        console.log("✅ Tables Game vérifiées.");
    } catch (err) {
        console.error("❌ Erreur init tables Game:", err);
    } finally {
        client.release();
    }
};

const addGameReview = async (userId, gameId, gameName, coverUrl, rating, review) => {
    try {
        await pool.query(`
            INSERT INTO game_reviews (user_id, game_id, game_name, game_cover_url, rating, review, added_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id, game_id) DO UPDATE SET
                game_name = $3,
                game_cover_url = $4,
                rating = $5,
                review = $6,
                added_at = $7;
        `, [userId, gameId, gameName, coverUrl, rating, review || null, Date.now()]);
        return true;
    } catch (err) {
        console.error("❌ Erreur addGameReview:", err);
        return false;
    }
};

const removeGameReview = async (userId, gameId) => {
    try {
        const res = await pool.query(
            'DELETE FROM game_reviews WHERE user_id = $1 AND game_id = $2 RETURNING *',
            [userId, gameId]
        );
        return res.rowCount > 0;
    } catch (err) {
        console.error("❌ Erreur removeGameReview:", err);
        return false;
    }
};

const getUserGameReview = async (userId, gameId) => {
    try {
        const res = await pool.query(
            'SELECT * FROM game_reviews WHERE user_id = $1 AND game_id = $2',
            [userId, gameId]
        );
        return res.rows[0] || null;
    } catch (err) {
        console.error("❌ Erreur getUserGameReview:", err);
        return null;
    }
};

const getUserGames = async (userId, search = '') => {
    try {
        const res = await pool.query(
            `SELECT * FROM game_reviews WHERE user_id = $1 AND LOWER(game_name) LIKE LOWER($2) ORDER BY added_at DESC`,
            [userId, `%${search}%`]
        );
        return res.rows;
    } catch (err) {
        console.error("❌ Erreur getUserGames:", err);
        return [];
    }
};

const setTopGame = async (userId, position, gameId, gameName, coverUrl) => {
    try {
        await pool.query(`
            INSERT INTO game_top (user_id, position, game_id, game_name, game_cover_url)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id, position) DO UPDATE SET
                game_id = $3,
                game_name = $4,
                game_cover_url = $5;
        `, [userId, position, gameId, gameName, coverUrl]);
        return true;
    } catch (err) {
        console.error("❌ Erreur setTopGame:", err);
        return false;
    }
};

const getUserTop = async (userId) => {
    try {
        const res = await pool.query(
            'SELECT * FROM game_top WHERE user_id = $1 ORDER BY position ASC',
            [userId]
        );
        return res.rows;
    } catch (err) {
        console.error("❌ Erreur getUserTop:", err);
        return [];
    }
};

module.exports = {
    initDb,
    addXp,
    getLeaderboard,
    getUserRank,
    getStravaLastId,
    updateStravaLastId,
    // LoL
    initLolTables,
    getLolPlayers,
    addLolPlayer,
    removeLolPlayer,
    getLolLastMatchId,
    updateLolLastMatchId,
    getLolPlayerByRiotId,
    // Game
    initGameTables,
    addGameReview,
    removeGameReview,
    getUserGameReview,
    getUserGames,
    setTopGame,
    getUserTop,
};