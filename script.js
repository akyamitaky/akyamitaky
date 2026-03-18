// --- Data Tree (Menu Items based on RS HX Manual) ---
const MENU_TREE = {
    'MSG':  ['FLASH MESSAGE', 'AMD LIST', 'SHORT MESSAGE'],
    'STAT': ['SNGL FREQ', 'DUAL TX', 'DUAL RX', 'POWER', 'DIG COMM', 'MODEM RATE'], 
    'MORE': ['BIT', 'ANT', 'GPS', 'ERASE'], // NEW: MORE now opens a vertical list
    'BIT':  ['BATTERY', 'SYSTEM RCV'],
    'ANT':  ['WHIP', 'DIPOLE', 'LONG WIRE'],
    'GPS':  ['GPS ON', 'NEXT SCREEN', 'GPS OFF'],
    'ERASE':['CONFIRM ERASE']
};

// The Taskbar is now permanently locked to these 4 default options
const TASKBAR_ITEMS = ['MSG', 'STAT', 'PRG', 'MORE'];

// --- Application State ---
let appState = 'IDLE'; // States: IDLE, TASKBAR_NAV, SUBMENU_NAV, PARAM_NAV, FREQ_EDIT_NAV
let tbIndex = 0;       
let subMenuIndex = 0;  
let currentList = [];  
let currentParentMenu = ''; 
let inactivityTimer = null; 

// --- Radio Variables ---
let opModeState = 'CLR'; 
let channelBank = 6; 
let freqMode = 'SNGL FREQ'; 
let currentPower = 'HIGH';  

let freqSngl = [0, 6, 5, 0, 0, 0, 0];
let freqTx   = [0, 8, 2, 5, 0, 0, 0];
let freqRx   = [0, 9, 1, 2, 5, 0, 0];

// Edit State Variables
let paramOptions = [];
let paramIndex = 0;
let paramCallback = null;

let activeFreqArray = [];
let freqEditIndex = 0;
let currentFreqType = ''; 

// --- Helpers ---
function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (appState !== 'IDLE') {
        inactivityTimer = setTimeout(() => showHomeView(), 6000); 
    }
}

function getPrgMenu() {
    if (freqMode === 'DUAL FREQ') {
        return ['CHAN BANK', 'FREQ MNG', 'DUAL TX', 'DUAL RX', 'POWER', 'SELF ID', 'PASSWORD'];
    }
    return ['CHAN BANK', 'FREQ MNG', 'SNGL FREQ', 'POWER', 'SELF ID', 'PASSWORD'];
}

function formatFreqString(arr) {
    return `${arr[0]}${arr[1]}.${arr[2]}${arr[3]}${arr[4]}${arr[5]}${arr[6]}`;
}

// --- Display Functions ---
function updateOpModeDisplay() {
    const opModeEl = document.getElementById('op-mode');
    if (opModeState === 'SEC') opModeEl.innerText = "SEC 1";
    else if (opModeState === 'CLR') opModeEl.innerText = "CLR 0";
    else if (opModeState === 'AJ') opModeEl.innerText = "A.J 1";
}

function updateMainDisplay() {
    document.getElementById('freq-mode').innerText = freqMode;
    const dialVal = document.getElementById('ch-dial-display').innerText;
    document.getElementById('ch-display-large').innerText = `${channelBank}${dialVal}`;
    
    if (freqMode === 'DUAL FREQ') {
        document.getElementById('freq-display').innerText = formatFreqString(freqRx);
    } else {
        document.getElementById('freq-display').innerText = formatFreqString(freqSngl);
    }
}

function renderTaskbar() {
    const tb = document.getElementById('taskbar');
    tb.innerHTML = '';
    
    // Always render the 4 default items
    TASKBAR_ITEMS.forEach((item, index) => {
        const span = document.createElement('span');
        span.className = 'task-item';
        span.innerText = `[${item}]`;
        span.onclick = () => { 
            if(appState === 'IDLE') appState = 'TASKBAR_NAV'; 
            resetInactivityTimer();
            handleTaskbarSelection(item); 
        };
        
        // Only highlight if we are actively navigating the taskbar
        if (appState === 'TASKBAR_NAV' && index === tbIndex) {
            span.classList.add('highlighted');
        }
        tb.appendChild(span);
    });
}

// --- View Switchers ---
function hideAllViews() {
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('list-view').style.display = 'none';
    document.getElementById('param-view').style.display = 'none';
    document.getElementById('freq-edit-view').style.display = 'none';
}

function showHomeView() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    hideAllViews();
    document.getElementById('home-view').style.display = 'flex';
    appState = 'IDLE';
    updateMainDisplay();
    renderTaskbar(); // Draws the default unhighlighted taskbar
}

function showListView(title, listData) {
    appState = 'SUBMENU_NAV';
    currentList = listData;
    currentParentMenu = title; 
    subMenuIndex = 0; 
    
    hideAllViews();
    document.getElementById('list-view').style.display = 'flex';
    document.getElementById('list-title').innerText = title;
    renderListItems();
}

