// handRanges.js

// --- 1. Define Categories of Poker Hands ---
// 's' = suited, 'o' = offsuit
const HandCategories = {
    // Top 1-2% of hands
    PREMIUM: ['AA', 'KK', 'QQ', 'JJ', 'AKs'],
    // Strong, but not quite premium
    STRONG: ['TT', 'AQs', 'AJs', 'KQs', 'AKo'],
    // Good speculative hands, pairs and strong connectors
    SOLID: ['99', '88', '77', 'ATs', 'KJs', 'QJs', 'JTs', 'AQo', 'AJo'],
    // Decent speculative hands, suited connectors, smaller pairs
    SPECULATIVE: ['66', '55', '44', '33', '22', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'K9s', 'QTs', 'T9s', '98s', '87s', '76s', 'KQo', 'KJo', 'QJo'],
    // Wide range, includes many more offsuit and suited cards, often played from late position or blinds
    WIDE: ['KTs', 'J9s', '65s', '54s', 'ATo', 'KTo', 'QTo', 'JTo']
};

// --- 2. Define Positional Profiles ---
// This determines the *probability* an opponent has a hand from a certain category
// based on YOUR position. This is a strategic simplification.
const PositionalProfiles = {
    // If you're in Early Position (UTG/MP), opponents who play are likely to have stronger hands.
    EARLY: {
        PREMIUM: 0.20,      // 20% chance their hand is Premium
        STRONG: 0.30,       // 30% chance their hand is Strong
        SOLID: 0.40,        // 40% chance their hand is Solid
        SPECULATIVE: 0.10,  // 10% chance it's Speculative
        WIDE: 0.00          // 0% chance they play a wide, weak hand
    },
    // If you're in Late Position (CO/BTN), opponents' ranges are wider.
    LATE: {
        PREMIUM: 0.10,
        STRONG: 0.15,
        SOLID: 0.25,
        SPECULATIVE: 0.35,
        WIDE: 0.15
    },
    // From the blinds, ranges are very wide and defensive.
    BLINDS: {
        PREMIUM: 0.05,
        STRONG: 0.10,
        SOLID: 0.20,
        SPECULATIVE: 0.35,
        WIDE: 0.30
    }
};

/**
 * Selects a random hand category for an opponent based on the player's position.
 * @param {string} playerPosition - The position of the main player ('UTG', 'BTN', etc.).
 * @returns {string} - The name of the chosen hand category (e.g., 'PREMIUM', 'SOLID').
 */
function getOpponentHandCategory(playerPosition) {
    let profile;
    if (['UTG', 'MP'].includes(playerPosition)) {
        profile = PositionalProfiles.EARLY;
    } else if (['CO', 'BTN'].includes(playerPosition)) {
        profile = PositionalProfiles.LATE;
    } else { // SB, BB
        profile = PositionalProfiles.BLINDS;
    }

    const rand = Math.random();
    let cumulativeProbability = 0;
    for (const category in profile) {
        cumulativeProbability += profile[category];
        if (rand < cumulativeProbability) {
            return category;
        }
    }
    return 'WIDE'; // Fallback
}

/**
 * Gets a specific, random 2-card hand from a given category.
 * @param {string} category - The category name (e.g., 'PREMIUM').
 * @returns {Array<Object>} - An array of two card objects, e.g., [{rank: 'A', suit: 'S'}, {rank: 'K', suit: 'S'}]
 */
function getRandomHandFromCategory(category) {
    const handsInCat = HandCategories[category];
    if (!handsInCat || handsInCat.length === 0) {
        // Fallback to a wider category if the selected one is empty
        return getRandomHandFromCategory('WIDE');
    }

    const handString = handsInCat[Math.floor(Math.random() * handsInCat.length)];
    const rank1 = handString[0];
    const rank2 = handString[1];
    
    const SUITS = ['H', 'D', 'C', 'S'];
    const shuffledSuits = SUITS.sort(() => 0.5 - Math.random());
    let suit1, suit2;

    if (handString.length === 3 && handString[2] === 's') { // Suited hand
        suit1 = suit2 = shuffledSuits[0];
    } else if (handString.length === 3 && handString[2] === 'o') { // Offsuit hand
        suit1 = shuffledSuits[0];
        suit2 = shuffledSuits[1];
    } else { // Pocket pair
        suit1 = shuffledSuits[0];
        suit2 = shuffledSuits[1];
    }

    return [{ rank: rank1, suit: suit1 }, { rank: rank2, suit: suit2 }];
}

module.exports = { getOpponentHandCategory, getRandomHandFromCategory };