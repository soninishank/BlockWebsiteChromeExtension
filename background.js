chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['blockedSites'], (result) => {
        const sites = result.blockedSites || [];
        updateRules(sites);
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateRules') {
        updateRules(request.sites);
    }
});

async function updateRules(sites) {
    // Get all current dynamic rules
    const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
    const currentRuleIds = currentRules.map(rule => rule.id);

    // Create new rules
    const newRules = sites.map((site, index) => {
        // We use index + 1 as the rule ID (must be unique and >= 1)
        return {
            id: index + 1,
            priority: 1,
            action: {
                type: 'redirect',
                redirect: {
                    extensionPath: '/blocked.html'
                }
            },
            condition: {
                urlFilter: site,
                resourceTypes: ['main_frame']
            }
        };
    });

    // Update rules: remove all old ones and add new ones
    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: currentRuleIds,
            addRules: newRules
        });
        console.log('Rules updated successfully:', newRules);
    } catch (error) {
        console.error('Error updating rules:', error);
    }
}
