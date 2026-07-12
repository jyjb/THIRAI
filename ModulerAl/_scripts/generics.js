async function normalizeResponse(response, url) {
    console.log(response.headers.get("content-type"));
    let contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType || contentType === "application/octet-stream") {
        const inExtArray = url.split(".");
        const ext = inExtArray[inExtArray.length - 1]
        const extMap = {
            "json": "application/json",
            "jsonl": "application/jsonl",
            "ndjson": "application/x-ndjson",
            "txt": "text/plain",
            "log": "text/plain",
            "csv": "text/csv",
            "pdf": "application/pdf",
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg"
        };
        contentType = extMap[ext] || "application/octet-stream";
    }
    if (
        contentType.includes("application/jsonl") ||
        contentType.includes("application/x-ndjson") ||
        contentType.includes("json-lines") ||
        contentType.includes("ndjson")
    ) {
        const text = await response.text();
        const lines = text.trim().split("\n");
        var jsonlData = lines.map(line => {
            try { return JSON.parse(line); }
            catch { return null; }
        })
            .filter(x => x !== null);
        return {
            kind: "jsonl",
            value: jsonlData
        };
    }
    if (contentType.includes("application/json")) {
        return {
            kind: "json",
            value: await response.json()
        };
    }
    if (contentType.startsWith("text/")) {
        return {
            kind: "text",
            value: await response.text()
        };
    }
    if (contentType.startsWith("image/") || contentType.startsWith("application/pdf")) {
        const blob = await response.blob();
        return {
            kind: "blob",
            value: blob,
            contentType
        };
    }
    try {
        const cloned = response.clone();
        return {
            kind: "json",
            value: await cloned.json()
        };
    }
    catch {
        try {
            const cloned = response.clone();
            return {
                kind: "text",
                value: await cloned.text()
            };
        }
        catch {
            const blob = await response.blob();
            return {
                kind: "blob",
                value: blob,
                contentType
            };
        }
    }
}
async function fetchget(url, options = {}) {

    const response = await apiFetchWithRetry(url, options);

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error: ${response.status} - ${text}`);
    }

    return await normalizeResponse(response, url);
}
async function apiFetchWithRetry(url, options = {}, retries = 3, delayMs = 300) {
    const correlationId = generateCorrelationId();
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...(options.headers || {}),
                    "X-Correlation-Id": correlationId,
                    "Content-Type": "application/json"
                }
            });
            if (!response.ok) {
                if (response.status >= 500 && attempt < retries) {
                    await sleep(delayMs * attempt);
                    continue;
                }
            }

            return response;
        }
        catch (err) {
            if (attempt === retries) throw err;
            await sleep(delayMs * attempt);
        }
    }
}
function generateCorrelationId() {
    return crypto.randomUUID();
}
function sleep(forSeconds = 3) {
    return new Promise(resolve => setTimeout(() => {
        console.log(`This runs after ${forSeconds} seconds`);
        resolve();
    }, forSeconds * 1000));

}
const formatDate = (date) => {
    if (!date) {
        date = new Date;
    } const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
};
const getrandomString = (n_strlen = 17, n_interVals = 6, f_MakeUnique = true, f_UseSplChars = false) => {
    let n_timeStamp = '';
    if (f_MakeUnique) {
        n_timeStamp = Date.now().toString();
    } let t_result = '';
    var t_Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const t_SpChars = '@$&%_'
    if (f_UseSplChars) { t_Chars = t_Chars + t_SpChars; }
    const n_CharLen = t_Chars.length;
    for (let i = n_timeStamp.length;
        i < n_strlen;
        i++) {
        t_result += t_Chars.charAt(Math.floor(Math.random() * n_CharLen));
    } const regex = new RegExp(`(.{${n_interVals}})(?=.)`, 'g');
    t_result += n_timeStamp;
    return t_result.replace(regex, `$1${'-'}`);
    return t_result;
};
function getUniqueColumnValues(o_Array, o_Key) {
    const seen = {};
    const result = [];
    for (const item of o_Array) {
        const val = item[o_Key];
        if (val != null && !seen[val]) {
            seen[val] = true;
            result.push(val);
        }
    }
    return result;
}
function filterObjectArray(o_DataArray, l_FilterCriteriae = [], t_ColumnKey, f_GetThatMatches = true, f_ParseString = false) {
    if (f_ParseString) { return o_DataArray.filter(o_Row => eval(l_FilterCriteriae)); }
    if (f_GetThatMatches) { return o_DataArray.filter(o_Row => l_FilterCriteriae.includes(o_Row[t_ColumnKey])); }
    else { return o_DataArray.filter(o_Row => !l_FilterCriteriae.includes(o_Row[t_ColumnKey])); }
}


function createFormElement(key, value, parent) {
    const wrapper = document.createElement('div');
    wrapper.className = "form-group";
    wrapper.style.paddingLeft = "20px";
    wrapper.style.borderLeft = "2px solid #eee";
    wrapper.style.marginBottom = "10px";

    const label = document.createElement('label');
    label.style.fontWeight = "bold";
    label.innerText = key.toUpperCase();
    wrapper.appendChild(label);

    // Case 1: Null/Undefined (Default to text)
    if (value === null || value === undefined) {
        wrapper.appendChild(createInput(key, ""));
    }
    // Case 2: Array
    else if (Array.isArray(value)) {
        const arrayContainer = document.createElement('div');
        value.forEach((item, index) => {
            createFormElement(`${key}[${index}]`, item, arrayContainer);
        });
        wrapper.appendChild(arrayContainer);
    }
    // Case 3: Object (but not null or array)
    else if (typeof value === 'object') {
        const fieldset = document.createElement('fieldset');
        fieldset.style.border = "1px solid #ddd";
        Object.entries(value).forEach(([subKey, subValue]) => {
            createFormElement(subKey, subValue, fieldset);
        });
        wrapper.appendChild(fieldset);
    }
    // Case 4: Primitives (String, Number, Boolean)
    else {
        wrapper.appendChild(createInput(key, value));
    }

    parent.appendChild(wrapper);
}

function createInput(name, value) {
    const input = document.createElement('input');
    input.name = name;
    input.style.display = "block";

    if (typeof value === 'boolean') {
        input.type = 'checkbox';
        input.checked = value;
    } else {
        input.type = typeof value === 'number' ? 'number' : 'text';
        input.value = value;
    }
    return input;
}

function tryParse(value) {
    if (typeof value !== 'string') return value;

    const trimmed = value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
            // Fix single quotes (common in 'Event' fields)
            const normalized = value.replace(/'/g, '"');
            return JSON.parse(normalized);
        } catch (e) {
            return value;
        }
    }
    return value;
}

/**
 * Recursive form builder
 */
function buildForm(data, container, path = "") {
    // 1. Always attempt to parse the current level
    const currentData = tryParse(data);

    const wrapper = document.createElement('div');
    wrapper.style.cssText = "margin-left: 15px; border-left: 2px solid #ddd; padding: 5px 10px;";

    // 2. Only iterate if it's an object/array, otherwise render an input
    if (currentData !== null && typeof currentData === 'object') {
        Object.entries(currentData).forEach(([key, value]) => {
            const fieldPath = path ? `${path}.${key}` : key;
            const itemContainer = document.createElement('div');
            itemContainer.style.marginBottom = "10px";

            const label = document.createElement('label');
            label.innerHTML = `<strong>${key}</strong>`;
            label.style.display = "block";
            itemContainer.appendChild(label);

            // 3. Check the nested value
            const parsedValue = tryParse(value);
            if (typeof parsedValue === 'object' && parsedValue !== null) {
                // Dive deeper
                buildForm(parsedValue, itemContainer, fieldPath);
            } else {
                // Render the final input
                const input = document.createElement('input');
                input.name = fieldPath;
                input.value = parsedValue === null ? "" : parsedValue;
                input.style.width = "100%";
                itemContainer.appendChild(input);
            }
            wrapper.appendChild(itemContainer);
        });
    } else {
        // Fallback for raw values to prevent the "character-by-character" bug
        const input = document.createElement('input');
        input.value = currentData;
        wrapper.appendChild(input);
    }

    container.appendChild(wrapper);
}

async function apiProxy(apiMethod, apiURL, apiBody, apiContentType, UploadFormat = "TEXT", apiQuery = null, apiHeaders = null, apiAuthorization = null) {
    const localProxyUrl = "/serverhost/http";
    const correlationId = generateCorrelationId();
    apiHeaders = { ...apiHeaders, ...{ "X-Correlation-Id": correlationId, "Content-Type": "application/json" } };
    apiBody = {
        "Content": apiBody,
        "ContentType": apiContentType,
        "tURL": apiURL,
        "Query": apiQuery,
        "UploadFormat": UploadFormat
    }
    console.log(apiBody);
    const response = await fetch(localProxyUrl, {
        method: apiMethod,
        headers: apiHeaders,
        body: JSON.stringify(apiBody)
    });
    if (!response.ok) {
        throw new Error(`HTTP error: status ${response.status}`);
    }
    // const data = await response.json();
    return await response.json();;
}
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const Vbase64 = reader.result.split(',')[1];
        resolve(Vbase64);
    }
    reader.onerror = error => reject(error);
});

async function filetoArrayBytes(file) {
    const buffer = await file.arrayBuffer();      // raw bytes
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    console.log(atob(btoa(binary)).slice(0, 10));
    return btoa(binary); // Base64 of raw bytes
}
async function fileToBase6UTF16(file) {
    const buffer = await file.arrayBuffer();
    const base64 = btoa(
        String.fromCharCode(...new Uint8Array(buffer))
    );
    console.log(atob(base64));
    return base64;
}
async function fileToBase64Blob(file) {
    const buffer = await file.arrayBuffer();
    return await new Promise((resolve, reject) => {
        const blob = new Blob([buffer]);
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}


const filetoBase64 = file => new Promise((resolve, reject) => {
const reader = new FileReader();
reader.readAsDataURL(file);
reader.onload = () => resolve(reader.result);
reader.onerror = reject;
});


function extractFirstJsonfromText(t_RawText) {
    const start = t_RawText.indexOf('[');
    if (start === -1) return null;

    let braceCount = 0;

    for (let i = start; i < t_RawText.length; i++) {
        if (t_RawText[i] === '[') braceCount++;
        if (t_RawText[i] === ']') braceCount--;

        if (braceCount === 0) {
            return t_RawText.substring(start, i + 1);
        }
    }

    return null;
}
async function serverAPI(query = {}, apiEndpoint = "read", apiMethod = "GET", payload = {}, options = {}) {
    const correlationId = generateCorrelationId();
    let retries = 3;
    let DelaySecs = 3;
    let queryString = "";
    for (const key in query) {
        queryString += encodeURIComponent(key) + "=" + encodeURIComponent(query[key]) + "&";
    }
    if (queryString.length > 0) {
        queryString = queryString.substring(0, queryString.length - 1); // chop off last "&"
        iURL = `/serverhost/${apiEndpoint}` + "?" + queryString;
    }
    let response;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            if (apiMethod == "GET") {
                response = await fetch(iURL, {
                    ...options,
                    headers: {
                        ...(options.headers || {}),
                        "X-Correlation-Id": correlationId,
                        "Content-Type": "application/json"
                    },
                    method: apiMethod
                });
            } else {
                response = await fetch(iURL, {
                    ...options,
                    headers: {
                        ...(options.headers || {}),
                        "X-Correlation-Id": correlationId,
                        "Content-Type": "application/json"
                    },
                    method: apiMethod,
                    body: JSON.stringify(payload)
                });
            }
            return await normalizeResponse(response, iURL);
        }
        catch (err) {
            if (attempt === retries) throw err;
            await sleep(DelaySecs);
        }
    }
}
