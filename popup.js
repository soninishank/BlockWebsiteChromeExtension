console.log('[Focus Flow Popup] Script loaded and initializing...');

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Focus Flow Popup] DOM Content Loaded');

    // Tab switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');

            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`${tabId}Tab`).classList.add('active');

            if (tabId === 'stats') loadStats();
        });
    });

    // Sites Management (kept from original with minor improvements)
    const siteInput = document.getElementById('siteInput');
    const addButton = document.getElementById('addButton');
    const blockList = document.getElementById('blockList');
    const suggestionsGrid = document.getElementById('suggestionsGrid');

    const suggestions = [
        // Social Media
        { name: 'YouTube', url: 'youtube.com', icon: '▶️' },
        { name: 'Facebook', url: 'facebook.com', icon: '👤' },
        { name: 'Instagram', url: 'instagram.com', icon: '📸' },
        { name: 'Twitter/X', url: 'x.com', icon: '✖️' },
        { name: 'TikTok', url: 'tiktok.com', icon: '🎵' },
        { name: 'LinkedIn', url: 'linkedin.com', icon: '💼' },
        { name: 'Snapchat', url: 'snapchat.com', icon: '👻' },
        { name: 'WhatsApp Web', url: 'web.whatsapp.com', icon: '💬' },

        // Entertainment & Streaming
        { name: 'Netflix', url: 'netflix.com', icon: 'N' },
        { name: 'Twitch', url: 'twitch.tv', icon: '🎮' },
        { name: 'Disney+', url: 'disneyplus.com', icon: '🏰' },
        { name: 'Prime Video', url: 'primevideo.com', icon: '📺' },

        // News & Forums
        { name: 'Reddit', url: 'reddit.com', icon: '🤖' },
        { name: 'Hacker News', url: 'news.ycombinator.com', icon: 'Y' },
        { name: 'Medium', url: 'medium.com', icon: 'M' },

        // Gaming
        { name: 'Steam', url: 'store.steampowered.com', icon: '🎮' },

        // Shopping
        { name: 'Amazon', url: 'amazon.com', icon: '📦' },
        { name: 'eBay', url: 'ebay.com', icon: '🏷️' }
    ];

    chrome.storage.local.get(['blockedSites', 'sessionState'], (result) => {
        if (chrome.runtime.lastError) {
            console.error('[Focus Flow Popup] Error loading storage:', chrome.runtime.lastError);
            return;
        }
        console.log('[Focus Flow Popup] Loaded from storage:', result);
        const sites = result.blockedSites || [];
        const isHardMode = result.sessionState?.active && result.sessionState?.hardMode;
        renderList(sites, isHardMode);
        updateTimerUI(result.sessionState);
    });

    addButton.addEventListener('click', () => addSiteFromInput());
    siteInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addSiteFromInput(); });

    function addSiteFromInput() {
        const site = siteInput.value.trim().toLowerCase();
        if (site) {
            addSite(site);
            siteInput.value = '';
        }
    }

    function renderList(sites, isHardMode) {
        blockList.innerHTML = '';

        // Get block timestamps
        chrome.storage.local.get(['blockTimestamps'], (result) => {
            const timestamps = result.blockTimestamps || {};

            sites.forEach((site) => {
                const li = document.createElement('li');
                const blockedSince = timestamps[site];
                let streakText = '';

                if (blockedSince) {
                    const timeBlocked = Date.now() - blockedSince;
                    streakText = formatStreakTime(timeBlocked);
                }

                li.innerHTML = `
                    <div class="site-info">
                        <span class="site-name">${site}</span>
                        ${streakText ? `<span class="streak-badge">🔥 ${streakText} clean</span>` : ''}
                    </div>
                    <button class="remove-btn" data-site="${site}" ${isHardMode ? 'disabled style="opacity:0.3;cursor:not-allowed"' : ''}>✕</button>
                `;
                blockList.appendChild(li);
            });

            document.querySelectorAll('.remove-btn').forEach(btn => {
                if (!isHardMode) {
                    btn.addEventListener('click', () => removeSite(btn.getAttribute('data-site')));
                }
            });
        });

        renderSuggestions(sites);
    }

    function formatStreakTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m`;
        } else {
            return `${seconds}s`;
        }
    }

    function renderSuggestions(blockedSites) {
        suggestionsGrid.innerHTML = '';
        const availableSuggestions = suggestions.filter(s => !blockedSites.includes(s.url));
        availableSuggestions.forEach(s => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';

            div.innerHTML = `
                <div class="suggestion-info">
                    <span class="icon">${s.icon}</span>
                    <span>${s.name}</span>
                </div>
                <span class="add-suggestion">+</span>
            `;
            div.addEventListener('click', () => addSite(s.url));
            suggestionsGrid.appendChild(div);
        });
    }


    function addSite(site) {
        console.log('[Popup] addSite called with:', site);
        let sanitizedSite = site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        console.log('[Popup] Sanitized to:', sanitizedSite);

        if (sanitizedSite) {
            chrome.storage.local.get(['blockedSites'], (result) => {
                if (chrome.runtime.lastError) {
                    console.error('[Popup] Error getting storage:', chrome.runtime.lastError);
                    return;
                }

                const sites = result.blockedSites || [];
                console.log('[Popup] Current sites in storage:', sites);

                if (!sites.includes(sanitizedSite)) {
                    const newSites = [...sites, sanitizedSite];
                    console.log('[Popup] Adding site, new list:', newSites);

                    // Save timestamp for streak tracking
                    chrome.storage.local.get(['blockTimestamps'], (timestampResult) => {
                        const timestamps = timestampResult.blockTimestamps || {};
                        timestamps[sanitizedSite] = Date.now();

                        chrome.storage.local.set({
                            blockedSites: newSites,
                            blockTimestamps: timestamps
                        }, () => {
                            if (chrome.runtime.lastError) {
                                console.error('[Popup] Error setting storage:', chrome.runtime.lastError);
                                return;
                            }

                            console.log('[Popup] Storage updated successfully');
                            renderList(newSites, false);

                            // Send message with the newly added site for cache clearing
                            chrome.runtime.sendMessage({
                                action: 'updateRules',
                                sites: newSites,
                                newSites: [sanitizedSite]  // Pass the newly added site for cache clearing
                            }, (response) => {
                                if (chrome.runtime.lastError) {
                                    console.error('[Popup] Error sending message:', chrome.runtime.lastError);
                                    return;
                                }
                                console.log('[Popup] Message sent to background, response:', response);
                            });
                        });
                    });
                } else {
                    console.log('[Popup] Site already in list, skipping');
                }
            });
        } else {
            console.log('[Popup] Sanitized site is empty, skipping');
        }
    }

    function removeSite(site) {
        chrome.storage.local.get(['blockedSites', 'blockTimestamps'], (result) => {
            const sites = result.blockedSites || [];
            const timestamps = result.blockTimestamps || {};

            const newSites = sites.filter(s => s !== site);
            delete timestamps[site]; // Remove timestamp

            chrome.storage.local.set({
                blockedSites: newSites,
                blockTimestamps: timestamps
            }, () => {
                renderList(newSites, false);
                chrome.runtime.sendMessage({ action: 'updateRules', sites: newSites });
            });
        });
    }

    // Timer Logic
    const timerDisplay = document.getElementById('timerDisplay');
    const startBtn = document.getElementById('startSessionBtn');
    const stopBtn = document.getElementById('stopSessionBtn');
    const durationSelect = document.getElementById('durationSelect');
    const hardModeToggle = document.getElementById('hardModeToggle');
    const statusText = document.getElementById('statusText');

    let timerInterval;

    startBtn.addEventListener('click', () => {
        const duration = parseInt(durationSelect.value);
        const hardMode = hardModeToggle.checked;
        chrome.runtime.sendMessage({ action: 'startSession', duration, hardMode });

        // Update local UI immediately
        const endTime = Date.now() + duration * 60000;
        startTimer(endTime);
        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
        durationSelect.disabled = true;
        if (hardMode) hardModeToggle.disabled = true;
        statusText.innerText = `Focus Session Active${hardMode ? ' (Hard Mode)' : ''}`;
    });

    stopBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'stopSession' });
        resetTimerUI();
    });

    function startTimer(endTime) {
        clearInterval(timerInterval);
        function update() {
            const now = Date.now();
            const remaining = endTime - now;

            if (remaining <= 0) {
                clearInterval(timerInterval);
                resetTimerUI();
                return;
            }

            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            timerDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        update();
        timerInterval = setInterval(update, 1000);
    }

    function resetTimerUI() {
        clearInterval(timerInterval);
        timerDisplay.innerText = "25:00";
        startBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        durationSelect.disabled = false;
        hardModeToggle.disabled = false;
        statusText.innerText = 'Focus Flow is ready';

        // Refresh site list to re-enable remove buttons if hard mode was on
        chrome.storage.local.get(['blockedSites'], (res) => {
            renderList(res.blockedSites || [], false);
        });
    }

    function updateTimerUI(sessionState) {
        if (sessionState?.active && sessionState.endTime > Date.now()) {
            startTimer(sessionState.endTime);
            startBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
            durationSelect.disabled = true;
            hardModeToggle.checked = sessionState.hardMode;
            if (sessionState.hardMode) {
                hardModeToggle.disabled = true;
                stopBtn.classList.add('hidden'); // Cannot stop in hard mode
            }
            statusText.innerText = `Focus Session Active${sessionState.hardMode ? ' (Hard Mode)' : ''}`;
        }
    }

    // Stats Logic
    function loadStats() {
        chrome.storage.local.get(['stats'], (result) => {
            const stats = result.stats || { totalBlocks: 0, siteStats: {} };
            document.getElementById('totalBlocks').innerText = stats.totalBlocks;

            const sites = Object.entries(stats.siteStats).sort((a, b) => b[1] - a[1]);
            const topDistraction = sites.length > 0 ? sites[0][0] : '-';
            document.getElementById('topDistraction').innerText = topDistraction;

            const statsList = document.getElementById('statsList');
            statsList.innerHTML = '';
            sites.forEach(([site, count]) => {
                const div = document.createElement('div');
                div.className = 'stats-item';
                div.innerHTML = `
                    <span>${site}</span>
                    <span class="stats-count">${count} blocks</span>
                `;
                statsList.appendChild(div);
            });
        });
    }
});
