let questionsData = [];
let currentTab = 0;
let totalSections = 0;

async function getQuestions() {
   return (await serverAPI({ "path": ".solutions/projectscoping/questions.json" })).value;
}

async function initIntakeApp() {
    const stepperContainer = document.getElementById("intake-stepper");
    const formContainer = document.getElementById("intakeForm");
    questionsData = await getQuestions();
    const structure = {};

    Array.from(questionsData).forEach(q => {
        if (!structure[q.section_id]) {
            structure[q.section_id] = { title: q.section_Title, categories: {} };
        }
        if (!structure[q.section_id].categories[q.category]) {
            structure[q.section_id].categories[q.category] = { rows: {} };
        }
        if (!structure[q.section_id].categories[q.category].rows[q.row_index]) {
            structure[q.section_id].categories[q.category].rows[q.row_index] = [];
        }
        structure[q.section_id].categories[q.category].rows[q.row_index].push(q);
    });

    const sortedSections = Object.keys(structure).sort((a, b) => a - b).map(key => structure[key]);
    totalSections = sortedSections.length;

    sortedSections.forEach((sectionObj, index) => {
        // Build Stepper
        const indicator = document.createElement('div');
        indicator.className = 'step-indicator';
        indicator.id = `indicator-${index}`;
        indicator.innerHTML = `<div class="step-circle">${index + 1}</div><div class="step-title">${sectionObj.title}</div>`;
        stepperContainer.appendChild(indicator);

        // Build Step Content Wrapper
        const stepDiv = document.createElement('div');
        stepDiv.className = 'step-content';
        stepDiv.id = `step-${index}`;

        // Build Accordions per Category
        for (const [categoryName, categoryObj] of Object.entries(sectionObj.categories)) {
            const details = document.createElement('details');
            details.className = 'category-accordion';
            details.open = true;

            const summary = document.createElement('summary');
            summary.className = 'category-summary';
            summary.textContent = categoryName;
            details.appendChild(summary);

            const body = document.createElement('div');
            body.className = 'accordion-body';

            // Grid Mapping
            for (const [rIndex, rowItems] of Object.entries(categoryObj.rows)) {
                rowItems.forEach(q => {
                    const el = createFormElement(q);
                    // If a field is the only one in a row and mapped to column 1, make it span full width
                    if (rowItems.length === 1 && q.col_index === 1 && q.IsVisible !== false) {
                        el.style.gridColumn = '1 / -1';
                    }
                    body.appendChild(el);
                });
            }
            details.appendChild(body);
            stepDiv.appendChild(details);
        }
        formContainer.appendChild(stepDiv);
    });

    showTab(currentTab);

    // Bind Live Listeners for scoring
    formContainer.addEventListener('input', runLiveAnalysis);
    formContainer.addEventListener('change', runLiveAnalysis);
}

function createFormElement(q) {
    const group = document.createElement('div');

    // Correctly handle hidden elements so they don't break the CSS grid
    if (q.IsVisible === false) {
        group.style.display = 'none';
        group.innerHTML = `<input type="hidden" name="${q.field_name}" value="">`;
        return group;
    }

    group.className = 'form-feild';
    const reqStr = q.mandatory ? '<span class="required">*</span>' : '';
    group.innerHTML = `<label>${q.user_question} ${reqStr}</label>
                               <span class="description">${q.description}</span>`;

    let inputHtml = '';
    const name = q.field_name;
    const reqAttr = q.mandatory ? 'required' : '';

    switch (q.data_type) {
        case 'Text':
        case 'Date':
            inputHtml = `<input type="${q.data_type === 'Date' ? 'date' : 'text'}" name="${name}" ${reqAttr}>`;
            break;
        case 'Number':
            inputHtml = `<input type="number" name="${name}" ${reqAttr} min="0">`;
            break;
        case 'Long Text':
            inputHtml = `<textarea name="${name}" ${reqAttr}></textarea>`;
            break;
        case 'Dropdown':
            const opts = q.allowed_values_input.split(',').map(o => o.trim()).filter(o => o);
            inputHtml = `<select name="${name}" ${reqAttr}>
                                    <option value="">-- Select --</option>
                                    ${opts.map(o => `<option value="${o}">${o}</option>`).join('')}
                                 </select>`;
            break;
        case 'Multi-select':
            const multiOpts = q.allowed_values_input.split(',').map(o => o.trim()).filter(o => o);
            inputHtml = `<div class="checkbox-group" data-required="${q.mandatory}">
                                    ${multiOpts.map(o => `<label><input type="checkbox" name="${name}" value="${o}"> ${o}</label>`).join('')}
                                 </div>`;
            break;
        case 'Yes/No':
            inputHtml = `<div class="radio-group">
                                    <label><input type="radio" name="${name}" value="Yes" ${reqAttr}> Yes</label>
                                    <label><input type="radio" name="${name}" value="No"> No</label>
                                 </div>`;
            break;
    }
    group.insertAdjacentHTML('beforeend', inputHtml);
    return group;
}