function showParamBox(title, options, defaultIndex, callback) {
    appState = 'PARAM_NAV';
    paramOptions = options;
    paramIndex = defaultIndex;
    paramCallback = callback;

    hideAllViews();
    document.getElementById('param-view').style.display = 'flex';
    document.getElementById('param-title').innerText = title;
    document.getElementById('param-value').innerText = paramOptions[paramIndex];
}

function showFreqEditBox(title, freqType) {
    appState = 'FREQ_EDIT_NAV';
    currentFreqType = freqType;
    freqEditIndex = 0; 
    
    if (freqType === 'SNGL') activeFreqArray = [...freqSngl];
    if (freqType === 'TX') activeFreqArray = [...freqTx];
    if (freqType === 'RX') activeFreqArray = [...freqRx];

    hideAllViews();
    document.getElementById('freq-edit-view').style.display = 'flex';
    document.getElementById('freq-edit-title').innerText = title;
    renderFreqEditDigits();
}

function renderFreqEditDigits() {
    const container = document.getElementById('freq-edit-container');
    container.innerHTML = '';
    
    activeFreqArray.forEach((digit, index) => {
        const span = document.createElement('span');
        span.innerText = digit;
        if (index === freqEditIndex) span.classList.add('blinking-cursor');
        container.appendChild(span);
        if (index === 1) {
            const dot = document.createElement('span');
            dot.innerText = '.';
            container.appendChild(dot);
        }
    });
}

function renderListItems() {
    const container = document.getElementById('list-container');
    container.innerHTML = '';
    let start = Math.max(0, subMenuIndex - 1);
    let end = Math.min(currentList.length, start + 4);
    if (end - start < 4 && currentList.length >= 4) start = end - 4;

    for (let i = start; i < end; i++) {
        const div = document.createElement('div');
        div.className = 'list-item';
        if (i === subMenuIndex) div.classList.add('selected');
        div.innerText = (i === subMenuIndex ? "▶ " : "  ") + currentList[i];
        container.appendChild(div);
    }
}

function handleTaskbarSelection(option) {
    if (option === 'PRG') { 
        showListView('PRG', getPrgMenu()); 
    } else if (MENU_TREE[option]) { 
        showListView(option, MENU_TREE[option]); 
    }
}

