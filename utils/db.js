const { Pool } = require('pg');

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false 
});

const getLevelFromXp = (xp) => {
    let level = 0;
    while (xp >= 75 * Math.pow(level, 2)) {
        level++;
    }
    return level - 1;
};

const initDb = async () => {
    await db.query(`
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            xp_text INTEGER DEFAULT 0,
            xp_voice INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            last_message_date BIGINT DEFAULT 0
        );
    `);
    console.log("💾 Base de données prête.");
};

module.exports = { db, getLevelFromXp, initDb };