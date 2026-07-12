function normalizeFlatFields(fields) {
    return fields.map(f => {
        // backward compatibility
        if (f.lineIndex === undefined && f.rowindex !== undefined) {
            f.lineIndex = f.rowindex;
        }

        // defaults
        if (f.lineIndex === undefined) f.lineIndex = 1;
        if (f.page === undefined) f.page = 1;

        return f;
    });
}
function compileSchemaToFlatFields(schema) {
  const flatFields = [];
  let pageIndex = 1;

  schema.pages.forEach(page => {
    let lineIndex = 1;

    page.sections.forEach(section => {
      section.components.forEach(component => {
        if (component.type !== "field") return;

        const f = component.field;

        flatFields.push({
          label: f.label,
          type: f.inputType,
          id: f.id,
          placeholder: f.placeholder || "",
          notes: "",
          values: f.values || null,
          mode: f.mode || "show",
          default: f.default || null,
          data: null,
          page: pageIndex,
          lineIndex: f.lineIndex ?? lineIndex,
          onchange: f.onchange || null
        });

        if (f.lineIndex === undefined) {
          lineIndex++;
        }
      });
    });

    pageIndex++;
  });

  return flatFields;
}