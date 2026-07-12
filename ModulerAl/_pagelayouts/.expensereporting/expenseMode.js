// Global variable to store our fetched data


// Basic navigation logic
function navigate(targetPageId) {
    const pages = document.querySelectorAll('.page-content');
    pages.forEach(page => page.classList.remove('active-page'));
    document.getElementById(targetPageId).classList.add('active-page');
}
let appData = null;
let t_thisFilePath =null;
// Initialize application by fetching the JSON
async function loadPage(t_PageName, t_ReportPath) {
    try {

        if (t_PageName == 'report') {
            oFiles = (await serverAPI({ "path": t_ReportPath, "recursive": "TRUE" , "ext": "json"}, "listfiles")).value;
            appData = oFiles.filter(file => file.Type === '.json');
            console.log(appData);
            //, "ext": "json" 
            loadReportTablePage(appData);
        }
        else if (t_PageName == 'record') {
            appData = (await serverAPI({ "path": t_ReportPath })).value;
            t_thisFilePath= t_ReportPath.substring(0, t_ReportPath.lastIndexOf('/'));
            loadRecordsPage(appData);
        }
        else if (t_PageName == 'recipt') {
            console.log(appData);
            //appData = (await serverAPI({ "path": t_ReportPath })).value;
            loadreciptFormPage(t_ReportPath, appData)
        }
        document.getElementById('loading-msg').style.display = 'none';
        document.getElementById('report-table-container').style.display = 'block';

    } catch (error) {
        console.error("Could not load JSON data:", error);
        document.getElementById('loading-msg').innerHTML =
            `<span style="color: var(--danger);">Failed to load JSON data. Make sure you are running a local web server (e.g., VS Code Live Server) and not just opening the file directly in the browser.</span>`;
    }
}

// Render Page 1 (Report Table)
function loadReportTablePage(appData) {
    const tbody = document.getElementById('page1-tbody');

    let tRows = []
    for (var int_FileIndex = 0; int_FileIndex < appData.length; int_FileIndex++) {
        iRow = appData[int_FileIndex];
        tRows.push(
            `
                <tr>
                    <td style="font-weight: 500;" title="${iRow.Name}">${iRow.Name}</td>
                    <td>${iRow.CreatedAt}</td>
                    <td><span style="background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">Draft Review</span></td>
                    <td style="text-align: right;">
                        <button class="btn btn-primary" onclick="loadPage('record','${(iRow.Path).replace(/\\/g, '/')}')">View Detail</button>
                    </td>
                </tr>
            `);

    }
    console.log(appData);
    tbody.innerHTML = tRows.join(" ");
}

// Render Page 2 (Line Items Table)
function loadRecordsPage(appData) {
    navigate('page2');
    // Set dynamic header
    const meta = appData.report_metadata;
    document.getElementById('page2-header').textContent = `Line Items: ${meta.OnBehalfOf} - ${meta.SentOn}`;

    const tbody = document.getElementById('page2-tbody');
    tbody.innerHTML = ''; // Clear previous contents

    // Loop through the receipts array in the JSON and create rows dynamically
    appData.receipts.forEach((receipt, index) => {
        tbody.innerHTML += `
                    <tr>
                        <td style="font-family: monospace; color: var(--text-muted);">${receipt.receipt_id}</td>
                        <td style="font-weight: 500;">${receipt.MerchantName}</td>
                        <td>${receipt.receiptdate}</td>
                        <td>$${receipt.total_amount}</td>
                        <td style="text-align: right;">
                            <button class="btn" onclick='loadPage("recipt",${index})'>View</button>
                        </td>
                    </tr>
                `;
    });
}

// Render Page 3 (Dynamic Form View based on selected index)
function loadreciptFormPage(receiptIndex, appData) {
    navigate('page3');
    const receipt = appData.receipts[receiptIndex];
    const meta = appData.report_metadata;
    // Extract the first line item for detailed classification if available
    const primaryLineItem = receipt.line_items && receipt.line_items.length > 0
        ? receipt.line_items[0]
        : { expense_type: 'Unknown', gl_code: 'Unknown' };

    // Inject the data directly into the input fields by ID
    document.getElementById('f-expense-type').value = primaryLineItem.expense_type;
    document.getElementById('f-date').value = receipt.receiptdate;
    document.getElementById('f-currency').value = receipt.currency;
    document.getElementById('f-total').value = receipt.total_amount;
    document.getElementById('f-merchant').value = receipt.MerchantName;
    document.getElementById('f-comment').value = receipt.Task;
    document.getElementById('f-location').value = receipt.Location || 'Not Provided';
    document.getElementById('f-attachment').textContent = receipt.filename;
    document.getElementById('btAttachment').onclick = () => openFile(receipt.filename, t_thisFilePath);

    // Bottom section
    document.getElementById('f-billable-title').textContent = `${receipt.Billable_Status}: $${receipt.total_amount}`;
    document.getElementById('f-client').value = receipt.Client;
    document.getElementById('f-gl').value = primaryLineItem.gl_code;
    document.getElementById('f-employee').value = meta.OnBehalfOf;
    document.getElementById('f-amount').value = receipt.total_amount;

    // Build a dynamic narrative string
    document.getElementById('f-narrative').value =
        `MERCHANT: ${receipt.MerchantName}, Date: ${receipt.receiptdate}, TASK: ${receipt.Task}`;
}

async function openFile(t_FileName, t_FilePath) {
    console.log(t_FileName);
    t_FileName = t_FileName.replace('.jfif','.jpeg')
    cfview = (await serverAPI({ "path": t_FilePath + "/" + t_FileName }, "view"));
    console.log(cfview);
    createFloatingBlobViewer(cfview.value, t_FileName);
    
    console.log(cfview);


}