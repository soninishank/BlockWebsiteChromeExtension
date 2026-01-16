chrome.runtime.onInstalled.addListener(() => {
    console.log('[Focus Flow] Extension installed/updated');
    chrome.storage.local.get(['blockedSites', 'stats'], (result) => {
        const sites = result.blockedSites || [];
        console.log('[Focus Flow] Initial blocked sites:', sites);
        updateRules(sites);

        if (!result.stats) {
            chrome.storage.local.set({
                stats: { totalBlocks: 0, siteStats: {} },
                sessionState: { active: false, hardMode: false }
            });
        }
    });
});

// Also update rules on startup
chrome.runtime.onStartup.addListener(() => {
    console.log('[Focus Flow] Browser started, reloading rules');
    chrome.storage.local.get(['blockedSites'], (result) => {
        const sites = result.blockedSites || [];
        console.log('[Focus Flow] Startup blocked sites:', sites);
        updateRules(sites);
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateRules') {
        // Use the centralized check to respect schedule
        checkAndApplySchedule(request.newSites);
        sendResponse({ success: true });
    } else if (request.action === 'startSession') {
        startSession(request.duration, request.hardMode);
        sendResponse({ success: true });
    } else if (request.action === 'stopSession') {
        stopSession();
        sendResponse({ success: true });
    } else if (request.action === 'pauseSession') {
        pauseSession();
        sendResponse({ success: true });
    } else if (request.action === 'resumeSession') {
        resumeSession();
        sendResponse({ success: true });
    } else if (request.action === 'incrementBlockCount') {
        incrementBlockCount(request.site);
        sendResponse({ success: true });
    }
    return true; // Indicates we will respond asynchronously (best practice)
});

// Clear cache, cookies, and service workers for a specific domain
async function clearSiteData(domain) {
    console.log(`[Focus Flow] Clearing cache for ${domain}`);

    try {
        // Clear cache, cookies, and service workers for the domain
        await chrome.browsingData.remove(
            {
                origins: [
                    `https://${domain}`,
                    `http://${domain}`,
                    `https://www.${domain}`,
                    `http://www.${domain}`
                ]
            },
            {
                cache: true,
                cacheStorage: true,
                cookies: true,
                serviceWorkers: true
            }
        );
        console.log(`[Focus Flow] ✅ Cache cleared for ${domain}`);

        // Close any open tabs of this domain
        const tabs = await chrome.tabs.query({});
        const tabsToClose = tabs.filter(tab => {
            try {
                const url = new URL(tab.url);
                return url.hostname === domain ||
                    url.hostname === `www.${domain}` ||
                    url.hostname.endsWith(`.${domain}`);
            } catch {
                return false;
            }
        });

        if (tabsToClose.length > 0) {
            const tabIds = tabsToClose.map(tab => tab.id);
            await chrome.tabs.remove(tabIds);
            console.log(`[Focus Flow] ✅ Closed ${tabsToClose.length} tab(s) for ${domain}`);
        }
    } catch (error) {
        console.error(`[Focus Flow] Error clearing cache for ${domain}:`, error);
    }
}

function startSession(durationMinutes, hardMode) {
    const endTime = Date.now() + durationMinutes * 60000;
    chrome.storage.local.set({
        sessionState: { active: true, endTime, hardMode, duration: durationMinutes }
    });
    chrome.alarms.create('focusSession', { delayInMinutes: durationMinutes });
}

function stopSession(wasCompleted = false) {
    chrome.storage.local.get(['sessionState', 'stats'], (result) => {
        const state = result.sessionState;

        if (state?.active && state?.hardMode && !wasCompleted) {
            console.log('[Focus Flow] 🛡️ Cannot stop session - Hard Mode is ACTIVE');
            return;
        }

        const updates = {
            sessionState: {
                active: false,
                hardMode: false,
                paused: false,
                showCelebration: wasCompleted,
                duration: state?.duration || 0
            }
        };

        if (wasCompleted) {
            const stats = result.stats || { totalBlocks: 0, siteStats: {}, totalSessions: 0, totalFocusMinutes: 0, daily: {} };
            stats.totalSessions = (stats.totalSessions || 0) + 1;

            // Daily stats
            const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
            if (!stats.daily) stats.daily = {};
            if (!stats.daily[today]) {
                stats.daily[today] = { sessions: 0, minutes: 0 };
            }
            stats.daily[today].sessions += 1;

            if (state?.duration) {
                const mins = parseInt(state.duration);
                stats.totalFocusMinutes = (stats.totalFocusMinutes || 0) + mins;
                stats.daily[today].minutes += mins;
            }
            updates.stats = stats;
        }

        chrome.storage.local.set(updates, () => {
            chrome.alarms.clear('focusSession');
        });
    });
}

function pauseSession() {
    chrome.storage.local.get(['sessionState'], (result) => {
        const state = result.sessionState;
        if (state && state.active && !state.paused) {
            if (state.hardMode) {
                console.log('[Focus Flow] 🛡️ Cannot pause session - Hard Mode is ACTIVE');
                return;
            }
            const remainingTime = state.endTime - Date.now();
            chrome.storage.local.set({
                sessionState: { ...state, paused: true, remainingTime }
            });
            chrome.alarms.clear('focusSession');
        }
    });
}

function resumeSession() {
    chrome.storage.local.get(['sessionState'], (result) => {
        const state = result.sessionState;
        if (state && state.active && state.paused) {
            const endTime = Date.now() + state.remainingTime;
            chrome.storage.local.set({
                sessionState: { ...state, paused: false, endTime }
            });
            chrome.alarms.create('focusSession', { delayInMinutes: state.remainingTime / 60000 });
        }
    });
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'focusSession') {
        stopSession(true); // Natural completion
        // Notify user session is over with sound
        triggerSound();
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon128.png',
            title: 'Focus Session Complete!',
            message: 'Great job staying focused. Take a break!',
            priority: 2
        });
    }
});

