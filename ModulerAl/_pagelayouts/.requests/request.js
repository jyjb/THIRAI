async function uploadFile() {
    const sessionID = getrandomString(21, 21);/*create Session ID*/
    console.log(sessionID);
    var agentResponse;
    var RequestID;

    const fileInput = document.getElementById('fileInput');
    const status = document.getElementById('status');
    if (fileInput.files.length === 0) {
        status.innerText = "Please select a file first.";
        return;
    }
    /*upload to S3*/
    status.innerText = "Placing Documents into S3 Bucket...";
    for (var int_FileIndex = 0; int_FileIndex < fileInput.files.length; int_FileIndex++) {
        const file = fileInput.files[int_FileIndex];
        agentResponse = await putDocument(file, sessionID);
        console.log(agentResponse);
    }
    await sleep();
    /*Identify the Solution*/
    status.innerText = "Identifying the right Agent to assign the task...";
    await sleep();
    status.innerText = "Assigning Agent...";
    await sleep();
    status.innerText = "Understanding the document upolaoded...";
    agentResponse = await invokeAgent('InvoiceAgentCall', `Today is ${new Date()}, Extract the invoice detail from the file in folder -s3://invoice-mail-bucket/mail-messages/${sessionID}`);
    console.log(agentResponse);
    RequestID = agentResponse.RequestID;
    console.log(RequestID);
    var f_Wait = true;
    status.innerText = "Extracting data...";
    var t_ExtractionResult;
    do {
        await sleep(60);
        agentResponse = await checkAgentStatus(RequestID);
        console.log(agentResponse);
        var t_Status = agentResponse.Status;
        if (t_Status == 'New' || t_Status == 'In Progress') {
            f_Wait = true;
            status.innerText = "Getting Results from Agent...";
        } else {
            f_Wait = false;
            status.innerText = "Agent has completed the task...";
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
        console.log(`Agent Says : ${chatOnly}`);
    }


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
async function planbyUserFeed() {
    var t_outcome;
    try {
        return response;


    } catch (error) {
        return `Error understanding user Meassage:${error}`
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
        return `Error Invoking the Agent :${error}`
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