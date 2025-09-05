// Main Application Logic
let currentRoundData = null;
let votesUnsubscribe = null;
let roundUnsubscribe = null;
let timerInterval = null;

// Initialize the application
async function initializeApp() {
    try {
        // Get current round (won't auto-create)
        currentRoundData = await getCurrentRound();
        
        if (!currentRoundData) {
            // No active round - show a waiting state
            showNoRoundState();
            return;
        }
        
        // Check if user has voted in this round
        checkUserVoteStatus();
        
        // Set up real-time listeners
        setupRealtimeListeners();
        
        // Start timer
        startRoundTimer();
        
        // Load charities for current round
        await loadRoundCharities();
        
        // Load global stats
        await loadGlobalStats();
        
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

// Show state when no round is active
function showNoRoundState() {
    const charityGrid = document.getElementById('charityGrid');
    if (charityGrid) {
        charityGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--muted);">
                <h3 style="color: var(--ink); margin-bottom: 20px;">No Active Round</h3>
                <p>Voting will begin soon. Please check back later!</p>
                <p style="margin-top: 10px; font-size: 14px; opacity: 0.7;">
                </p>
            </div>
        `;
    }
    
    // Update timer to show waiting state
    const timerElement = document.getElementById('mainTimer');
    if (timerElement) {
        timerElement.textContent = 'Waiting to Start';
    }
    
    // Update round info
    const roundNumberElement = document.querySelector('.round-number');
    if (roundNumberElement) {
        roundNumberElement.textContent = 'Round 0';
    }
    
    const roundStatusElement = document.querySelector('.round-status');
    if (roundStatusElement) {
        roundStatusElement.textContent = 'Waiting';
    }
}

// Check if user has already voted in current round
function checkUserVoteStatus() {
    const votedInRound = localStorage.getItem(`round_${currentRoundData.id}_voted`);
    const votedCharityId = localStorage.getItem(`round_${currentRoundData.id}_charity`);
    
    if (votedInRound === 'true') {
        AppState.hasVoted = true;
        AppState.votedCharityId = votedCharityId;
    }
}

// Set up real-time Firebase listeners
function setupRealtimeListeners() {
    // Listen to vote changes
    if (votesUnsubscribe) votesUnsubscribe();
    votesUnsubscribe = subscribeToVotes(currentRoundData.id, (votes, totalVotes) => {
        updateVoteDisplay(votes, totalVotes);
    });
    
    // Listen to round changes
    if (roundUnsubscribe) roundUnsubscribe();
    roundUnsubscribe = subscribeToRound(currentRoundData.id, async (roundData) => {
        currentRoundData = roundData;
        
        // Check if round has ended
        if (roundData.status === 'completed') {
            await handleRoundEnd(roundData);
        }
    });
}

// Load charities for the current round
async function loadRoundCharities() {
    const charityGrid = document.getElementById('charityGrid');
    if (!charityGrid) return; // Not on main page
    
    charityGrid.innerHTML = '';
    
    for (const charityId of currentRoundData.charities) {
        const charityDoc = await Collections.charities.doc(charityId).get();
        if (charityDoc.exists) {
            const charityData = {
                id: charityDoc.id,
                ...charityDoc.data(),
                votes: 0,
                percentage: 0
            };
            
            const card = createCharityCard(charityData);
            charityGrid.appendChild(card);
        }
    }
}

// Create charity card HTML element
function createCharityCard(charity) {
    const card = document.createElement('div');
    card.className = 'charity-card';
    card.setAttribute('data-charity-id', charity.id);
    
    if (AppState.votedCharityId === charity.id) {
        card.classList.add('voted');
    }
    
    card.innerHTML = `
        <div class="charity-name">${charity.name}</div>
        <div class="charity-description">${charity.description}</div>
        <span class="charity-region">${charity.region}</span>
        <div class="vote-progress">
            <div class="progress-bar">
                <div class="progress-fill" data-charity-progress="${charity.id}" style="width: 0%"></div>
            </div>
            <div class="vote-stats">
                <span class="vote-count" data-charity-votes="${charity.id}">0 votes</span>
                <span data-charity-percentage="${charity.id}">0%</span>
            </div>
        </div>
        <button class="vote-btn" onclick="handleVote('${charity.id}')" ${AppState.hasVoted ? 'disabled' : ''}>
            ${AppState.hasVoted && AppState.votedCharityId === charity.id ? '✓ Your Vote' : AppState.hasVoted ? 'Already Voted' : 'Cast Vote'}
        </button>
        <a href="${charity.website}" target="_blank" class="charity-link">Learn more</a>
    `;
    
    return card;
}

// Handle voting
async function handleVote(charityId) {
    if (AppState.hasVoted) {
        alert('You have already voted in this round');
        return;
    }
    
    const result = await castVote(charityId, currentRoundData.id);
    
    if (result.success) {
        // Update UI
        const card = document.querySelector(`[data-charity-id="${charityId}"]`);
        if (card) {
            card.classList.add('voted');
            const btn = card.querySelector('.vote-btn');
            btn.disabled = true;
            btn.textContent = '✓ Your Vote';
        }
        
        // Disable all other vote buttons
        document.querySelectorAll('.vote-btn').forEach(btn => {
            if (!btn.textContent.includes('✓')) {
                btn.disabled = true;
                btn.textContent = 'Already Voted';
            }
        });
    } else {
        alert(result.message || 'Failed to cast vote');
    }
}

// Update vote display in real-time
function updateVoteDisplay(votes, totalVotes) {
    Object.keys(votes).forEach(charityId => {
        const voteCount = votes[charityId];
        const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
        
        // Update progress bar
        const progressBar = document.querySelector(`[data-charity-progress="${charityId}"]`);
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
        
        // Update vote count
        const voteCountElement = document.querySelector(`[data-charity-votes="${charityId}"]`);
        if (voteCountElement) {
            voteCountElement.textContent = `${voteCount} ${voteCount === 1 ? 'vote' : 'votes'}`;
        }
        
        // Update percentage
        const percentageElement = document.querySelector(`[data-charity-percentage="${charityId}"]`);
        if (percentageElement) {
            percentageElement.textContent = `${percentage}%`;
        }
    });
    
    // Update total votes in stats if on main page
    const totalVotesElement = document.getElementById('totalVotes');
    if (totalVotesElement) {
        totalVotesElement.textContent = totalVotes.toLocaleString();
    }
}

// Timer management
function startRoundTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        updateTimerDisplay();
    }, 1000);
    
    updateTimerDisplay();
}

function updateTimerDisplay() {
    if (!currentRoundData || !currentRoundData.endTime) return;
    
    const now = Date.now();
    const endTime = currentRoundData.endTime.toMillis 
        ? currentRoundData.endTime.toMillis() 
        : currentRoundData.endTime;
    
    const remaining = endTime - now;
    
    if (remaining <= 0) {
        clearInterval(timerInterval);
        // Auto-end the round when timer reaches zero
        handleAutoRoundEnd();
        return;
    }
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    const timerElement = document.getElementById('mainTimer');
    if (timerElement) {
        timerElement.textContent = `Next Donation: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        // Add warning classes for last minute
        if (remaining < 60000) {
            timerElement.classList.add('urgent');
        } else if (remaining < 300000) { // 5 minutes
            timerElement.classList.add('warning');
        }
    }
    
    // Update round info if on main page
    const roundNumberElement = document.querySelector('.round-number');
    if (roundNumberElement) {
        roundNumberElement.textContent = `Round ${currentRoundData.roundNumber}`;
    }
}

// Auto-end round when timer expires
async function handleAutoRoundEnd() {
    console.log('Round timer expired, ending round automatically...');
    
    // Only end if we're still showing an active round
    if (currentRoundData && currentRoundData.status === 'active') {
        // End the current round
        const result = await endRound(currentRoundData.id);
        
        if (result && result.winner) {
            // Show winner and handle round transition
            await handleRoundEnd({
                ...currentRoundData,
                status: 'completed',
                winner: result.winner,
                results: result.results
            });
        }
    }
}

// Handle round end
async function handleRoundEnd(roundData) {
    // Get winner information
    if (roundData.winner) {
        const winnerDoc = await Collections.charities.doc(roundData.winner).get();
        const winnerName = winnerDoc.exists ? winnerDoc.data().name : 'Unknown';
        
        // Show winner overlay if on main page
        const winnerOverlay = document.getElementById('votingClosed');
        if (winnerOverlay) {
            document.getElementById('winnerName').textContent = winnerName;
            winnerOverlay.classList.add('active');
            
            // Countdown to next round
            let countdown = 30;
            const countdownInterval = setInterval(() => {
                countdown--;
                const countdownElement = document.getElementById('nextRoundCountdown');
                if (countdownElement) {
                    countdownElement.textContent = countdown;
                }
                
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    startNewRound();
                }
            }, 1000);
        }
    }
}

