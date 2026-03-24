const { createCanvas, loadImage } = require('canvas');
const axios = require('axios');
const path = require('path');

const WIDTH = 900;
const HEIGHT = 510;

const RANK_COLORS = {
    IRON: '#8a8a8a', BRONZE: '#ad5f26', SILVER: '#a0a8b0', GOLD: '#c89b3c',
    PLATINUM: '#4a8f8c', EMERALD: '#32a868', DIAMOND: '#576bce',
    MASTER: '#9d4dc9', GRANDMASTER: '#d6382e', CHALLENGER: '#f4c874',
};

const QUEUE_NAMES = { 420: 'Ranked Solo/Duo', 440: 'Ranked Flex' };

const CHAMPIONS = {
    'Jinx': path.join(__dirname, '../img/icons/jinx.jpg'),
    'Vi': path.join(__dirname, '../img/icons/vi.jpg'),
    'Viktor': path.join(__dirname, '../img/icons/viktor.jpg'),
    'Ekko': path.join(__dirname, '../img/icons/ekko.jpg'),
    'Singed': path.join(__dirname, '../img/icons/singed.jpg'),
    'Velkoz': path.join(__dirname, '../img/icons/velkoz.jpg'),
};

const SPLASH = {
    'Jinx': path.join(__dirname, '../img/splash/jinx.png'),
    'Velkoz': path.join(__dirname, '../img/splash/velkoz.jpg'),
    'Lillia': path.join(__dirname, '../img/splash/lillia.jpg'),
    'Singed': path.join(__dirname, '../img/splash/singed.png'),
};

let ddragonVersion = null;
const imageCache = new Map();

