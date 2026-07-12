function createForm(o_ParentElement, o_FormFeilds) {
    o_FormFeilds.push({ "label": "Entry ID", "type": "text", "id": "entryID", "page": 0, "rowindex": 0, "mode": "hide" });
    o_FormFeilds.push({ "label": "Data Unique Title", "type": "text", "id": "datauniquetitle", "page": 0, "rowindex": 0, "mode": "hide" });
    
    const o_Form = document.createElement('form');
    o_Form.className = 'form-container';
    o_Form.id = getrandomString();
    
    let n_PrevRowIndex = -1;
    let o_FormRow;
    let n_CurRowIndex;
    
    for (var n_fieldIndex = 0; n_fieldIndex < o_FormFeilds.length; n_fieldIndex++) {
        n_CurRowIndex = o_FormFeilds[n_fieldIndex].rowindex;
        
        if (n_fieldIndex > 0) {
            n_PrevRowIndex = o_FormFeilds[n_fieldIndex - 1].rowindex;
        } 
        
        if (n_fieldIndex != 0 && n_PrevRowIndex == n_CurRowIndex) { 
            // Stay in the same row
        } else {
            o_FormRow = createNewElement(o_Form, 'div', 'form-row', getrandomString());
        } 
        
        const o_Formfeild = createNewElement(o_FormRow, 'div', 'form-feild', getrandomString());
        const o_label = createNewElement(o_Formfeild, 'label', getrandomString(), getrandomString(), o_FormFeilds[n_fieldIndex].label);
        
        o_Formfeild.appendChild(o_label);
        o_label.setAttribute('for', o_FormFeilds[n_fieldIndex].id);
        
        let o_input;
        switch (o_FormFeilds[n_fieldIndex].type) {
            case 'textarea': 
                o_input = createNewElement(o_Formfeild, 'textarea', getrandomString(), o_FormFeilds[n_fieldIndex].id);
                break;
            case 'text': 
                o_input = createNewElement(o_Formfeild, 'input', getrandomString(), o_FormFeilds[n_fieldIndex].id);
                o_input.type = o_FormFeilds[n_fieldIndex].type;
                if (o_FormFeilds[n_fieldIndex].values) {
                    let t_listid = getrandomString();
                    o_input.setAttribute('list', t_listid);
                    let o_Suggestions = createNewElement(o_Formfeild, 'datalist', '', t_listid);
                    for (var n_dataIndex = 0; n_dataIndex < o_FormFeilds[n_fieldIndex].values.length; n_dataIndex++) {
                        o_Suggestions.innerHTML += ' <option value="' + o_FormFeilds[n_fieldIndex].values[n_dataIndex] + '"> ';
                    }
                } 
                break;
            case 'number': 
                console.log("only for date");
                break;
            case 'date': 
            case 'time': 
            case 'datetime-local': 
            case 'datetime': 
                o_input = createNewElement(o_Formfeild, 'input', getrandomString(), o_FormFeilds[n_fieldIndex].id);
                o_input.type = o_FormFeilds[n_fieldIndex].type;
                if (o_FormFeilds[n_fieldIndex].default in ["today", "now"]) {
                    const o_now = new Date(); 
                    o_now.setMinutes(o_now.getMinutes() - o_now.getTimezoneOffset()); 
                    const formattedDateTime = o_now.toISOString().slice(0, 16); 
                    o_input.value = formattedDateTime;
                }
                break;
            case 'multiselect': 
                o_input = createMultiselect(o_FormFeilds[n_fieldIndex].id, o_FormFeilds[n_fieldIndex].values);
        } 
        
        o_Formfeild.appendChild(o_input);
        o_input.name = o_FormFeilds[n_fieldIndex].id;
        
        // Handle placeholders and modes safely
        if (o_FormFeilds[n_fieldIndex].placeholder) {
            o_input.placeholder = o_FormFeilds[n_fieldIndex].placeholder;
        }

        switch (o_FormFeilds[n_fieldIndex].mode) {
            case 'hide': o_FormRow.classList.add('hidden'); break;
            case 'disable': o_input.disabled = true; break;
        } 
        
        if (o_FormFeilds[n_fieldIndex].default) {
            o_input.value = o_FormFeilds[n_fieldIndex].default;
        } 
        
        if (o_FormFeilds[n_fieldIndex].label == "Entry ID") {
            o_input.value = getrandomString();
        } 
        
        // Note: Dynamically injecting script tags can be risky
        if (o_FormFeilds[n_fieldIndex].onchange) {
            const t_functionName = "on_" + o_FormFeilds[n_fieldIndex].id + '_' + getrandomString(5, 13);
            o_input.setAttribute('onchange', t_functionName + "(this)");
            const o_Script = document.createElement('script');
            o_Script.innerText = 'function ' + t_functionName + '(o_Element){ ' + o_FormFeilds[n_fieldIndex].onchange + ' console.log("running script for :' + o_FormFeilds[n_fieldIndex].label + '")}';
            o_Formfeild.appendChild(o_Script);
        } 
        
        o_FormRow.appendChild(o_Formfeild);
        o_Form.appendChild(o_FormRow);
    } 
    o_ParentElement.appendChild(o_Form);
}

