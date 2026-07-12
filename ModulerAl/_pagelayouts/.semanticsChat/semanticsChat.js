const chatWindow = document.getElementById('chat-window');
const textInput = document.getElementById('text-input');
const sendBtn = document.getElementById('send-btn');
const progressText = document.getElementById('progress-text');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const historyListContainer = document.getElementById('history-list');
var sessionID = getrandomString(21, 21);/*create Session ID*/
let currentChat = [];

function appendMessage(text, role) {
    const msg = document.createElement('div');
    msg.classList.add('chat-msg', role); // Purely class-based
    msg.textContent = text;
    chatWindow.appendChild(msg);
    chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });
}

function simulateResponse() {
    const val = textInput.value.trim();
    if (!val) return;

    appendMessage(val, 'user');
    textInput.value = '';

    // Updating progress text
    let percent = 0;
    const interval = setInterval(() => {
        percent += 25;
        progressText.textContent = `Agent processing... ${percent}%`;
        if (percent >= 100) {
            clearInterval(interval);
            progressText.textContent = "";
            appendMessage("Request processed successfully.", "bot");
        }
    }, 400);
}

sendBtn.addEventListener('click', triggerAgent);
textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        triggerAgent();
    }
});
uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        for (var int_FileIndex = 0; int_FileIndex < fileInput.files.length; int_FileIndex++) {
            appendMessage(`File Attached: ${fileInput.files[int_FileIndex].name}`, 'user');
        }
        progressText.textContent = "Processing attachment(s)...";
        setTimeout(() => {
            progressText.textContent = "";
            appendMessage("File received(s)", "bot");
        }, 1500);
    }
});


