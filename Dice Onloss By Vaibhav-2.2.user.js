// ==UserScript==
// @name         Dice Onloss By Vaibhav
// @namespace    https://stake.ac
// @version      2.2
// @description  Dice Onloss by Vaibhav – green toggles, Start/Stop lock, set values once
// @author       Vaibhav
// @include      *://*stake*/casino/games/dice*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ---------- helpers ----------
    function waitFor(selector, timeout = 8000) {
        return new Promise((resolve, reject) => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);
            const obs = new MutationObserver(() => {
                const found = document.querySelector(selector);
                if (found) { obs.disconnect(); resolve(found); }
            });
            obs.observe(document.body, { childList: true, subtree: true });
            setTimeout(() => { obs.disconnect(); reject(new Error('Timeout waiting for ' + selector)); }, timeout);
        });
    }

    function setNativeValue(input, value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    }

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    function log(msg, type = 'info') {
        const colors = { info: '#22c55e', error: '#ef4444', warn: '#f59e0b' };
        console.log('%c[Dice Onloss By Vaibhav] ' + msg, 'color:' + (colors[type] || '#94a3b8'));
        if (statusEl) {
            statusEl.textContent = msg;
            statusEl.style.color = colors[type] || '#94a3b8';
        }
    }

    // ---------- UI ----------
    const panel = document.createElement('div');
    panel.id = 'dice-onloss-panel';
    panel.innerHTML = `
        <div class="dop-header">
            <span>Dice Onloss By Vaibhav</span>
            <button id="dop-minimize" title="Minimize">−</button>
        </div>
        <div class="dop-body">
            <label>Bet Amount
                <input type="number" id="dop-amount" step="0.01" min="0" value="1.00">
            </label>
            <label>Number of Bets
                <input type="number" id="dop-bets" step="1" min="1" max="999999999" value="5">
            </label>
            <label>Multiplier
                <input type="number" id="dop-multiplier" step="0.0001" min="0.01" max="9900" value="0.9901" disabled>
            </label>

            <div class="dop-toggles">
                <button type="button" class="dop-switch" id="dop-101x" data-on="false">
                    <span class="dop-switch-label">1.01x</span>
                    <span class="dop-switch-track"><span class="dop-switch-thumb"></span></span>
                </button>
                <button type="button" class="dop-switch on" id="dop-onloss" data-on="true">
                    <span class="dop-switch-label">Onloss</span>
                    <span class="dop-switch-track"><span class="dop-switch-thumb"></span></span>
                </button>
            </div>

            <div class="dop-actions">
                <button id="dop-start">Start</button>
                <button id="dop-stop" disabled>Stop</button>
            </div>
            <div id="dop-status">Ready · Onloss ON</div>
        </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
        #dice-onloss-panel {
            position: fixed;
            top: 80px;
            right: 16px;
            z-index: 999999;
            width: 270px;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.55);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #e2e8f0;
            overflow: hidden;
            user-select: none;
        }
        #dice-onloss-panel .dop-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 14px;
            background: #0f172a;
            font-weight: 700;
            font-size: 13px;
            cursor: move;
        }
        #dice-onloss-panel .dop-header button {
            background: transparent;
            border: none;
            color: #94a3b8;
            font-size: 18px;
            cursor: pointer;
            line-height: 1;
            padding: 0 4px;
        }
        #dice-onloss-panel .dop-body {
            padding: 14px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        #dice-onloss-panel.minimized .dop-body { display: none; }
        #dice-onloss-panel label {
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-size: 12px;
            color: #94a3b8;
        }
        #dice-onloss-panel input[type="number"] {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 8px 10px;
            color: #e2e8f0;
            font-size: 14px;
            outline: none;
        }
        #dice-onloss-panel input[type="number"]:focus { border-color: #22c55e; }
        #dice-onloss-panel input[type="number"]:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            background: #111827;
        }

        #dice-onloss-panel .dop-toggles {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        #dice-onloss-panel .dop-switch {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            padding: 10px 12px;
            border-radius: 10px;
            border: 1px solid #334155;
            background: #0f172a;
            color: #94a3b8;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.18s ease;
        }
        #dice-onloss-panel .dop-switch .dop-switch-track {
            position: relative;
            width: 44px;
            height: 24px;
            border-radius: 999px;
            background: #475569;
            transition: background 0.18s ease;
            flex-shrink: 0;
        }
        #dice-onloss-panel .dop-switch .dop-switch-thumb {
            position: absolute;
            top: 3px;
            left: 3px;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #e2e8f0;
            transition: transform 0.18s ease;
        }
        #dice-onloss-panel .dop-switch.on {
            border-color: #22c55e;
            background: rgba(34, 197, 94, 0.12);
            color: #22c55e;
        }
        #dice-onloss-panel .dop-switch.on .dop-switch-track {
            background: #22c55e;
        }
        #dice-onloss-panel .dop-switch.on .dop-switch-thumb {
            transform: translateX(20px);
            background: #fff;
        }
        #dice-onloss-panel .dop-switch:active { transform: scale(0.98); }

        #dice-onloss-panel .dop-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }
        #dice-onloss-panel #dop-start {
            background: #22c55e;
            color: #0f172a;
            border: none;
            border-radius: 8px;
            padding: 10px;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
        }
        #dice-onloss-panel #dop-start:hover { background: #16a34a; }
        #dice-onloss-panel #dop-start:disabled {
            opacity: 0.45;
            cursor: not-allowed;
            background: #166534;
        }
        #dice-onloss-panel #dop-stop {
            background: #ef4444;
            color: #fff;
            border: none;
            border-radius: 8px;
            padding: 10px;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
        }
        #dice-onloss-panel #dop-stop:hover { background: #dc2626; }
        #dice-onloss-panel #dop-stop:disabled {
            opacity: 0.45;
            cursor: not-allowed;
            background: #7f1d1d;
        }
        #dice-onloss-panel #dop-status {
            font-size: 11px;
            color: #94a3b8;
            text-align: center;
            min-height: 16px;
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(panel);

    // Drag
    (function makeDraggable() {
        const header = panel.querySelector('.dop-header');
        let dragging = false, sx, sy, sl, st;
        header.addEventListener('mousedown', e => {
            if (e.target.id === 'dop-minimize') return;
            dragging = true;
            sx = e.clientX; sy = e.clientY;
            const r = panel.getBoundingClientRect();
            sl = r.left; st = r.top;
            panel.style.right = 'auto';
            panel.style.left = sl + 'px';
            panel.style.top = st + 'px';
        });
        document.addEventListener('mousemove', e => {
            if (!dragging) return;
            panel.style.left = (sl + e.clientX - sx) + 'px';
            panel.style.top = (st + e.clientY - sy) + 'px';
        });
        document.addEventListener('mouseup', () => { dragging = false; });
    })();

    document.getElementById('dop-minimize').addEventListener('click', () => {
        panel.classList.toggle('minimized');
        document.getElementById('dop-minimize').textContent =
            panel.classList.contains('minimized') ? '+' : '−';
    });

    const statusEl = document.getElementById('dop-status');
    const startBtn = document.getElementById('dop-start');
    const stopBtn = document.getElementById('dop-stop');
    const amountEl = document.getElementById('dop-amount');
    const betsEl = document.getElementById('dop-bets');
    const multiplierEl = document.getElementById('dop-multiplier');
    const btn101 = document.getElementById('dop-101x');
    const btnOnloss = document.getElementById('dop-onloss');

    let isRunning = false;

    function setRunning(running) {
        isRunning = running;
        startBtn.disabled = running;
        stopBtn.disabled = !running;
    }

    function isOn(btn) {
        return btn.dataset.on === 'true';
    }

    function setOn(btn, on) {
        btn.dataset.on = on ? 'true' : 'false';
        btn.classList.toggle('on', on);
    }

    function updateMultiplierUI() {
        const on101 = isOn(btn101);
        const onOnloss = isOn(btnOnloss);

        if (on101 || onOnloss) {
            multiplierEl.disabled = true;
            multiplierEl.value = on101 ? '1.0102' : '0.9901';
        } else {
            multiplierEl.disabled = false;
        }

        if (!isRunning) {
            if (onOnloss) log('Onloss ON · multiplier locked to 0.9901');
            else if (on101) log('1.01x ON · multiplier locked to 1.0102');
            else log('Manual mode · type your multiplier');
        }
    }

    btn101.addEventListener('click', () => {
        const turningOn = !isOn(btn101);
        setOn(btn101, turningOn);
        if (turningOn) setOn(btnOnloss, false);
        updateMultiplierUI();
    });

    btnOnloss.addEventListener('click', () => {
        const turningOn = !isOn(btnOnloss);
        setOn(btnOnloss, turningOn);
        if (turningOn) setOn(btn101, false);
        updateMultiplierUI();
    });

    updateMultiplierUI();
    setRunning(false); // Start enabled, Stop disabled

    // ---------- Start (set values ONCE, then leave the site alone) ----------
    async function runStart() {
        if (isRunning) return;
        startBtn.disabled = true;
        try {
            const amount = amountEl.value;
            const numBets = betsEl.value;

            let multiplier;
            if (isOn(btn101)) multiplier = '1.0102';
            else if (isOn(btnOnloss)) multiplier = '0.9901';
            else multiplier = multiplierEl.value;

            if (!amount || parseFloat(amount) <= 0) { log('Enter a valid bet amount', 'error'); startBtn.disabled = false; return; }
            if (!numBets || parseInt(numBets) < 1) { log('Enter number of bets (≥1)', 'error'); startBtn.disabled = false; return; }
            if (!multiplier || parseFloat(multiplier) <= 0) { log('Enter a valid multiplier', 'error'); startBtn.disabled = false; return; }

            log('Clicking Auto tab…');
            const autoTab = await waitFor('button[data-testid="auto-tab"]');
            autoTab.click();
            await sleep(700);

            // Set values only once
            log('Setting bet amount…');
            const amountInput = await waitFor('input[data-testid="input-game-amount"]');
            setNativeValue(amountInput, amount);
            await sleep(250);

            log('Setting number of bets…');
            const limitInput = await waitFor('input[data-testid="limit-input"]');
            setNativeValue(limitInput, numBets);
            await sleep(250);

            log('Setting multiplier to ' + multiplier + '…');
            const payoutInput = await waitFor('input[data-testid="payout"]');
            setNativeValue(payoutInput, multiplier);
            await sleep(350);

            if (parseFloat(multiplier) < 1.0102) {
                log('Unlocking Start button…');
                const unlock = () => {
                    const b = document.querySelector('button[data-testid="auto-bet-button"][data-autobet-status="start"]');
                    if (b) {
                        b.removeAttribute('disabled');
                        b.classList.remove('disabled');
                        b.disabled = false;
                        return true;
                    }
                    return false;
                };
                if (!unlock()) { await sleep(400); unlock(); }
                await sleep(200);
            }

            log('Starting autobet…');
            const startAutobetBtn = await waitFor('button[data-testid="auto-bet-button"][data-autobet-status="start"]');
            startAutobetBtn.removeAttribute('disabled');
            startAutobetBtn.disabled = false;
            startAutobetBtn.click();

            setRunning(true);
            log('Autobet running… (only Stop available)', 'info');
        } catch (err) {
            log('Error: ' + err.message, 'error');
            console.error(err);
            setRunning(false);
        }
    }

    // ---------- Stop ----------
    async function runStop() {
        if (!isRunning) return;
        stopBtn.disabled = true;
        try {
            log('Stopping autobet…');
            const stopBtnEl = document.querySelector('button[data-testid="auto-bet-button"][data-autobet-status="stop"]');
            if (stopBtnEl) {
                stopBtnEl.click();
                log('Autobet stopped · Start available again', 'info');
            } else {
                log('Stop button not found on page (already stopped?)', 'warn');
            }
        } catch (err) {
            log('Error: ' + err.message, 'error');
            console.error(err);
        } finally {
            setRunning(false); // re-enable Start, disable Stop
        }
    }

    startBtn.addEventListener('click', runStart);
    stopBtn.addEventListener('click', runStop);
})();
