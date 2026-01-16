console.log('[Focus Flow Popup] Script loaded and initializing...');

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
    const completeTotalSessions = document.getElementById('completeTotalSessions');
    const completeTotalMinutes = document.getElementById('completeTotalMinutes');
    const closeCelebration = document.getElementById('closeCelebration');
    const dailySessionsEl = document.getElementById('dailySessions');
    const dailyMinutesEl = document.getElementById('dailyMinutes');

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
        loadDailyStats(); // Initial load of daily stats
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
                loadStats();
                loadDailyStats(); // Update daily stats live
            }
        }
    });

    function loadDailyStats() {
        chrome.storage.local.get(['stats'], (result) => {
            const stats = result.stats || {};
            const daily = stats.daily || {};
            const today = new Date().toLocaleDateString('en-CA');
            const todaysData = daily[today] || { sessions: 0, minutes: 0 };

            if (dailySessionsEl) dailySessionsEl.textContent = todaysData.sessions;
            if (dailyMinutesEl) dailyMinutesEl.textContent = todaysData.minutes;
        });
    }

    // Stats Logic
    function loadStats() {
        chrome.storage.local.get(['stats'], (result) => {
            const stats = result.stats || { totalBlocks: 0, siteStats: {}, totalSessions: 0, totalFocusMinutes: 0 };
            document.getElementById('totalBlocks').innerText = stats.totalBlocks || 0;
            document.getElementById('totalFocusSessions').innerText = stats.totalSessions || 0;
            document.getElementById('totalFocusMinutes').innerText = stats.totalFocusMinutes || 0;

            const sites = Object.entries(stats.siteStats || {}).sort((a, b) => b[1] - a[1]);
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
        const scheduleToggleSection = document.getElementById('scheduleToggleSection');
        const disableScheduleBtn = document.getElementById('disableSchedule');

        // Check if elements exist to prevent errors
        if (!scheduleEnabled || !scheduleSettings || !scheduleSummary) {
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

            // Show summary or settings based on whether schedule is enabled
            if (schedule.enabled) {
                scheduleSummary.style.display = 'block';
                scheduleSettings.classList.remove('active');
                if (scheduleToggleSection) scheduleToggleSection.style.display = 'none';
                updateSummaryView(schedule);
            } else {
                scheduleSummary.style.display = 'none';
                scheduleSettings.classList.add('active');
                if (scheduleToggleSection) scheduleToggleSection.style.display = 'block';
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
                scheduleSummary.style.display = 'none';
                scheduleSettings.classList.add('active');
                if (scheduleToggleSection) scheduleToggleSection.style.display = 'block';
            });

            // Disable button
            if (disableScheduleBtn) {
                disableScheduleBtn.addEventListener('click', () => {
                    chrome.storage.local.get(['schedule'], (result) => {
                        const schedule = result.schedule || {};
                        schedule.enabled = false;
                        chrome.storage.local.set({ schedule }, () => {
                            scheduleEnabled.checked = false;
                            scheduleSummary.style.display = 'none';
                            scheduleSettings.classList.add('active');
                            if (scheduleToggleSection) scheduleToggleSection.style.display = 'block';
                            updateSummaryView(schedule);
                        });
                    });
                });
            }

            // Toggle schedule settings
            scheduleEnabled.addEventListener('change', () => {
                if (scheduleEnabled.checked) {
                    scheduleSettings.classList.add('active');
                } else {
                    scheduleSettings.classList.remove('active');
                    if (scheduleStatus) scheduleStatus.classList.remove('active');
                    // Disable schedule
                    chrome.storage.local.get(['schedule'], (result) => {
                        const schedule = result.schedule || {};
                        schedule.enabled = false;
                        chrome.storage.local.set({ schedule });
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
                    if (scheduleToggleSection) scheduleToggleSection.style.display = 'none';

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

        // Format time
        const formatTime = (time) => {
            const [hours, minutes] = time.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            return `${displayHour}:${minutes} ${ampm}`;
        };

        summaryTime.textContent = `${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}`;

        // Format days
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const activeDays = schedule.days.map(d => dayNames[d]).join(', ');
        summaryDays.textContent = activeDays;

        // Check if schedule is currently active
        const now = new Date();
        const currentDay = now.getDay();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        const [startHour, startMin] = schedule.startTime.split(':').map(Number);
        const [endHour, endMin] = schedule.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        const isActiveDay = schedule.days.includes(currentDay);
        const isActiveTime = currentTime >= startMinutes && currentTime <= endMinutes;

        if (schedule.enabled && isActiveDay && isActiveTime) {
            statusIndicator.classList.remove('inactive');
            statusText.textContent = '🔒 Schedule is ACTIVE - Sites are blocked now';
            // Update the global footer status too
            const globalStatusText = document.getElementById('statusText');
            if (globalStatusText) globalStatusText.innerText = '🔒 Schedule Active';
        } else {
            statusIndicator.classList.add('inactive');
            if (!schedule.enabled) {
                statusText.textContent = '⏸️ Schedule is DISABLED';
            } else if (!isActiveDay) {
                statusText.textContent = `⏸️ Schedule is INACTIVE - Not active on ${dayNames[currentDay]}`;
            } else {
                statusText.textContent = `⏸️ Schedule is INACTIVE - Outside scheduled hours`;
            }
            // Update the global footer status too
            const globalStatusText = document.getElementById('statusText');
            if (globalStatusText) globalStatusText.innerHTML = 'Made by <a href="https://www.hashmatic.in" target="_blank">www.hashmatic.in</a>';
        }
    }
});