async function triggerAgent() {
    sessionID = getrandomString(21, 21);/*create Session ID*/
    let o_Attachments = [];
    console.log(sessionID);
    let d_currentDate = new Date(Date.now()).toString();
    var agentResponse;
    var RequestID;
    if (fileInput.files.length === 0) {
        progressText.textContent = "Please select a file first.";
        return;
    }
    let l_FIleNames = [];
    for (var int_FileIndex = 0; int_FileIndex < fileInput.files.length; int_FileIndex++) {
        const file = fileInput.files[int_FileIndex];
        l_FIleNames.push(file.name)
    }
    var userPrompt = textInput.value.trim();
    appendMessage(userPrompt, "user");
    textInput.value = '';
    appendMessage("User Instruction Recieved", "bot");
    /*Identify the Solution*/
    progressText.textContent = "Identifying the right Agent to assign the task...";
    agentResponse = await planbyUserFeed(userPrompt, l_FIleNames);
    console.log(agentResponse);
    var Gesture = JSON.parse(agentResponse.body);
    appendMessage(Gesture.result.Reasoning, "bot");
    var MethodIdentified = Gesture.result.Method;
    progressText.textContent = "Assigning Agent (read the chat for my Reasoning...)";
    switch (MethodIdentified) {
        case "InvoiceAgentCall":
        case "ReconAgentCall":
            /*upload to S3*/
            progressText.textContent = "Placing Documents into S3 Bucket...";
            for (var int_FileIndex = 0; int_FileIndex < fileInput.files.length; int_FileIndex++) {
                const file = fileInput.files[int_FileIndex];
                agentResponse = await putDocument(file, sessionID);
                console.log(agentResponse);
            }
            await sleep(5);
            progressText.textContent = "Understanding the document upolaoded...";
            agentResponse = await invokeAgent(MethodIdentified, `input date : ${d_currentDate} /n S3FolderPath: s3://invoice-mail-bucket/mail-messages/${sessionID}/`);
            console.log(agentResponse);
            RequestID = agentResponse.RequestID;
            console.log(RequestID);
            var f_Wait = true;
            progressText.textContent = "Processing the data";
            var t_ExtractionResult;
            do {
                await sleep(60);
                agentResponse = await checkAgentStatus(RequestID);
                console.log(agentResponse);
                var t_Status = agentResponse.Status;
                if (t_Status == 'New' || t_Status == 'In Progress') {
                    f_Wait = true;
                    progressText.textContent = "Getting Results from Agent...";
                } else {
                    f_Wait = false;
                    progressText.textContent = "Agent has completed the task...";
                    t_ExtractionResult = agentResponse.ExecutionResult.body.agent_response;
                }
            } while (f_Wait);
            console.log(t_ExtractionResult);
            const jsonString = extractFirstJsonfromText(t_ExtractionResult);

            let parsedData = null;
            let chatOnly = t_ExtractionResult;

            if (jsonString) {
                parsedData = JSON.parse(jsonString);
                console.log(parsedData);
                chatOnly = t_ExtractionResult.replace(jsonString, "").trim();
                if (chatOnly.length <= 5) {
                    chatOnly = parsedData[0].QC_Comments;
                    console.log("1st QC Comments :", chatOnly);
                }
                if (chatOnly === undefined) {
                    chatOnly = "Click here for your output"
                    console.log("Fall back Comments :", chatOnly)
                }
            }
            appendMessage(chatOnly, "bot");
            console.log(`Agent Says : ${chatOnly}`);
            break;
        case "EmailTriggerRecon":
            /*triggerEmail*/
            o_Attachments = [];
            for (var int_FileIndex = 0; int_FileIndex < fileInput.files.length; int_FileIndex++) {
                const file = fileInput.files[int_FileIndex];
                const b64 = await fileToBase64Blob(file);
                o_Attachments.push({
                    "Name": file.name,
                    "ContentBytes": { "$content-type": file.type, "$content": b64 }
                })
            }
            agentResponse = await postEmailRequest("recon aiagent", "Test Email", o_Attachments);
            console.log(agentResponse);
            appendMessage(agentResponse.Status, "bot");
            break;
        case "EmailTriggerInvoice":
            /*triggerEmail*/
            o_Attachments = [];
            for (var int_FileIndex = 0; int_FileIndex < fileInput.files.length; int_FileIndex++) {
                const file = fileInput.files[int_FileIndex];
                const b64 = await fileToBase64Blob(file);
                o_Attachments.push({
                    "Name": file.name,
                    "ContentBytes": { "$content-type": file.type, "$content": b64 }
                })
            }
            agentResponse = await postEmailRequest("invoice aiagent", "Test Email", o_Attachments);
            console.log(agentResponse);
            appendMessage(agentResponse.Status, "bot");
            break;
    }




}
async function name(params) {
    //old
    const b64 = await filetoBase64(file);
    console.log(b64.substring(0, 10));
    console.log(atob(b64).substring(0, 5));


    //new                
    const file = fileInput.files[0];

    // Read file as PURE binary
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Convert binary → Base64 (browser-safe)
    let binary = "";
    const chunkSize = 0x8000; // prevents stack overflow for large files

    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    const base64 = btoa(binary); // clean, single-line Base64


}
async function putDocument(o_file, sessionID) {
    try {
        var requestBody = await toBase64(o_file);
        response = await apiProxy(
            'PUT',
            'https://btov4mm75g.execute-api.us-east-1.amazonaws.com/dev/FinalResource',
            requestBody,
            o_file.type,
            "BINARY",
            {
                "filename": `${sessionID}/${o_file.name}`
            }
        );
        return response;
    } catch (error) {
        return `Error Uploading File to S3:${error}`
    }
}
async function planbyUserFeed(userPrompt, filesName) {
    var t_outcome;
    try {
        var requestBody = {
            "method": "identifyMethod",
            "parameters": {
                "prompt": `Role: You are an Orchestration Agent responsible for routing user requests to the correct specialized AI Agent.
                            Available Agents:
                            InvoiceAgentCall: Use for invoice extraction, billing queries, or document processing.
                            ReconAgentCall: Use for bank reconciliation and financial matching tasks.
                            EmailTriggerRecon: Use for sending emails or triggering communications to bank reconciliation.
                            EmailTriggerInvoice: Use for sending emails or triggering communications for invoice extraction, billing queries.
                            Task: Analyze the user message: ${userPrompt} Files Attached: ${filesName.join(",")}.
                            Response Format: Return a strict JSON object only:
                            JSON
                            {
                            "Reasoning": "Brief explanation of why this agent was selected based on the intent.",
                            "Method": "SelectedAgentName"
                            }`
            }
        }
        console.log(requestBody);
        response = await apiProxy(
            'POST',
            'https://btov4mm75g.execute-api.us-east-1.amazonaws.com/dev/FinalResource',
            JSON.stringify(requestBody),
            "application/json"
        );
        return response;
    } catch (error) {
        return `Error understanding user Message: ${error}`
    }

}
async function invokeAgent(t_AgentName, t_UserPrompt) {
    try {
        var requestBody = {
            "method": t_AgentName,
            "parameters": {
                "prompt": t_UserPrompt
            }
        };
        response = await apiProxy(
            'POST',
            'https://btov4mm75g.execute-api.us-east-1.amazonaws.com/dev/FinalResource',
            JSON.stringify(requestBody),
            "application/json"
        );
        return response;
    } catch (error) {
        return `Error Invoking the Agent:${error} `
    }
}
async function checkAgentStatus(t_requestID) {
    try {
        var requestBody = {
            "RequestID": t_requestID,
            "method": "getRequestStatus"
        };
        response = await apiProxy(
            'POST',
            'https://btov4mm75g.execute-api.us-east-1.amazonaws.com/dev/FinalResource',
            JSON.stringify(requestBody),
            "application/json"
        );
        return response;
    } catch (error) {
        return `Error Reading the Agent's status :${error}`
    }

}
async function getDocumentPreviews(sessionID, t_fileName) {
    try {
        var requestBody = {
            "method": "getFileLink",
            "parameters": {
                "key": `mail-messages/${sessionID}/${t_fileName}`,
                "previewInSeconds": "3600"
            }
        };
        response = await apiProxy(
            'POST',
            'https://btov4mm75g.execute-api.us-east-1.amazonaws.com/dev/FinalResource',
            JSON.stringify(requestBody),
            "application/json"
        );
        return response;
    } catch (error) {
        return `Error Reading the Agent's status :${error}`
    }
}