// --- MAIN KEYPAD CONTROLLER ---
function press(key) {
    const scr = document.getElementById('screen');
    resetInactivityTimer();

    // 1. IDLE
    if (appState === 'IDLE') {
        if (key === 'LITE') { scr.style.filter = scr.style.filter === 'brightness(1.5)' ? 'brightness(1)' : 'brightness(1.5)'; } 
        else if (key === 'CLR') { opModeState = 'CLR'; updateOpModeDisplay(); } 
        else if (key === 'SEC') { opModeState = 'SEC'; updateOpModeDisplay(); } 
        else if (key === 'AJ')  { opModeState = 'AJ'; updateOpModeDisplay(); } 
        else if (key === 'FNC') { appState = 'TASKBAR_NAV'; tbIndex = 0; renderTaskbar(); }
        return;
    }

    // 2. TASKBAR (Always the default 4 items)
    if (appState === 'TASKBAR_NAV') {
        if (key === 'LITE') { showHomeView(); } 
        else if (key === 'AJ') { 
            tbIndex = (tbIndex + 1) % TASKBAR_ITEMS.length; 
            renderTaskbar(); 
        } 
        else if (key === 'CLR' || key === 'SEC') { 
            // Optional: allow left/backwards navigation
            tbIndex = (tbIndex - 1 + TASKBAR_ITEMS.length) % TASKBAR_ITEMS.length; 
            renderTaskbar(); 
        } 
        else if (key === 'FNC') { 
            handleTaskbarSelection(TASKBAR_ITEMS[tbIndex]); 
        }
        return;
    }

    // 3. SUBMENU LISTS
    if (appState === 'SUBMENU_NAV') {
        if (key === 'LITE') {
            // Nested Menu logic: If we are deep in a secondary menu, go back to MORE
            if (['BIT', 'ANT', 'GPS', 'ERASE'].includes(currentParentMenu)) {
                showListView('MORE', MENU_TREE['MORE']);
            } else {
                showHomeView(); 
                appState = 'TASKBAR_NAV';
                renderTaskbar(); 
            }
        } 
        else if (key === 'CLR') { subMenuIndex = (subMenuIndex + 1) % currentList.length; renderListItems(); } 
        else if (key === 'SEC') { subMenuIndex = (subMenuIndex - 1 + currentList.length) % currentList.length; renderListItems(); } 
        else if (key === 'FNC') {
            const selection = currentList[subMenuIndex];
            
            // Handle opening secondary menus from MORE
            if (currentParentMenu === 'MORE' && MENU_TREE[selection]) {
                showListView(selection, MENU_TREE[selection]);
                return;
            }

            // Handle specific menu items
            if (selection === 'FREQ MNG') {
                showParamBox('FREQ MNG', ['SNGL FREQ', 'DUAL FREQ'], freqMode === 'DUAL FREQ' ? 1 : 0, (val) => { freqMode = val; });
            } else if (selection === 'SNGL FREQ') {
                showFreqEditBox('SNGL FREQ', 'SNGL');
            } else if (selection === 'DUAL TX') {
                showFreqEditBox('DUAL TX', 'TX');
            } else if (selection === 'DUAL RX') {
                showFreqEditBox('DUAL RX', 'RX');
            } else if (selection === 'CHAN BANK') {
                showParamBox('CHAN BANK', ['0','1','2','3','4','5','6','7','8','9'], channelBank, (val) => { channelBank = parseInt(val); });
            } else if (selection === 'PASSWORD') {
                showParamBox('PASSWORD', ['00000','10000','20000'], 0, null);
            } else if (selection === 'POWER') {
                const pwrOpts = ['ADAPTIVE', 'HIGH', 'MED', 'LOW', 'RCV ONLY'];
                let idx = pwrOpts.indexOf(currentPower);
                showParamBox('POWER', pwrOpts, idx !== -1 ? idx : 1, (val) => { currentPower = val; });
            } else {
                document.getElementById('list-title').innerText = "SAVED";
                setTimeout(() => showHomeView(), 800);
            }
        }
        return;
    }

    // 4. PARAMETER EDITING
    if (appState === 'PARAM_NAV') {
        if (key === 'LITE') { showListView(currentParentMenu, currentParentMenu === 'PRG' ? getPrgMenu() : MENU_TREE[currentParentMenu]); }
        else if (key === 'CLR') { paramIndex = (paramIndex - 1 + paramOptions.length) % paramOptions.length; document.getElementById('param-value').innerText = paramOptions[paramIndex]; }
        else if (key === 'SEC') { paramIndex = (paramIndex + 1) % paramOptions.length; document.getElementById('param-value').innerText = paramOptions[paramIndex]; }
        else if (key === 'FNC') {
            if (paramCallback) paramCallback(paramOptions[paramIndex]);
            showListView(currentParentMenu, currentParentMenu === 'PRG' ? getPrgMenu() : MENU_TREE[currentParentMenu]);
        }
        return;
    }

    // 5. FREQUENCY DIGIT EDITING
    if (appState === 'FREQ_EDIT_NAV') {
        if (key === 'LITE') { showListView(currentParentMenu, getPrgMenu()); }
        else if (key === 'AJ') { freqEditIndex = (freqEditIndex + 1) % 7; renderFreqEditDigits(); }
        else if (key === 'SEC') { 
            let max = (freqEditIndex === 0) ? 2 : 9; 
            activeFreqArray[freqEditIndex]++;
            if(activeFreqArray[freqEditIndex] > max) activeFreqArray[freqEditIndex] = 0;
            renderFreqEditDigits();
        }
        else if (key === 'CLR') { 
            let max = (freqEditIndex === 0) ? 2 : 9;
            activeFreqArray[freqEditIndex]--;
            if(activeFreqArray[freqEditIndex] < 0) activeFreqArray[freqEditIndex] = max;
            renderFreqEditDigits();
        }
        else if (key === 'FNC') {
            if (currentFreqType === 'SNGL') freqSngl = [...activeFreqArray];
            if (currentFreqType === 'TX') freqTx = [...activeFreqArray];
            if (currentFreqType === 'RX') freqRx = [...activeFreqArray];
            showListView(currentParentMenu, getPrgMenu());
        }
        return;
    }
}

// --- Rotary Dial Logic ---
const knob = document.getElementById('channel-knob');
let isDragging = false, currentAngle = 0, startAngle = 0, center = { x: 0, y: 0 };
knob.addEventListener('pointerdown', (e) => {
    isDragging = true;
    const rect = knob.getBoundingClientRect();
    center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    startAngle = Math.atan2(e.clientY - center.y, e.clientX - center.x) * (180 / Math.PI) - currentAngle;
    knob.setPointerCapture(e.pointerId);
});

knob.addEventListener('pointermove', (e) => {
    if (!isDragging || appState !== 'IDLE') return; 
    resetInactivityTimer();
    let angle = Math.atan2(e.clientY - center.y, e.clientX - center.x) * (180 / Math.PI);
    currentAngle = angle - startAngle;
    knob.style.transform = `rotate(${currentAngle}deg)`;
    let onesDigit = Math.round(currentAngle / 36) % 10;
    if (onesDigit < 0) { onesDigit += 10; } 
    document.getElementById('ch-dial-display').innerText = onesDigit;
    updateMainDisplay();
});

knob.addEventListener('pointerup', () => isDragging = false);

// Initialize the Radio
updateOpModeDisplay();
updateMainDisplay();
showHomeView();
