// Pre-generated donation data - Update this manually after each round
const MANUAL_DONATIONS_DATA = [
    // Most recent donations at the top
    // Copy this template and add new entries as rounds complete:

    {
        roundNumber: 1,
        date: "09/05/2025",
        charityName: "One Earth",
        amount: 300$,
        votes: 64,
        totalVotes: 102,
        duration: 10
        tweetUrl: "https://x.com/IDOCharity/status/1964089658402324629",
        transactionSignature: "https://solscan.io/tx/5gM6NB8CRLzk2yhppm6pbK7o2NyAvMHamLZm9Mfo3YJNRf8FpG5ZmVQxtMJyi4NaEA7RvAgAp9PGkDrfuTryU6GF"
    },
    
    // Example entries - Replace with real data as rounds complete
   
];

// Function to load manual donations (replaces Firebase loading)
function loadManualDonations() {
    const donationsList = document.getElementById('donationsList');
    if (!donationsList) return;
    
    donationsList.innerHTML = '';
    
    // Apply filters if needed
    let donationsToShow = [...MANUAL_DONATIONS_DATA];
    
    // Filter based on current filter selection
    const currentFilter = getCurrentFilter();
    if (currentFilter === 'week') {
        // Show only last 7 days
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        donationsToShow = donationsToShow.filter(d => {
            const donationDate = new Date(d.date);
            return donationDate > weekAgo;
        });
    } else if (currentFilter === 'month') {
        // Show only last 30 days
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        donationsToShow = donationsToShow.filter(d => {
            const donationDate = new Date(d.date);
            return donationDate > monthAgo;
        });
    } else if (currentFilter === 'large') {
        // Show only donations >= $1000
        donationsToShow = donationsToShow.filter(d => d.amount >= 1000);
    }
    
    // Create donation cards
    donationsToShow.forEach(donation => {
        const votePercentage = donation.totalVotes > 0 
            ? Math.round((donation.votes / donation.totalVotes) * 100) 
            : 0;
        
        const donationCard = document.createElement('div');
        donationCard.className = 'donation-item';
        
        donationCard.innerHTML = `
            <div class="round-badge">
                <div class="round-number">Round ${donation.roundNumber}</div>
                <div class="round-date">${donation.date}</div>
            </div>
            <div class="donation-details">
                <div class="charity-winner">${donation.charityName}</div>
                <div class="donation-stats">
                    <span>${donation.votes} votes (${votePercentage}%)</span>
                    <span>Duration: ${donation.duration} min</span>
                    <span>${donation.totalVotes} total voters</span>
                </div>
            </div>
            <div>
                <div class="donation-amount">$${donation.amount.toLocaleString()}</div>
                <div class="proof-links">
                    ${donation.tweetUrl ? 
                        `<a href="${donation.tweetUrl}" class="proof-link" target="_blank">View Tweet</a>` : 
                        '<span class="proof-link secondary">Tweet Pending</span>'
                    }
                    ${donation.transactionSignature ? 
                        `<a href="https://solscan.io/tx/${donation.transactionSignature}" class="proof-link secondary" target="_blank">Transaction</a>` : 
                        '<span class="proof-link secondary">TX Pending</span>'
                    }
                </div>
            </div>
        `;
        
        donationsList.appendChild(donationCard);
    });
    
    // Update statistics
    updateManualStats();
}

// Calculate and update statistics from manual data
function updateManualStats() {
    const totalDonated = MANUAL_DONATIONS_DATA.reduce((sum, d) => sum + d.amount, 0);
    const totalVotes = MANUAL_DONATIONS_DATA.reduce((sum, d) => sum + d.totalVotes, 0);
    const uniqueCharities = [...new Set(MANUAL_DONATIONS_DATA.map(d => d.charityName))].length;
    const roundsCompleted = MANUAL_DONATIONS_DATA.length;
    
    // Update stat cards
    const statCards = document.querySelectorAll('.stat-card .stat-value');
    if (statCards[0]) statCards[0].textContent = `$${totalDonated.toLocaleString()}`;
    if (statCards[1]) statCards[1].textContent = roundsCompleted.toLocaleString();
    if (statCards[2]) statCards[2].textContent = uniqueCharities.toLocaleString();
    if (statCards[3]) statCards[3].textContent = totalVotes.toLocaleString();
}

// Get current filter selection
function getCurrentFilter() {
    const activeBtn = document.querySelector('.filter-btn.active');
    if (!activeBtn) return 'all';
    
    const filterText = activeBtn.textContent.toLowerCase();
    if (filterText.includes('week')) return 'week';
    if (filterText.includes('month')) return 'month';
    if (filterText.includes('large')) return 'large';
    return 'all';
}

// Hide or handle load more button
const loadMoreBtn = document.querySelector('.load-more-btn');
if (loadMoreBtn) {
    // For manual data, hide the button since all data is already shown
    loadMoreBtn.style.display = 'none';
}

// Global function for load more (called by onclick)
window.loadMore = function() {
    alert('All donations are already displayed');
};

// Global function for filter (called by onclick)
window.filterDonations = function(filter) {
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Find and activate the clicked button
    const clickedBtn = event.target;
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }
    
    // Reload donations with new filter
    loadManualDonations();
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('donationsList')) {
        loadManualDonations();
        
        // Set up filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active button
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Reload donations with new filter
                loadManualDonations();
            });
        });
    }
});

// Template for quickly adding new donations after round completes
function getNewDonationTemplate(roundNumber) {
    return {
        roundNumber: roundNumber,
        date: new Date().toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        }),
        charityName: "", // Add winner name
        amount: 0, // Add donation amount
        votes: 0, // Add winner's vote count
        totalVotes: 0, // Add total votes in round
        duration: 5, // Round duration in minutes
        tweetUrl: "", // Add after posting tweet
        transactionSignature: "" // Add Solana tx signature
    };
}

// Helper function to add after round ends
console.log("To add a new donation after round ends:");
console.log("1. Copy this template:");
console.log(getNewDonationTemplate(5)); // Update with next round number
console.log("2. Fill in the actual values");

console.log("3. Add to top of MANUAL_DONATIONS_DATA array");
