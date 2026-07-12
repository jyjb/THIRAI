/******************************************************
 * MODULE 1 — INFER SCHEMA FROM JSON INSTANCE
 ******************************************************/
function inferSchema(obj) {
  if (Array.isArray(obj)) {
    return {
      type: "array",
      items: obj.length > 0 ? inferSchema(obj[0]) : { type: "string" }
    };
  }

  if (typeof obj === "object" && obj !== null) {
    const props = {};
    Object.keys(obj).forEach(key => {
      props[key] = inferSchema(obj[key]);
    });
    return { type: "object", properties: props };
  }

  if (typeof obj === "number") return { type: "number" };
  if (typeof obj === "boolean") return { type: "boolean" };
  return { type: "string" };
}

/******************************************************
 * MODULE 2 — SMART UI INFERENCE RULES
 ******************************************************/
function inferUIConfigFromSchema(schema) {
  const layout = [];

  if (schema.type === "object") {
    const keys = Object.keys(schema.properties);

    // RULE 1: FLAT OBJECT → SINGLE FORM
    const allPrimitives = keys.every(k =>
      schema.properties[k].type !== "object" &&
      schema.properties[k].type !== "array"
    );

    if (allPrimitives) {
      layout.push({
        section: "Main",
        type: "form",
        bind: "",
        fields: keys.map(k => ({
          key: k,
          label: k,
          ui: "text"
        }))
      });
      return { layout };
    }

    // OTHER CASES
    keys.forEach(key => {
      const child = schema.properties[key];

      // RULE 2: ARRAY OF OBJECTS → TABLE
      if (child.type === "array" && child.items.type === "object") {
        const hasNested = Object.values(child.items.properties)
          .some(p => p.type === "object");

        if (hasNested) {
          // RULE 3: ARRAY OF NESTED OBJECTS → CARD + FORM
          layout.push({
            section: key,
            type: "cardForm",
            bind: key,
            fields: child.items.properties
          });
        } else {
          layout.push({
            section: key,
            type: "table",
            bind: key,
            columns: Object.keys(child.items.properties).map(col => ({
              key: col,
              label: col
            }))
          });
        }
      }
      else if (child.type === "object") {
        layout.push({
          section: key,
          type: "form",
          bind: key,
          fields: Object.keys(child.properties).map(f => ({
            key: f,
            label: f,
            ui: child.properties[f].type === "array" ? "array" : "text"
          }))
        });
      }
    });
  }

  return { layout };
}

/******************************************************
 * MODULE 3 — RENDERERS
 ******************************************************/
const app = document.getElementById("app");
const output = document.getElementById("output");
let formData = {};

function createInput(path) {
  const input = document.createElement("input");
  input.dataset.path = path;
  input.addEventListener("input", (e) => setValue(path, e.target.value));
  return input;
}

function setValue(path, value) {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
  let current = formData;

  parts.forEach((p, i) => {
    if (i === parts.length - 1) {
      current[p] = value;
    } else {
      if (!current[p]) current[p] = {};
      current = current[p];
    }
  });
}

/******** TABLE RENDERER ********/
function renderTable(section) {
  const container = document.createElement("div");
  container.className = "section";

  const title = document.createElement("h3");
  title.textContent = section.section;
  container.appendChild(title);

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tr = document.createElement("tr");

  section.columns.forEach(col => {
    const th = document.createElement("th");
    th.textContent = col.label;
    tr.appendChild(th);
  });

  const thAction = document.createElement("th");
  thAction.textContent = "Action";
  tr.appendChild(thAction);

  thead.appendChild(tr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  table.appendChild(tbody);

  const addBtn = document.createElement("button");
  addBtn.textContent = "Add Row";
  addBtn.type = "button";

  addBtn.addEventListener("click", () => {
    const rowIndex = tbody.children.length;
    const row = document.createElement("tr");

    section.columns.forEach(col => {
      const td = document.createElement("td");
      const input = createInput(`${section.bind}[${rowIndex}].${col.key}`);
      td.appendChild(input);
      row.appendChild(td);
    });

    const tdDel = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.type = "button";
    delBtn.onclick = () => tbody.removeChild(row);

    tdDel.appendChild(delBtn);
    row.appendChild(tdDel);
    tbody.appendChild(row);
  });

  container.appendChild(table);
  container.appendChild(addBtn);
  app.appendChild(container);
}

/******** FORM RENDERER ********/
function renderForm(section) {
  const container = document.createElement("div");
  container.className = "section";

  const title = document.createElement("h3");
  title.textContent = section.section;
  container.appendChild(title);

  section.fields.forEach(field => {
    const div = document.createElement("div");
    div.className = "field";

    const label = document.createElement("label");
    label.textContent = field.label;
    div.appendChild(label);

    const input = createInput(section.bind ? `${section.bind}.${field.key}` : field.key);
    div.appendChild(input);

    container.appendChild(div);
  });

  app.appendChild(container);
}

/******** CARD + FORM RENDERER ********/
function renderCardForm(section) {
  const container = document.createElement("div");
  container.className = "section";

  const title = document.createElement("h3");
  title.textContent = section.section;
  container.appendChild(title);

  const layout = document.createElement("div");
  layout.className = "card-form-layout";

  const cardList = document.createElement("div");
  cardList.className = "card-list";

  const formEditor = document.createElement("div");
  formEditor.className = "form-editor";

  layout.appendChild(cardList);
  layout.appendChild(formEditor);
  container.appendChild(layout);
  app.appendChild(container);

  // Add sample card button
  const addBtn = document.createElement("button");
  addBtn.textContent = "Add Item";
  addBtn.type = "button";

  addBtn.onclick = () => {
    const idx = cardList.children.length;

    const card = document.createElement("div");
    card.className = "card";
    card.textContent = `${section.section} #${idx + 1}`;

    card.onclick = () => {
      formEditor.innerHTML = "";

      Object.keys(section.fields).forEach(f => {
        const div = document.createElement("div");
        div.className = "field";

        const label = document.createElement("label");
        label.textContent = f;
        div.appendChild(label);

        const input = createInput(`${section.bind}[${idx}].${f}`);
        div.appendChild(input);
        formEditor.appendChild(div);
      });
    };

    cardList.appendChild(card);
  };

  container.appendChild(addBtn);
}

/******************************************************
 * MODULE 4 — BUTTON HANDLERS
 ******************************************************/
let savedSchema = null;
let savedUiConfig = null;

document.getElementById("btnInfer").addEventListener("click", () => {
  try {
    const instance = JSON.parse(document.getElementById("jsonInput").value);

    savedSchema = inferSchema(instance);
    savedUiConfig = inferUIConfigFromSchema(savedSchema);

    document.getElementById("schemaOutput").value =
      JSON.stringify(savedSchema, null, 2);

    document.getElementById("uiConfigOutput").value =
      JSON.stringify(savedUiConfig, null, 2);

    alert("Schema & UI Config inferred!");
  } catch (err) {
    alert("Invalid JSON: " + err.message);
  }
});

document.getElementById("btnRenderForm").addEventListener("click", () => {
  if (!savedUiConfig) {
    alert("Infer or save UI Config first!");
    return;
  }

  app.innerHTML = "";
  formData = {};

  savedUiConfig.layout.forEach(section => {
    if (section.type === "table") renderTable(section);
    else if (section.type === "form") renderForm(section);
    else if (section.type === "cardForm") renderCardForm(section);
  });

  const submit = document.createElement("button");
  submit.textContent = "Submit Data";
  submit.onclick = () =>
    (output.textContent = JSON.stringify(formData, null, 2));

  app.appendChild(submit);
});