async function postEmailRequest(subjectKey, Body, Attachments) {
    try {
        var requestBody = {
            "subjectKey": subjectKey,
            "Body": Body,
            "Attachments": Attachments
        };
        console.log(requestBody);
        response = await apiProxy(
            'POST',
            'https://default095ffef99fdd4726b10061f64ad17f.21.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/3aa2a2b4cfe344deada50a770d09eec2/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=HoJ_GJM8doKfPO-3joEXId8Pdulw4kVst0azZn9dark',
            JSON.stringify(requestBody),
            "application/json"
        );
        return response;
    } catch (error) {
        return `Error Reading the Agent's status :${error}`
    }

}
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggle-history');

// Toggle sidebar visibility
toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

// JSON Logic (as before)
const chatHistory = [];//(await serverAPI({ "path": ".solutions/AiAgent/chatHistory.jsonl" })).value

function renderHistory(data) {
    const historyListContainer = document.getElementById('history-list');
    historyListContainer.innerHTML = '';
    data.forEach(item => {
        const div = document.createElement('div');
        div.classList.add('history-item');
        div.innerHTML = `
            <strong>${item.title}</strong>
            <span class="history-date">${item.date}</span>
        `;
        div.onclick = () => appendMessage(`Restoring: ${item.title}`, 'bot');
        historyListContainer.appendChild(div);
    });
}
function addHistory(currentChat) {


}
renderHistory(chatHistory);

