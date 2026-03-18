// --- Data Tree (Menu Items based on RS HX Manual) ---
const MENU_TREE = {
    'MSG':  ['FLASH MESSAGE', 'AMD LIST', 'SHORT MESSAGE'],
    'STAT': ['SNGL FREQ', 'DUAL TX', 'DUAL RX', 'POWER', 'DIG COMM', 'MODEM RATE'], 
    'BIT':  ['BATTERY', 'SYSTEM RCV'],
    'ANT':  ['WHIP', 'DIPOLE', 'LONG WIRE'],
    'GPS':  ['GPS ON', 'NEXT SCREEN', 'GPS OFF'],
    'ERASE':['CONFIRM ERASE']
};

const TASKBAR_PAGES = [
    ['MSG', 'STAT', 'PRG', 'MORE'],
    ['BIT', 'ANT', 'GPS', 'MORE2'],
    ['ERASE', '', '', 'BACK']
];

// --- 100 Channel Database Generation (Mobile Safe) ---
function generateRandomFreq() {
    var min = 150000; 
    var max = 2999999;
    var rand = Math.floor(Math.random() * (max - min + 1)) + min;
    var str = String(rand);
    
    while (str.length < 7) {
        str = '0' + str;
    }
    
    var arr = [];
    for(var i = 0; i < str.length; i++) {
        arr.push(parseInt(str[i]));
    }
    return arr;
}

var channels = [];
for (var i = 0; i < 100; i++) {
    channels.push({
        freqSngl: generateRandomFreq(),
        freqTx: generateRandomFreq(),
        freqRx: generateRandomFreq(),
        freqMode: 'SNGL FREQ',
        power: 'HIGH'
    });
}

// --- Application State ---
let currentTaskbarPage = 0;
let appState = 'IDLE'; 
let tbIndex = 0;       
let subMenuIndex = 0;  
let currentList = [];  
let currentParentMenu = ''; 
let inactivityTimer = null; 

// --- Active Radio Variables ---
let opModeState = 'CLR'; 
let channelBank = 6; 
let currentDial = 0; 

// Working Memory for the selected channel
let freqMode = 'SNGL FREQ'; 
let currentPower = 'HIGH';  
let freqSngl = [];
let freqTx = [];
let freqRx = [];

let paramOptions = [];
let paramIndex = 0;
let paramCallback = null;
let activeFreqArray = [];
let freqEditIndex = 0;
let currentFreqType = ''; 

// --- Channel Memory Managers ---
function updateActiveChannel() {
    let chIndex = (channelBank * 10) + currentDial;
    let slot = channels[chIndex];
    
    freqSngl = slot.freqSngl.slice();
    freqTx = slot.freqTx.slice();
    freqRx = slot.freqRx.slice();
    freqMode = slot.freqMode;
    currentPower = slot.power;
    
    updateMainDisplay();
}

function saveCurrentChannel() {
    let chIndex = (channelBank * 10) + currentDial;
    channels[chIndex].freqSngl = freqSngl.slice();
    channels[chIndex].freqTx = freqTx.slice();
    channels[chIndex].freqRx = freqRx.slice();
    channels[chIndex].freqMode = freqMode;
    channels[chIndex].power = currentPower;
}

// --- Helpers ---
function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (appState !== 'IDLE') {
        inactivityTimer = setTimeout(() => showHomeView(), 6000); 
    }
}

function getPrgMenu() {
    if (freqMode === 'DUAL FREQ') return ['CHAN BANK', 'FREQ MNG', 'DUAL TX', 'DUAL RX', 'POWER', 'SELF ID', 'PASSWORD'];
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
    document.getElementById('ch-dial-display').innerText = currentDial;
    document.getElementById('ch-display-large').innerText = `${channelBank}${currentDial}`;
    
    if (freqMode === 'DUAL FREQ') document.getElementById('freq-display').innerText = formatFreqString(freqRx);
    else document.getElementById('freq-display').innerText = formatFreqString(freqSngl);
}

function renderTaskbar() {
    const tb = document.getElementById('taskbar');
    tb.innerHTML = '';
    TASKBAR_PAGES[currentTaskbarPage].forEach((item, index) => {
        if (item === '') return;
        const span = document.createElement('span');
        span.className = 'task-item';
        span.innerText = `[${item}]`;
        span.onclick = () => { 
            if(appState === 'IDLE') appState = 'TASKBAR_NAV'; 
            resetInactivityTimer();
            handleTaskbarSelection(item); 
        };
        if (appState === 'TASKBAR_NAV' && index === tbIndex) span.classList.add('highlighted');
        tb.appendChild(span);
    });
}

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
    currentTaskbarPage = 0; 
    updateMainDisplay();
    renderTaskbar(); 
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
    if (freqType === 'SNGL') activeFreqArray = freqSngl.slice();
    if (freqType === 'TX') activeFreqArray = freqTx.slice();
    if (freqType === 'RX') activeFreqArray = freqRx.slice();
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
    if (option === 'MORE') { currentTaskbarPage = 1; tbIndex = 0; renderTaskbar(); } 
    else if (option === 'MORE2') { currentTaskbarPage = 2; tbIndex = 0; renderTaskbar(); } 
    else if (option === 'BACK') { currentTaskbarPage = 0; tbIndex = 0; renderTaskbar(); } 
    else if (option === 'PRG') { showListView('PRG', getPrgMenu()); }
    else if (MENU_TREE[option]) { showListView(option, MENU_TREE[option]); }
}