// Start a new round
async function startNewRound() {
    // Reset local state
    AppState.hasVoted = false;
    AppState.votedCharityId = null;
    
    // Close overlay if exists
    const winnerOverlay = document.getElementById('votingClosed');
    if (winnerOverlay) {
        winnerOverlay.classList.remove('active');
    }
    
    // Reinitialize app with new round
    await initializeApp();
}

// Load global statistics (simplified - no database stats)
async function loadGlobalStats() {
    // For main page, you can either:
    // 1. Leave these as placeholder values
    // 2. Calculate from current round data
    // 3. Manually update these values
    
    try {
        // Simple placeholder or manual values
        if (document.getElementById('totalDonated')) {
            document.getElementById('totalDonated').textContent = '$0'; // Update manually
        }
        if (document.getElementById('roundsCompleted')) {
            const roundsSnapshot = await Collections.rounds.where('status', '==', 'completed').get();
            document.getElementById('roundsCompleted').textContent = roundsSnapshot.size.toLocaleString();
        }
        if (document.getElementById('totalVotes')) {
            // This will show current round votes
            if (currentRoundData) {
                document.getElementById('totalVotes').textContent = 
                    (currentRoundData.totalVotes || 0).toLocaleString();
            }
        }
        if (document.getElementById('activeVoters')) {
            // Rough estimate or manual value
            document.getElementById('activeVoters').textContent = '0';
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Close winner overlay manually
function closeWinnerOverlay() {
    const overlay = document.getElementById('votingClosed');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// Set up FAQ event listeners
function setupFAQListeners() {
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', () => {
            const item = question.parentElement;
            const isActive = item.classList.contains('active');
            
            document.querySelectorAll('.faq-item').forEach(faqItem => {
                faqItem.classList.remove('active');
            });
            
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });
}

// Set up smooth scrolling
function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Common initialization
    setupFAQListeners();
    setupSmoothScrolling();
    
    // Page-specific initialization
    if (document.getElementById('charityGrid')) {
        // Main page - initialize voting
        await initializeApp();
    } else if (document.getElementById('donationsList')) {
        // Past donations page - load donations
        await loadPastDonationsPage();
    }
});

// Clean up listeners on page unload
window.addEventListener('beforeunload', () => {
    if (votesUnsubscribe) votesUnsubscribe();
    if (roundUnsubscribe) roundUnsubscribe();
    if (timerInterval) clearInterval(timerInterval);

});
