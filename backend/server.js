// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { getOpponentHandCategory, getRandomHandFromCategory } = require('./handRanges');


const app = express();
const server = http.createServer(app);

app.use(cors({ origin: '*' }));
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// --- Poker Logic Utilities (Simplified) ---
// (evaluateHand, getBest5CardHand, getHandScore functions remain the same)
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['H', 'D', 'C', 'S'];

function evaluateHand(cards) {
    if (cards.length < 5) return "Not enough cards for a full poker hand";
    const relevantCards = cards;
    const counts = {};
    const suitCounts = {};
    const rankValues = relevantCards.map(c => RANKS.indexOf(c.rank) + 2).sort((a, b) => a - b);
    relevantCards.forEach(card => {
        counts[card.rank] = (counts[card.rank] || 0) + 1;
        suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    });
    const numPairs = Object.values(counts).filter(c => c === 2).length;
    const numTrips = Object.values(counts).filter(c => c === 3).length;
    const numQuads = Object.values(counts).filter(c => c === 4).length;
    const isFlush = Object.values(suitCounts).some(c => c >= 5);
    let isStraight = false;
    const uniqueSortedRankValues = [...new Set(rankValues)].sort((a, b) => a - b);
    let straightCheckRanks = [...uniqueSortedRankValues];
    if (uniqueSortedRankValues.includes(14)) { straightCheckRanks.unshift(1); }
    if (straightCheckRanks.length >= 5) {
        for (let i = 0; i <= straightCheckRanks.length - 5; i++) {
            let consecutive = true;
            for (let j = 0; j < 4; j++) {
                if (straightCheckRanks[i + j + 1] !== straightCheckRanks[i + j] + 1) {
                    consecutive = false;
                    break;
                }
            }
            if (consecutive) { isStraight = true; break; }
        }
    }
    if (isStraight && isFlush) return "Straight Flush";
    if (numQuads === 1) return "Four of a Kind";
    if (numTrips === 1 && numPairs >= 1) return "Full House";
    if (isFlush) return "Flush";
    if (isStraight) return "Straight";
    if (numTrips === 1) return "Three of a Kind";
    if (numPairs >= 2) return "Two Pair";
    if (numPairs === 1) return "One Pair";
    const highestRank = RANKS[Math.max(...rankValues) - 2];
    return `High Card (${highestRank})`;
}
function getBest5CardHand(cards) {
    if (cards.length <= 5) return cards;
    return cards.slice(0, 5);
}
function getHandScore(fiveCardHand) {
    const handType = evaluateHand(fiveCardHand);
    switch (handType) {
        case "Straight Flush": return 9;
        case "Four of a Kind": return 8;
        case "Full House": return 7;
        case "Flush": return 6;
        case "Straight": return 5;
        case "Three of a Kind": return 4;
        case "Two Pair": return 3;
        case "One Pair": return 2;
        default: return 1;
    }
}


function calculateEquity(playerHand, communityCards, numOpponents, playerPosition, numSimulations = 10000) {
    let wins = 0, ties = 0, losses = 0;
    // ... (The entire simulation logic inside this function remains the same)
    const allKnownCards = [...playerHand, ...communityCards];
    const fullDeck = [];
    SUITS.forEach(suit => RANKS.forEach(rank => fullDeck.push({ rank, suit })));

    const isKnown = (card) => allKnownCards.some(kc => kc.rank === card.rank && kc.suit === card.suit);
    const deck = fullDeck.filter(card => !isKnown(card));

    const cardsToDealForCommunity = 5 - communityCards.length;

    for (let i = 0; i < numSimulations; i++) {
        let tempDeck = [...deck];
        tempDeck.sort(() => 0.5 - Math.random());

        const opponentHands = [];
        let possible = true;
        for (let opp = 0; opp < numOpponents; opp++) {
            let opponentHand;
            let attempts = 0;
            const MAX_ATTEMPTS = 50;

            while(attempts < MAX_ATTEMPTS) {
                const category = getOpponentHandCategory(playerPosition);
                const handAttempt = getRandomHandFromCategory(category);
                
                const card1Index = tempDeck.findIndex(c => c.rank === handAttempt[0].rank && c.suit === handAttempt[0].suit);
                const card2Index = tempDeck.findIndex(c => c.rank === handAttempt[1].rank && c.suit === handAttempt[1].suit);

                if (card1Index > -1 && card2Index > -1) {
                    opponentHand = tempDeck.splice(Math.max(card1Index, card2Index), 1)[0];
                    opponentHand = [opponentHand, ...tempDeck.splice(Math.min(card1Index, card2Index), 1)];
                    break;
                }
                attempts++;
            }

            if (!opponentHand) {
                if (tempDeck.length < 2) { possible = false; break; }
                opponentHand = [tempDeck.shift(), tempDeck.shift()];
            }
            opponentHands.push(opponentHand);
        }

        if (!possible || tempDeck.length < cardsToDealForCommunity) continue;

        const simulatedCommunity = [...communityCards, ...tempDeck.splice(0, cardsToDealForCommunity)];
        const playerCombined = playerHand.concat(simulatedCommunity);
        const playerBestHand = getBest5CardHand(playerCombined);
        const playerScore = getHandScore(playerBestHand);
        
        let bestOpponentScore = 0;
        opponentHands.forEach(hand => {
            const oppCombined = hand.concat(simulatedCommunity);
            const oppBestHand = getBest5CardHand(oppCombined);
            const oppScore = getHandScore(oppBestHand);
            if (oppScore > bestOpponentScore) {
                bestOpponentScore = oppScore;
            }
        });

        if (playerScore > bestOpponentScore) {
            wins++;
        } else if (playerScore === bestOpponentScore) {
            ties++;
        } else {
            losses++;
        }
    }
    // ... (Simulation logic ends here)


    const total = wins + ties + losses;

    // --- MODIFIED LOGIC: Redistribute ties and remove the tie field ---
    const winChance = total > 0 ? (wins + ties / 2) / total : 0;
    const loseChance = total > 0 ? (losses + ties / 2) / total : 0;

    return {
        winChance: winChance,
        // tieChance field is now removed
        loseChance: loseChance,
        numSimulations: total,
        yourHandType: evaluateHand(playerHand.concat(communityCards)),
        message: `Analysis based on player position: ${playerPosition}. Opponent hand ranges adjusted accordingly.`
    };
    // --- END OF MODIFIED LOGIC ---
}


// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('requestAnalysis', (data) => {
        const { playerHand, communityCards, numOpponents, playerPosition } = data;
        const formatCards = (cards) => {
            if (!cards || cards.length === 0) return "None";
            return cards.map(c => c.rank + c.suit).join(' ');
        };
        const timestamp = new Date().toISOString();
        console.log(
`[${timestamp}] Received Analysis Request from ${socket.id}
    > Player Hand: ${formatCards(playerHand)}
    > Community:   ${formatCards(communityCards)}
    > Opponents:   ${numOpponents}
    > Position:    ${playerPosition}`
        );

        if (!playerHand || playerHand.length !== 2) {
            socket.emit('analysisResult', { error: "Please select exactly 2 hole cards." });
            return;
        }
        if (!playerPosition) {
            socket.emit('analysisResult', { error: "Player position is missing." });
            return;
        }

        try {
            const results = calculateEquity(playerHand, communityCards, numOpponents, playerPosition, 10000);
            socket.emit('analysisResult', results);
        } catch (error) {
            console.error('Error during analysis:', error);
            socket.emit('analysisResult', { error: `Backend calculation error: ${error.message}` });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

app.get('/', (req, res) => {
    res.send('Poker Hand Analyzer Backend is running!');
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});