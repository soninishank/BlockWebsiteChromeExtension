# Focus Flow - Debugging Guide

## How to Debug the Extension

### Step 1: Reload the Extension
After making any code changes, you **MUST** reload the extension:

1. Go to `chrome://extensions/`
2. Find "Focus Flow"
3. Click the **reload icon** (circular arrow) on the extension card
4. **Important**: Just refreshing the popup is NOT enough!

### Step 2: Open the Right Console

There are **THREE different consoles** for Chrome extensions:

#### A. Popup Console (for popup.js)
1. **Right-click** on the extension icon in the toolbar
2. Select **"Inspect popup"**
3. This opens DevTools for the popup
4. Go to the **Console** tab
5. You should see: `[Focus Flow Popup] Script loaded and initializing...`

#### B. Background Service Worker Console (for background.js)
1. Go to `chrome://extensions/`
2. Find "Focus Flow"
3. Click **"service worker"** link (appears when the worker is active)
4. This opens DevTools for the background script
5. You should see: `[Focus Flow] Extension installed/updated`

#### C. Blocked Page Console (for blocked.js)
1. Try to visit a blocked site (e.g., x.com if you added it)
2. When redirected to the blocked page, press **F12** or **Cmd+Option+I**
3. This opens DevTools for the blocked page

### Step 3: Test Adding a Site

1. Open the popup (click the extension icon)
2. **Right-click** the popup and select **"Inspect"** to open DevTools
3. Go to the **Console** tab
4. Click on the "Sites" tab in the popup
5. Type `x.com` in the input field
6. Click "Add" or press Enter

### Expected Console Output

You should see these logs in the **Popup Console**:

```
[Focus Flow Popup] Script loaded and initializing...
[Focus Flow Popup] DOM Content Loaded
[Focus Flow Popup] Loaded from storage: {blockedSites: Array(0), sessionState: {...}}
[Popup] addSite called with: x.com
[Popup] Sanitized to: x.com
[Popup] Current sites in storage: []
[Popup] Adding site, new list: ['x.com']
[Popup] Storage updated successfully
[Popup] Message sent to background, response: {success: true}
```

And in the **Background Console**:

```
[Focus Flow] updateRules called with sites: ['x.com']
[Focus Flow] Current rule IDs to remove: []
[Focus Flow] New rules to add: [...]
[Focus Flow] ✅ Rules updated successfully!
[Focus Flow] Active dynamic rules: [...]
```

### Step 4: Verify the Blocking Works

1. Open a new tab
2. Navigate to `https://x.com`
3. You should be redirected to the blocked page with a motivational quote

### Common Issues

#### Issue: No console logs appear
**Solution**: 
- Make sure you're looking at the **Popup Console** (right-click popup → Inspect)
- NOT the regular page console
- Reload the extension at `chrome://extensions/`

#### Issue: "Unchecked runtime.lastError" still appears
**Solution**:
- Reload the extension completely
- Close and reopen the popup
- Check that background.js has the updated code with `sendResponse()`

#### Issue: Site doesn't get blocked
**Solution**:
- Check the Background Console for rule update logs
- Verify the rules were added: `chrome.declarativeNetRequest.getDynamicRules()`
- Make sure you're testing with the exact domain you added (e.g., `x.com` not `www.x.com`)

#### Issue: Extension ID mismatch error
**Solution**:
- The curl error you saw is from a DIFFERENT extension
- Ignore errors from extension IDs that don't match yours
- Find your extension ID at `chrome://extensions/`

### Checking Storage Manually

Open the Popup Console and run:

```javascript
chrome.storage.local.get(null, (result) => console.log(result));
```

This shows all stored data.

### Checking Active Rules Manually

Open the Background Console and run:

```javascript
chrome.declarativeNetRequest.getDynamicRules().then(rules => console.log(rules));
```

This shows all active blocking rules.

### Clear All Data (Reset)

If you want to start fresh:

```javascript
// Run in Popup or Background Console
chrome.storage.local.clear(() => console.log('Storage cleared'));
chrome.declarativeNetRequest.updateDynamicRules({
  removeRuleIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] // adjust as needed
});
```

## Quick Checklist

- [ ] Reloaded extension at `chrome://extensions/`
- [ ] Opened Popup Console (right-click popup → Inspect)
- [ ] Opened Background Console (click "service worker" link)
- [ ] Verified initial logs appear in both consoles
- [ ] Tested adding a site and checked console logs
- [ ] Verified site gets blocked when visited
- [ ] No errors in any console