async function triggerSound() {
    // Check if offscreen document already exists
    const hasOffscreen = await chrome.offscreen.hasDocument();
    if (!hasOffscreen) {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Play sound notification when focus session ends'
        });
    }
    // Send message to offscreen to play sound
    chrome.runtime.sendMessage({ action: 'playSound' });

    // Close offscreen after a few seconds to save resources
    setTimeout(() => {
        chrome.offscreen.closeDocument().catch(() => { });
    }, 15000);
}

function incrementBlockCount(site) {
    chrome.storage.local.get(['stats'], (result) => {
        const stats = result.stats || { totalBlocks: 0, siteStats: {} };
        stats.totalBlocks++;
        if (site) {
            stats.siteStats[site] = (stats.siteStats[site] || 0) + 1;
        }
        chrome.storage.local.set({ stats });
    });
}

let isUpdatingRules = false;
let pendingUpdate = null;

async function updateRules(sites) {
    // If already updating, just save the latest sites and return
    if (isUpdatingRules) {
        console.log('[Focus Flow] Update already in progress, queuing latest site list');
        pendingUpdate = sites;
        return;
    }

    isUpdatingRules = true;
    console.log('[Focus Flow] Starting updateRules with sites:', sites);

    try {
        // Get all current dynamic rules
        const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
        const currentRuleIds = currentRules.map(rule => rule.id);
        console.log('[Focus Flow] Removing existing rules:', currentRuleIds.length);

        // Expand sites list - handle edge cases
        let expandedSites = Array.isArray(sites) ? [...sites] : [];
        if (expandedSites.includes('x.com') && !expandedSites.includes('twitter.com')) {
            expandedSites.push('twitter.com');
        }
        if (expandedSites.includes('twitter.com') && !expandedSites.includes('x.com')) {
            expandedSites.push('x.com');
        }

        // DEDUPLICATE and sanitize
        const uniqueSites = [...new Set(expandedSites.filter(s => s && typeof s === 'string' && s.trim()))];
        console.log('[Focus Flow] Final unique sites to block:', uniqueSites);

        // Create new rules using requestDomains
        const newRules = uniqueSites.map((site, index) => ({
            id: index + 1,
            priority: 1,
            action: {
                type: 'redirect',
                redirect: { extensionPath: '/blocked.html' }
            },
            condition: {
                requestDomains: [site],
                resourceTypes: ['main_frame']
            }
        }));

        // Update rules: remove all old ones and add new ones
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: currentRuleIds,
            addRules: newRules
        });
        console.log(`[Focus Flow] ✅ Successfully applied ${newRules.length} rules`);

    } catch (error) {
        console.error('[Focus Flow] ❌ Error updating rules:', error);
    } finally {
        isUpdatingRules = false;
        // If a new update request came in while we were working, process it now
        if (pendingUpdate !== null) {
            const nextUpdate = pendingUpdate;
            pendingUpdate = null;
            console.log('[Focus Flow] Processing queued update...');
            updateRules(nextUpdate);
        }
    }
}

// Check schedule every minute and update rules accordingly
chrome.alarms.create('checkSchedule', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkSchedule') {
        checkAndApplySchedule();
    }
});

async function checkAndApplySchedule(newSitesToClear = []) {
    const result = await chrome.storage.local.get(['schedule', 'blockedSites']);
    const schedule = result.schedule;
    const allSites = result.blockedSites || [];

    let shouldBlock = false;

    if (!schedule || !schedule.enabled) {
        // Schedule disabled (or not set) -> Default behavior is ALWAYS BLOCK
        shouldBlock = true;
    } else {
        // Schedule is enabled -> Check if we are in the focus window
        const now = new Date();
        const currentDay = now.getDay();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        const [startHour, startMin] = schedule.startTime.split(':').map(Number);
        const [endHour, endMin] = schedule.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        const isActiveDay = schedule.days.includes(currentDay);
        // Handle overnight schedules (e.g. 10PM to 2AM)
        const isActiveTime = startMinutes <= endMinutes
            ? (currentTime >= startMinutes && currentTime <= endMinutes)
            : (currentTime >= startMinutes || currentTime <= endMinutes);

        shouldBlock = isActiveDay && isActiveTime;
    }

    if (shouldBlock) {
        // Schedule is active (or default) - block all sites
        console.log('[Focus Flow] Enforcing blocks (Schedule ' + (schedule?.enabled ? 'Active Window' : 'Default/Disabled') + ')');
        await updateRules(allSites);

        // Clear cache for newly added sites ONLY if we are actually blocking them
        if (newSitesToClear && newSitesToClear.length > 0) {
            newSitesToClear.forEach(site => clearSiteData(site));
        }
    } else {
        // Schedule is enabled but we are outside the window - remove all blocks
        console.log('[Focus Flow] Schedule enabled but outside focus window - removing blocks');
        await updateRules([]);
    }
}

// Run check on startup
checkAndApplySchedule();
