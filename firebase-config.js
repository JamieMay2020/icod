// Firebase configuration - Your actual config
const firebaseConfig = {
    apiKey: "AIzaSyBcKWEP2DkeUdjMdeehqlMyGU45omkAFAY",
    authDomain: "idoc-dbfae.firebaseapp.com",
    projectId: "idoc-dbfae",
    storageBucket: "idoc-dbfae.firebasestorage.app",
    messagingSenderId: "683035975075",
    appId: "1:683035975075:web:1d3387f407a78be5f30e16",
    measurementId: "G-6MFV205V7H"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Global state management
const AppState = {
    currentRound: 1,
    roundEndTime: null,
    hasVoted: false,
    votedCharityId: null,
    userId: null,
    roundDurations: [5, 10, 20, 30, 60], // minutes
    charityPool: [], // Will be loaded from Firestore
    activeCharities: [] // Current round's charities
};

// Generate/retrieve anonymous user ID
function getUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now();
        localStorage.setItem('userId', userId);
    }
    AppState.userId = userId;
    return userId;
}

// Initialize user
getUserId();

// Firebase Collections Reference
const Collections = {
    rounds: db.collection('rounds'),
    charities: db.collection('charities'),
    votes: db.collection('votes')
};

// Round Management Functions
async function getCurrentRound() {
    try {
        const roundsSnapshot = await Collections.rounds
            .where('status', '==', 'active')
            .limit(1)
            .get();
        
        if (!roundsSnapshot.empty) {
            const round = roundsSnapshot.docs[0];
            return { id: round.id, ...round.data() };
        }
        
        // Don't auto-create a round - return null if none exists
        console.log('No active round found. Run startFirstRound() to begin.');
        return null;
    } catch (error) {
        console.error('Error getting current round:', error);
        return null;
    }
}

// Manually start the first round
async function startFirstRound() {
    try {
        // Check if there's already an active round
        const activeRound = await getCurrentRound();
        if (activeRound) {
            console.log('A round is already active!');
            return activeRound;
        }
        
        // Check if any rounds exist
        const allRounds = await Collections.rounds.get();
        if (!allRounds.empty) {
            console.log('Rounds have already been created. Creating next round...');
            return await createNewRound();
        }
        
        console.log('Starting the very first round...');
        return await createNewRound();
    } catch (error) {
        console.error('Error starting first round:', error);
        return null;
    }
}

async function createNewRound() {
    try {
        // Get the last round number
        const lastRoundSnapshot = await Collections.rounds
            .orderBy('roundNumber', 'desc')
            .limit(1)
            .get();
        
        const newRoundNumber = lastRoundSnapshot.empty ? 
            1 : lastRoundSnapshot.docs[0].data().roundNumber + 1;
        
        // Calculate duration (capped at 60 minutes)
        const durationIndex = Math.min(newRoundNumber - 1, 4);
        const durationMinutes = AppState.roundDurations[durationIndex];
        const endTime = new Date(Date.now() + durationMinutes * 60 * 1000);
        
        // Select 5 random charities from pool
        const charitiesSnapshot = await Collections.charities.get();
        const allCharities = charitiesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Shuffle and select 5
        const selectedCharities = allCharities
            .sort(() => Math.random() - 0.5)
            .slice(0, 5)
            .map(c => c.id);
        
        // Create new round
        const newRound = {
            roundNumber: newRoundNumber,
            status: 'active',
            startTime: firebase.firestore.FieldValue.serverTimestamp(),
            endTime: firebase.firestore.Timestamp.fromDate(endTime),
            durationMinutes: durationMinutes,
            charities: selectedCharities,
            totalVotes: 0
        };
        
        const roundRef = await Collections.rounds.add(newRound);
        
        // Initialize vote counts for each charity in this round
        for (const charityId of selectedCharities) {
            await Collections.votes.doc(`${roundRef.id}_${charityId}`).set({
                roundId: roundRef.id,
                charityId: charityId,
                voteCount: 0,
                voters: []
            });
        }
        
        return { id: roundRef.id, ...newRound };
    } catch (error) {
        console.error('Error creating new round:', error);
        return null;
    }
}

// Voting Functions
async function castVote(charityId, roundId) {
    if (AppState.hasVoted) {
        return { success: false, message: 'Already voted in this round' };
    }
    
    try {
        const voteDocId = `${roundId}_${charityId}`;
        const voteRef = Collections.votes.doc(voteDocId);
        
        // Use transaction to ensure atomic update
        await db.runTransaction(async (transaction) => {
            const voteDoc = await transaction.get(voteRef);
            
            if (!voteDoc.exists) {
                throw new Error('Vote document not found');
            }
            
            const voteData = voteDoc.data();
            
            // Check if user already voted
            if (voteData.voters && voteData.voters.includes(AppState.userId)) {
                throw new Error('User already voted');
            }
            
            // Update vote count and add voter
            transaction.update(voteRef, {
                voteCount: firebase.firestore.FieldValue.increment(1),
                voters: firebase.firestore.FieldValue.arrayUnion(AppState.userId)
            });
            
            // Update round total votes
            transaction.update(Collections.rounds.doc(roundId), {
                totalVotes: firebase.firestore.FieldValue.increment(1)
            });
        });
        
        // Update local state
        AppState.hasVoted = true;
        AppState.votedCharityId = charityId;
        localStorage.setItem(`round_${roundId}_voted`, 'true');
        localStorage.setItem(`round_${roundId}_charity`, charityId);
        
        return { success: true, message: 'Vote cast successfully' };
    } catch (error) {
        console.error('Error casting vote:', error);
        return { success: false, message: error.message };
    }
}

