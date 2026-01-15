document.addEventListener('DOMContentLoaded', () => {
    const siteInput = document.getElementById('siteInput');
    const addButton = document.getElementById('addButton');
    const blockList = document.getElementById('blockList');

    // Load initial list
    chrome.storage.local.get(['blockedSites'], (result) => {
        const sites = result.blockedSites || [];
        renderList(sites);
    });

    addButton.addEventListener('click', () => {
        const site = siteInput.value.trim().toLowerCase();
        if (site) {
            addSite(site);
            siteInput.value = '';
        }
    });

    siteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const site = siteInput.value.trim().toLowerCase();
            if (site) {
                addSite(site);
                siteInput.value = '';
            }
        }
    });

    function renderList(sites) {
        blockList.innerHTML = '';
        sites.forEach((site) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="site-name">${site}</span>
                <button class="remove-btn" data-site="${site}">✕</button>
            `;
            blockList.appendChild(li);
        });

        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const siteToRemove = btn.getAttribute('data-site');
                removeSite(siteToRemove);
            });
        });
    }

    function addSite(site) {
        chrome.storage.local.get(['blockedSites'], (result) => {
            const sites = result.blockedSites || [];
            if (!sites.includes(site)) {
                const newSites = [...sites, site];
                chrome.storage.local.set({ blockedSites: newSites }, () => {
                    renderList(newSites);
                    notifyBackground(newSites);
                });
            }
        });
    }

    function removeSite(site) {
        chrome.storage.local.get(['blockedSites'], (result) => {
            const sites = result.blockedSites || [];
            const newSites = sites.filter(s => s !== site);
            chrome.storage.local.set({ blockedSites: newSites }, () => {
                renderList(newSites);
                notifyBackground(newSites);
            });
        });
    }

    function notifyBackground(sites) {
        // We can either rely on storage change listeners in background.js
        // or send an explicit message. Using message is more direct.
        chrome.runtime.sendMessage({ action: 'updateRules', sites: sites });
    }
});
