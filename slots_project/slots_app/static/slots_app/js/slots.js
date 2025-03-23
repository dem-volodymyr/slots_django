document.addEventListener('DOMContentLoaded', function() {
    // Game variables
    let isSpinning = false;
    let playerData = initialPlayerData;
    const reels = document.querySelectorAll('.reel');
    const spinButton = document.getElementById('spin-button');
    const balanceDisplay = document.getElementById('balance');
    const betSizeDisplay = document.getElementById('bet-size');
    const winMessage = document.getElementById('win-message');
    const decreaseBetButton = document.getElementById('decrease-bet');
    const increaseBetButton = document.getElementById('increase-bet');

    // Symbol image paths
    const symbolImages = {
        'diamond': '/static/slots_app/images/symbols/0_diamond.png',
        'floppy': '/static/slots_app/images/symbols/0_floppy.png',
        'hourglass': '/static/slots_app/images/symbols/0_hourglass.png',
        'seven': '/static/slots_app/images/symbols/0_seven.png',
        'telephone': '/static/slots_app/images/symbols/0_telephone.png'
    };

    // Initialize symbols on the reels
    initializeReels();

    // Spin button event listener
    spinButton.addEventListener('click', handleSpin);

    // Bet size controls
    decreaseBetButton.addEventListener('click', () => adjustBetSize(-5));
    increaseBetButton.addEventListener('click', () => adjustBetSize(5));

    // Keypress handler for spacebar
    document.addEventListener('keydown', function(event) {
        if (event.key === ' ' || event.code === 'Space') {
            event.preventDefault();
            if (!isSpinning) handleSpin();
        }
    });

    function initializeReels() {
        // Fill all symbol containers with random symbols initially
        document.querySelectorAll('.symbol-container').forEach(container => {
            const randomSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
            container.style.backgroundImage = `url(${symbolImages[randomSymbol]})`;
            container.dataset.symbol = randomSymbol;
        });
    }

    function handleSpin() {
        if (isSpinning) return;

        // Check if player has enough balance
        if (parseFloat(playerData.balance) < parseFloat(playerData.betSize)) {
            alert('Insufficient balance to place bet!');
            return;
        }

        isSpinning = true;
        spinButton.disabled = true;
        decreaseBetButton.disabled = true;
        increaseBetButton.disabled = true;

        // Clear any previous win messages
        winMessage.textContent = '';
        winMessage.classList.remove('win-animation');

        // Reset any highlighted symbols
        document.querySelectorAll('.symbol-container').forEach(container => {
            container.classList.remove('winning-symbol');
            container.classList.remove('non-winning-symbol');
        });

        // Start the spinning animation
        reels.forEach((reel, reelIndex) => {
            const symbols = reel.querySelectorAll('.symbol-container');

            // Add spinning class with staggered delay
            symbols.forEach((symbol, symbolIndex) => {
                symbol.style.transition = 'none';
                symbol.classList.add('spinning');

                // Stagger the spin start times
                setTimeout(() => {
                    symbol.style.transition = 'transform 0.1s linear';
                }, 50 * reelIndex);
            });
        });

        // Send the spin request to the server
        fetch('/api/spin/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                bet_size: playerData.betSize
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Stop the reels with staggered timing
            stopReels(data.result, data.win_data);

            // Update player data
            playerData = data.player_data;
            updateUI();

            // If there's a win, show it
            if (data.payout > 0) {
                setTimeout(() => {
                    showWinMessage(data.payout);
                }, 2500);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            stopReelsOnError();
        });
    }

    function stopReels(result, winData) {
        reels.forEach((reel, reelIndex) => {
            const symbols = reel.querySelectorAll('.symbol-container');

            // Delay the stopping of each reel
            setTimeout(() => {
                symbols.forEach((symbol, symbolIndex) => {
                    symbol.classList.remove('spinning');

                    // Update the symbol with result from the server
                    const symbolType = result[reelIndex][symbolIndex];
                    symbol.style.backgroundImage = `url(${symbolImages[symbolType.split('_')[0]]})`;
                    symbol.dataset.symbol = symbolType;
                });

                // Play stop sound effect (add audio implementation later)

                // If all reels have stopped spinning, enable the spin button
                if (reelIndex === 4) {
                    setTimeout(() => {
                        isSpinning = false;
                        spinButton.disabled = false;
                        decreaseBetButton.disabled = false;
                        increaseBetButton.disabled = false;

                        // Highlight winning combinations
                        highlightWinningSymbols(winData);
                    }, 500);
                }
            }, 500 + (reelIndex * 300)); // Stagger the stop times
        });
    }

    function stopReelsOnError() {
        reels.forEach((reel, reelIndex) => {
            const symbols = reel.querySelectorAll('.symbol-container');

            setTimeout(() => {
                symbols.forEach(symbol => {
                    symbol.classList.remove('spinning');
                });

                if (reelIndex === 4) {
                    isSpinning = false;
                    spinButton.disabled = false;
                    decreaseBetButton.disabled = false;
                    increaseBetButton.disabled = false;
                }
            }, 500 + (reelIndex * 300));
        });

        alert('An error occurred. Please try again.');
    }

    function highlightWinningSymbols(winData) {
        if (!winData) return;

        // First, fade out all symbols
        document.querySelectorAll('.symbol-container').forEach(container => {
            container.classList.add('non-winning-symbol');
        });

        // Then highlight winning symbols
        for (const [rowIndex, value] of Object.entries(winData)) {
            const [symbolType, columns] = value;

            // In our UI, rows are 1-indexed but reversed from backend
            // Row 1 from backend is actually the bottom row in UI (index 2)
            // Row 3 from backend is actually the top row in UI (index 0)
            const uiRowIndex = 3 - parseInt(rowIndex);

            columns.forEach(colIndex => {
                const reel = document.getElementById(`reel-${colIndex}`);
                const symbols = reel.querySelectorAll('.symbol-container');
                const symbolToHighlight = symbols[uiRowIndex];

                symbolToHighlight.classList.remove('non-winning-symbol');
                symbolToHighlight.classList.add('winning-symbol');
            });
        }
    }

    function showWinMessage(amount) {
        winMessage.textContent = `WIN! $${amount.toFixed(2)}`;
        winMessage.classList.add('win-animation');
    }

    function updateUI() {
        balanceDisplay.textContent = playerData.balance;
        betSizeDisplay.textContent = playerData.betSize;
    }

    function adjustBetSize(amount) {
        const currentBet = parseFloat(playerData.betSize);
        let newBet = currentBet + amount;

        // Limit bet size
        if (newBet < 5) newBet = 5;
        if (newBet > 100) newBet = 100;

        // Update bet size in UI and player data
        playerData.betSize = newBet.toFixed(2);
        betSizeDisplay.textContent = playerData.betSize;

        // Update bet size on server (optional, can implement later)
    }

    // Helper function to get CSRF token
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
});