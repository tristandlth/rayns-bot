const { createCanvas, loadImage } = require('canvas');
const axios = require('axios');

const WIDTH = 900;
const HEIGHT = 380;

const RANK_COLORS = {
    IRON: '#8a8a8a',
    BRONZE: '#ad5f26',
    SILVER: '#a0a8b0',
    GOLD: '#c89b3c',
    PLATINUM: '#4a8f8c',
    EMERALD: '#32a868',
    DIAMOND: '#576bce',
    MASTER: '#9d4dc9',
    GRANDMASTER: '#d6382e',
    CHALLENGER: '#f4c874',
};

const QUEUE_NAMES = {
    420: 'Ranked Solo/Duo',
    440: 'Ranked Flex',
};

async function fetchImage(source) {
    try {
        // Chemin local
        if (!source.startsWith('http')) {
            return await loadImage(source);
        }
        // URL distante
        const res = await axios.get(source, { responseType: 'arraybuffer', timeout: 5000 });
        return await loadImage(Buffer.from(res.data));
    } catch {
        return null;
    }
}

async function getDdragonVersion() {
    try {
        const res = await axios.get('https://ddragon.leagueoflegends.com/api/versions.json');
        return res.data[0];
    } catch {
        return '14.24.1';
    }
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

async function generateMatchCard(player, participant, match, rankInfo) {
    const version = await getDdragonVersion();
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    const win = participant.win;
    const champion = participant.championName;
    const kills = participant.kills;
    const deaths = participant.deaths;
    const assists = participant.assists;
    const kda = deaths === 0 ? '∞' : ((kills + assists) / deaths).toFixed(2);
    const cs = participant.totalMinionsKilled + participant.neutralMinionsKilled;
    const gameDuration = Math.floor(match.info.gameDuration / 60);
    const csPerMin = (cs / gameDuration).toFixed(1);
    const damage = Math.round(participant.totalDamageDealtToChampions / 1000 * 10) / 10;
    const visionScore = participant.visionScore;
    const queueName = QUEUE_NAMES[match.info.queueId] || 'Ranked';

    const teamKills = match.info.participants
        .filter(p => p.teamId === participant.teamId)
        .reduce((sum, p) => sum + p.kills, 0);
    const kp = teamKills === 0 ? '0%' : `${Math.round(((kills + assists) / teamKills) * 100)}%`;

    let multikill = '';
    if (participant.pentaKills > 0) multikill = 'PENTA KILL !';
    else if (participant.quadraKills > 0) multikill = 'QUADRA KILL';
    else if (participant.tripleKills > 0) multikill = 'Triple Kill';
    else if (participant.doubleKills > 0) multikill = 'Double Kill';

    // Fond : splash art du champion
    const splashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champion}_0.jpg`;
    const splash = await fetchImage(splashUrl);

    if (splash) {
        // Dessine le splash en couvrant toute la carte
        const scale = Math.max(WIDTH / splash.width, HEIGHT / splash.height);
        const sw = splash.width * scale;
        const sh = splash.height * scale;
        const sx = (WIDTH - sw) / 2;
        const sy = (HEIGHT - sh) / 2;
        ctx.drawImage(splash, sx, sy, sw, sh);
    }

    // Overlay sombre dégradé
    const grad = ctx.createLinearGradient(0, 0, WIDTH, 0);
    grad.addColorStop(0, 'rgba(10,10,20,0.97)');
    grad.addColorStop(0.45, 'rgba(10,10,20,0.85)');
    grad.addColorStop(1, 'rgba(10,10,20,0.3)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Barre colorée gauche (victoire/défaite)
    ctx.fillStyle = win ? '#2ecc71' : '#e74c3c';
    ctx.fillRect(0, 0, 5, HEIGHT);

    const ARCANE_CHAMPIONS = {
        'Jinx': path.join(__dirname, '../img/arcane/jinx.jpg'),
    };

    const champIconUrl = ARCANE_CHAMPIONS[champion] 
        || `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion}.png`;
    const champIcon = await fetchImage(champIconUrl);
    if (champIcon) {
        // Cercle clip
        ctx.save();
        ctx.beginPath();
        ctx.arc(70, 80, 48, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(champIcon, 22, 32, 96, 96);
        ctx.restore();
        // Bordure
        ctx.strokeStyle = win ? '#2ecc71' : '#e74c3c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(70, 80, 48, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Résultat / champion
    ctx.fillStyle = win ? '#2ecc71' : '#e74c3c';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(win ? '🏆 VICTOIRE' : '💀 DÉFAITE', 140, 60);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(champion, 140, 92);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '15px sans-serif';
    ctx.fillText(`${player.displayName}  •  ${queueName}  •  ${gameDuration} min`, 140, 118);

    // badge multikill
    if (multikill) {
        ctx.fillStyle = '#f39c12';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`⚡ ${multikill}`, 140, 142);
    }

    // rank
    if (rankInfo?.solo) {
        const r = rankInfo.solo;
        const rankColor = RANK_COLORS[r.tier] || '#ffffff';
        const winrate = ((r.wins / (r.wins + r.losses)) * 100).toFixed(0);

        ctx.fillStyle = rankColor;
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(`${r.tier} ${r.rank}`, 140, 175);

        ctx.fillStyle = '#dddddd';
        ctx.font = '14px sans-serif';
        ctx.fillText(`${r.leaguePoints} LP  •  ${r.wins}V/${r.losses}D  •  ${winrate}% WR`, 140, 197);
    }

    // séparateur
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 225);
    ctx.lineTo(600, 225);
    ctx.stroke();

    const stats = [
        { label: 'KDA', value: `${kills} / ${deaths} / ${assists}`, sub: `Ratio ${kda}` },
        { label: 'CS', value: cs.toString(), sub: `${csPerMin}/min` },
        { label: 'Vision', value: visionScore.toString(), sub: 'score' },
        { label: 'Dégâts', value: `${damage}k`, sub: 'aux champions' },
        { label: 'Kill Part.', value: kp, sub: '' },
    ];

    const statStartX = 30;
    const statY = 250;
    const statW = 108;
    const statGap = 12;

    stats.forEach((stat, i) => {
        const x = statStartX + i * (statW + statGap);

        // Fond du bloc
        roundRect(ctx, x, statY, statW, 100, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fill();

        // Label
        ctx.fillStyle = '#888888';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(stat.label, x + statW / 2, statY + 22);

        // Valeur principale
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${stat.value.length > 7 ? '15px' : '18px'} sans-serif`;
        ctx.fillText(stat.value, x + statW / 2, statY + 58);

        // Sous-valeur
        if (stat.sub) {
            ctx.fillStyle = '#888888';
            ctx.font = '11px sans-serif';
            ctx.fillText(stat.sub, x + statW / 2, statY + 80);
        }
    });

    ctx.textAlign = 'left';

    const itemIds = [
        participant.item0, participant.item1, participant.item2,
        participant.item3, participant.item4, participant.item5
    ].filter(id => id > 0);

    const itemSize = 36;
    const itemStartX = 630;
    const itemStartY = 250;
    const itemCols = 3;

    for (let i = 0; i < itemIds.length; i++) {
        const col = i % itemCols;
        const row = Math.floor(i / itemCols);
        const x = itemStartX + col * (itemSize + 4);
        const y = itemStartY + row * (itemSize + 4);

        const imgUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemIds[i]}.png`;
        const img = await fetchImage(imgUrl);
        if (img) {
            roundRect(ctx, x, y, itemSize, itemSize, 4);
            ctx.save();
            ctx.clip();
            ctx.drawImage(img, x, y, itemSize, itemSize);
            ctx.restore();
        } else {
            roundRect(ctx, x, y, itemSize, itemSize, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fill();
        }
    }

    if (participant.item6 > 0) {
        const trinketUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${participant.item6}.png`;
        const trinket = await fetchImage(trinketUrl);
        if (trinket) {
            const tx = itemStartX + itemCols * (itemSize + 4) + 8;
            roundRect(ctx, tx, itemStartY, itemSize, itemSize, 4);
            ctx.save();
            ctx.clip();
            ctx.drawImage(trinket, tx, itemStartY, itemSize, itemSize);
            ctx.restore();
        }
    }

    return canvas.toBuffer('image/png');
}

module.exports = { generateMatchCard };