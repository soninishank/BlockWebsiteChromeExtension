console.log('[Focus Flow Popup] Script loaded v1.0.1 initializing...');

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Focus Flow Popup] DOM Content Loaded');

    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.querySelector('.theme-icon');

    // Timer Elements
    const timerDisplay = document.getElementById('timerDisplay');
    const startBtn = document.getElementById('startSessionBtn');
    const stopBtn = document.getElementById('stopSessionBtn');
    const durationInput = document.getElementById('durationInput');
    const chips = document.querySelectorAll('.chip');
    const activeActionGroup = document.getElementById('activeActionGroup');
    const pauseSessionBtn = document.getElementById('pauseSessionBtn');
    const hardModeToggle = document.getElementById('hardModeToggle');
    const statusText = document.getElementById('statusText');
    const hardModeLockedMsg = document.getElementById('hardModeLockedMsg');
    const celebrationOverlay = document.getElementById('celebrationOverlay');
    const closeCelebration = document.getElementById('closeCelebration');
    const confirmationModal = document.getElementById('confirmationModal');
    const cancelConfirm = document.getElementById('cancelConfirm');
    const executeConfirm = document.getElementById('executeConfirm');
    const modalGuidance = document.getElementById('modalGuidance');
    const modalTitle = document.getElementById('modalTitle');
    const confirmIcon = document.getElementById('confirmIcon');

    let currentConfirmAction = null;

    let timerInterval;

    // Load saved theme
    chrome.storage.local.get(['theme'], (result) => {
        const theme = result.theme || 'dark';
        if (theme === 'light') {
            document.body.classList.add('light-theme');
            themeIcon.textContent = '☀️';
        }
    });

    // Toggle theme
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        themeIcon.textContent = isLight ? '☀️' : '🌙';
        chrome.storage.local.set({ theme: isLight ? 'light' : 'dark' });
    });

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
            if (tabId === 'schedule') loadSchedule();
        });
    });

    // Limit duration input to 3 digits
    if (durationInput) {
        durationInput.addEventListener('input', () => {
            if (durationInput.value.length > 3) {
                durationInput.value = durationInput.value.slice(0, 3);
            }
        });
    }

    // Site Management (kept from original with minor improvements)
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

    chrome.storage.local.get(['blockedSites', 'sessionState', 'lastDuration'], (result) => {
        if (chrome.runtime.lastError) {
            console.error('[Focus Flow Popup] Error loading storage:', chrome.runtime.lastError);
            return;
        }
        console.log('[Focus Flow Popup] Loaded from storage:', result);
        const sites = result.blockedSites || [];
        const isHardMode = result.sessionState?.active && result.sessionState?.hardMode;

        // Duration persistence
        if (result.lastDuration) {
            let clampedMins = parseInt(result.lastDuration);
            if (clampedMins > 360) clampedMins = 360;

            durationInput.value = clampedMins;
            updateActiveChip(clampedMins.toString());
        }

        renderList(sites, isHardMode);
        updateTimerUI(result.sessionState);
        updateUnifiedStats(); // Initial load of all stats

        // Auto-fill current site
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0] && tabs[0].url && tabs[0].url.startsWith('http')) {
                try {
                    const url = new URL(tabs[0].url);
                    const hostname = url.hostname.replace(/^www\./, '');
                    siteInput.value = hostname;
                    siteInput.select(); // Highlight for easy overwriting
                } catch (e) {
                    console.error('Error parsing URL:', e);
                }
            }
        });
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

    function renderList(sites, isHardMode, highlightSite = null) {
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
                if (highlightSite && site === highlightSite) {
                    li.classList.add('just-added');
                    setTimeout(() => li.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                }

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
                            renderList(newSites, false, sanitizedSite);

                            // Check if schedule is enabled
                            chrome.storage.local.get(['schedule'], (schedRes) => {
                                const schedule = schedRes.schedule;
                                if (!schedule || !schedule.enabled) {
                                    // Scenario 1: No Schedule -> Prompt to create one
                                    showConfirmationModal({
                                        title: 'Enable Focus Schedule?',
                                        message: 'This site is now blocked 24/7. Would you like to set specific focus hours instead?',
                                        icon: '⏰',
                                        confirmText: 'Set Schedule',
                                        cancelText: 'Keep 24/7 Block',
                                        onConfirm: () => {
                                            const scheduleTabBtn = document.querySelector('.tab-btn[data-tab="schedule"]');
                                            if (scheduleTabBtn) scheduleTabBtn.click();
                                        }
                                    });
                                } else {
                                    // Scenario 2: Schedule Enabled -> Check if currently active
                                    const status = checkScheduleStatus(schedule);
                                    if (!status.isActive) {
                                        showConfirmationModal({
                                            title: 'Site Added (Not Currently Blocked)',
                                            message: 'This site is in your blocklist, but your Focus Schedule is currently inactive. It will be blocked when your schedule starts.',
                                            icon: '💤',
                                            cancelText: 'Change Schedule', // Primary Button
                                            confirmText: 'OK', // Secondary Link
                                            onCancel: () => {
                                                const scheduleTabBtn = document.querySelector('.tab-btn[data-tab="schedule"]');
                                                if (scheduleTabBtn) scheduleTabBtn.click();
                                            }
                                        });
                                    }
                                }
                            });

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

    function showConfirmationModal(config) {
        modalTitle.textContent = config.title || 'Wait, Stay Focused!';
        modalGuidance.textContent = config.message;
        confirmIcon.textContent = config.icon || '🛡️';
        cancelConfirm.textContent = config.cancelText || 'Keep it Active';
        executeConfirm.textContent = config.confirmText || 'Yes, remove it';

        currentConfirmAction = config.onConfirm;
        currentCancelAction = config.onCancel;
        confirmationModal.classList.remove('hidden');
    }

    let currentCancelAction = null;

    if (cancelConfirm) {
        cancelConfirm.addEventListener('click', () => {
            if (currentCancelAction) currentCancelAction();
            confirmationModal.classList.add('hidden');
            currentConfirmAction = null;
            currentCancelAction = null;
        });
    }

    if (executeConfirm) {
        executeConfirm.addEventListener('click', () => {
            if (currentConfirmAction) currentConfirmAction();
            confirmationModal.classList.add('hidden');
            currentConfirmAction = null;
            currentCancelAction = null;
        });
    }

    function removeSite(site) {
        const guidanceMessages = [
            "Is this website really more important than the goals you're working toward right now?",
            "Remember why you blocked this in the first place. Stay strong!",
            "Temptation is temporary, but the regret of lost time lasts longer.",
            "You were doing so well! Are you sure you want to let this distraction back in?",
            "Success is built on what you don't do. Keep your focus on what matters.",
            "Is 5 minutes of scrolling worth losing your momentum?"
        ];

        const randomGuidance = guidanceMessages[Math.floor(Math.random() * guidanceMessages.length)];

        showConfirmationModal({
            title: 'Unblock Website?',
            message: randomGuidance,
            icon: '🛡️',
            cancelText: 'Keep it Blocked',
            confirmText: 'Yes, unblock it',
            onConfirm: () => actuallyRemoveSite(site)
        });
    }

    function actuallyRemoveSite(site) {
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

    startBtn.addEventListener('click', () => {
        let duration = parseInt(durationInput.value);
        if (isNaN(duration) || duration <= 0) {
            alert('Please enter a valid number of minutes.');
            return;
        }
        if (duration > 360) {
            alert('Focus sessions are limited to 6 hours (360 minutes).');
            return;
        }

        const hardMode = hardModeToggle.checked;
        chrome.runtime.sendMessage({ action: 'startSession', duration, hardMode });

        // Save last used duration
        chrome.storage.local.set({ lastDuration: duration });

        // Update local UI immediately
        const endTime = Date.now() + duration * 60000;
        startTimer(endTime);
        startBtn.classList.add('hidden');
        activeActionGroup.classList.remove('hidden');

        if (hardMode) {
            hardModeToggle.disabled = true;
            stopBtn.classList.add('hidden');
            pauseSessionBtn.classList.add('hidden');
            hardModeLockedMsg.classList.remove('hidden');
        } else {
            stopBtn.classList.remove('hidden');
            pauseSessionBtn.classList.remove('hidden');
            hardModeLockedMsg.classList.add('hidden');
        }

        durationInput.disabled = true;
        chips.forEach(c => c.style.pointerEvents = 'none');
        statusText.innerText = `Focus Session Active${hardMode ? ' (Hard Mode)' : ''}`;
    });

    stopBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'stopSession' });
        resetTimerUI();
    });

    pauseSessionBtn.addEventListener('click', () => {
        chrome.storage.local.get(['sessionState'], (result) => {
            const state = result.sessionState;
            if (state?.active) {
                if (state.paused) {
                    chrome.runtime.sendMessage({ action: 'resumeSession' });
                    pauseSessionBtn.innerText = 'Pause';
                } else {
                    chrome.runtime.sendMessage({ action: 'pauseSession' });
                    pauseSessionBtn.innerText = 'Resume';
                    clearInterval(timerInterval);
                }
            }
        });
    });

    // Chip interaction
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            const mins = chip.getAttribute('data-mins');
            durationInput.value = mins;
            updateActiveChip(mins);

            // Sync display
            const displayMins = mins.padStart(2, '0');
            timerDisplay.innerText = `${displayMins}:00`;
            chrome.storage.local.set({ lastDuration: mins });
        });
    });

    durationInput.addEventListener('input', () => {
        const val = durationInput.value;
        const mins = val.padStart(2, '0');
        timerDisplay.innerText = `${mins}:00`;
        updateActiveChip(val);
        chrome.storage.local.set({ lastDuration: val });
    });

    function updateActiveChip(mins) {
        chips.forEach(c => {
            if (c.getAttribute('data-mins') === mins.toString()) {
                c.classList.add('active');
            } else {
                c.classList.remove('active');
            }
        });
    }

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
        const mins = durationInput.value.toString().padStart(2, '0');
        timerDisplay.innerText = `${mins}:00`;
        startBtn.classList.remove('hidden');
        activeActionGroup.classList.add('hidden');
        pauseSessionBtn.innerText = 'Pause';
        durationInput.disabled = false;
        chips.forEach(c => c.style.pointerEvents = 'auto');
        hardModeToggle.disabled = false;
        hardModeLockedMsg.classList.add('hidden');
        statusText.innerHTML = 'Made by <a href="https://www.hashmatic.in" target="_blank">www.hashmatic.in</a>';

        // Refresh site list to re-enable remove buttons if hard mode was on
        chrome.storage.local.get(['blockedSites'], (res) => {
            renderList(res.blockedSites || [], false);
        });
    }

    function updateTimerUI(sessionState) {
        if (sessionState?.active) {
            if (sessionState.paused) {
                // ... (paused logic remains same)
                const remaining = sessionState.remainingTime;
                const mins = Math.floor(remaining / 60000);
                const secs = Math.floor((remaining % 60000) / 1000);
                timerDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

                startBtn.classList.add('hidden');
                activeActionGroup.classList.remove('hidden');
                pauseSessionBtn.innerText = 'Resume';
                pauseSessionBtn.classList.remove('hidden');
                stopBtn.classList.remove('hidden');
                durationInput.disabled = true;
                chips.forEach(c => c.style.pointerEvents = 'none');
                hardModeToggle.checked = sessionState.hardMode;
                statusText.innerText = `Focus Session Paused${sessionState.hardMode ? ' (Hard Mode)' : ''}`;
            } else if (sessionState.endTime > Date.now()) {
                // Active running state
                startTimer(sessionState.endTime);
                startBtn.classList.add('hidden');
                activeActionGroup.classList.remove('hidden');
                pauseSessionBtn.innerText = 'Pause';
                pauseSessionBtn.classList.remove('hidden');
                stopBtn.classList.remove('hidden');
                durationInput.disabled = true;
                chips.forEach(c => c.style.pointerEvents = 'none');
                hardModeToggle.checked = sessionState.hardMode;
                if (sessionState.hardMode) {
                    hardModeToggle.disabled = true;
                    stopBtn.classList.add('hidden');
                    pauseSessionBtn.classList.add('hidden');
                    hardModeLockedMsg.classList.remove('hidden');
                    activeActionGroup.classList.add('hard-mode-active');
                } else {
                    stopBtn.classList.remove('hidden');
                    pauseSessionBtn.classList.remove('hidden');
                    hardModeLockedMsg.classList.add('hidden');
                    activeActionGroup.classList.remove('hard-mode-active');
                }
                statusText.innerText = `Focus Session Active${sessionState.hardMode ? ' (Hard Mode)' : ''}`;
            } else {
                // Active flag is true but time passed
                if (sessionState.showCelebration) {
                    showCelebrationUI();
                }
                resetTimerUI();
            }
        } else {
            // No active session at all
            if (sessionState?.showCelebration) {
                showCelebrationUI();
            }
            resetTimerUI();
        }
    }

    function showCelebrationUI() {
        chrome.storage.local.get(['stats'], (result) => {
            const stats = result.stats || { totalSessions: 0, totalFocusMinutes: 0 };
            completeTotalSessions.textContent = stats.totalSessions || 0;
            completeTotalMinutes.textContent = stats.totalFocusMinutes || 0;

            celebrationOverlay.classList.remove('hidden');

            // Clear the flag so it doesn't show again on next open
            chrome.storage.local.get(['sessionState'], (stateRes) => {
                const state = stateRes.sessionState || {};
                state.showCelebration = false;
                chrome.storage.local.set({ sessionState: state });
            });
        });
    }

    closeCelebration.addEventListener('click', () => {
        celebrationOverlay.classList.add('hidden');
        resetTimerUI(); // Ensure UI is re-enabled immediately
    });

    // Storage change listener for live syncing
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local') {
            if (changes.sessionState) {
                updateTimerUI(changes.sessionState.newValue);
            }
            if (changes.stats) {
                updateUnifiedStats(); // Update everything live
            }
        }
    });

    function updateUnifiedStats() {
        chrome.storage.local.get(['stats'], (result) => {
            const stats = result.stats || { totalBlocks: 0, siteStats: {}, totalSessions: 0, totalFocusMinutes: 0, daily: {} };

            // Get today's data
            const today = new Date().toLocaleDateString('en-CA');
            const todaysData = (stats.daily && stats.daily[today]) || { sessions: 0, minutes: 0 };

            // Update all elements by class
            const updateList = [
                { class: '.val-today-sessions', val: todaysData.sessions },
                { class: '.val-today-mins', val: todaysData.minutes },
                { class: '.val-total-sessions', val: stats.totalSessions || 0 },
                { class: '.val-total-mins', val: stats.totalFocusMinutes || 0 }
            ];

            updateList.forEach(item => {
                document.querySelectorAll(item.class).forEach(el => {
                    el.textContent = item.val;
                });
            });

            // Handle non-focus stats (Stats Tab only)
            const totalBlocksEl = document.getElementById('totalBlocks');
            if (totalBlocksEl) totalBlocksEl.innerText = stats.totalBlocks || 0;

            const sites = Object.entries(stats.siteStats || {}).sort((a, b) => b[1] - a[1]);
            const topDistraction = sites.length > 0 ? sites[0][0] : '-';
            const topDistractionEl = document.getElementById('topDistraction');
            if (topDistractionEl) topDistractionEl.innerText = topDistraction;
        });
    }

    // Heritage wrapper for any old calls
    function loadStats() {
        updateUnifiedStats();
    }

    // Schedule Tab Logic
    let scheduleListenersAdded = false;

    function loadSchedule() {
        const scheduleEnabled = document.getElementById('scheduleEnabled');
        const scheduleSettings = document.getElementById('scheduleSettings');
        const scheduleSummary = document.getElementById('scheduleSummary');
        const modifyScheduleBtn = document.getElementById('modifySchedule');
        const scheduleStart = document.getElementById('scheduleStart');
        const scheduleEnd = document.getElementById('scheduleEnd');
        const saveScheduleBtn = document.getElementById('saveSchedule');
        const scheduleStatus = document.getElementById('scheduleStatus');
        const dayCheckboxes = document.querySelectorAll('.day-checkbox input[type="checkbox"]');
        const presetBtns = document.querySelectorAll('.preset-btn');
        const scheduleToggleSection = document.querySelector('.schedule-toggle-section');
        const disableScheduleBtn = document.getElementById('disableSchedule');
        const scheduleContent = document.getElementById('scheduleContent');

        // Check if elements exist to prevent errors
        if (!scheduleEnabled || !scheduleSettings || !scheduleSummary || !scheduleContent) {
            console.error('[Focus Flow Popup] Schedule elements not found');
            return;
        }

        // Load saved schedule
        chrome.storage.local.get(['schedule'], (result) => {
            const schedule = result.schedule || {
                enabled: false,
                startTime: '09:00',
                endTime: '17:00',
                days: [1, 2, 3, 4, 5] // Mon-Fri
            };

            scheduleEnabled.checked = schedule.enabled;
            scheduleStart.value = schedule.startTime;
            scheduleEnd.value = schedule.endTime;

            // Handle main content visibility based on master toggle
            if (schedule.enabled) {
                scheduleContent.style.display = 'block';
                scheduleToggleSection.classList.add('hidden'); // Hide toggle when enabled
                // Show summary or settings based on whether it's established
                scheduleSummary.style.display = 'block';
                scheduleSettings.classList.remove('active');
                updateSummaryView(schedule);
            } else {
                scheduleContent.style.display = 'none';
                scheduleSummary.style.display = 'none';
                scheduleSettings.classList.add('active');
                scheduleToggleSection.classList.remove('hidden'); // Show toggle when disabled
            }

            // Set day checkboxes and check for preset match
            dayCheckboxes.forEach(checkbox => {
                checkbox.checked = schedule.days.includes(parseInt(checkbox.value));
            });

            // Highlight matching preset
            presetBtns.forEach(btn => {
                const preset = btn.getAttribute('data-preset');
                let isMatch = false;

                if (preset === 'work' && schedule.startTime === '09:00' && schedule.endTime === '17:00' &&
                    JSON.stringify(schedule.days.sort()) === JSON.stringify([1, 2, 3, 4, 5])) {
                    isMatch = true;
                } else if (preset === 'evening' && schedule.startTime === '18:00' && schedule.endTime === '22:00') {
                    isMatch = true;
                } else if (preset === 'allday' && schedule.startTime === '00:00' && schedule.endTime === '23:59') {
                    isMatch = true;
                }

                if (isMatch) btn.classList.add('active');
            });
        });

        // Only add event listeners once
        if (!scheduleListenersAdded) {
            scheduleListenersAdded = true;

            // Modify button - show settings
            modifyScheduleBtn.addEventListener('click', () => {
                const modifyScheduleMessages = [
                    "Consistency is the foundation of success. Are you sure you need to change this?",
                    "Stick to the plan if you can. Modifying often leads to relaxing boundaries.",
                    "Great schedules are built on routine. Try to keep this one if possible!",
                    "Changing your schedule is okay, but are you doing it to improve focus or avoid it?",
                    "Optimizing is good, but make sure you aren't just making it easier to be distracted."
                ];

                const randomMessage = modifyScheduleMessages[Math.floor(Math.random() * modifyScheduleMessages.length)];

                showConfirmationModal({
                    title: 'Modify Focus Plan?',
                    message: randomMessage,
                    icon: '📝',
                    cancelText: 'Keep current schedule',
                    confirmText: 'Yes, modify it',
                    onConfirm: () => {
                        scheduleSummary.style.display = 'none';
                        scheduleSettings.classList.add('active');
                        if (scheduleToggleSection) scheduleToggleSection.style.display = 'block';
                    }
                });
            });

            // Disable button
            if (disableScheduleBtn) {
                disableScheduleBtn.addEventListener('click', () => {
                    const scheduleDisableMessages = [
                        "Your future self will thank you for keeping this schedule active. Are you sure?",
                        "Maintaining a schedule is the key to long-term success. Don't let it slip now.",
                        "Are you sure you want to relax your focus boundaries?",
                        "The best way to reach your goals is to stick to your plan. Stay committed!",
                        "Consistency is what transforms average into excellence. Keep going!"
                    ];

                    const randomMessage = scheduleDisableMessages[Math.floor(Math.random() * scheduleDisableMessages.length)];

                    showConfirmationModal({
                        title: 'Disable Schedule?',
                        message: randomMessage,
                        icon: '🎯',
                        cancelText: 'Keep it Active',
                        confirmText: 'Yes, disable it',
                        onConfirm: () => {
                            chrome.storage.local.get(['schedule'], (result) => {
                                const schedule = result.schedule || {
                                    startTime: '09:00',
                                    endTime: '17:00',
                                    days: [1, 2, 3, 4, 5]
                                };
                                schedule.enabled = false;
                                chrome.storage.local.set({ schedule }, () => {
                                    if (scheduleEnabled) scheduleEnabled.checked = false;
                                    if (scheduleContent) scheduleContent.style.display = 'none';
                                    if (scheduleSummary) scheduleSummary.style.display = 'none';
                                    if (scheduleSettings) scheduleSettings.classList.add('active');
                                    if (scheduleToggleSection) scheduleToggleSection.classList.remove('hidden');
                                    updateSummaryView(schedule);
                                });
                            });
                        }
                    });
                });
            }

            // Master schedule toggle
            scheduleEnabled.addEventListener('change', () => {
                if (scheduleEnabled.checked) {
                    scheduleContent.style.display = 'block';
                    scheduleSettings.classList.add('active');
                    scheduleSummary.style.display = 'none';
                    // We don't save yet, wait for 'Save Schedule'
                } else {
                    scheduleContent.style.display = 'none';
                    if (scheduleStatus) scheduleStatus.classList.remove('active');
                    // Disable schedule and save immediately
                    chrome.storage.local.get(['schedule'], (result) => {
                        const schedule = result.schedule || {
                            startTime: '09:00',
                            endTime: '17:00',
                            days: [1, 2, 3, 4, 5]
                        };
                        schedule.enabled = false;
                        chrome.storage.local.set({ schedule }, () => {
                            updateSummaryView(schedule);
                        });
                    });
                }
            });

            // Quick presets
            presetBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    presetBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    const preset = btn.getAttribute('data-preset');
                    if (preset === 'work') {
                        scheduleStart.value = '09:00';
                        scheduleEnd.value = '17:00';
                        dayCheckboxes.forEach(cb => {
                            cb.checked = [1, 2, 3, 4, 5].includes(parseInt(cb.value));
                        });
                    } else if (preset === 'evening') {
                        scheduleStart.value = '18:00';
                        scheduleEnd.value = '22:00';
                    } else if (preset === 'allday') {
                        scheduleStart.value = '00:00';
                        scheduleEnd.value = '23:59';
                    }
                });
            });

            // Save schedule
            saveScheduleBtn.addEventListener('click', () => {
                // Re-query checkboxes to ensure we get the latest state
                const currentDayCheckboxes = document.querySelectorAll('.day-checkbox input[type="checkbox"]');
                const selectedDays = Array.from(currentDayCheckboxes)
                    .filter(cb => cb.checked)
                    .map(cb => parseInt(cb.value));

                // If user clicks save, we assume they want the schedule enabled
                // at least if they've provided valid settings.
                const schedule = {
                    enabled: true, // Force enable on save to show summary
                    startTime: scheduleStart.value,
                    endTime: scheduleEnd.value,
                    days: selectedDays
                };

                chrome.storage.local.set({ schedule }, () => {
                    // Update UI state
                    scheduleEnabled.checked = true;

                    if (scheduleStatus) {
                        scheduleStatus.textContent = '✓ Schedule saved and activated!';
                        scheduleStatus.classList.add('active');
                    }

                    // Switch to summary view immediately
                    updateSummaryView(schedule);
                    scheduleSummary.style.display = 'block';
                    scheduleSettings.classList.remove('active');

                    setTimeout(() => {
                        if (scheduleStatus) scheduleStatus.classList.remove('active');
                    }, 3000);
                });
            });
        }
    }

    function updateSummaryView(schedule) {
        const summaryTime = document.getElementById('summaryTime');
        const summaryDays = document.getElementById('summaryDays');
        const statusIndicator = document.getElementById('scheduleActiveStatus');

        if (!summaryTime || !summaryDays || !statusIndicator) return;

        const statusText = statusIndicator.querySelector('.status-text');
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // Robust Format time
        const formatTime = (time) => {
            if (!time || typeof time !== 'string' || !time.includes(':')) return '--:--';
            try {
                const [hours, minutes] = time.split(':');
                const hour = parseInt(hours);
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour % 12 || 12;
                return `${displayHour}:${minutes} ${ampm}`;
            } catch (e) {
                return '--:--';
            }
        };

        if (schedule && schedule.startTime && schedule.endTime) {
            let timeText = `${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}`;
            // Check for overnight schedule
            if (schedule.startTime > schedule.endTime) {
                timeText += ' (Overnight 🌙)';
            }
            summaryTime.textContent = timeText;
        } else {
            summaryTime.textContent = 'Not configured';
        }

        // Format days
        if (schedule && Array.isArray(schedule.days)) {
            const activeDays = schedule.days.map(d => dayNames[d]).join(', ');
            summaryDays.textContent = activeDays || 'None selected';
        } else {
            summaryDays.textContent = 'None selected';
        }

        if (schedule && schedule.enabled) {
            const { isActive, isActiveDay, isActiveTime } = checkScheduleStatus(schedule);

            const headerStatus = document.getElementById('scheduleHeaderStatus');
            const headerText = headerStatus ? headerStatus.querySelector('.status-text') : null;

            if (isActive) {
                statusIndicator.classList.remove('inactive');
                const activeText = '🔒 Focus Schedule Active';
                statusText.textContent = activeText;

                if (headerStatus) {
                    headerStatus.classList.remove('inactive');
                    if (headerText) headerText.textContent = activeText;
                    headerStatus.style.display = 'flex';
                }

                const globalStatusText = document.getElementById('statusText');
                if (globalStatusText) globalStatusText.innerText = '🔒 Focus Schedule Active';
            } else {
                statusIndicator.classList.add('inactive');
                let inactiveText = '';
                if (!isActiveDay) {
                    inactiveText = `⏸️ Focus window closed - Not active on ${dayNames[new Date().getDay()]}`;
                } else {
                    inactiveText = `⏸️ Focus window closed - Outside scheduled hours`;
                }
                statusText.textContent = inactiveText;

                if (headerStatus) {
                    headerStatus.classList.add('inactive');
                    if (headerText) headerText.textContent = inactiveText;
                    headerStatus.style.display = 'flex';
                }
            }
        }
    }

    function checkScheduleStatus(schedule) {
        if (!schedule || !schedule.enabled || !schedule.startTime || !schedule.endTime || !Array.isArray(schedule.days)) {
            return { isActive: false, isActiveDay: false, isActiveTime: false };
        }

        const now = new Date();
        const currentDay = now.getDay();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        const [startHour, startMin] = schedule.startTime.split(':').map(Number);
        const [endHour, endMin] = schedule.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        const isActiveDay = schedule.days.includes(currentDay);

        // Handle overnight schedules
        const isActiveTime = startMinutes <= endMinutes
            ? (currentTime >= startMinutes && currentTime <= endMinutes)
            : (currentTime >= startMinutes || currentTime <= endMinutes);

        return { isActive: isActiveDay && isActiveTime, isActiveDay, isActiveTime };
    }

    const globalStatusText = document.getElementById('statusText');
    if (globalStatusText) globalStatusText.innerHTML = 'Made by <a href="https://www.hashmatic.in" target="_blank">www.hashmatic.in</a>';
});
