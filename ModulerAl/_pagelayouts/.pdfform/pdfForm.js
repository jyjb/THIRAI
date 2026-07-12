(async function init() {
    // 1) load local JSON (await fetch so nothing else runs until it's loaded)
    let jsonData;
    try {

        obj_Response = await fetchget("/api/serverhost/file?path=Q:\\Shared drives\\Project Files\\WL\\0001-Expert Expenses\\001 New Request\\Miscellaneous files\\AIWorkflow Output").value;
        jsonData = JSON.parse(obj_Response);
        console.log(jsonData);
        const form = document.getElementById('formBody');
        jsonData = JSON[0];
        jsonData = JSON.parse(jsonData.Output);
        console.log(jsonData);
       jsonData = jsonData.KnowledgeBaseResult[1].result.citations[0].generatedResponsePart.textResponsePart.text;
        console.log(jsonData);
        jsonData = JSON.parse(jsonData);
        buildForm(jsonData,form);
        //generateForm(jsonData.KnowledgeBaseResult[0], 'formBody');

       // Object.entries(jsonData).forEach(([k, v]) => createFormElement(k, v, form));

    } catch (err) {
        console.error('Failed to load —', err);
        return;
    }

    // 2) state
    let currentGroup = null;
    let currentPage = 1;
    let pdfObject = document.getElementById('pdfObject');
    const pdfWrapper = document.getElementById('pdfWrapper');
    const overlay = document.getElementById('overlay');
    const tabsEl = document.getElementById('tabs');
    const formTitle = document.getElementById('formTitle');
    const formBody = document.getElementById('formBody');
    const coordOrigin = document.getElementById('coordOrigin');
    const pageInfo = document.getElementById('pageInfo');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');

    // 3) group JSON by 'group'
    const groups = {};
    jsonData.forEach((it, idx) => {
        const g = it.group || 'default';
        if (!groups[g]) groups[g] = [];
        // attach original index so we can cross-ref
        groups[g].push(Object.assign({}, it, { __idx: idx }));
    });

    // 4) Create tabs (now that jsonData is available)
    Object.keys(groups).forEach((g, i) => {
        const t = document.createElement('div');
        t.className = 'tab' + (i === 0 ? ' active' : '');
        t.innerText = g;
        t.onclick = () => selectGroup(g, t);
        tabsEl.appendChild(t);
    });

    // default select first group
    const initialGroup = Object.keys(groups)[0];
    if (initialGroup) selectGroup(initialGroup, tabsEl.children[0]);

    // 5) PDF load handling: we must wait for object to layout so we know width/height
    // attach load listener; browsers fire for object when content is ready
    function onPdfLoaded() {
        // update page info (we don't know number of pages from <object>, so we show currentPage only)
        pageInfo.innerText = `Page ${currentPage}`;
        // size overlay to match displayed object region:
        updateOverlaySize();
        // redraw boxes for current group/page
        drawBoxesForCurrentGroup();
    }

    pdfObject.addEventListener('load', onPdfLoaded);

    // If user wants to load a different pdf via file input (useful when testing)
    document.getElementById('pdfFile').addEventListener('change', async (ev) => {
        const f = ev.target.files && ev.target.files[0];
        if (!f) return;
        // create object URL and set as data
        const url = URL.createObjectURL(f);
        pdfObject.data = url;
        // wait a tick, the 'load' event will follow
    });

    // handle window resize to keep overlay aligned
    window.addEventListener('resize', () => {
        updateOverlaySize();
        drawBoxesForCurrentGroup();
    });

    // prev/next buttons — simple page number logic (note: <object> native viewer handles page navigation itself;
    // these buttons are here for your JSON page-based filtering. They don't change the displayed PDF page.)
    prevPageBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; pageInfo.innerText = `Page ${currentPage}`; drawBoxesForCurrentGroup(); } });
    nextPageBtn.addEventListener('click', () => { currentPage++; pageInfo.innerText = `Page ${currentPage}`; drawBoxesForCurrentGroup(); });

    // 6) helper: select group & build form
    function selectGroup(groupName, tabEl) {
        currentGroup = groupName;
        // tab visuals
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tabEl.classList.add('active');
        // build form (left)
        buildFormForGroup(groupName);
        // draw overlay boxes for the group's fields
        drawBoxesForCurrentGroup();
    }

    function buildFormForGroup(groupName) {
        formTitle.innerText = `Group — ${groupName}`;
        formBody.innerHTML = '';
        const fields = groups[groupName] || [];
        if (fields.length === 0) {
            formBody.innerHTML = '<div class="small">No fields for this group</div>';
            return;
        }
        fields.forEach(f => {
            const wrapper = document.createElement('div'); wrapper.className = 'form-field';
            const label = document.createElement('label'); label.innerText = f.key;
            let input;
            if (f.Field_type === 'Checkbox') {
                input = document.createElement('input'); input.type = 'checkbox'; input.checked = !!f.value;
                input.onchange = () => { jsonData[f.__idx].value = input.checked ? 'true' : ''; drawBoxesForCurrentGroup(); };
            } else {
                input = document.createElement('input'); input.type = 'text'; input.value = f.value ?? '';
                input.oninput = () => { jsonData[f.__idx].value = input.value; };
            }
            // hover highlight -> highlight box
            wrapper.onmouseenter = () => highlightBoxByIdx(f.__idx, true);
            wrapper.onmouseleave = () => highlightBoxByIdx(f.__idx, false);

            wrapper.appendChild(label); wrapper.appendChild(input);
            formBody.appendChild(wrapper);
        });
    }

    // 7) overlay sizing helper
    function updateOverlaySize() {
        // PDF object bounding box (rendered area)
        const rect = pdfObject.getBoundingClientRect();
        const wrapperRect = pdfWrapper.getBoundingClientRect();
        // compute top-left of object relative to wrapper
        const left = rect.left - wrapperRect.left;
        const top = rect.top - wrapperRect.top;
        overlay.style.left = left + 'px';
        overlay.style.top = top + 'px';
        // set overlay size to the object's size
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
        overlay.innerHTML = ''; // clear any previous boxes (they will be recreated)
    }

    // 8) draw boxes using coordinates from JSON
    // NOTE: Because browser native PDF viewer is a black box, we cannot read the PDF intrinsic size.
    // We assume your coordinates are expressed in the PDF coordinate space with a known baseline width/height.
    // If your coordinates are already in CSS pixels for the displayed size, set expectedPdfWidth/Height accordingly.
    const expectedPdfWidth = 612; // default PDF pt width (change if your extraction used a different base)
    const expectedPdfHeight = 792; // default PDF pt height (change if necessary)

    function drawBoxesForCurrentGroup() {
        overlay.innerHTML = ''; // remove old boxes
        if (!currentGroup) return;
        // overlay size
        const ow = overlay.clientWidth;
        const oh = overlay.clientHeight;
        if (ow === 0 || oh === 0) return; // not ready
        const origin = coordOrigin.value; // 'top-left' or 'pdf' (bottom-left)
        // scale factor from PDF pts -> displayed CSS pixels
        const sx = ow / expectedPdfWidth;
        const sy = oh / expectedPdfHeight;

        // get fields for current group and current page
        const fields = groups[currentGroup].filter(f => (f.page || 1) === currentPage);
        fields.forEach(f => {
            const c = f.coordinates || {};
            if (c.x1 == null || c.y1 == null || c.x2 == null || c.y2 == null) return;
            // compute box coords in overlay CSS pixels
            let left, top, width, height;
            if (origin === 'pdf') {
                // convert from PDF bottom-left origin -> top-left CSS
                left = c.x1 * sx;
                // y measured from bottom in PDF pts:
                top = (expectedPdfHeight - c.y2) * sy;
            } else {
                // top-left origin
                left = c.x1 * sx;
                top = c.y1 * sy;
            }
            width = (c.x2 - c.x1) * sx;
            height = (c.y2 - c.y1) * sy;

            const box = document.createElement('div');
            box.className = 'box';
            box.style.left = Math.round(left) + 'px';
            box.style.top = Math.round(top) + 'px';
            box.style.width = Math.round(width) + 'px';
            box.style.height = Math.round(height) + 'px';
            box.dataset.idx = f.__idx;
            // clicking a box focuses corresponding form field
            box.addEventListener('click', () => {
                focusFormFieldForIdx(f.__idx);
                // toggle checkbox if the field is a checkbox
                if (f.Field_type === 'Checkbox') {
                    // find input element and toggle
                    const wrapper = Array.from(document.querySelectorAll('.form-field')).find(w => w.querySelector('label')?.innerText === f.key);
                    if (wrapper) {
                        const inp = wrapper.querySelector('input');
                        if (inp && inp.type === 'checkbox') {
                            inp.checked = !inp.checked;
                            jsonData[f.__idx].value = inp.checked ? 'true' : '';
                        }
                    }
                }
            });
            overlay.appendChild(box);
        });
    }

    function highlightBoxByIdx(idx, on) {
        const b = Array.from(overlay.children).find(x => Number(x.dataset.idx) === idx);
        if (!b) return;
        b.style.borderColor = on ? 'rgba(16,185,129,0.95)' : 'rgba(233,61,88,0.95)';
        b.style.background = on ? 'rgba(16,185,129,0.08)' : 'rgba(233,61,88,0.06)';
    }

    function focusFormFieldForIdx(idx) {
        const target = jsonData[idx];
        if (!target) return;
        // find wrapper by label text match
        const wrappers = Array.from(document.querySelectorAll('.form-field'));
        const wrapper = wrappers.find(w => w.querySelector('label') && w.querySelector('label').innerText === target.key);
        if (wrapper) {
            const input = wrapper.querySelector('input');
            if (input) input.focus();
        }
    }

    // expose a manual redraw function (useful in console)
    window.redrawOverlay = () => {
        updateOverlaySize();
        drawBoxesForCurrentGroup();
    };

    // done init
    console.log('Initialization complete — JSON loaded and UI built.');
})(); // end init