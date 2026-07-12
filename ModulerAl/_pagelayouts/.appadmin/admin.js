//import * as generics from '../../_scripts/generics.js';

async function getBaseData() {
    /*read config for keys*/
    const obj_AppConfig = await fetchget('/serverhost/read?uid=UfvYjzfP1770828845047').value/*appConfig*/;
    console.log(obj_AppConfig);
    const obj_PageFormConfig = obj_AppConfig.pageconfig;
    const obj_key = obj_PageFormConfig.map(item => item.key);
    console.log(obj_key);
    buildFormBase(obj_PageFormConfig);


}

function buildFormBase(obj_Feilds) {
    const container = document.getElementById('formContainer');
    container.innerHTML = '';
    let row = document.createElement('div');
    row.className = 'form-row';
    for (var feildItem = 0; feildItem < obj_Feilds.length; feildItem++) {
        switch (obj_Feilds[feildItem].type) {
            case 'object':
                console.log(obj_Feilds[feildItem]);
                var obj_Section = buildDynamicSection(obj_Feilds[feildItem]);
                container.appendChild(obj_Section.section);
                break;
            case 'number': case 'text':
                buildFormFeild(obj_Feilds[feildItem], row);
                break;
            case 'multitext':
                break;
            case 'index':
                buildIndexFeild(obj_Feilds[feildItem], row);
                break;
        }
        if ((feildItem + 1) % 2 === 0 || feildItem === obj_Feilds.length - 1) {
            container.appendChild(row);
            row = document.createElement('div');
            row.className = 'form-row';
        }

    }
}
function buildFormFeild(obj_FeildData, obj_Parent) {
    const fieldWrapper = document.createElement('div');
    fieldWrapper.className = 'form-feild';
    const label = document.createElement('label');
    label.innerText = obj_FeildData.lable;
    const input = document.createElement('input');
    input.type = obj_FeildData.type;
    input.value = obj_FeildData.default;
    input.id = obj_FeildData.key;
    switch (obj_FeildData.mode) {
        case 'hide': fieldWrapper.classList.add('hidden'); break;
        case 'disable': input.disabled = true; break;
    }
    fieldWrapper.appendChild(label);
    fieldWrapper.appendChild(input);
    obj_Parent.appendChild(fieldWrapper);
    return obj_Parent;
}
function buildIndexFeild(obj_FeildData, obj_Parent) {
    const fieldWrapper = document.createElement('div');
    fieldWrapper.className = 'form-feild';
    fieldWrapper.classList.add('hidden');
    const label = document.createElement('label');
    label.innerText = obj_FeildData.lable;
    const input = document.createElement('input');
    input.type = obj_FeildData.type;
    input.value = getrandomString(21);
    input.id = obj_FeildData.key;
    fieldWrapper.appendChild(label);
    fieldWrapper.appendChild(input);
    obj_Parent.appendChild(fieldWrapper);
    return obj_Parent;
}
function buildDynamicSection(obj_FeildData) {
    const contentSection = document.createElement('div');
    contentSection.className = 'dynamic-section';
    const header = document.createElement('div');
    header.className = 'dynamic-header';
    header.innerHTML = `
        <h4>${obj_FeildData.lable}</h4>
        <button class="btn-style btnSize" onclick="addContentField()">+ Add Field</button>
    `;
    contentSection.appendChild(header);
    const contentContainer = document.createElement('div');
    contentContainer.className = 'content-fields-container';
    contentContainer.id = getrandomString(21);
    contentSection.appendChild(contentContainer);
    return { section: contentSection, content: contentContainer };;
}

// State
let jsonlData = [];
let currentIndex = -1;

// --- INITIALIZATION ---
async function init() {
    // Parse JSONL
    jsonlData = (await fetchget('/serverhost/read?uid=DaO4VMWH1770828857774')).value;
    console.log(jsonlData)
    renderList();
    if (jsonlData.length > 0) loadEntry(0);
}

// --- RENDER SIDEBAR LIST ---
function renderList() {
    const container = document.getElementById('tab-left-content-container');
    const filter = document.getElementById('search-cards-below').value.toLowerCase();
    container.innerHTML = '';
    jsonlData.forEach((item, index) => {
        if (!item.id.toLowerCase().includes(filter) && !item.title.toLowerCase().includes(filter)) return;
        const div = document.createElement('div');
        div.className = `cardsContent ${index === currentIndex ? 'active' : ''}`;
        div.onclick = () => loadEntry(index);
        div.innerHTML = `
            <a class="smallText" style="color:var(--deep-slate); font-weight:800;">${item.title || 'Untitled'}</a>
            <a class="smallerText" style="color:var(--muted);">ID: ${item.id}</a>
            <a class="smallerText" style="color:var(--muted);">Type: ${item.type}</a>
        `;
        container.appendChild(div);
    });
}

