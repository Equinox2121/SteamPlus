function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
}

function createSeededRng(seed) {
    let state = Math.abs(Math.round(Number(seed))) | 0;
    if (state === 0) state = 1;
    return function next() {
        state |= 0;
        state = (state + 0x6D2B79F5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function seededShuffle(array, rng) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function defaultDailySeed() {
    const now = new Date();
    return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

function toNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function parseOwnersEstimate(ownersEstimate) {
    if (ownersEstimate == null) return 0;

    if (typeof ownersEstimate === "number") {
        return Number.isFinite(ownersEstimate) ? ownersEstimate : 0;
    }

    const cleaned = String(ownersEstimate).replace(/,/g, "").trim();
    if (!cleaned) return 0;

    if (!cleaned.includes("..")) {
        const direct = Number(cleaned);
        return Number.isFinite(direct) ? direct : 0;
    }

    const parts = cleaned.split("..").map((part) => Number(part.trim()));
    if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
        return 0;
    }

    return (parts[0] + parts[1]) / 2;
}

function extractTagVector(tags, limit = 10) {
    if (!tags || typeof tags !== "object") {
        return {
            orderedTags: [],
            tagWeights: new Map(),
            tagSet: new Set()
        };
    }

    const rankedEntries = Object.entries(tags)
        .map(([tag, votes]) => ({
            tag,
            votes: Math.max(toNumber(votes, 0), 0)
        }))
        .filter((entry) => entry.tag && entry.votes > 0)
        .sort((a, b) => b.votes - a.votes)
        .slice(0, Math.max(1, limit));

    if (!rankedEntries.length) {
        return {
            orderedTags: [],
            tagWeights: new Map(),
            tagSet: new Set()
        };
    }

    const totalVotes = rankedEntries.reduce((sum, entry) => sum + entry.votes, 0) || 1;
    const length = rankedEntries.length;
    const tagWeights = new Map();
    const orderedTags = [];

    rankedEntries.forEach((entry, index) => {
        const voteWeight = entry.votes / totalVotes;
        const rankWeight = (length - index) / length;
        const combinedWeight = (voteWeight * 0.7) + (rankWeight * 0.3);
        tagWeights.set(entry.tag, combinedWeight);
        orderedTags.push(entry.tag);
    });

    return {
        orderedTags,
        tagWeights,
        tagSet: new Set(orderedTags)
    };
}

function computeNorm(weightMap) {
    if (!weightMap || !weightMap.size) return 1;
    let sumSquares = 0;
    weightMap.forEach((weight) => {
        sumSquares += (weight * weight);
    });
    return Math.sqrt(sumSquares) || 1;
}

function getSpyRecord(steamSpyLookup, appid) {
    if (!steamSpyLookup || appid == null) return null;
    if (steamSpyLookup instanceof Map) {
        return steamSpyLookup.get(appid) || null;
    }
    return steamSpyLookup[appid] || null;
}

function buildUserTasteProfile(profileGames, steamSpyLookup, options = {}) {
    const maxGames = Math.max(toNumber(options.maxGames, 35), 1);
    const profileTagLimit = Math.max(toNumber(options.profileTagLimit, 12), 1);
    const sortedGames = Array.isArray(profileGames)
        ? [...profileGames]
            .filter((game) => Number.isFinite(Number(game?.appid)))
            .sort((a, b) => toNumber(b?.playtime_forever, 0) - toNumber(a?.playtime_forever, 0))
            .slice(0, maxGames)
        : [];

    const tagWeights = new Map();
    let gamesUsed = 0;

    sortedGames.forEach((game, index) => {
        const appid = Number(game.appid);
        const spyData = getSpyRecord(steamSpyLookup, appid);
        if (!spyData?.tags) return;

        const tagVector = extractTagVector(spyData.tags, profileTagLimit);
        if (!tagVector.orderedTags.length) return;

        const playtimeHours = Math.max(toNumber(game.playtime_forever, 0) / 60, 0);
        const playtimeWeight = Math.log2(playtimeHours + 2);
        const indexDecay = 1 / (1 + (index * 0.055));
        const gameWeight = Math.max(playtimeWeight * indexDecay, 0.2);

        tagVector.tagWeights.forEach((weight, tag) => {
            const current = tagWeights.get(tag) || 0;
            tagWeights.set(tag, current + (weight * gameWeight));
        });

        gamesUsed += 1;
    });

    const sortedTags = [...tagWeights.entries()].sort((a, b) => b[1] - a[1]);

    return {
        tagWeights,
        tagNorm: computeNorm(tagWeights),
        topTags: sortedTags.slice(0, 8).map(([tag]) => tag),
        gamesUsed,
        tagCount: tagWeights.size
    };
}

function computeCandidateStats(candidateRows) {
    const rows = Array.isArray(candidateRows) ? candidateRows : [];
    const stats = {
        maxOwners: 1,
        maxPlayers2Weeks: 1,
        maxAverageForever: 1,
        maxMedianForever: 1,
        maxScoreRank: 1,
        maxMomentum: 1,
        maxRetentionRatio: 1
    };

    rows.forEach((row) => {
        const owners = parseOwnersEstimate(row?.owners_estimate);
        const players2Weeks = toNumber(row?.players_2weeks, 0);
        const averageForever = toNumber(row?.average_forever, 0);
        const medianForever = toNumber(row?.median_forever, 0);
        const momentum = players2Weeks / Math.max(owners, 1);
        const retentionRatio = averageForever > 0 ? (medianForever / averageForever) : 0;

        stats.maxOwners = Math.max(stats.maxOwners, owners);
        stats.maxPlayers2Weeks = Math.max(stats.maxPlayers2Weeks, players2Weeks);
        stats.maxAverageForever = Math.max(stats.maxAverageForever, toNumber(row?.average_forever, 0));
        stats.maxMedianForever = Math.max(stats.maxMedianForever, toNumber(row?.median_forever, 0));
        stats.maxScoreRank = Math.max(stats.maxScoreRank, toNumber(row?.score_rank, 0));
        stats.maxMomentum = Math.max(stats.maxMomentum, momentum);
        stats.maxRetentionRatio = Math.max(stats.maxRetentionRatio, retentionRatio);
    });

    return stats;
}

function normalizeByMax(value, maxValue) {
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (!Number.isFinite(maxValue) || maxValue <= 0) return 0;
    return clamp01(Math.log1p(value) / Math.log1p(maxValue));
}

function roundPercent(value) {
    return Math.round(clamp01(value) * 100);
}

function boostMatchPercent(value, exponent = 0.65) {
    const safeExponent = Number.isFinite(exponent) && exponent > 0 ? exponent : 0.65;
    return clamp01(Math.pow(clamp01(value), safeExponent));
}

function cosineSimilarity(userWeights, userNorm, candidateWeights) {
    if (!userWeights?.size || !candidateWeights?.size) return 0;

    let dot = 0;
    let candidateNormSq = 0;

    candidateWeights.forEach((weight, tag) => {
        candidateNormSq += (weight * weight);
        const userWeight = userWeights.get(tag) || 0;
        if (userWeight > 0) {
            dot += userWeight * weight;
        }
    });

    const candidateNorm = Math.sqrt(candidateNormSq) || 1;
    const safeUserNorm = userNorm || 1;
    return clamp01(dot / (safeUserNorm * candidateNorm));
}

function buildReason(sharedTags, profileTopTags, scores = {}) {
    const {
        trendScore = 0,
        momentumScore = 0,
        depthScore = 0,
        retentionScore = 0,
        noveltyScore = 0
    } = scores;

    if (sharedTags.length >= 2) {
        return `Because you play ${sharedTags.slice(0, 2).join(" + ")}`;
    }

    if (sharedTags.length === 1) {
        return `Because you play ${sharedTags[0]}`;
    }

    if (momentumScore >= 0.7 || trendScore >= 0.74) {
        return "Fast-rising among Steam players this week";
    }

    if (depthScore >= 0.68 || retentionScore >= 0.65) {
        return "Players spend long sessions in this game";
    }

    if (noveltyScore >= 0.66 && profileTopTags.length) {
        return `A fresh discovery for your ${profileTopTags[0]} taste`;
    }

    if (profileTopTags.length) {
        return `Trending near your taste in ${profileTopTags[0]}`;
    }

    return "Popular on Steam right now";
}

function scoreCandidateForUser(params) {
    const {
        candidateRow,
        candidateSpy,
        userProfile,
        candidateStats,
        options = {}
    } = params;

    if (!candidateRow || !candidateSpy?.tags || !userProfile?.tagWeights?.size) {
        return null;
    }

    const tagLimit = Math.max(toNumber(options.candidateTagLimit, 10), 1);
    const tagVector = extractTagVector(candidateSpy.tags, tagLimit);
    if (!tagVector.orderedTags.length) return null;

    const similarity = cosineSimilarity(userProfile.tagWeights, userProfile.tagNorm, tagVector.tagWeights);
    const sharedTags = tagVector.orderedTags.filter((tag) => userProfile.tagWeights.has(tag)).slice(0, 4);
    const tagCoverage = sharedTags.length / Math.max(1, Math.min(4, tagVector.orderedTags.length));

    const popularityRankScore = clamp01(1 - ((toNumber(candidateRow.score_rank, candidateStats.maxScoreRank) - 1) / Math.max(1, candidateStats.maxScoreRank)));
    const ownersEstimate = parseOwnersEstimate(candidateRow.owners_estimate);
    const players2Weeks = toNumber(candidateRow.players_2weeks, 0);
    const averageForever = toNumber(candidateRow.average_forever, 0);
    const medianForever = toNumber(candidateRow.median_forever, 0);

    const ownersScore = normalizeByMax(ownersEstimate, candidateStats.maxOwners);
    const trendScore = normalizeByMax(players2Weeks, candidateStats.maxPlayers2Weeks);
    const averageScore = normalizeByMax(averageForever, candidateStats.maxAverageForever);
    const medianScore = normalizeByMax(medianForever, candidateStats.maxMedianForever);

    const momentumRaw = players2Weeks / Math.max(ownersEstimate, 1);
    const momentumScore = normalizeByMax(momentumRaw, candidateStats.maxMomentum);
    const retentionRaw = averageForever > 0 ? (medianForever / averageForever) : 0;
    const retentionScore = clamp01(retentionRaw / Math.max(candidateStats.maxRetentionRatio || 1, 1));

    const popularityScore = (popularityRankScore * 0.50) + (ownersScore * 0.25) + (trendScore * 0.15);
    const depthScore = (averageScore * 0.6) + (medianScore * 0.4);
    const noveltyScore = clamp01(1 - popularityScore);
    const explorationScore = clamp01(1 - (Math.abs(popularityScore - 0.5) / 0.5));

    const longTailBonus = clamp01(1 - ownersScore) * 0.05;

    let baseScore =
        (similarity * 0.42) +
        (tagCoverage * 0.12) +
        (popularityScore * 0.08) +
        (trendScore * 0.08) +
        (depthScore * 0.07) +
        (momentumScore * 0.07) +
        (retentionScore * 0.05) +
        (noveltyScore * 0.05) +
        (explorationScore * 0.03) +
        longTailBonus;

    const topTagOverlap = sharedTags.filter((tag) => (userProfile.topTags || []).includes(tag)).length;
    if (topTagOverlap > 0) {
        baseScore += Math.min(topTagOverlap, 2) * 0.01;
    }

    if (!sharedTags.length) {
        baseScore *= 0.85;
    }

    const normalizedScore = clamp01(baseScore);
    const calibratedRelevance = boostMatchPercent(normalizedScore, 0.66);
    const relevance = Number((calibratedRelevance * 100).toFixed(2));

    const confidenceRaw =
        (similarity * 0.53) +
        (tagCoverage * 0.22) +
        (momentumScore * 0.10) +
        (retentionScore * 0.10) +
        ((Math.min(sharedTags.length, 3) / 3) * 0.05);
    const confidence = roundPercent(boostMatchPercent(confidenceRaw, 0.62));

    const signals = {
        taste: roundPercent((similarity * 0.75) + (tagCoverage * 0.25)),
        trend: roundPercent((trendScore * 0.6) + (momentumScore * 0.4)),
        depth: roundPercent((depthScore * 0.65) + (retentionScore * 0.35)),
        discovery: roundPercent((noveltyScore * 0.55) + (explorationScore * 0.45))
    };

    return {
        appid: Number(candidateRow.app_id),
        name: candidateSpy.name || candidateRow.name,
        header_image: candidateRow.header_image || `https://cdn.cloudflare.steamstatic.com/steam/apps/${candidateRow.app_id}/header.jpg`,
        price: "View on Steam",
        relevance,
        confidence,
        tags: tagVector.orderedTags.slice(0, 4),
        reason: buildReason(sharedTags, userProfile.topTags || [], {
            trendScore,
            momentumScore,
            depthScore,
            retentionScore,
            noveltyScore
        }),
        signals,
        _score: normalizedScore,
        _tagSet: tagVector.tagSet
    };
}

function jaccardSimilarity(setA, setB) {
    if (!setA?.size || !setB?.size) return 0;
    let intersection = 0;
    setA.forEach((value) => {
        if (setB.has(value)) intersection += 1;
    });
    const union = setA.size + setB.size - intersection;
    if (union <= 0) return 0;
    return intersection / union;
}

function rerankForDiversity(scoredCandidates, limit = 12, options = {}) {
    const maxItems = Math.max(toNumber(limit, 12), 1);
    const lambda = clamp01(toNumber(options.lambda, 0.82));
    const seed = options.seed != null ? options.seed : null;
    const noiseAmount = clamp01(toNumber(options.noise, 0.12));
    const candidates = Array.isArray(scoredCandidates)
        ? scoredCandidates.filter((candidate) => Number.isFinite(candidate?._score) && candidate._score > 0)
        : [];

    const rng = seed != null ? createSeededRng(seed) : null;
    const noisyCandidates = rng
        ? candidates.map((c) => ({
            ...c,
            _score: clamp01(c._score + (rng() - 0.5) * 2 * noiseAmount)
        }))
        : candidates;

    const selected = [];
    const remaining = [...noisyCandidates].sort((a, b) => b._score - a._score);

    while (selected.length < maxItems && remaining.length) {
        let bestIndex = 0;
        let bestMmr = -Infinity;

        for (let index = 0; index < remaining.length; index += 1) {
            const candidate = remaining[index];
            let maxSimilarity = 0;

            selected.forEach((picked) => {
                const similarity = jaccardSimilarity(candidate._tagSet, picked._tagSet);
                if (similarity > maxSimilarity) {
                    maxSimilarity = similarity;
                }
            });

            const mmr = (lambda * candidate._score) - ((1 - lambda) * maxSimilarity);
            if (mmr > bestMmr) {
                bestMmr = mmr;
                bestIndex = index;
            }
        }

        selected.push(remaining.splice(bestIndex, 1)[0]);
    }

    return selected;
}

function categorizeRecommendations(scoredCandidates, userProfile, options = {}) {
    const seed = options.seed != null ? options.seed : defaultDailySeed();
    const perCategory = Math.max(toNumber(options.perCategory, 6), 1);

    const valid = [...scoredCandidates].filter((c) => Number.isFinite(c?._score) && c._score > 0);

    const used = new Set();
    const canEnforceUnique = () => (valid.length - used.size) >= perCategory;

    const pickDiverse = (pool, count, categorySeed) => {
        const rngLocal = createSeededRng(categorySeed);
        const noise = 0.18;
        const enforceUnique = canEnforceUnique();
        const source = enforceUnique ? pool.filter((c) => !used.has(c.appid)) : pool;
        const jittered = source
            .map((c) => ({
                candidate: c,
                score: clamp01((c._catScore ?? c._score) + (rngLocal() - 0.5) * 2 * noise)
            }))
            .sort((a, b) => b.score - a.score);

        const picked = [];
        const pickedIds = new Set();
        while (picked.length < count && jittered.length) {
            let bestIdx = 0;
            let bestVal = -Infinity;
            for (let i = 0; i < jittered.length; i += 1) {
                const { candidate, score } = jittered[i];
                if (pickedIds.has(candidate.appid)) continue;
                let maxSim = 0;
                for (const p of picked) {
                    const s = jaccardSimilarity(candidate._tagSet, p._tagSet);
                    if (s > maxSim) maxSim = s;
                }
                const mmr = (0.7 * score) - (0.3 * maxSim);
                if (mmr > bestVal) {
                    bestVal = mmr;
                    bestIdx = i;
                }
            }
            const chosen = jittered.splice(bestIdx, 1)[0].candidate;
            if (pickedIds.has(chosen.appid)) continue;
            picked.push(chosen);
            pickedIds.add(chosen.appid);
            if (enforceUnique) used.add(chosen.appid);
        }
        return picked;
    };

    const buildPool = (signalKey) => {
        const ranked = valid
            .map((c) => {
                const signalScore = (c.signals?.[signalKey] || 0) / 100;
                const _catScore = (signalScore * 0.7) + ((c._score || 0) * 0.3);
                return { ...c, _catScore };
            })
            .filter((c) => c._catScore > 0)
            .sort((a, b) => b._catScore - a._catScore);
        if (!ranked.length) return [];
        const poolSize = Math.max(perCategory * 20, 60);
        const cutoff = Math.max(Math.ceil(ranked.length / 2), perCategory * 4);
        return ranked.slice(0, Math.min(poolSize, cutoff));
    };

    const topPicks = rerankForDiversity(valid, perCategory, {
        lambda: 0.7,
        seed,
        noise: 0.15
    });

    const becauseYouPlay = pickDiverse(buildPool("taste"), perCategory, seed ^ 0x1);
    const trending = pickDiverse(buildPool("trend"), perCategory, seed ^ 0x2);
    const deepDives = pickDiverse(buildPool("depth"), perCategory, seed ^ 0x3);
    const discoveries = pickDiverse(buildPool("discovery"), perCategory, seed ^ 0x4);

    return {
        topPicks,
        becauseYouPlay,
        trending,
        deepDives,
        discoveries
    };
}

module.exports = {
    parseOwnersEstimate,
    extractTagVector,
    buildUserTasteProfile,
    computeCandidateStats,
    scoreCandidateForUser,
    rerankForDiversity,
    categorizeRecommendations,
    createSeededRng,
    seededShuffle,
    defaultDailySeed
};
