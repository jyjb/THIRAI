async function opfg() {
    const progressBar = document.getElementById("progress");

    const result = await fetchget(
        "/api/serverhost/file?path=.solutions/expenseprocessing/ySgt1770738979453/Uber Cab_1st Oct_Eve.pdf",
        {
            onProgress: percent => {
                progressBar.value = percent;
            }
        }
    );
    console.log(result);
    const pdfblob = new Blob([result.value], { type: "application/pdf" })
    const iURL = URL.createObjectURL(pdfblob);

    // ---- IMPORTANT FIX ----
    // Store the blob URL so the viewer page can read it
    sessionStorage.setItem("activePdfBlob", iURL);

    // Now load the viewer page
    // document.getElementById("pdfViewer").src = "pdf-viewer.html";
    document.getElementById("pdfViewer").src = `pdf-viewer.html?src=${encodeURIComponent(iURL)}`;

    //document.getElementById("pdfViewer").data = iURL;

    console.log(document.getElementById("pdfViewer"));
}


/*
"Q:\Shared drives\BPI ShowCase 360\_data\.solutions\expenseprocessing\ySgt1770738979453\Uber Cab_1st Oct_Eve.pdf"

const config = await FileClient.fetchFile(
    "/api/serverhost/file?path=config.json"
);


const text = await FileClient.fetchFile(
    "/api/serverhost/file?path=notes.txt"
);



const result = await FileClient.fetchFile(
    "/api/serverhost/file?path=document.pdf",
    {
        onProgress: percent => {
            progressBar.value = percent;
        }
    }
);

await FileClient.fetchFile(
    "/api/serverhost/file?path=image.png"
);

document.getElementById("img").src = img.objectUrl;

*/


async function ProxyApiRequest(apiMethod, apiURL, apiBody, apiQuery, apiHeaders, apiContentType, apiAuthorization) {
    const localProxyUrl = "/serverhost/http";
    if (!(apiQuery === null) && !(typeof apiQuery === 'undefined')) {
        console.log(apiQuery);
        console.log("line 315:apiQuery");
        const queryString = new URLSearchParams(apiQuery);
        apiURL = `${apiURL}?${queryString}`;
    }
    console.log("line 319:URL :" + apiURL);
    const response = await fetch(localProxyUrl, {
        method: apiMethod,
        headers: {
            "X-Target-Url": apiURL,
            "Content-Type": apiContentType
        },
        body: apiBody
    });

    if (!response.ok) {
        throw new Error(`HTTP error: status ${response.status}`);
    }
    const data = await response.json();
    console.log("Success:", data);
    return data;
}

try {
    var thisSelect = document.getElementById('reportViewer_ctl08_ctl05_ddValue');
    var newOption = 'WW Enterprises 401(k) Plan'
    for (var oprindex = 0; oprindex < thisSelect.options.length; oprindex++) {
        var opt = thisSelect.options[oprindex].text;
        //console.log(opt);
        if (opt.startsWith('Double')){
            console.log(`Select : ${opt}`);
            thisSelect.options[oprindex].selected = true;
            //console.log(thisSelect.options[oprindex].text);
        }
    }
} catch (ex) { console.error(ex) }