function createMultiselect(t_fieldID, l_Choices) {
    const o_MultiChoiceContainer = document.createElement('div');
    o_MultiChoiceContainer.className = 'multiselectcontainer';
    o_MultiChoiceContainer.id = t_fieldID;
    
    const o_MultiChoiceInput = createNewElement(o_MultiChoiceContainer, "div", "multiselector", getrandomString(), "<span class = 'multiselectplaceholder' >Select options...</span> <span class = 'optiontags' ></span>");
    o_MultiChoiceInput.onclick = () => toggleDropdown(t_fieldID);
    
    const o_MultiChoiceOptions = createNewElement(o_MultiChoiceContainer, "div", "multioptions", getrandomString());
    o_MultiChoiceOptions.style = "display:none;";
    
    for (var n_optionIndex = 0; n_optionIndex < l_Choices.length; n_optionIndex++) {
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
        o_lable.setAttribute('for', l_Choices[n_optionIndex]); // Link label to input via value, not ID
        
        o_ochoice.appendChild(o_input);
        o_ochoice.appendChild(o_lable);
        o_ochoice.onclick = () => addOptionChoice(t_fieldID, o_choiceID);
        
        o_MultiChoiceOptions.appendChild(o_ochoice);
    } 
    return o_MultiChoiceContainer;
}

function createFormCards(o_ParentElement, o_CardData) {
    o_ParentElement.innerText = "";
    for (var n_cardIndex = 0; n_cardIndex < o_CardData.length; n_cardIndex++) {
        let o_CardCon = createNewElement(o_ParentElement, 'div', 'cardsContent', getrandomString(), '<a class ="smallText">' + o_CardData[n_cardIndex].title + '</a> <a class ="smallerText"> ' + o_CardData[n_cardIndex].submittedby + ' </a> <a class ="smallerText"> ' + o_CardData[n_cardIndex].date + ' </a>');
        const o_par1 = o_CardData[n_cardIndex].datafileid;
        const o_par2 = o_CardData[n_cardIndex].datafilename;
        o_CardCon.onclick = () => setFormData(o_par1, o_par2);
    }
}

function createNewElement(o_ParentElement, t_elementType, t_className, t_elementID = "", t_elementContent = "") {
    const o_newContainer = document.createElement(t_elementType);
    o_newContainer.className = t_className;
    o_newContainer.id = t_elementID;
    o_newContainer.innerHTML = t_elementContent;
    o_ParentElement.appendChild(o_newContainer);
    return o_newContainer;
}

function multiselectItems(t_fieldID, l_Defaults) { 
    console.log(t_fieldID); 
    const o_Element = document.getElementById(t_fieldID); 
    l_Defaults.forEach(function (t_thisItem, n_iIndex) { 
        let o_rerElement = o_Element.querySelector('.multioptions input[type="checkbox"][value="' + t_thisItem + '"]'); 
        addOptionChoice(t_fieldID, o_rerElement.id); 
    });
}

function clearForm() {
    const inputs = document.querySelectorAll('.form-feild > input, .form-feild > textarea');
    inputs.forEach(i => i.value = '');
} 

function getFormData() {
    const o_data = {};
    const o_inputFeilds = document.querySelectorAll('.form-feild > input, .form-feild > textarea');
    o_inputFeilds.forEach(i => o_data[i.id] = i.value);
    
    const o_AllMultibox = document.querySelectorAll('.multiselectcontainer');
    Array.from(o_AllMultibox).forEach(function (oMultiBox) {
        let selectedCheckboxes = oMultiBox.querySelectorAll('.multioptions input[type="checkbox"]:checked');
        o_data[oMultiBox.id] = Array.from(selectedCheckboxes).map(checkedData => checkedData.value);
    });
    return o_data;
}

function toggleDropdown(t_ElemetID) {
    const o_MulSelContainer = document.getElementById(t_ElemetID);
    const o_optContainer = o_MulSelContainer.querySelector('.multioptions');
    if (o_optContainer) {
        o_optContainer.style.display = o_optContainer.style.display === 'none' ? 'block' : 'none';
    }
} 

function updateSelection(t_ElemetID, o_Elements) {
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
} 

function addOptionChoice(t_ElemetID, t_optionID) {
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
}