// Pre-generated donation data - Update this manually after each round
const MANUAL_DONATIONS_DATA = [
  // Most recent donations at the top
  {
    roundNumber: 1,
    date: "2025-09-05",               // ISO format for safe parsing
    charityName: "One Earth",
    amount: 300,                      // number, not "300$"
    votes: 64,
    totalVotes: 102,
    duration: 10,                     // <-- comma was missing here
    tweetUrl: "https://x.com/IDOCharity/status/1964089658402324629",
    // Store just the signature (recommended), not a full URL
    transactionSignature: "5gM6NB8CRLzk2yhppm6pbK7o2NyAvMHamLZm9Mfo3YJNRf8FpG5ZmVQxtMJyi4NaEA7RvAgAp9PGkDrfuTryU6GF"
  },
  // Add new entries above this comment as rounds complete
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
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    donationsToShow = donationsToShow.filter(d => new Date(d.date) > weekAgo);
  } else if (currentFilter === 'month') {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    donationsToShow = donationsToShow.filter(d => new Date(d.date) > monthAgo);
  } else if (currentFilter === 'large') {
    donationsToShow = donationsToShow.filter(d => Number(d.amount) >= 1000);
  }

  // Create donation cards
  donationsToShow.forEach(donation => {
    const votePercentage = donation.totalVotes > 0
      ? Math.round((donation.votes / donation.totalVotes) * 100)
      : 0;

    const donationCard = document.createElement('div');
    donationCard.className = 'donation-item';

    // Build Solscan link from signature; if a full URL was provided, use it directly
    const txHref = donation.transactionSignature?.startsWith('http')
      ? donation.transactionSignature
      : (donation.transactionSignature
          ? `https://solscan.io/tx/${donation.transactionSignature}`
          : "");

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
        <div class="donation-amount">$${Number(donation.amount).toLocaleString()}</div>
        <div class="proof-links">
          ${donation.tweetUrl
            ? `<a href="${donation.tweetUrl}" class="proof-link" target="_blank" rel="noopener">View Tweet</a>`
            : '<span class="proof-link secondary">Tweet Pending</span>'}
          ${txHref
            ? `<a href="${txHref}" class="proof-link secondary" target="_blank" rel="noopener">Transaction</a>`
            : '<span class="proof-link secondary">TX Pending</span>'}
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
  const totalDonated = MANUAL_DONATIONS_DATA.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const totalVotes = MANUAL_DONATIONS_DATA.reduce((sum, d) => sum + Number(d.totalVotes || 0), 0);
  const uniqueCharities = new Set(MANUAL_DONATIONS_DATA.map(d => d.charityName)).size;
  const roundsCompleted = MANUAL_DONATIONS_DATA.length;

  const statCards = document.querySelectorAll('.stat-card .stat-value');
  if (statCards[0]) statCards[0.textContent !== undefined ? 0 : 0];
  if (statCards[0]) statCards[0].textContent = `$${totalDonated.toLocaleString()}`;
  if (statCards[1]) statCards[1].textContent = roundsCompleted.toLocaleString();
  if (statCards[2]) statCards[2].textContent = uniqueCharities.toLocaleString();
  if (statCards[3]) statCards[3].textContent = totalVotes.toLocaleString();
}

// Get current filter selection
function getCurrentFilter() {
  const activeBtn = document.querySelector('.filter-btn.active');
  if (!activeBtn) return 'all';

  const t = activeBtn.textContent.toLowerCase();
  if (t.includes('week')) return 'week';
  if (t.includes('month')) return 'month';
  if (t.includes('large')) return 'large';
  return 'all';
}

// Hide or handle load more button
const loadMoreBtn = document.querySelector('.load-more-btn');
if (loadMoreBtn) {
  loadMoreBtn.style.display = 'none';
}

// Global function for load more (called by onclick)
window.loadMore = function() {
  alert('All donations are already displayed');
};

// Global function for filter (called by onclick)
// NOTE: we don't rely on "event" here; we compute the active button by label.
window.filterDonations = function(filter) {
  const map = { all: 'All Time', week: 'This Week', month: 'This Month', large: 'Large Donations' };
  const label = map[filter] || 'All Time';
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === label);
  });
  loadManualDonations();
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('donationsList')) {
    loadManualDonations();

    // Set up filter buttons (this also handles clicks without inline onclick)
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadManualDonations();
      });
    });
  }
});

// Template helper
function getNewDonationTemplate(roundNumber) {
  return {
    roundNumber,
    date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
    charityName: "",
    amount: 0,
    votes: 0,
    totalVotes: 0,
    duration: 5,
    tweetUrl: "",
    transactionSignature: ""
  };
}
