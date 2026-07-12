// --- DYNAMIC SYSTEM CONFIGURATION ---
let SYSTEM_CONFIG = {
    "regions": ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"],
    "buckets": ["gen-orrick-agent-store", "legal-agent-store", "finance-agent-store"],
    "models": [
        { "id": "anthropic.claude-3-5-sonnet-20240620-v1:0", "name": "Claude 3.5 Sonnet" },
        { "id": "anthropic.claude-3-opus-20240229-v1:0", "name": "Claude 3 Opus" },
        { "id": "meta.llama3-70b-instruct-v1:0", "name": "Llama 3 70B" }
    ],
    "embedders": ["amazon.titan-embed-text-v1", "amazon.titan-embed-text-v2:0", "cohere.embed-english-v3"],
    "available_tools": ["getFilesFromS3Folder", "put2CSVfile", "get_json_content", "getPDFContent", "getImageText", "getScannedPDF_Text", "queryDatabase"]
};

// --- MASTER STATE ---
let CURRENT_ROLE = 'admin';
let AGENTS = [
    {
        id: 'a1', name: "Expense Reports Agent", basebucket: "gen-orrick-agent-store", bedrock_region: "us-east-1",
        dbrain: "anthropic.claude-3-5-sonnet-20240620-v1:0", temperature: 0, prompt: "You are the Lead... ",
        persona: [{ role: "Extraction Agent", prompt: "Extract vendor name..." }], tools: ["getFilesFromS3Folder"],
        vectorize: { method: "inject", embedder: "amazon.titan-embed-text-v1", activeversion: "v1" }, knowledge: { topk: 5 }, limits: { max_iterations: 100 }
    }
];

let SESSIONS = [
    { id: 's1', title: 'October Expenses', agentId: 'a1', type: 'mine', history: [{ role: 'agent', text: 'How can I assist?' }] }
];

let curAgentId = 'a1';
let curSessionId = null;

// --- DROPDOWN POPULATION ---
function populateDropdown(elementId, optionsArray, isObject = false) {
    const selectEl = document.getElementById(elementId);
    if (!selectEl) return;
    if (elementId !== 'new-tool') selectEl.innerHTML = '';

    optionsArray.forEach(opt => {
        const optionEl = document.createElement('option');
        optionEl.value = isObject ? opt.id : opt;
        optionEl.textContent = isObject ? opt.name : opt;
        selectEl.appendChild(optionEl);
    });
}

function refreshBuilderDropdowns() {
    populateDropdown('j-bucket', SYSTEM_CONFIG.buckets);
    populateDropdown('j-region', SYSTEM_CONFIG.regions);
    populateDropdown('j-model', SYSTEM_CONFIG.models, true);
    populateDropdown('j-v-embed', SYSTEM_CONFIG.embedders);
    populateDropdown('new-tool', SYSTEM_CONFIG.available_tools);
}

// --- SETTINGS MANAGER ---
function setSettingSec(sec, el) {
    document.querySelectorAll('.set-sec').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('#scr-settings .side-item').forEach(i => i.classList.remove('active'));
    document.getElementById('set-' + sec).classList.remove('hidden');
    el.classList.add('active');
}

function renderConfigManager() {
    const buildList = (key, targetId) => {
        const list = document.getElementById(targetId);
        list.innerHTML = SYSTEM_CONFIG[key].map((item, idx) => `
                    <div class="config-list-row">
                        <span class="flex-1">${typeof item === 'string' ? item : item.name + ' (' + item.id + ')'}</span>
                        <button class="btn-icon" onclick="removeFromConfig('${key}', ${idx})">×</button>
                    </div>
                `).join('');
    };
    buildList('regions', 'cfg-regions-list');
    buildList('buckets', 'cfg-buckets-list');
    buildList('models', 'cfg-models-list');
    buildList('embedders', 'cfg-embed-list');
    buildList('available_tools', 'cfg-tools-list');
    refreshBuilderDropdowns();
}

function addToConfig(key, inputId) {
    const val = document.getElementById(inputId).value.trim();
    if (!val) return;
    SYSTEM_CONFIG[key].push(val);
    document.getElementById(inputId).value = '';
    renderConfigManager();
}

function addModelToConfig() {
    const name = document.getElementById('new-mod-name').value.trim();
    const id = document.getElementById('new-mod-id').value.trim();
    if (!name || !id) return;
    SYSTEM_CONFIG.models.push({ id, name });
    document.getElementById('new-mod-name').value = '';
    document.getElementById('new-mod-id').value = '';
    renderConfigManager();
}

