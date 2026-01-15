const quotes = [
    { text: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.", author: "Alexander Graham Bell" },
    { text: "Your focus determines your reality.", author: "Qui-Gon Jinn" },
    { text: "The secret of change is to focus all of your energy, not on fighting the old, but on building the new.", author: "Socrates" },
    { text: "Focusing is about saying No.", author: "Steve Jobs" },
    { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
    { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
    { text: "Focus is a matter of deciding what things you're not going to do.", author: "John Carmack" }
];

document.addEventListener('DOMContentLoaded', () => {
    const quoteElement = document.getElementById('quote');
    const authorElement = document.getElementById('author');
    const timerCountdown = document.getElementById('timerCountdown');
    const sessionTimerDiv = document.getElementById('sessionTimer');

    // Pick a random quote
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    quoteElement.textContent = `"${randomQuote.text}"`;
    authorElement.textContent = `— ${randomQuote.author}`;

    // Detect which site was blocked and notify background
    // Since we are redirected to blocked.html, we can't easily get the original URL from location.href
    // unless we pass it as a query param. However, DNR doesn't easily support dynamic query params on redirect.
    // We can use chrome.tabs.getCurrent or sender info if we used a different approach,
    // but for now let's just increment the total count.
    chrome.runtime.sendMessage({ action: 'incrementBlockCount' });

    // Add event listener for Go Back button
    const goBackBtn = document.getElementById('goBack');
    if (goBackBtn) {
        goBackBtn.addEventListener('click', () => {
            window.history.back();
        });
    }

    // Check for focus session
    chrome.storage.local.get(['sessionState'], (result) => {
        const state = result.sessionState;
        if (state?.active && state.endTime > Date.now()) {
            sessionTimerDiv.classList.remove('hidden');
            startTimer(state.endTime);
        }
    });

    function startTimer(endTime) {
        function update() {
            const now = Date.now();
            const remaining = endTime - now;

            if (remaining <= 0) {
                timerCountdown.innerText = "00:00";
                return;
            }

            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            timerCountdown.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        update();
        setInterval(update, 1000);
    }
});