async function getDdragonVersion() {
    if (ddragonVersion) return ddragonVersion;
    try {
        const res = await axios.get('https://ddragon.leagueoflegends.com/api/versions.json');
        ddragonVersion = res.data[0];
        return ddragonVersion;
    } catch { return '14.24.1'; }
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
    } catch (err) {
        console.error(`❌ fetchImage erreur: ${source}`, err.message);
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

function kdaColor(ratio) {
    if (ratio === null) return '#2ecc71';
    return ratio >= 1 ? '#2ecc71' : '#e74c3c';
}

function playerKdaColor(p) {
    const isSupport = p.teamPosition === 'UTILITY';
    if (p.deaths === 0) return '#2ecc71';
    const s = isSupport ? (p.kills + p.assists) / p.deaths : p.kills / p.deaths;
    return s >= 1 ? '#2ecc71' : '#e74c3c';
}

function calculateScore(participant, match) {
    const role = participant.teamPosition || 'NONE';
    const dur = match.info.gameDuration / 60;
    const sameRole = match.info.participants.filter(p => p.teamPosition === role && p.puuid !== participant.puuid);
    const ref = sameRole.length >= 2 ? sameRole : match.info.participants.filter(p => p.puuid !== participant.puuid);
    const avg = (arr, fn) => arr.reduce((s, p) => s + fn(p), 0) / arr.length;
    const ratio = (v, a) => Math.min(v / Math.max(a, 0.01), 2.0);

    const myKda = participant.deaths === 0 ? (participant.kills + participant.assists) * 2 : (participant.kills + participant.assists) / participant.deaths;
    const myCs = (participant.totalMinionsKilled + participant.neutralMinionsKilled) / dur;
    const myVision = participant.visionScore / dur;
    const myDamage = participant.totalDamageDealtToChampions / dur;
    const teamKills = match.info.participants.filter(p => p.teamId === participant.teamId).reduce((s, p) => s + p.kills, 0);
    const myKp = teamKills === 0 ? 0 : (participant.kills + participant.assists) / teamKills;

    const avgKda = avg(ref, p => p.deaths === 0 ? (p.kills + p.assists) * 2 : (p.kills + p.assists) / p.deaths);
    const avgCs = avg(ref, p => (p.totalMinionsKilled + p.neutralMinionsKilled) / dur);
    const avgVision = avg(ref, p => p.visionScore / dur);
    const avgDamage = avg(ref, p => p.totalDamageDealtToChampions / dur);
    const avgKp = avg(ref, p => {
        const tk = match.info.participants.filter(x => x.teamId === p.teamId).reduce((s, x) => s + x.kills, 0);
        return tk === 0 ? 0 : (p.kills + p.assists) / tk;
    });

    let w;
    if (role === 'UTILITY') w = { kda: 0.30, cs: 0.05, damage: 0.10, kp: 0.30, vision: 0.25 };
    else if (role === 'JUNGLE') w = { kda: 0.25, cs: 0.20, damage: 0.15, kp: 0.25, vision: 0.15 };
    else w = { kda: 0.25, cs: 0.30, damage: 0.25, kp: 0.10, vision: 0.10 };

    const raw = ratio(myKda, avgKda) * w.kda + ratio(myCs, avgCs) * w.cs +
        ratio(myDamage, avgDamage) * w.damage + ratio(myKp, avgKp) * w.kp + ratio(myVision, avgVision) * w.vision;

    let score = Math.round(raw * 50);
    if (participant.win === true || participant.win === 'Win') score += 5;
    return Math.min(Math.max(score, 0), 100);
}

function scoreColor(score) {
    if (score >= 90) return '#f39c12';
    if (score >= 70) return '#2ecc71';
    if (score >= 50) return '#3498db';
    if (score >= 30) return '#aaaaaa';
    return '#e74c3c';
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
    const kdaRatio = deaths === 0 ? null : (kills + assists) / deaths;
    const kda = kdaRatio === null ? 'Perfect' : kdaRatio.toFixed(2);
    const cs = participant.totalMinionsKilled + participant.neutralMinionsKilled;
    const gameDuration = Math.floor(match.info.gameDuration / 60);
    const csPerMin = (cs / gameDuration).toFixed(1);
    const damage = Math.round(participant.totalDamageDealtToChampions / 1000 * 10) / 10;
    const visionScore = participant.visionScore;
    const wardsPlaced = participant.wardsPlaced || 0;
    const champLevel = participant.champLevel;
    const queueName = QUEUE_NAMES[match.info.queueId] || 'Ranked';

    const isBlue = participant.teamId === 100;
    const myTeamId = participant.teamId;
    const enemyTeamId = myTeamId === 100 ? 200 : 100;

    const myTeam = match.info.participants.filter(p => p.teamId === myTeamId);
    const enemyTeam = match.info.participants.filter(p => p.teamId === enemyTeamId);

    const teamKills = myTeam.reduce((s, p) => s + p.kills, 0);
    const teamDeaths = myTeam.reduce((s, p) => s + p.deaths, 0);
    const teamAssists = myTeam.reduce((s, p) => s + p.assists, 0);
    const enemyKills = enemyTeam.reduce((s, p) => s + p.kills, 0);
    const enemyDeaths = enemyTeam.reduce((s, p) => s + p.deaths, 0);
    const enemyAssists = enemyTeam.reduce((s, p) => s + p.assists, 0);

    const kp = teamKills === 0 ? '0%' : `${Math.round(((kills + assists) / teamKills) * 100)}%`;
    const score = calculateScore(participant, match);
    const sColor = scoreColor(score);

    let multikill = '';
    if (participant.pentaKills > 0) multikill = 'PENTA KILL';
    else if (participant.quadraKills > 0) multikill = 'QUADRA KILL';
    else if (participant.tripleKills > 0) multikill = 'Triple Kill';
    else if (participant.doubleKills > 0) multikill = 'Double Kill';

    const champX = 88;
    const champY = 120;
    const champR = 56;

    // ── BACKGROUND ──────────────────────────────────────────────────────────
    const splashSource = SPLASH[champion] || `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champion}_0.jpg`;
    const splash = await fetchImage(splashSource);
    if (splash) {
        const scale = Math.max(WIDTH / splash.width, HEIGHT / splash.height);
        const sw = splash.width * scale;
        const sh = splash.height * scale;
        ctx.drawImage(splash, (WIDTH - sw) / 2, (HEIGHT - sh) / 2, sw, sh);
    }

    const grad = ctx.createLinearGradient(0, 0, WIDTH, 0);
    grad.addColorStop(0, 'rgba(8,8,18,0.98)');
    grad.addColorStop(0.38, 'rgba(8,8,18,0.95)');
    grad.addColorStop(0.65, 'rgba(8,8,18,0.78)');
    grad.addColorStop(1, 'rgba(8,8,18,0.22)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // ── TOP BORDER ───────────────────────────────────────────────────────────
    ctx.fillStyle = win ? '#2ecc71' : '#e74c3c';
    ctx.fillRect(0, 0, WIDTH, 4);

    // ── RESULT PILL (au-dessus du champion) ──────────────────────────────────
    const resultText = win ? 'VICTOIRE' : 'DEFAITE';
    const resultColor = win ? '#2ecc71' : '#e74c3c';
    ctx.font = 'bold 12px sans-serif';
    const rw = ctx.measureText(resultText).width + 26;
    const pillX = champX - rw / 2;
    roundRect(ctx, pillX, 10, rw, 24, 12);
    ctx.fillStyle = win ? 'rgba(46,204,113,0.12)' : 'rgba(231,76,60,0.12)';
    ctx.fill();
    roundRect(ctx, pillX, 10, rw, 24, 12);
    ctx.strokeStyle = resultColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = resultColor;
    ctx.textAlign = 'center';
    ctx.fillText(resultText, champX, 26);
    ctx.textAlign = 'left';

    // ── CHAMPION CIRCLE ──────────────────────────────────────────────────────
    const champSrc = CHAMPIONS[champion];
    const champIconUrl = champSrc || `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion}.png`;
    const champIcon = await fetchImage(champIconUrl);
    if (champIcon) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(champX, champY, champR, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(champIcon, champX - champR, champY - champR, champR * 2, champR * 2);
        ctx.restore();
        ctx.strokeStyle = win ? 'rgba(46,204,113,0.5)' : 'rgba(231,76,60,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(champX, champY, champR, 0, Math.PI * 2);
        ctx.stroke();
    }

    // ── SCORE ARC RING ───────────────────────────────────────────────────────
    const arcR = champR + 11;
    ctx.beginPath();
    ctx.arc(champX, champY, arcR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 5;
    ctx.stroke();
    const arcStart = -Math.PI / 2;
    const arcEnd = arcStart + (score / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(champX, champY, arcR, arcStart, arcEnd);
    ctx.strokeStyle = sColor;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineCap = 'butt';

    // ── LEVEL BADGE ──────────────────────────────────────────────────────────
    const badgeY = champY + champR - 12;
    roundRect(ctx, champX - 24, badgeY, 48, 18, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fill();
    ctx.fillStyle = '#c89b3c';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Niv. ${champLevel}`, champX, badgeY + 13);

    // ── CHAMPION NAME + SCORE ─────────────────────────────────────────────────
    ctx.fillStyle = '#777777';
    ctx.font = '12px sans-serif';
    ctx.fillText(champion, champX, champY + champR + 24);

    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = sColor;
    ctx.fillText(`${score}`, champX, champY + champR + 54);
    ctx.fillStyle = '#444444';
    ctx.font = '11px sans-serif';
    ctx.fillText('/100', champX, champY + champR + 69);
    ctx.textAlign = 'left';

    // ── PLAYER NAME + QUEUE ───────────────────────────────────────────────────
    const hx = 190;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(player.displayName, hx, 76);

    ctx.fillStyle = '#777777';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${queueName}  •  ${gameDuration} min`, hx, 98);

    if (multikill) {
        ctx.fillStyle = '#f39c12';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(multikill, hx, 120);
    }

    // ── RANK ──────────────────────────────────────────────────────────────────
    if (rankInfo?.solo) {
        const r = rankInfo.solo;
        const rankColor = RANK_COLORS[r.tier] || '#ffffff';
        const winrate = ((r.wins / (r.wins + r.losses)) * 100).toFixed(0);
        const noDiv = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(r.tier);

        const rankLogoUrl = `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/ranked-emblem/emblem-${r.tier.toLowerCase()}.png`;
        const rankLogo = await fetchImage(rankLogoUrl);
        if (rankLogo) {
            const logoSize = 230;
            const lw = logoSize * (rankLogo.width / rankLogo.height);
            ctx.drawImage(rankLogo, 20, 60, lw, logoSize);
        }

        ctx.fillStyle = rankColor;
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(noDiv ? r.tier : `${r.tier} ${r.rank}`, 288, 155);

        ctx.fillStyle = '#bbbbbb';
        ctx.font = '13px sans-serif';
        ctx.fillText(`${r.leaguePoints} LP  •  ${r.wins}V / ${r.losses}D  •  ${winrate}% WR`, 288, 175);

        if (!noDiv) {
            const bx = 288, by = 185, bw = 220, bh = 5;
            roundRect(ctx, bx, by, bw, bh, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fill();
            roundRect(ctx, bx, by, Math.round(bw * r.leaguePoints / 100), bh, 3);
            ctx.fillStyle = rankColor;
            ctx.fill();
        }
    }

    // ── SEPARATOR 1 ───────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(15, 280);
    ctx.lineTo(WIDTH - 15, 280);
    ctx.stroke();

    // ── STATS ─────────────────────────────────────────────────────────────────
    const stats = [
        { label: 'KDA', value: `${kills} / ${deaths} / ${assists}`, sub: `Ratio ${kda}`, colored: true },
        { label: 'CS', value: cs.toString(), sub: `${csPerMin}/min`, colored: false },
        { label: 'Vision', value: visionScore.toString(), sub: `${wardsPlaced} wards`, colored: false },
        { label: 'Degats', value: `${damage}k`, sub: 'aux champs', colored: false },
        { label: 'Kill Part.', value: kp, sub: '', colored: false },
    ];

    const sY = 290, sH = 108, sW = 112, sGap = 8, sX = 15;

    stats.forEach((stat, i) => {
        const x = sX + i * (sW + sGap);

        roundRect(ctx, x, sY, sW, sH, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fill();
        roundRect(ctx, x, sY, sW, sH, 8);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.stroke();

        roundRect(ctx, x, sY, sW, 3, 2);
        ctx.fillStyle = stat.colored ? kdaColor(kdaRatio) : '#2ecc71';
        ctx.fill();

        const cx = x + sW / 2;
        ctx.textAlign = 'center';

        ctx.fillStyle = '#555555';
        ctx.font = '10px sans-serif';
        ctx.fillText(stat.label.toUpperCase(), cx, sY + 18);

        ctx.fillStyle = stat.colored ? kdaColor(kdaRatio) : '#ffffff';
        ctx.font = `bold ${stat.value.length > 9 ? '13px' : '20px'} sans-serif`;
        ctx.fillText(stat.value, cx, sY + 63);

        if (stat.sub) {
            ctx.fillStyle = '#4a4a4a';
            ctx.font = '11px sans-serif';
            ctx.fillText(stat.sub, cx, sY + 83);
        }
    });

    ctx.textAlign = 'left';

    // ── ITEMS ─────────────────────────────────────────────────────────────────
    const itemIds = [
        participant.item0, participant.item1, participant.item2,
        participant.item3, participant.item4, participant.item5,
    ].filter(id => id > 0);

    const iSize = 33;
    const iX = sX + 5 * (sW + sGap) + 14;
    const iY = sY + 10;

    for (let i = 0; i < itemIds.length; i++) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = iX + col * (iSize + 4);
        const y = iY + row * (iSize + 4);
        const imgUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemIds[i]}.png`;
        const img = await fetchImage(imgUrl);
        roundRect(ctx, x, y, iSize, iSize, 5);
        if (img) {
            ctx.save(); ctx.clip();
            ctx.drawImage(img, x, y, iSize, iSize);
            ctx.restore();
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fill();
        }
    }

    if (participant.item6 > 0) {
        const trinketUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${participant.item6}.png`;
        const trinket = await fetchImage(trinketUrl);
        const tx = iX + 3 * (iSize + 4) + 8;
        roundRect(ctx, tx, iY, iSize, iSize, 5);
        if (trinket) {
            ctx.save(); ctx.clip();
            ctx.drawImage(trinket, tx, iY, iSize, iSize);
            ctx.restore();
        }
    }

    // ── SEPARATOR 2 ───────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(15, 410);
    ctx.lineTo(WIDTH - 15, 410);
    ctx.stroke();

    // ── 5v5 COMPOS ────────────────────────────────────────────────────────────
    const team1 = match.info.participants.filter(p => p.teamId === 100);
    const team2 = match.info.participants.filter(p => p.teamId === 200);
    const cSize = 34;
    const cGap = 6;
    const cY = 450;

    const oneTeamW = 5 * (cSize + cGap) - cGap;
    const vsAreaW = 44;
    const totalW = oneTeamW * 2 + vsAreaW;
    const cStartX = Math.round((WIDTH - totalW) / 2);
    const vsCenter = cStartX + oneTeamW + vsAreaW / 2;
    const t2StartX = cStartX + oneTeamW + vsAreaW;

    // KDA équipe du joueur
    const myKdaStr = `${teamKills} / ${teamDeaths} / ${teamAssists}`;
    // KDA équipe adverse
    const enemyKdaStr = `${enemyKills} / ${enemyDeaths} / ${enemyAssists}`;

    const blueKdaStr = isBlue ? myKdaStr : enemyKdaStr;
    const redKdaStr = isBlue ? enemyKdaStr : myKdaStr;

    // Blue Side
    ctx.fillStyle = '#3d7fd4';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BLUE SIDE', cStartX + oneTeamW / 2, 418);
    ctx.fillStyle = '#ffffff';
    ctx.font = '9px sans-serif';
    ctx.fillText(blueKdaStr, cStartX + oneTeamW / 2, 430);

    // Red Side
    ctx.fillStyle = '#d44040';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('RED SIDE', t2StartX + oneTeamW / 2, 418);
    ctx.fillStyle = '#ffffff';
    ctx.font = '9px sans-serif';
    ctx.fillText(redKdaStr, t2StartX + oneTeamW / 2, 430);

    // VS
    ctx.fillStyle = '#444444';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('VS', vsCenter, cY + cSize / 2 + 5);
    ctx.textAlign = 'left';

    for (const [teamIndex, team] of [team1, team2].entries()) {
        const offsetX = teamIndex === 0 ? cStartX : t2StartX;
        for (let i = 0; i < team.length; i++) {
            const p = team[i];
            const x = offsetX + i * (cSize + cGap);
            const isTracked = p.puuid === participant.puuid;
            const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${p.championName}.png`;
            const icon = await fetchImage(iconUrl);

            ctx.save();
            ctx.beginPath();
            ctx.arc(x + cSize / 2, cY + cSize / 2, cSize / 2, 0, Math.PI * 2);
            ctx.clip();
            if (icon) {
                ctx.drawImage(icon, x, cY, cSize, cSize);
            } else {
                ctx.fillStyle = '#2a2a2a';
                ctx.fillRect(x, cY, cSize, cSize);
            }
            ctx.restore();

            ctx.strokeStyle = isTracked ? '#ffffff' : 'rgba(255,255,255,0.15)';
            ctx.lineWidth = isTracked ? 2.5 : 1;
            ctx.beginPath();
            ctx.arc(x + cSize / 2, cY + cSize / 2, cSize / 2, 0, Math.PI * 2);
            ctx.stroke();

            const pKda = `${p.kills}/${p.deaths}/${p.assists}`;
            ctx.fillStyle = isTracked ? '#ffffff' : playerKdaColor(p);
            ctx.font = `${isTracked ? 'bold ' : ''}9px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(pKda, x + cSize / 2, cY + cSize + 13);
        }
    }

    ctx.textAlign = 'left';
    return canvas.toBuffer('image/png');
}

module.exports = { generateMatchCard };