// Get real-time vote updates
function subscribeToVotes(roundId, callback) {
    return Collections.votes
        .where('roundId', '==', roundId)
        .onSnapshot((snapshot) => {
            const votes = {};
            let totalVotes = 0;
            
            snapshot.forEach(doc => {
                const data = doc.data();
                votes[data.charityId] = data.voteCount;
                totalVotes += data.voteCount;
            });
            
            callback(votes, totalVotes);
        });
}

// Subscribe to round updates
function subscribeToRound(roundId, callback) {
    return Collections.rounds.doc(roundId).onSnapshot((doc) => {
        if (doc.exists) {
            callback({ id: doc.id, ...doc.data() });
        }
    });
}

// End round and determine winner
async function endRound(roundId) {
    try {
        // Get all votes for this round
        const votesSnapshot = await Collections.votes
            .where('roundId', '==', roundId)
            .get();
        
        let winner = null;
        let maxVotes = 0;
        const results = [];
        
        votesSnapshot.forEach(doc => {
            const data = doc.data();
            results.push({
                charityId: data.charityId,
                voteCount: data.voteCount
            });
            
            if (data.voteCount > maxVotes) {
                maxVotes = data.voteCount;
                winner = data.charityId;
            }
        });
        
        // Update round with results
        await Collections.rounds.doc(roundId).update({
            status: 'completed',
            winner: winner,
            results: results,
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // No need to create donation records or update stats
        // You'll handle that manually in donations-data.js
        
        return { winner, results };
    } catch (error) {
        console.error('Error ending round:', error);
        return null;
    }
}

// Initialize sample data (run once to populate Firestore)
async function initializeSampleData() {
    const sampleCharities = [
        {
            name: 'Save the Children',
            description: 'Provides support for children\'s health, education, and protection worldwide.',
            region: 'Global',
            website: 'https://www.savethechildren.org/',
            category: 'Children'
        },

        {
            name: 'WaterAid',
            description: 'Brings clean water, sanitation, and hygiene to underserved communities.',
            region: 'Global',
            website: 'https://www.wateraid.org/',
            category: 'Water & Sanitation'
        },

        {
            name: 'Children\'s Cancer Cause',
            description: 'Advocates for research, treatment, and policy support for children with cancer.',
            region: 'Global',
            website: 'https://www.childrenscancercause.org/',
            category: 'Health'
        },


        {
            name: 'One Earth',
            description: 'Promotes climate solutions and biodiversity conservation for a sustainable future.',
            region: 'Global',
            website: 'https://www.oneearth.org/',
            category: 'Environment'
        },
        {
            name: 'ASPCA',
            description: 'Rescues animals, fights cruelty, and promotes adoption.',
            region: 'Global',
            website: 'https://www.aspca.org/',
            category: 'Animals'
        }
    ];
    
    // Check if charities already exist
    const charitiesSnapshot = await Collections.charities.get();
    if (charitiesSnapshot.empty) {
        console.log('Initializing sample charities...');
        for (const charity of sampleCharities) {
            await Collections.charities.add(charity);
        }
        console.log('Sample charities initialized');
    } else {
        console.log('Charities already exist');
    }
}

// Admin commands for console use
window.startFirstRound = startFirstRound;

// Manually end current round (for testing)
window.endCurrentRound = async function() {
    const round = await getCurrentRound();
    if (round) {
        console.log('Ending current round...');
        const result = await endRound(round.id);
        console.log('Round ended. Winner:', result.winner);
        return result;
    } else {
        console.log('No active round to end');
    }
};

// Create a test round with short duration (for testing)
window.createTestRound = async function(seconds = 30) {
    try {
        // End any active round first
        const activeRound = await getCurrentRound();
        if (activeRound) {
            await endRound(activeRound.id);
        }
        
        // Get charities
        const charitiesSnapshot = await Collections.charities.limit(5).get();
        const charityIds = charitiesSnapshot.docs.map(doc => doc.id);
        
        // Create test round
        const testRound = {
            roundNumber: 999, // Test round number
            status: 'active',
            startTime: firebase.firestore.FieldValue.serverTimestamp(),
            endTime: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + (seconds * 1000))),
            durationMinutes: seconds / 60,
            charities: charityIds,
            totalVotes: 0
        };
        
        const roundRef = await Collections.rounds.add(testRound);
        
        // Initialize vote counts
        for (const charityId of charityIds) {
            await Collections.votes.doc(`${roundRef.id}_${charityId}`).set({
                roundId: roundRef.id,
                charityId: charityId,
                voteCount: 0,
                voters: []
            });
        }
        
        console.log(`Test round created! Will end in ${seconds} seconds`);
        
        // Reload the page to see the new round
        setTimeout(() => location.reload(), 1000);
        
        return roundRef.id;
    } catch (error) {
        console.error('Error creating test round:', error);
    }
};

// Check current round status
window.checkRound = async function() {
    const round = await getCurrentRound();
    if (round) {
        const endTime = round.endTime.toDate ? round.endTime.toDate() : new Date(round.endTime);
        const remaining = Math.max(0, endTime - Date.now());
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        
        console.log('Current Round:', {
            roundNumber: round.roundNumber,
            status: round.status,
            timeRemaining: `${minutes}:${String(seconds).padStart(2, '0')}`,
            totalVotes: round.totalVotes,
            charities: round.charities
        });
    } else {
        console.log('No active round. Run startFirstRound() to begin.');
    }
};

// Make initializeSampleData available globally
window.initializeSampleData = initializeSampleData;

