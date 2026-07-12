

const taskList = document.getElementById('taskList');

// --- Helper: Create Method Input ---
function createMethodInput(value = '') {
    const div = document.createElement('div');
    div.className = 'method-row';
    div.innerHTML = `
        <input type="text" class="t-method" value="${value}" placeholder="Method name">
        <button type="button" class="btn-icon-remove" onclick="this.parentElement.remove()">×</button>
    `;
    return div;
}


// LOAD JSON FROM FILE
async function getjsonfilecontent(str_Filename) {
    const o_response = await fetch('/api/serverhost/file?path=' + str_Filename + '.json');
    return await o_response.json()
}

// SAVE JSON TO FILE
async function setjsonfilecontent(str_Filename, obj_Content) {
    // optional validation
    try {
        const o_response = await fetch('/api/serverhost/file?path=' + str_Filename + '.json', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(obj_Content)
        });
        return await o_response.json()
    } catch (e) {
        console.log(e);
        alert("Failed to post")
    }

}

// --- Helper: Create Task Card ---
function createTaskCard(task = { name: '', class: '', methods: [] }) {
    const div = document.createElement('div');
    div.className = 'task-item';

    // Generate Methods HTML
    let methodsHtml = '';
    // We will populate this via JS after appending to ensure clean DOM manipulation, 
    // but the container structure is defined here.

    div.innerHTML = `
        <button type="button" class="remove-btn" onclick="this.parentElement.remove()">✕ Remove Task</button>
        <div class="grid">
            <div class="form-group">
                <label>DLL Name</label>
                <input type="text" class="t-name" value="${task.name}" placeholder="Example.dll">
            </div>
            <div class="form-group">
                <label>Class Namespace</label>
                <input type="text" class="t-class" value="${task.class}" placeholder="Namespace.Logic">
            </div>
        </div>
        
        <div class="methods-section">
            <div class="methods-header">
                <span>Methods</span>
                <button type="button" class="btn btn-add-sm" onclick="addMethodToTask(this)">+ Add Method</button>
            </div>
            <div class="methods-container"></div>
        </div>
    `;

    // Populate methods
    const container = div.querySelector('.methods-container');
    task.methods.forEach(m => {
        container.appendChild(createMethodInput(m));
    });

    return div;
}

// --- Actions ---

function addTask() {
    taskList.appendChild(createTaskCard({ name: '', class: '', methods: [''] }));
}

function addMethodToTask(btn) {
    // Find the container within this specific task card
    const container = btn.closest('.methods-section').querySelector('.methods-container');
    container.appendChild(createMethodInput());
}

// --- Initialization ---
async function saveConfig() {
    let initialData = getConfigData();
    return await setjsonfilecontent('_servertools/.serveradmin/serverConfig', initialData);
}

async function init() {
    // Global Fields
    const initialData = await getjsonfilecontent('_servertools/.serveradmin/serverConfig');
    document.getElementById('port').value = initialData.port;
    document.getElementById('staticRoot').value = initialData.staticRoot;
    document.getElementById('pluginroot').value = initialData.pluginroot;
    document.getElementById('dataroot').value = initialData.dataroot;
    document.getElementById('autoOpenBrowser').checked = initialData.autoOpenBrowser;

    // Log Fields
    document.getElementById('logType').value = initialData.log.type;
    document.getElementById('logConsole').checked = initialData.log.console;
    document.getElementById('ev-apicalls').checked = initialData.log.events.apicalls;
    document.getElementById('ev-hash').checked = initialData.log.events.hashchange;
    document.getElementById('ev-url').checked = initialData.log.events.urlchange;

    // Tasks
    initialData.apitasks.forEach(task => {
        taskList.appendChild(createTaskCard(task));
    });
}

// --- Submit / Save ---

document.getElementById('configForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveConfig();
});
/*
*/


function getConfigData() {
    // Rebuild Tasks Array
    const tasks = Array.from(document.querySelectorAll('.task-item')).map(item => {
        // Get methods for this specific task
        const methodInputs = item.querySelectorAll('.t-method');
        const methodsArr = Array.from(methodInputs).map(input => input.value).filter(val => val.trim() !== "");

        return {
            name: item.querySelector('.t-name').value,
            class: item.querySelector('.t-class').value,
            methods: methodsArr
        };
    });

    const config = {
        port: parseInt(document.getElementById('port').value),
        staticRoot: document.getElementById('staticRoot').value,
        pluginroot: document.getElementById('pluginroot').value,
        dataroot: document.getElementById('dataroot').value,
        autoOpenBrowser: document.getElementById('autoOpenBrowser').checked,
        log: {
            type: document.getElementById('logType').value,
            events: {
                apicalls: document.getElementById('ev-apicalls').checked,
                hashchange: document.getElementById('ev-hash').checked,
                urlchange: document.getElementById('ev-url').checked
            },
            console: document.getElementById('logConsole').checked
        },
        api: { server: "localhost" },
        apitasks: tasks
    };
    return config;
}
function showJSON(data) {
    document.getElementById('jsonPreview').textContent = JSON.stringify(data, null, 2);
    document.getElementById('jsonModal').style.display = 'block';
}

function toggleJSON() {
    let initialData = getConfigData();
    document.getElementById('jsonPreview').textContent = JSON.stringify(initialData, null, 2);
    const modal = document.getElementById('jsonModal');
    modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
}// Start
init();