function showTab(n) {
    const steps = document.querySelectorAll('.step-content');
    const indicators = document.querySelectorAll('.step-indicator');

    steps.forEach(s => s.classList.remove('active'));
    if (steps[n]) steps[n].classList.add('active');

    indicators.forEach((ind, i) => {
        ind.classList.remove('active', 'completed');
        if (i < n) ind.classList.add('completed');
        if (i === n) ind.classList.add('active');
    });

    document.getElementById("prevBtn").style.visibility = (n === 0) ? "hidden" : "visible";
    const nextBtn = document.getElementById("nextBtn");

    if (n === steps.length - 1) {
        nextBtn.textContent = "Submit Process";
        nextBtn.onclick = function () {
            if (validateForm()) alert("Form Validated! Ready for backend.");
        };
    } else {
        nextBtn.textContent = "Continue";
        nextBtn.onclick = function () { nextPrev(1); };
    }
}

function nextPrev(n) {
    if (n === 1 && !validateForm()) return false;
    currentTab += n;
    showTab(currentTab);
    // Scroll the left column back to the top when switching pages
    document.querySelector('.form-column').scrollTop = 0;
}

function validateForm() {
    let valid = true;
    const currentStep = document.querySelectorAll('.step-content')[currentTab];
    const inputs = currentStep.querySelectorAll('input[required], select[required], textarea[required]');

    for (let i = 0; i < inputs.length; i++) {
        if (!inputs[i].checkValidity()) {
            const parentDetails = inputs[i].closest('details');
            if (parentDetails && !parentDetails.open) parentDetails.open = true;
            inputs[i].reportValidity();
            return false;
        }
    }
    return valid;
}
function runLiveAnalysis() {
    const form = document.getElementById('intakeForm');
    const formData = new FormData(form);
    const data = {};

    for (let [key, value] of formData.entries()) {
        if (data[key]) {
            if (!Array.isArray(data[key])) data[key] = [data[key]];
            data[key].push(value);
        } else {
            data[key] = value;
        }
    }

    const scoreEl = document.getElementById('feasibilityScore');
    const scoreText = document.getElementById('feasibilityText');
    const techTags = document.getElementById('techTags');
    const suggestionsList = document.getElementById('suggestionsList');

    suggestionsList.innerHTML = '';
    techTags.innerHTML = '';

    // If the form is relatively empty, wait for inputs
    if (Object.keys(data).length < 2) {
        scoreEl.textContent = "--";
        scoreEl.className = 'score-circle';
        scoreText.textContent = "Awaiting inputs...";
        return;
    }

    let score = 0;
    const suggestions = [];
    const tags = new Set();

    // Additive Scoring Logic based on your new schema
    // Note: The data keys (e.g., 'repetitive') must match the 'field_name' in your JSON
    if (data.repetitive === 'Yes') score += 2; 
    if (data.multiple_systems === 'Yes') score += 5;
    if (data.uses_documents === 'Yes') score += 4;
    if (data.requires_reasoning === 'Yes') score += 10;
    if (data.needs_planning === 'Yes') score += 12;
    if (data.needs_memory === 'Yes') score += 10;
    if (data.autonomous_decisions === 'Yes') score += 15;
    if (data.human_approval === 'Yes') score += 5;
    if (data.uses_sap === 'Yes') score += 3;
    if (data.needs_ai === 'Yes' || data.needs_llm === 'Yes') score += 8; 

    // Determine Classification Recommendation
    let recommendation = "";
    let scoreClass = "";

    if (score <= 10) {
        recommendation = "Workflow Automation";
        scoreClass = "score-low"; // Reusing your existing CSS classes
        tags.add('<span class="tech-tag">Standard API / Logic Apps</span>');
    } else if (score <= 20) {
        recommendation = "RPA";
        scoreClass = "score-medium";
        tags.add('<span class="tech-tag rpa">UiPath / Power Automate</span>');
    } else if (score <= 35) {
        recommendation = "Intelligent Automation";
        scoreClass = "score-high";
        tags.add('<span class="tech-tag ai">IDP & Machine Learning</span>');
    } else if (score <= 50) {
        recommendation = "AI Assistant";
        scoreClass = "score-high";
        tags.add('<span class="tech-tag ai">Copilot / Conversational AI</span>');
    } else {
        recommendation = "Agentic AI";
        scoreClass = "score-high";
        tags.add('<span class="tech-tag ai">Autonomous Agents / LLM Orchestration</span>');
        suggestions.push({ type: 'critical', msg: 'High complexity: Requires strict guardrails and human-in-the-loop oversight.' });
    }

    // Risk and Compliance Flags (Example implementation)
    if (data.pii === 'Yes' || data.gdpr === 'Yes') {
        suggestions.push({ type: 'warning', msg: 'Data Privacy flag triggered. Ensure data masking is implemented.' });
    }

    // Update UI
    scoreEl.textContent = score;
    scoreEl.className = `score-circle ${scoreClass}`;
    scoreText.innerHTML = `<strong>${recommendation}</strong>`;

    if (tags.size > 0) {
        techTags.innerHTML = Array.from(tags).join('');
    }

    suggestions.forEach(s => {
        const li = document.createElement('li');
        li.className = s.type;
        li.innerHTML = s.msg;
        suggestionsList.appendChild(li);
    });
}

