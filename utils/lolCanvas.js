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
    } catch (err) {
        console.error(`❌ fetchImage erreur pour: ${source}`, err.message);
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
    if (ratio >= 1) return '#2ecc71';
    return '#e74c3c';
}

// Couleur KDA selon rôle : support = (kills+assists)/deaths, autres = kills/deaths
function playerKdaColor(p) {
    const isSupport = p.teamPosition === 'UTILITY';
    if (p.deaths === 0) return '#2ecc71';
    const score = isSupport
        ? (p.kills + p.assists) / p.deaths
        : p.kills / p.deaths;
    return score >= 1 ? '#2ecc71' : '#e74c3c';
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

    const teamParticipants = match.info.participants.filter(p => p.teamId === participant.teamId);
    const teamKills = teamParticipants.reduce((sum, p) => sum + p.kills, 0);
    const teamDeaths = teamParticipants.reduce((sum, p) => sum + p.deaths, 0);
    const teamAssists = teamParticipants.reduce((sum, p) => sum + p.assists, 0);
    const kp = teamKills === 0 ? '0%' : `${Math.round(((kills + assists) / teamKills) * 100)}%`;

    let multikill = '';
    if (participant.pentaKills > 0) multikill = 'PENTA KILL';
    else if (participant.quadraKills > 0) multikill = 'QUADRA KILL';
    else if (participant.tripleKills > 0) multikill = 'Triple Kill';
    else if (participant.doubleKills > 0) multikill = 'Double Kill';

    // Fond splash art
    const splashSource = SPLASH[champion] || `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champion}_0.jpg`;
    const splash = await fetchImage(splashSource);
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
    const champSource = CHAMPIONS[champion];
    const champIconUrl = champSource || `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion}.png`;
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

    // Nom du champion sous le badge
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '12px sans-serif';
    ctx.fillText(champion, 70, 148);
    ctx.textAlign = 'left';

    // Résultat
    ctx.fillStyle = win ? '#2ecc71' : '#e74c3c';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(win ? 'VICTOIRE' : 'DEFAITE', 140, 58);

    // Pseudo du joueur en blanc
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(player.displayName, 140, 90);

    // Queue et durée
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '14px sans-serif';
    ctx.fillText(`${queueName}  |  ${gameDuration} min`, 140, 115);

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

    // Blocs stats — design propre, 1 couleur accent
    const ACCENT = '#2ecc71';
    const stats = [
        { label: 'KDA', value: `${kills} / ${deaths} / ${assists}`, sub: `Ratio ${kda}`, colored: true },
        { label: 'CS', value: cs.toString(), sub: `${csPerMin}/min`, colored: false },
        { label: 'Vision', value: visionScore.toString(), sub: `${wardsPlaced} wards`, colored: false },
        { label: 'Degats', value: `${damage}k`, sub: 'aux champions', colored: false },
        { label: 'Kill Part.', value: kp, sub: '', colored: false },
    ];

    const statY = 240;
    const statW = 108;
    const statH = 95;
    const statGap = 10;
    const statStartX = 25;

    stats.forEach((stat, i) => {
        const x = statStartX + i * (statW + statGap);

        // Fond du bloc
        roundRect(ctx, x, statY, statW, statH, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fill();

        // Bordure subtile
        roundRect(ctx, x, statY, statW, statH, 8);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Ligne accent en haut
        roundRect(ctx, x, statY, statW, 3, 2);
        ctx.fillStyle = stat.colored ? kdaColor(kdaRatio) : ACCENT;
        ctx.fill();

        // Label
        ctx.fillStyle = '#888888';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(stat.label, x + statW / 2, statY + 20);

        // Valeur principale
        ctx.fillStyle = stat.colored ? kdaColor(kdaRatio) : '#ffffff';
        ctx.font = `bold ${stat.value.length > 9 ? '13px' : '19px'} sans-serif`;
        ctx.fillText(stat.value, x + statW / 2, statY + 58);

        // Sous-valeur
        if (stat.sub) {
            ctx.fillStyle = '#666666';
            ctx.font = '11px sans-serif';
            ctx.fillText(stat.sub, x + statW / 2, statY + 78);
        }
    });

    ctx.textAlign = 'left';

    // Compos 5v5 avec KDA et KDA global team
    const team1 = match.info.participants.filter(p => p.teamId === 100);
    const team2 = match.info.participants.filter(p => p.teamId === 200);
    const champSize = 32;
    const compoY = HEIGHT - champSize - 30;

    // KDA global de la team du joueur suivi
    const teamKdaStr = `Team : ${teamKills} / ${teamDeaths} / ${teamAssists}`;
    ctx.fillStyle = '#666666';
    ctx.font = '10px sans-serif';
    ctx.fillText(teamKdaStr, 25, HEIGHT - 5);

    ctx.fillStyle = '#555555';
    ctx.font = '11px sans-serif';
    ctx.fillText('Blue Side', 25, compoY - 5);

    const team2StartX = 25 + 5 * (champSize + 4) + 30;
    ctx.fillText('Red Side', team2StartX, compoY - 5);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VS', 25 + 5 * (champSize + 4) + 14, compoY + 20);
    ctx.textAlign = 'left';

    for (const [teamIndex, team] of [team1, team2].entries()) {
        const offsetX = teamIndex === 0 ? 25 : team2StartX;
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

            // KDA sous l'icône
            const pKda = `${p.kills}/${p.deaths}/${p.assists}`;
            ctx.fillStyle = isTracked ? '#c89b3c' : playerKdaColor(p);
            ctx.font = `${isTracked ? 'bold ' : ''}9px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(pKda, x + champSize / 2, compoY + champSize + 12);
        }
    }

    ctx.textAlign = 'left';

    // Items à droite des équipes
    const itemIds = [
        participant.item0, participant.item1, participant.item2,
        participant.item3, participant.item4, participant.item5,
    ].filter(id => id > 0);

    const itemSize = 30;
    const itemStartX = team2StartX + 5 * (champSize + 4) + 15;
    const itemStartY = compoY;

    for (let i = 0; i < itemIds.length; i++) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = itemStartX + col * (itemSize + 3);
        const y = itemStartY + row * (itemSize + 3);
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
        const tx = itemStartX + 3 * (itemSize + 3) + 6;
        roundRect(ctx, tx, itemStartY, itemSize, itemSize, 4);
        if (trinket) {
            ctx.save();
            ctx.clip();
            ctx.drawImage(trinket, tx, itemStartY, itemSize, itemSize);
            ctx.restore();
        }
    }

    return canvas.toBuffer('image/png');
}

module.exports = { generateMatchCard };