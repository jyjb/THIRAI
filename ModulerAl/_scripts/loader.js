let l_currentScripts = [];
let l_currentStyles = [];
let o_AppData;
let o_PageConfig;
let o_pageData;
let o_ChildPages;
let formContent;
let t_ParentPage;
async function buildPage() {
    unloadTemplate();
    spinnerActions(true);
    console.log("RUN");
    extractions = (await serverAPI({ "path": "_pagelayouts/.expensereporting/expenses", "recursive": "TRUE" }, "listfiles")).value;
    console.log(extractions);

    o_PageConfig = (await serverAPI({ "uid": 'DaO4VMWH1770828857774' })).value/*pageConfig*/;
    console.log(o_PageConfig);
    o_PageConfig = filterObjectArray(o_PageConfig, [true, 'true'], 'isvisible');
    o_AppData = (await serverAPI({ "uid": 'UfvYjzfP1770828845047' })).value/*appConfig*/;
    const t_CurrentPagetTitle = document.getElementById('pageTitle').innerText;
    const t_CurrentPageName = window.location.hash.slice(1) || 'home';
    o_ChildPages = filterObjectArray(o_PageConfig, [t_CurrentPageName], 'parent');
    o_pageData = o_PageConfig.filter(pages => pages.id == t_CurrentPageName)[0];
    if (o_ChildPages.length == 0) {
        console.log('End Of Navigation');
        o_ChildPages = filterObjectArray(o_PageConfig, [t_CurrentPageName], 'id');
    };
    const o_headerContainer = document.getElementById('page-head');
    const o_bodyContainer = document.getElementById('page-body');
    const o_TargetContainer = document.getElementById('dynamic-content-body');
    const o_ControlsContainer = document.getElementById('dynamic-content-controls');
    o_TargetContainer.className = 'main-content';
    o_TargetContainer.innerHTML = '';
    document.getElementById('pageTitle').innerText = o_pageData.title;
    const o_PageContolContainer = document.getElementsByClassName('controls-right')[0];
    o_PageContolContainer.innerText = "";

    if (o_pageData.type == 'card-page') { addCardsElement(o_TargetContainer, o_ChildPages) };
    if (t_CurrentPageName != 'home') {
        o_ControlsContainer.classList.remove('hidden');
        o_headerContainer.className = 'pages';
        o_bodyContainer.className = 'content-Body pages';
        addBackButton(o_ControlsContainer, t_ParentPage);
    } else {
        o_ControlsContainer.classList.add('hidden');
        o_headerContainer.className = 'home';
        o_bodyContainer.className = 'content-Body home';
    };
    if (o_pageData.type == 'video-page') {
        addVideoElement(o_TargetContainer, o_pageData);
    };
    if (o_pageData.type == 'form-page') {
        const l_forms = await getJSONData(o_pageData.content.datafilename);
        const t_html = await getlocalFileContent(o_ConfigData.data.templates.filter(keys => keys.key == 'tabdcontainer')[0].name);
        addFormElement(o_TargetContainer, o_pageData.content.feilds, l_forms, t_html);
    };
    if (o_pageData.type == 'template-page') {
        const t_html = await getlocalFileContent(o_pageData.content.templatefilename);
        addElementFromTemplate(o_TargetContainer, t_html)
    };

    if (o_pageData.type == 'powerbi-page') {
        addbiElements(o_TargetContainer, o_pageData);
    }
    addPageEvents();
    setDefaults();
    await setSleep(2);
    spinnerActions();
}
function addPageControls(o_Controls) {
    const o_PageContolContainer = document.getElementsByClassName('controls-right')[0];
    for (var btnIndex = 0;
        btnIndex < o_Controls.length;
        btnIndex++) {
        let o_ctrlButton = document.createElement('button');
        o_ctrlButton.className = 'btn-style btnSize';
        o_ctrlButton.innerText = o_Controls[btnIndex].title;
        o_ctrlButton.id = o_Controls[btnIndex].id;
        o_ctrlButton.type = "button";
        o_ctrlButton.title = o_Controls[btnIndex].hint;
        let t_api = o_Controls[btnIndex].api;
        o_ctrlButton.onclick = async () => {
            await runAPI(t_api, null);
            if (o_Controls.reloadsource) {
                reloadSource();
            }
        };
        o_PageContolContainer.appendChild(o_ctrlButton);
    }
} function addCardsElement(o_Container, o_pageData) {
    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'cards';
    o_pageData.forEach(card => {
        const cardElem = document.createElement('div');
        cardElem.className = 'card';
        cardElem.innerHTML = `<h3>${card.title}</h3>` + `<br> <a>${card.description}</a>`;
        if (card.redirecturl) {
            cardElem.setAttribute('href', card.redirecturl);
            cardElem.onclick = () => window.open(card.redirecturl, '_blank');
        } else {
            cardElem.onclick = () => window.location.hash = card.id;
        } cardsDiv.appendChild(cardElem);
    });
    o_Container.appendChild(cardsDiv);
} function addVideoElement(o_Container, o_pageData) {
    const iframe = document.createElement('iframe');
    iframe.src = o_pageData.content.videoUrl;
    iframe.allow = 'autoplay;fullscreen';
    o_Container.appendChild(iframe);
} function addBackButton(o_parentElement, t_Parent) {
    const o_leftcontrol = o_parentElement.getElementsByClassName('controls-left')[0];
    o_leftcontrol.innerHTML = '';
    const o_backBtn = document.createElement('button');
    o_backBtn.className = 'back-btn btnSize';
    o_backBtn.textContent = '⬅';
    o_backBtn.onclick = () => window.location.hash = t_Parent;
    o_backBtn.title = "go back";
    o_leftcontrol.appendChild(o_backBtn);
    const o_HomeBtn = document.createElement('button');
    o_HomeBtn.className = 'icon-btn btnSize';
    o_HomeBtn.textContent = '🏠';
    o_HomeBtn.onclick = () => window.location.hash = 'home';
    o_HomeBtn.title = "go to home page";
    o_leftcontrol.appendChild(o_HomeBtn);
    const o_refreshbtn = document.createElement('button');
    o_refreshbtn.className = 'icon-btn btnSize';
    o_refreshbtn.textContent = '🔄';
    console.log(window.location.hash);
    o_refreshbtn.onclick = () => {
        const o_CurrentHash = window.location.hash;
        window.location.hash = "";
        window.location.hash = o_CurrentHash;
    };
    o_refreshbtn.title = "Refresh Current Page";
    o_leftcontrol.appendChild(o_refreshbtn);
} function addElementFromTemplate(o_Container, o_pageData) {
    o_Container.innerHTML = o_pageData;
    const scripts = o_Container.querySelectorAll("script");
    scripts.forEach(oldScript => {
        const newScript = document.createElement("script");
        if (oldScript.src) {
            newScript.src = oldScript.src;
        } else {
            newScript.textContent = oldScript.textContent;
        };
        newScript.cleanup = null;
        document.body.appendChild(newScript);
        l_currentScripts.push(newScript);
        document.body.removeChild(newScript);
    });
} function addbiElements(o_Container, o_pageData) {
    console.log(o_pageData);
    addPageControls(o_pageData.content.triggers);
    let o_infHorPage = document.createElement('div');
    o_infHorPage.className = 'infititypage-h';
    for (var btnIndex = 0;
        btnIndex < o_pageData.content.dashboards.length;
        btnIndex++) {
        let o_Dashboards = document.createElement('iframe');
        o_Dashboards.src = o_pageData.content.dashboards[btnIndex];
        o_infHorPage.appendChild(o_Dashboards);
    } o_Container.appendChild(o_infHorPage);
} function addFormElement(o_Container, o_FormFeilds, o_FormData, t_formTemplate) {
    o_Container.className = 'tabbed-page';
    o_Container.innerHTML = t_formTemplate;
    const o_formCont = document.getElementById("tab-right-content-container");
    createForm(o_formCont, o_FormFeilds);
    const o_formsContent = document.getElementById("tab-left-content-container");
    createFormCards(o_formsContent, o_FormData);
} function spinnerActions(f_show = false) {
    if (f_show) {
        document.getElementById('loading-spinner').classList.remove('hidden');
    } else {
        document.getElementById('loading-spinner').classList.add('hidden');
    }
} function setSleep(n_timeDuration, t_timeValue = 'ss') {
    let n_MilliSecs;
    let n_Secs;
    let n_Mins;
    let n_Hors;
    switch (t_timeValue) {
        case 'ms': n_MilliSecs = n_timeDuration;
            break;
        case 'ss': n_Secs = n_timeDurationn_MilliSecs = Math.floor(n_Secs * 1000);
            break;
        case 'mm': n_Mins = n_timeDuration;
            n_Secs = Math.floor(n_Mins * 60);
            n_MilliSecs = Math.floor(n_Secs * 1000);
            break;
        case 'hh': n_Hors = n_timeDurationn_Mins = Math.floor(n_Hors * 60);
            n_Secs = Math.floor(n_Mins * 60);
            n_MilliSecs = Math.floor(n_Secs * 1000);
            break;
    }return new Promise(resolve => setTimeout(resolve, n_MilliSecs));
} function getWindowSize(o_ParentElement = null) {
    let o_Results;
    o_Results = { wiWidth: window.innerWidth, wiHeight: window.innerHeight, woWidth: window.outerWidth, woHeight: window.outerHeight, sWidth: screen.width, sHeight: screen.height, saWidth: window.screen.availWidth, saHeight: window.screen.availHeight, cWidth: document.documentElement.clientWidth, cHeight: document.documentElement.clientHeight, pWidth: document.documentElement.scrollWidth, pHeight: document.documentElement.scrollHeight };
    if (o_ParentElement) { o_Results.elementSize = o_ParentElement.getBoundingClientRect() } return o_Results;
} function toggleLeftPane(o_Container, o_controlbutton) {
    if (o_Container.classList.contains('collapsed')) {
        o_Container.classList.remove('collapsed');
        o_Container.classList.add('expanded');
        o_controlbutton.innerHTML = '⏴';
    } else {
        o_Container.classList.remove('expanded');
        o_Container.classList.add('collapsed');
        o_controlbutton.innerHTML = '⏵';
    };
} function unloadTemplate() {
    l_currentScripts.forEach(scriptItem => {
        try {
            if (typeof scriptItem.cleanup === "function") scriptItem.cleanup();
        } catch (e) {
            console.warn("Cleanup failed for script:", e);
        } scriptItem.remove();
    });
    l_currentScripts = [];
    l_currentStyles.forEach(styleItem => styleItem.remove());
    l_currentStyles = [];
} function reloadSource() {
    const myIframes = document.getElementsByTagName('iframe');
    for (var n_iIndex = 0;
        n_iIndex < myIframes.length;
        n_iIndex++) {
        myIframes[n_iIndex].src = myIframes[n_iIndex].src;
    };
    document.getElementsByClassName('controls-right')[0].innerText = "";
} function showNotification(message, type) {
    const jsonString = JSON.stringify(message, null, 2);
    const noti = document.getElementById('notification');
    noti.innerHTML = '';
    const o_DataContent = document.createElement('pre');
    o_DataContent.className = 'noti-content';
    o_DataContent.textContent = jsonString;
    noti.appendChild(o_DataContent);
    noti.className = `notification ${type}`;
    noti.classList.remove('hidden');
    setTimeout(() => noti.classList.add('hidden'), 15000);
} async function runAPI(l_apiURL, o_apiBody) {
    spinnerActions(true);
    let response;
    try {
        l_apiURL.forEach(function (t_apiURL) { }

        )
        const res = await fetch(t_apiURL, { method: 'POST', body: JSON.stringify(o_apiBody || {}) });
        response = await res.json();
    } catch (e) {
        response = { status: 'error', reason: e.message };
    } spinnerActions();
    // showNotification(response.status === 'success' ? 'Success!' : `Failure: ${response.reason}`, response.status);
} function createForm(o_ParentElement, o_FormFeilds) {
    o_FormFeilds.push({ "label": "Entry ID", "type": "text", "id": "entryID", "page": 0, "rowindex": 0, "mode": "hide" });
    o_FormFeilds.push({ "label": "Data Unique Title", "type": "text", "id": "datauniquetitle", "page": 0, "rowindex": 0, "mode": "hide" });
    const o_Form = document.createElement('form');
    o_Form.className = 'form-container';
    o_Form.id = getrandomString();
    let n_PrevRowIndex = -1;
    let o_FormRow;
    let n_CurRowIndex;
    for (var n_fieldIndex = 0;
        n_fieldIndex < o_FormFeilds.length;
        n_fieldIndex++) {
        n_CurRowIndex = o_FormFeilds[n_fieldIndex].rowindex;
        if (n_fieldIndex > 0) {
            n_PrevRowIndex = o_FormFeilds[n_fieldIndex - 1].rowindex;
        } if (n_fieldIndex != 0 && n_PrevRowIndex == n_CurRowIndex) { } else {
            o_FormRow = createNewElement(o_Form, 'div', 'form-row', getrandomString());
        } const o_Formfeild = createNewElement(o_FormRow, 'div', 'form-feild', getrandomString());
        const o_label = createNewElement(o_Formfeild, 'label', getrandomString(), getrandomString(), o_FormFeilds[n_fieldIndex].label);
        o_Formfeild.appendChild(o_label);
        o_label.setAttribute('for', o_FormFeilds[n_fieldIndex].id);
        let o_input;
        switch (o_FormFeilds[n_fieldIndex].type) {
            case 'textarea': o_input = createNewElement(o_Formfeild, 'textarea', getrandomString(), o_FormFeilds[n_fieldIndex].id);
                break;
            case 'number': case 'text': o_input = createNewElement(o_Formfeild, 'input', getrandomString(), o_FormFeilds[n_fieldIndex].id);
                o_input.type = o_FormFeilds[n_fieldIndex].type;
                if (o_FormFeilds[n_fieldIndex].values) {
                    let t_listid = getrandomString();
                    o_input.setAttribute('list', t_listid);
                    let o_Suggestions = createNewElement(o_Formfeild, 'datalist', '', t_listid);
                    for (var n_dataIndex = 0;
                        n_dataIndex < o_FormFeilds[n_fieldIndex].values.length;
                        n_dataIndex++) {
                        o_Suggestions.innerHTML += ' <option value="' + o_FormFeilds[n_fieldIndex].values[n_dataIndex] + '"> ';
                    }
                } break;
            case 'number': console.log("only for date");
                break;
            case 'date': case 'time': case 'datetime-local': case 'datetime': o_input = createNewElement(o_Formfeild, 'input', getrandomString(), o_FormFeilds[n_fieldIndex].id);
                o_input.type = o_FormFeilds[n_fieldIndex].type;
                if (o_FormFeilds[n_fieldIndex].default in ["today", "now"]) {
                    const o_now = new Date(); o_now.setMinutes(o_now.getMinutes() - o_now.getTimezoneOffset()); const formattedDateTime = o_now.toISOString().slice(0, 16); o_input.value = formattedDateTime;
                }
                break;
            case 'multiselect': o_input = createMultiselect(o_FormFeilds[n_fieldIndex].id, o_FormFeilds[n_fieldIndex].values);
        } o_Formfeild.appendChild(o_input);
        o_input.name = o_FormFeilds[n_fieldIndex].id;
        o_input.placeholder = o_FormFeilds[n_fieldIndex].placeholder;
        switch (o_FormFeilds[n_fieldIndex].mode) {
            case 'hide': o_FormRow.classList.add('hidden'); break;
            case 'disable': o_input.disabled = true; break;
        }        if (o_FormFeilds[n_fieldIndex].default) {
            o_input.value = o_FormFeilds[n_fieldIndex].default;
        } if (o_FormFeilds[n_fieldIndex].label == "Entry ID") {
            o_input.value = getrandomString();
        } if (o_FormFeilds[n_fieldIndex].onchange) {
            const t_functionName = "on_" + o_FormFeilds[n_fieldIndex].id + '_' + getrandomString(5, 13);
            o_input.setAttribute('onchange', t_functionName + "(this)");
            const o_Script = document.createElement('script');
            o_Script.innerText = 'function ' + t_functionName + '(o_Element){ ' + o_FormFeilds[n_fieldIndex].onchange + ' console.log("running script for :' + o_FormFeilds[n_fieldIndex].label + '")}';
            o_Formfeild.appendChild(o_Script);
        } o_FormRow.appendChild(o_Formfeild);
        o_Form.appendChild(o_FormRow);
    } o_ParentElement.appendChild(o_Form);
} function createMultiselect(t_fieldID, l_Choices) {
    const o_MultiChoiceContainer = document.createElement('div');
    o_MultiChoiceContainer.className = 'multiselectcontainer';
    o_MultiChoiceContainer.id = t_fieldID;
    const o_MultiChoiceInput = createNewElement(o_MultiChoiceContainer, "div", "multiselector", getrandomString(), "<span class = 'multiselectplaceholder' >Select options...</span> <span class = 'optiontags' ></span>");
    o_MultiChoiceInput.onclick = () => toggleDropdown(t_fieldID);
    const o_MultiChoiceOptions = createNewElement(o_MultiChoiceContainer, "div", "multioptions", getrandomString());
    o_MultiChoiceOptions.style = "display:none;";
    for (var n_optionIndex = 0;
        n_optionIndex < l_Choices.length;
        n_optionIndex++) {
        const o_choiceID = getrandomString();
        const o_ochoice = document.createElement('div');
        o_ochoice.className = "ochoice";
        o_ochoice.id = o_choiceID;
        const o_lable = document.createElement('label');
        const o_input = document.createElement('input');
        o_input.id = o_choiceID;
        o_input.title = l_Choices[n_optionIndex];
        o_input.type = "checkbox";
        o_input.name = l_Choices[n_optionIndex];
        o_input.value = l_Choices[n_optionIndex];
        o_lable.id = o_choiceID;
        o_lable.innerText = l_Choices[n_optionIndex];
        o_lable.setAttribute('for', l_Choices[n_optionIndex]);
        o_ochoice.appendChild(o_input);
        o_ochoice.appendChild(o_lable);
        o_ochoice.onclick = () => addOptionChoice(t_fieldID, o_choiceID);
        o_MultiChoiceOptions.appendChild(o_ochoice);
    } return o_MultiChoiceContainer;
} function createFormCards(o_ParentElement, o_CardData) {
    o_ParentElement.innerText = "";
    for (var n_cardIndex = 0;
        n_cardIndex < o_CardData.length;
        n_cardIndex++) {
        let o_CardCon = createNewElement(o_ParentElement, 'div', 'cardsContent', getrandomString(), '<a class ="smallText">' + o_CardData[n_cardIndex].title + '</a> <a class ="smallerText"> ' + o_CardData[n_cardIndex].submittedby + ' </a> <a class ="smallerText"> ' + o_CardData[n_cardIndex].date + ' </a>');
        const o_par1 = o_CardData[n_cardIndex].datafileid;
        const o_par2 = o_CardData[n_cardIndex].datafilename;
        o_CardCon.onclick = () => setFormData(o_par1, o_par2);
    };
} function createNewElement(o_ParentElement, t_elementType, t_className, t_elementID = "", t_elementContent = "") {
    const o_newContainer = document.createElement(t_elementType);
    o_newContainer.className = t_className;
    o_newContainer.id = t_elementID;
    o_newContainer.innerHTML = t_elementContent;
    o_ParentElement.appendChild(o_newContainer);
    return o_newContainer;
}
function multiselectItems(t_fieldID, l_Defaults) { console.log(t_fieldID); const o_Element = document.getElementById(t_fieldID); l_Defaults.forEach(function (t_thisItem, n_iIndex) { o_rerElement = o_Element.querySelector('.multioptions input[type="checkbox"][value="' + t_thisItem + '"]'); addOptionChoice(t_fieldID, o_rerElement.id); }) }
function clearForm() {
    const inputs = document.querySelectorAll('.form-feild > input, .form-feild > textarea');
    inputs.forEach(i => i.value = '');
} function getFormData() {
    const o_data = {};
    const o_inputFeilds = document.querySelectorAll('.form-feild > input, .form-feild > textarea');
    o_inputFeilds.forEach(i => o_data[i.id] = i.value);
    const o_AllMultibox = document.querySelectorAll('.multiselectcontainer');
    Array.from(o_AllMultibox).forEach(function (oMultiBox) {
        selectedCheckboxes = oMultiBox.querySelectorAll('.multioptions input[type="checkbox"]:checked');
        o_data[oMultiBox.id] = Array.from(selectedCheckboxes).map(checkedData => checkedData.value);
    });
    return o_data;
} function toggleDropdown(t_ElemetID) {
    const o_MulSelContainer = document.getElementById(t_ElemetID);
    const o_optContainer = o_MulSelContainer.querySelector('.multioptions');
    if (o_optContainer) {
        o_optContainer.style.display = o_optContainer.style.display === 'none' ? 'block' : 'none';
    }
} function updateSelection(t_ElemetID, o_Elements) {
    const o_tagsContainer = document.getElementById(t_ElemetID).querySelector('.optiontags');
    o_tagsContainer.innerHTML = '';
    const o_selectedOptions = Array.from(o_Elements);
    document.getElementById(t_ElemetID).querySelector('.multiselectplaceholder').style.display = 'none';
    o_selectedOptions.forEach(option => {
        const tag = document.createElement('span');
        tag.classList.add('otag');
        tag.innerHTML = option.value;
        tag.onclick = () => addOptionChoice(t_ElemetID, option.id);
        o_tagsContainer.appendChild(tag);
    });
} function addOptionChoice(t_ElemetID, t_optionID) {
    const o_MulSelContainer = document.getElementById(t_ElemetID);
    const o_ThisElement = o_MulSelContainer.querySelector('input[type="checkbox"][id="' + t_optionID + '"]');
    o_ThisElement.checked = o_ThisElement.checked === true ? false : true;
    const o_Selecteditems = o_MulSelContainer.querySelectorAll('input[type="checkbox"]:checked');
    if (o_Selecteditems) {
        updateSelection(t_ElemetID, o_Selecteditems);
        if (o_Selecteditems.length == 0) {
            document.getElementById(t_ElemetID).querySelector('.multiselectplaceholder').style.display = 'block';
        }
    }
} function addPageEvents() {
    window.addEventListener('hashchange', buildPage);
    document.addEventListener("DOMContentLoaded", () => {
        PageManager.init("dynamic-content-body");
    });
    document.addEventListener('click', function (event) {
        if (!event.target.classList.contains('multiselector')) {
            document.querySelectorAll('.multioptions').forEach(o_Con => {
                if (!o_Con.contains(event.target)) {
                    o_Con.style.display = 'none';
                }
            });
        } if ((!event.target.classList.contains('notification')) && (event.target.id != "results-pop-show")) {
            document.getElementById('notification').classList.add('hidden');
        }
    });
} function setDefaults() {
    document.querySelectorAll('input[type="datetime-local"]').forEach(o_Con => { const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); const formattedDateTime = now.toISOString().slice(0, 16); o_Con.value = formattedDateTime; });
}
function updatedataform(o_formData) {
    let o_formFeilds = document.querySelectorAll('form .form-feild > input,form .form-feild > textarea');
    o_formFeilds.forEach(o_eleItem => o_eleItem.value = o_formData[o_eleItem.id]);


}