// --- SAVE TO JSON ---
function saveToJSON() {
    const form = document.getElementById('intakeForm');
    const formData = new FormData(form);
    const data = {};

    // Convert FormData to a standard object, handling multiple selections properly
    for (let [key, value] of formData.entries()) {
        if (data[key]) {
            if (!Array.isArray(data[key])) data[key] = [data[key]];
            data[key].push(value);
        } else {
            data[key] = value;
        }
    }

    // Create a downloadable Blob
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Create a temporary link to trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = "automation_intake_data.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}



// --- LOAD FROM JSON ---
function loadFromJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            populateForm(data);
            alert("Data loaded successfully!");
        } catch (error) {
            alert("Error parsing JSON file. Make sure it is a valid save file.");
        }
        // Reset the file input so the same file can be loaded again if needed
        event.target.value = "";
    };
    reader.readAsText(file);
}

// --- POPULATE FORM FIELDS ---
// --- 1. OPEN MODAL & FETCH LIST FROM SERVER ---
async function openLoadModal() {
    const modal = document.getElementById('serverLoadModal');
    const container = document.getElementById('savedCardsContainer');

    modal.showModal();
    container.innerHTML = '<p style="text-align:center;">Loading saved forms...</p>';

    try {
        files = (await serverAPI({ "path": ".solutions/projectscoping", "recursive": "TRUE" }, "listfiles")).value;
        console.log(files);
        container.innerHTML = ''; // Clear loading text

        if (files.length === 0) {
            container.innerHTML = '<p>No saved forms found.</p>';
            return;
        }

        // Build clickable cards (similar to your createFormCards logic)
        files.forEach(file => {
            const card = document.createElement('div');
            card.className = 'saved-card';
            card.innerHTML = `<h4>${file.title || 'Untitled Form'}</h4>
                              <p>ID: ${file.id} | Saved: ${file.date}</p>`;

            // When clicked, fetch this specific JSON and populate the form
            card.onclick = () => fetchSpecificData(".solutions/projectscoping/" + file.FileName);
            container.appendChild(card);
        });

    } catch (error) {
        console.error("Failed to fetch list:", error);
        container.innerHTML = '<p style="color:red;">Error connecting to server to fetch files.</p>';
    }
}

// --- 2. FETCH SPECIFIC JSON & POPULATE ---
async function fetchSpecificData(t_FilePath) {
    try {
        const data = (await serverAPI({ "path": t_FilePath })).value;
        console.log(data);
        populateForm(data); // Call the populate function
        document.getElementById('serverLoadModal').close(); // Close modal
        alert("Data loaded successfully!");

    } catch (error) {
        console.error("Failed to load data:", error);
        alert("Failed to pull data from server.");
    }
}

// --- 3. SAVE DATA BACK TO SERVER ---
async function saveDataToServer() {
    // You already built this function in formactions.js!
    const data = getFormData();

    try {
        // REPLACE WITH YOUR ACTUAL C# POST ENDPOINT
        const response = await fetch('/api/saveIntakeData', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert("Progress saved to server!");
        } else {
            alert("Failed to save to server.");
        }
    } catch (error) {
        console.error("Save error:", error);
        alert("Network error while saving.");
    }
}

// --- 4. POPULATE ENGINE ---
function populateForm(data) {
    const form = document.getElementById('intakeForm');
    form.reset(); // Clear form first

    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            const value = data[key];
            const elements = form.querySelectorAll(`[name="${key}"]`);
            if (elements.length === 0) continue;

            const type = elements[0].type;
            if (type === 'radio') {
                elements.forEach(el => { if (el.value === value) el.checked = true; });
            } else if (type === 'checkbox') {
                const valArray = Array.isArray(value) ? value : [value];
                elements.forEach(el => { if (valArray.includes(el.value)) el.checked = true; });
            } else {
                elements[0].value = value;
            }
        }
    }

    // Force live analysis to run and update score
    if (typeof runLiveAnalysis === "function") runLiveAnalysis();
}