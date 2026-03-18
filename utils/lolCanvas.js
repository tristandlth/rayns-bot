const { createCanvas, loadImage } = require('canvas');
const axios = require('axios');
const path = require('path');

const WIDTH = 900;
const HEIGHT = 420;

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

const ARCANE_CHAMPIONS = {
    'Jinx': path.join(__dirname, '../img/arcane/jinx.jpg'),
    'Vi': path.join(__dirname, '../img/arcane/vi.jpg'),
    'Jayce': path.join(__dirname, '../img/arcane/jayce.jpg'),
    'Caitlyn': path.join(__dirname, '../img/arcane/caitlyn.jpg'),
    'Viktor': path.join(__dirname, '../img/arcane/viktor.jpg'),
    'Ekko': path.join(__dirname, '../img/arcane/ekko.jpg'),
    'Singed': path.join(__dirname, '../img/arcane/singed.jpg'),
};

let ddragonVersion = null;
const imageCache = new Map();

async function getDdragonVersion() {
    if (ddragonVersion) return ddragonVersion;
    try {
        const res = await axios.get('https://ddragon.leagueoflegends.com/api/versions.json');
        ddragonVersion = res.data[0];
        return ddragonVersion;
    } catch {
        return '14.24.1';
    }
}

async function fetchImage(source) {
    if (imageCache.has(source)) return imageCache.get(source);
    try {
        let img;
        if (!source.startsWith('http')) {
            img = await loadImage(source);
        } else {
            const res = await axios.get(source, { responseType: 'arraybuffer', timeout: 5000 });
            img = await loadImage(Buffer.from(res.data));
        }
        imageCache.set(source, img);
        return img;
    } catch {
        return null;
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

    const win = participant.win === true || participant.win === 'Win';
    const champion = participant.championName;
    const kills = participant.kills;
    const deaths = participant.deaths;
    const assists = participant.assists;
    const kda = deaths === 0 ? 'Perfect' : ((kills + assists) / deaths).toFixed(2);
    const cs = participant.totalMinionsKilled + participant.neutralMinionsKilled;
    const gameDuration = Math.floor(match.info.gameDuration / 60);
    const csPerMin = (cs / gameDuration).toFixed(1);
    const damage = Math.round(participant.totalDamageDealtToChampions / 1000 * 10) / 10;
    const visionScore = participant.visionScore;
    const wardsPlaced = participant.wardsPlaced || 0;
    const champLevel = participant.champLevel;
    const queueName = QUEUE_NAMES[match.info.queueId] || 'Ranked';

    const teamKills = match.info.participants
        .filter(p => p.teamId === participant.teamId)
        .reduce((sum, p) => sum + p.kills, 0);
    const kp = teamKills === 0 ? '0%' : `${Math.round(((kills + assists) / teamKills) * 100)}%`;

    let multikill = '';
    if (participant.pentaKills > 0) multikill = 'PENTA KILL';
    else if (participant.quadraKills > 0) multikill = 'QUADRA KILL';
    else if (participant.tripleKills > 0) multikill = 'Triple Kill';
    else if (participant.doubleKills > 0) multikill = 'Double Kill';

    // Fond splash art
    const splashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champion}_0.jpg`;
    const splash = await fetchImage(splashUrl);
    if (splash) {
        const scale = Math.max(WIDTH / splash.width, HEIGHT / splash.height);
        const sw = splash.width * scale;
        const sh = splash.height * scale;
        ctx.drawImage(splash, (WIDTH - sw) / 2, (HEIGHT - sh) / 2, sw, sh);
    }

    // Overlay dégradé
    const grad = ctx.createLinearGradient(0, 0, WIDTH, 0);
    grad.addColorStop(0, 'rgba(10,10,20,0.97)');
    grad.addColorStop(0.5, 'rgba(10,10,20,0.88)');
    grad.addColorStop(1, 'rgba(10,10,20,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Barre couleur gauche
    ctx.fillStyle = win ? '#2ecc71' : '#e74c3c';
    ctx.fillRect(0, 0, 5, HEIGHT);

    // Icône champion
    const arcaneSource = ARCANE_CHAMPIONS[champion];
    const champIconUrl = arcaneSource || `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion}.png`;
    const champIcon = await fetchImage(champIconUrl);
    if (champIcon) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(70, 78, 48, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(champIcon, 22, 30, 96, 96);
        ctx.restore();
        ctx.strokeStyle = win ? '#2ecc71' : '#e74c3c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(70, 78, 48, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Badge niveau champion
    roundRect(ctx, 46, 112, 48, 20, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fill();
    ctx.fillStyle = '#c89b3c';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Niv. ${champLevel}`, 70, 126);
    ctx.textAlign = 'left';

    // Résultat
    ctx.fillStyle = win ? '#2ecc71' : '#e74c3c';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(win ? 'VICTOIRE' : 'DEFAITE', 140, 58);

    // Nom champion en blanc
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(champion, 140, 90);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '14px sans-serif';
    ctx.fillText(`${player.displayName}  |  ${queueName}  |  ${gameDuration} min`, 140, 115);

    if (multikill) {
        ctx.fillStyle = '#f39c12';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(multikill, 140, 140);
    }

    // Logo et infos de rang
    if (rankInfo?.solo) {
        const r = rankInfo.solo;
        const rankColor = RANK_COLORS[r.tier] || '#ffffff';
        const winrate = ((r.wins / (r.wins + r.losses)) * 100).toFixed(0);
        const noDiv = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(r.tier);

        const rankLogoUrl = `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/ranked-emblem/emblem-${r.tier.toLowerCase()}.png`;
        const rankLogo = await fetchImage(rankLogoUrl);
        if (rankLogo) {
            const logoSize = 230;
            const ratio = rankLogo.width / rankLogo.height;
            const logoW = logoSize * ratio;
            const logoH = logoSize;
            ctx.drawImage(rankLogo, -35, 70, logoW, logoH);
        }

        ctx.fillStyle = rankColor;
        ctx.font = 'bold 17px sans-serif';
        ctx.fillText(noDiv ? r.tier : `${r.tier} ${r.rank}`, 220, 172);

        ctx.fillStyle = '#dddddd';
        ctx.font = '13px sans-serif';
        ctx.fillText(`${r.leaguePoints} LP  |  ${r.wins}V / ${r.losses}D  |  ${winrate}% WR`, 220, 192);

        if (!noDiv) {
            const barX = 220;
            const barY = 200;
            const barW = 200;
            const barH = 6;
            roundRect(ctx, barX, barY, barW, barH, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fill();
            roundRect(ctx, barX, barY, Math.round(barW * (r.leaguePoints / 100)), barH, 3);
            ctx.fillStyle = rankColor;
            ctx.fill();
        }
    }

    // Séparateur
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(25, 228);
    ctx.lineTo(620, 228);
    ctx.stroke();

    // Blocs stats
    const stats = [
        { label: 'KDA', value: `${kills} / ${deaths} / ${assists}`, sub: `Ratio ${kda}` },
        { label: 'CS', value: cs.toString(), sub: `${csPerMin}/min` },
        { label: 'Vision', value: visionScore.toString(), sub: `${wardsPlaced} wards` },
        { label: 'Degats', value: `${damage}k`, sub: 'aux champions' },
        { label: 'Kill Part.', value: kp, sub: '' },
    ];

    const statY = 245;
    const statW = 108;
    const statGap = 10;
    const statStartX = 25;

    stats.forEach((stat, i) => {
        const x = statStartX + i * (statW + statGap);
        roundRect(ctx, x, statY, statW, 90, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fill();

        ctx.fillStyle = '#888888';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(stat.label, x + statW / 2, statY + 20);

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${stat.value.length > 9 ? '14px' : '18px'} sans-serif`;
        ctx.fillText(stat.value, x + statW / 2, statY + 56);

        if (stat.sub) {
            ctx.fillStyle = '#888888';
            ctx.font = '11px sans-serif';
            ctx.fillText(stat.sub, x + statW / 2, statY + 74);
        }
    });

    ctx.textAlign = 'left';

    // Items (2 rangées de 3)
    const itemIds = [
        participant.item0, participant.item1, participant.item2,
        participant.item3, participant.item4, participant.item5,
    ].filter(id => id > 0);

    const itemSize = 36;
    const itemStartX = 648;
    const itemStartY = 245;

    for (let i = 0; i < itemIds.length; i++) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = itemStartX + col * (itemSize + 4);
        const y = itemStartY + row * (itemSize + 4);
        const imgUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemIds[i]}.png`;
        const img = await fetchImage(imgUrl);
        roundRect(ctx, x, y, itemSize, itemSize, 4);
        if (img) {
            ctx.save();
            ctx.clip();
            ctx.drawImage(img, x, y, itemSize, itemSize);
            ctx.restore();
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fill();
        }
    }

    // Trinket
    if (participant.item6 > 0) {
        const trinketUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${participant.item6}.png`;
        const trinket = await fetchImage(trinketUrl);
        const tx = itemStartX + 3 * (itemSize + 4) + 6;
        roundRect(ctx, tx, itemStartY, itemSize, itemSize, 4);
        if (trinket) {
            ctx.save();
            ctx.clip();
            ctx.drawImage(trinket, tx, itemStartY, itemSize, itemSize);
            ctx.restore();
        }
    }

    // Compos 5v5
    const team1 = match.info.participants.filter(p => p.teamId === 100);
    const team2 = match.info.participants.filter(p => p.teamId === 200);
    const champSize = 32;
    const compoY = HEIGHT - champSize - 15;

    ctx.fillStyle = '#555555';
    ctx.font = '11px sans-serif';
    ctx.fillText('Equipe 1', 25, compoY - 5);
    ctx.fillText('Equipe 2', 25 + 5 * (champSize + 4) + 30, compoY - 5);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VS', 25 + 5 * (champSize + 4) + 14, compoY + 20);
    ctx.textAlign = 'left';

    for (const [teamIndex, team] of [team1, team2].entries()) {
        const offsetX = teamIndex === 0 ? 25 : 25 + 5 * (champSize + 4) + 30;
        for (let i = 0; i < team.length; i++) {
            const p = team[i];
            const x = offsetX + i * (champSize + 4);
            const isTracked = p.puuid === participant.puuid;
            const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${p.championName}.png`;
            const icon = await fetchImage(iconUrl);

            ctx.save();
            ctx.beginPath();
            ctx.arc(x + champSize / 2, compoY + champSize / 2, champSize / 2, 0, Math.PI * 2);
            ctx.clip();
            if (icon) {
                ctx.drawImage(icon, x, compoY, champSize, champSize);
            } else {
                ctx.fillStyle = '#333333';
                ctx.fillRect(x, compoY, champSize, champSize);
            }
            ctx.restore();

            ctx.strokeStyle = isTracked ? '#c89b3c' : 'rgba(255,255,255,0.2)';
            ctx.lineWidth = isTracked ? 2.5 : 1;
            ctx.beginPath();
            ctx.arc(x + champSize / 2, compoY + champSize / 2, champSize / 2, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    return canvas.toBuffer('image/png');
}

module.exports = { generateMatchCard };