function press(key) {
    const scr = document.getElementById('screen');
    resetInactivityTimer();

    if (appState === 'IDLE') {
        if (key === 'LITE') { scr.style.filter = scr.style.filter === 'brightness(1.5)' ? 'brightness(1)' : 'brightness(1.5)'; } 
        else if (key === 'CLR') { opModeState = 'CLR'; updateOpModeDisplay(); } 
        else if (key === 'SEC') { opModeState = 'SEC'; updateOpModeDisplay(); } 
        else if (key === 'AJ')  { opModeState = 'AJ'; updateOpModeDisplay(); } 
        else if (key === 'FNC') { 
            appState = 'TASKBAR_NAV'; 
            tbIndex = 0; 
            renderTaskbar(); 
        }
        return;
    }

    if (appState === 'TASKBAR_NAV') {
        const pageLength = TASKBAR_PAGES[currentTaskbarPage].filter(x => x !== '').length;
        if (key === 'LITE') { showHomeView(); } 
        else if (key === 'AJ') { tbIndex = (tbIndex + 1) % pageLength; renderTaskbar(); } 
        else if (key === 'CLR') { currentTaskbarPage = (currentTaskbarPage + 1) % TASKBAR_PAGES.length; tbIndex = 0; renderTaskbar(); } 
        else if (key === 'SEC') { currentTaskbarPage = (currentTaskbarPage - 1 + TASKBAR_PAGES.length) % TASKBAR_PAGES.length; tbIndex = 0; renderTaskbar(); } 
        else if (key === 'FNC') { handleTaskbarSelection(TASKBAR_PAGES[currentTaskbarPage][tbIndex]); }
        return;
    }

    if (appState === 'SUBMENU_NAV') {
        // FIX: LITE button now strictly exits cleanly back to IDLE
        if (key === 'LITE') {
            showHomeView();
        } 
        else if (key === 'CLR') { subMenuIndex = (subMenuIndex + 1) % currentList.length; renderListItems(); } 
        else if (key === 'SEC') { subMenuIndex = (subMenuIndex - 1 + currentList.length) % currentList.length; renderListItems(); } 
        else if (key === 'FNC') {
            const selection = currentList[subMenuIndex];
            if (selection === 'FREQ MNG') { 
                showParamBox('FREQ MNG', ['SNGL FREQ', 'DUAL FREQ'], freqMode === 'DUAL FREQ' ? 1 : 0, (val) => { freqMode = val; saveCurrentChannel(); }); 
            } 
            else if (selection === 'SNGL FREQ') { showFreqEditBox('SNGL FREQ', 'SNGL'); } 
            else if (selection === 'DUAL TX') { showFreqEditBox('DUAL TX', 'TX'); } 
            else if (selection === 'DUAL RX') { showFreqEditBox('DUAL RX', 'RX'); } 
            else if (selection === 'CHAN BANK') { 
                showParamBox('CHAN BANK', ['0','1','2','3','4','5','6','7','8','9'], channelBank, (val) => { 
                    channelBank = parseInt(val); 
                    updateActiveChannel(); 
                }); 
            } 
            else if (selection === 'PASSWORD') { showParamBox('PASSWORD', ['00000','10000','20000'], 0, null); } 
            else if (selection === 'POWER') {
                const pwrOpts = ['ADAPTIVE', 'HIGH', 'MED', 'LOW', 'RCV ONLY'];
                let idx = pwrOpts.indexOf(currentPower);
                showParamBox('POWER', pwrOpts, idx !== -1 ? idx : 1, (val) => { currentPower = val; saveCurrentChannel(); });
            } 
            else {
                document.getElementById('list-title').innerText = "SAVED";
                setTimeout(() => showHomeView(), 800);
            }
        }
        return;
    }

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
            let freqFloat = parseFloat(formatFreqString(activeFreqArray));
            
            if (freqFloat < 1.5) {
                const titleEl = document.getElementById('freq-edit-title');
                const oldTitle = titleEl.innerText;
                titleEl.innerText = "INVALID";
                setTimeout(() => { titleEl.innerText = oldTitle; }, 1000);
                return; 
            }

            if (currentFreqType === 'SNGL') freqSngl = activeFreqArray.slice();
            if (currentFreqType === 'TX') freqTx = activeFreqArray.slice();
            if (currentFreqType === 'RX') freqRx = activeFreqArray.slice();
            
            saveCurrentChannel();
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
    if (!isDragging) return; 
    
    // FIX: Twisting the physical knob instantly aborts any software menus
    if (appState !== 'IDLE') {
        showHomeView();
    }
    
    resetInactivityTimer();
    let angle = Math.atan2(e.clientY - center.y, e.clientX - center.x) * (180 / Math.PI);
    currentAngle = angle - startAngle;
    knob.style.transform = `rotate(${currentAngle}deg)`;
    
    let onesDigit = Math.round(currentAngle / 36) % 10;
    if (onesDigit < 0) { onesDigit += 10; } 
    
    if (currentDial !== onesDigit) {
        currentDial = onesDigit;
        updateActiveChannel();
    }
});

knob.addEventListener('pointerup', () => isDragging = false);

// --- Boot Up ---
updateOpModeDisplay();
updateActiveChannel();
showHomeView();
                
