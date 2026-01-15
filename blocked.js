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

    // Pick a random quote
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

    quoteElement.textContent = `"${randomQuote.text}"`;
    authorElement.textContent = `— ${randomQuote.author}`;
});
