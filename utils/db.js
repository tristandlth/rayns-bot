const Database = require('better-sqlite3');
const db = new Database('levels.sqlite');

const initDb = () => {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS levels (
            userId TEXT PRIMARY KEY,
            experience INTEGER DEFAULT 0,
            level INTEGER DEFAULT 0,
            msgCount INTEGER DEFAULT 0,
            voiceMin INTEGER DEFAULT 0,
            lastMessageDate INTEGER DEFAULT 0
        )
    `).run();
};

const addXp = (userId, xpToAdd, type = 'text') => {
    const user = db.prepare('SELECT * FROM levels WHERE userId = ?').get(userId);

    if (!user) {
        db.prepare(`
            INSERT INTO levels (userId, experience, level, msgCount, voiceMin) 
            VALUES (?, ?, ?, ?, ?)
        `).run(
            userId, 
            xpToAdd, 
            0, 
            type === 'text' ? 1 : 0,
            type === 'voice' ? 1 : 0
        );
        return { oldLevel: 0, newLevel: 0 };
    }

    const newXp = user.experience + xpToAdd;
    const currentLevel = user.level;
    const nextLevelXp = 75 * ((currentLevel + 1) ** 2);
    let newLevel = currentLevel;

    if (newXp >= nextLevelXp) {
        newLevel++;
    }

    if (type === 'text') {
        db.prepare(`
            UPDATE levels 
            SET experience = ?, level = ?, msgCount = msgCount + 1, lastMessageDate = ? 
            WHERE userId = ?
        `).run(newXp, newLevel, Date.now(), userId);
    } else {
        const minutesToAdd = xpToAdd / 10; 
        
        db.prepare(`
            UPDATE levels 
            SET experience = ?, level = ?, voiceMin = voiceMin + ? 
            WHERE userId = ?
        `).run(newXp, newLevel, minutesToAdd, userId);
    }

    return { oldLevel: currentLevel, newLevel };
};

const getLeaderboard = (limit = 10) => {
    return db.prepare('SELECT * FROM levels ORDER BY experience DESC LIMIT ?').all(limit);
};

const getUserRank = (userId) => {
    const user = db.prepare('SELECT * FROM levels WHERE userId = ?').get(userId);
    if (!user) return null;
    
    const rank = db.prepare('SELECT COUNT(*) as count FROM levels WHERE experience > ?').get(user.experience).count + 1;
    return { ...user, rank };
};

module.exports = { initDb, addXp, getLeaderboard, getUserRank };