function filterList() {
    renderList();
}
async function getKeyFeilds() {
    const obj_AppConfig = await fetchget('/serverhost/read?uid=UfvYjzfP1770828845047');/*appConfig*/
    let obj_PageFormConfig = obj_AppConfig.value.pageconfig;
    obj_PageFormConfig = filterObjectArray(obj_PageFormConfig, ['text', 'multitext', 'checkbox'], 'type');
    return obj_PageFormConfig.map(item => item.key);

}
// --- BUILD DYNAMIC FORM ---
async function loadEntry(index) {
    currentIndex = index;
    renderList(); // Update active state
    const data = jsonlData[index];
    document.getElementById('current-id-display').innerText = data.title;
    const container = document.getElementById('formContainer');
    container.innerHTML = '';
    // 1. Standard Fields (Top Section)
    stdFields = await getKeyFeilds();
    let row = document.createElement('div');
    row.className = 'form-row';

    stdFields.forEach((key, i) => {
        const fieldWrapper = document.createElement('div');
        fieldWrapper.className = 'form-feild';

        const label = document.createElement('label');
        label.innerText = key.toUpperCase();

        const input = document.createElement('input');
        input.type = 'text';
        input.value = data[key] === null ? '' : data[key];
        input.id = `input-${key}`;

        fieldWrapper.appendChild(label);
        fieldWrapper.appendChild(input);

        row.appendChild(fieldWrapper);

        // Break to new row every 2 items
        if ((i + 1) % 2 === 0 || i === stdFields.length - 1) {
            container.appendChild(row);
            row = document.createElement('div');
            row.className = 'form-row';
        }
    });

    // 2. Dynamic Content Section
    const contentSection = document.createElement('div');
    contentSection.className = 'dynamic-section';

    const header = document.createElement('div');
    header.className = 'dynamic-header';
    header.innerHTML = `
        <h4>Content Object (Dynamic)</h4>
        <button class="btn-style btnSize" onclick="addContentField()">+ Add Field</button>
    `;
    contentSection.appendChild(header);

    const contentContainer = document.createElement('div');
    contentContainer.id = 'content-fields-container';

    // Loop through existing keys in 'content'
    const contentObj = data.content || {};
    Object.keys(contentObj).forEach(key => {
        contentContainer.appendChild(createContentFieldDOM(key, contentObj[key]));
    });

    contentSection.appendChild(contentContainer);
    container.appendChild(contentSection);
}

// Helper to create a dynamic key-value row
function createContentFieldDOM(key, value) {
    const wrapper = document.createElement('div');
    wrapper.className = 'content-row';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-field-btn icon-btn';
    removeBtn.innerText = '×';
    removeBtn.onclick = () => wrapper.remove();

    const row = document.createElement('div');
    row.className = 'form-row';

    // Key Input
    const keyField = document.createElement('div');
    keyField.className = 'form-feild';
    keyField.innerHTML = `<label>Key Name</label><input type="text" class="dyn-key" value="${key}">`;

    // Value Input
    const valField = document.createElement('div');
    valField.className = 'form-feild';

    // Check if value is long, use textarea
    if (String(value).length > 50) {
        valField.innerHTML = `<label>Value</label><textarea class="dyn-val" rows="3">${value}</textarea>`;
    } else {
        valField.innerHTML = `<label>Value</label><input type="text" class="dyn-val" value="${value}">`;
    }

    row.appendChild(keyField);
    row.appendChild(valField);
    row.appendChild(removeBtn);
    wrapper.appendChild(row);

    return wrapper;
}

function addContentField() {
    const container = document.getElementById('content-fields-container');
    container.appendChild(createContentFieldDOM('new_key', ''));
}

// --- ACTIONS ---

function addNewEntry() {
    let newObj = {
        "id": "new-page",
        "pagekey": "",
        "title": "New Page",
        "parent": null,
        "type": "card-page",
        "webhook": "",
        "child": "",
        "content": {},
        "isvisible": true
    };
    newObj = {
        "id": getrandomString(21),
        "category": "Main Page Category",
        "subcategory": "Page Sub Category",
        "title": "Page Title",
        "description": "Short Page Description For Cards",
        "type": "powerbi-page",
        "content": {},
        "isvisible": true
    };
    jsonlData.push(newObj);
    loadEntry(jsonlData.length - 1);
}

function deleteCurrentEntry() {
    if (currentIndex === -1) return;
    if (confirm('Are you sure you want to delete this page?')) {
        jsonlData.splice(currentIndex, 1);
        currentIndex = -1;
        document.getElementById('formContainer').innerHTML = '<div style="text-align:center; padding: 50px;">Select an item</div>';
        renderList();
    }
}

async function saveCurrentForm() {
    if (currentIndex === -1) return alert("No item selected");

    const data = jsonlData[currentIndex];
    console.log(data);


    // 1. Save Standard Fields
    stdFields = await getKeyFeilds();
    stdFields.forEach(key => {
        const el = document.getElementById(`input-${key}`);
        if (el) {
            let val = el.value;
            if (val === "null") val = null; // Handle null string
            data[key] = val;
        }
    });

    // 2. Save Dynamic Content Fields
    const contentObj = {};
    const dynRows = document.querySelectorAll('.content-row');
    dynRows.forEach(row => {
        const k = row.querySelector('.dyn-key').value.trim();
        const v = row.querySelector('.dyn-val').value;
        if (k) contentObj[k] = v;
    });
    data.content = contentObj;

    // Refresh UI
    renderList();

    // Show success notification (simple)
    const btn = document.querySelector('.right-controls .btn-style');
    const originalText = btn.innerText;
    btn.innerText = "Saved!";
    btn.style.background = "green";
    setTimeout(() => {
        btn.innerText = originalText;
        btn.style.background = ""; // Reset
    }, 1000);
}

// --- EXPORT / VIEW ---

function generateJSONL() {
    return jsonlData.map(obj => JSON.stringify(obj)).join('\n');
}

function toggleJSONLView() {
    const modal = document.getElementById('jsonlModal');
    const textarea = document.getElementById('jsonlOutput');

    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        textarea.value = generateJSONL();
        modal.style.display = 'flex';
    }
}

function downloadJSONL() {
    const content = generateJSONL();
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data.jsonl';
    a.click();
}

async function setAppPageData(str_Filename, obj_Content) {
    // optional validation
    try {

        const content = generateJSONL();
        const o_response = await fetch('/api/serverhost/file?path=pagedata.jsonl', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: content
        });
        var obj_Response = await o_response.json();
        alert(JSON.stringify(obj_Response));
    } catch (e) {
        console.log(e);
        alert("Failed to post")
    }

}
// Start
init();