function removeFromConfig(key, idx) {
    SYSTEM_CONFIG[key].splice(idx, 1);
    renderConfigManager();
}

// --- NAVIGATION & RBAC ---
function changeRole(role) {
    CURRENT_ROLE = role;
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = role === 'admin' ? '' : 'none');
    setScreen(role === 'admin' ? 'dash' : 'workspace');
}

function setScreen(s) {
    if (CURRENT_ROLE === 'user' && (s === 'dash' || s === 'studio' || s === 'build' || s === 'settings')) s = 'workspace';
    document.querySelectorAll('.screen').forEach(scr => scr.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.getElementById('scr-' + s).classList.add('active');
    if (document.getElementById('l-' + (s === 'build' ? 'studio' : s)))
        document.getElementById('l-' + (s === 'build' ? 'studio' : s)).classList.add('active');
    if (s === 'studio') renderDirectory();
    if (s === 'settings') renderConfigManager();
    if (s === 'workspace') renderSessions();
}

function setSec(sec, el) {
    document.querySelectorAll('.form-section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('#scr-build .side-item').forEach(i => i.classList.remove('active'));
    document.getElementById('sec-' + sec).classList.remove('hidden');
    el.classList.add('active');
}

// --- DIRECTORY & BUILDER ---
function renderDirectory() {
    const grid = document.getElementById('directory-grid');
    grid.innerHTML = AGENTS.map(a => `
                <div class="agent-card" onclick="openBuilder('${a.id}')">
                    <h3 class="mb-4">${a.name}</h3>
                    <p class="text-steel text-xs uppercase">S3: ${a.basebucket}</p>
                    <div class="mt-auto font-bold text-red text-xs uppercase">Edit Agent →</div>
                </div>
            `).join('') + `<div class="agent-card new-card cursor-pointer" onclick="toggleModal('modal-new', true)"><h3 class="text-lg">+ Create New Agent</h3></div>`;
}

function openBuilder(id) {
    curAgentId = id;
    const a = AGENTS.find(x => x.id === id);
    refreshBuilderDropdowns();
    document.getElementById('builder-title').innerText = `Editing: ${a.name}`;
    document.getElementById('j-name').value = a.name;
    document.getElementById('j-bucket').value = a.basebucket;
    document.getElementById('j-region').value = a.bedrock_region;
    document.getElementById('j-iter').value = a.limits.max_iterations;
    document.getElementById('j-model').value = a.dbrain;
    document.getElementById('j-temp').value = a.temperature;
    document.getElementById('j-prompt').value = a.prompt;
    document.getElementById('j-v-method').value = a.vectorize.method;
    document.getElementById('j-v-embed').value = a.vectorize.embedder;
    document.getElementById('j-v-ver').value = a.vectorize.activeversion;
    document.getElementById('j-topk').value = a.knowledge.topk;
    renderPersonas(a);
    renderTools(a);
    setScreen('build');
}

function closeBuilder() { saveAgentState(); setScreen('studio'); }

function saveAgentState() {
    const a = AGENTS.find(x => x.id === curAgentId);
    if (!a) return;
    a.name = document.getElementById('j-name').value;
    a.basebucket = document.getElementById('j-bucket').value;
    a.bedrock_region = document.getElementById('j-region').value;
    a.limits.max_iterations = parseInt(document.getElementById('j-iter').value) || 100;
    a.dbrain = document.getElementById('j-model').value;
    a.temperature = parseFloat(document.getElementById('j-temp').value) || 0;
    a.prompt = document.getElementById('j-prompt').value;
    a.vectorize.method = document.getElementById('j-v-method').value;
    a.vectorize.embedder = document.getElementById('j-v-embed').value;
    a.vectorize.activeversion = document.getElementById('j-v-ver').value;
    a.knowledge.topk = parseInt(document.getElementById('j-topk').value) || 5;
    a.persona = Array.from(document.querySelectorAll('.persona-row')).map(r => ({ role: r.querySelector('.p-role').value, prompt: r.querySelector('.p-prompt').value }));
}

function initAgent() {
    const name = document.getElementById('mn-name').value;
    if (!name) return;
    const n = { id: Date.now().toString(), name, basebucket: SYSTEM_CONFIG.buckets[0], bedrock_region: SYSTEM_CONFIG.regions[0], dbrain: SYSTEM_CONFIG.models[0].id, temperature: 0, prompt: '', persona: [], tools: [], vectorize: { method: 'inject', embedder: SYSTEM_CONFIG.embedders[0], activeversion: 'v1' }, knowledge: { topk: 5 }, limits: { max_iterations: 100 } };
    AGENTS.push(n);
    toggleModal('modal-new', false);
    openBuilder(n.id);
}

// --- LIST RENDERERS ---
function renderPersonas(a) {
    document.getElementById('fleet-list').innerHTML = a.persona.map(p => `
                <div class="persona-row">
                    <div class="persona-header">
                        <input type="text" value="${p.role}" class="p-role" placeholder="Worker Role Name">
                        <button class="btn-icon p-5" onclick="this.closest('.persona-row').remove()">×</button>
                    </div>
                    <textarea class="p-prompt" rows="4" placeholder="Instructions...">${p.prompt || ''}</textarea>
                </div>`).join('');
}
function addWorkerRow() {
    const div = document.createElement('div'); div.className = 'persona-row';
    div.innerHTML = `<div class="persona-header"><input type="text" class="p-role" placeholder="Role Name"><button class="btn-icon p-5" onclick="this.closest('.persona-row').remove()">×</button></div><textarea class="p-prompt" rows="4" placeholder="Instructions..."></textarea>`;
    document.getElementById('fleet-list').appendChild(div);
}

function renderTools(a) { document.getElementById('tool-pool').innerHTML = a.tools.map(t => `<div class="tool-chip">${t} <span class="cursor-pointer" onclick="removeTool('${t}')">×</span></div>`).join(''); }
function addTool() {
    const select = document.getElementById('new-tool');
    const a = AGENTS.find(x => x.id === curAgentId);
    if (select.value && !a.tools.includes(select.value)) { a.tools.push(select.value); renderTools(a); select.value = ''; }
}
function removeTool(t) { const a = AGENTS.find(x => x.id === curAgentId); a.tools = a.tools.filter(x => x !== t); renderTools(a); }

function exportJSON() {
    if (document.getElementById('scr-build').classList.contains('active')) saveAgentState();
    const exportData = AGENTS.map(({ id, ...cleanConfig }) => cleanConfig);
    document.getElementById('json-out').value = JSON.stringify(exportData, null, 2);
    toggleModal('modal-json', true);
}

// --- WORKSPACE & CHAT ---
function toggleModal(id, open) {
    document.getElementById(id).classList.toggle('active', open);
    if (id === 'modal-new-chat' && open) document.getElementById('mc-agent').innerHTML = AGENTS.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
}
function renderSessions() {
    const buildS = s => `<div class="session-item ${curSessionId === s.id ? 'active' : ''}" onclick="loadSession('${s.id}')"><div class="session-title">${s.title}</div><div class="session-agent">${AGENTS.find(a => a.id === s.agentId)?.name || ''}</div></div>`;
    document.getElementById('my-sessions-list').innerHTML = SESSIONS.filter(s => s.type === 'mine').map(buildS).join('');
    document.getElementById('shared-sessions-list').innerHTML = SESSIONS.filter(s => s.type === 'shared').map(buildS).join('');
}
function startNewChat() {
    const newS = { id: 's' + Date.now(), title: document.getElementById('mc-name').value || 'New Chat', agentId: document.getElementById('mc-agent').value, type: 'mine', history: [{ role: 'agent', text: 'Hello!' }] };
    SESSIONS.push(newS); toggleModal('modal-new-chat', false); renderSessions(); loadSession(newS.id);
}
function loadSession(id) {
    curSessionId = id; renderSessions();
    const s = SESSIONS.find(x => x.id === id);
    document.getElementById('chat-header-title').innerText = s.title;
    document.getElementById('chat-in').disabled = false;
    document.getElementById('btn-send').disabled = false;
    document.getElementById('chat-msgs').innerHTML = s.history.map(m => `<div class="bubble ${m.role}">${m.text}</div>`).join('');
}
function sendChat() {
    const input = document.getElementById('chat-in');
    if (!input.value.trim()) return;
    const s = SESSIONS.find(x => x.id === curSessionId);
    s.history.push({ role: 'user', text: input.value });
    input.value = ''; loadSession(curSessionId);
}

// Init
changeRole('admin');
