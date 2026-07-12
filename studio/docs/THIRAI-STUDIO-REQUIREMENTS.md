# Thirai Studio - Requirements

## Core Philosophy

- The Studio provides **high expressiveness** and excellent developer experience.
- The Thirai Runtime remains **pure, minimal, declarative, governed, and lightweight**.
- The Studio's main job is to **generate clean, valid Thirai artifacts** (JSON metadata, templates, workflows, etc.).

---

## 1. Must-Have Features (Phase 1 - MVP)

### Project & Workspace Management
- Create, open, save, and manage multiple Thirai applications
- Workspace explorer with Thirai-aware views
- Basic Git integration (commit, push, pull, branch status)
- Project settings and manifest editor

### Visual Page Builder
- Drag-and-drop page layout using template regions
- Real-time live preview (powered by actual Thirai runtime)
- Support for all current page types (`landing-page`, `catalog-page`, `form-page`, `product-page`, etc.)
- Visual editing of hero, body, cards, footer, etc.

### Component System
- Visual Component Builder
- Built-in Component Library (Product Card, Hero, Testimonial, etc.)
- Drag-and-drop components onto pages
- Component properties (props) editor that generates template overrides

### Data & Datasource Management
- Visual datasource creator and editor (JSON files, REST)
- Live data preview
- Easy binding of datasources to regions and components

### Form Builder
- Drag-and-drop form field editor
- Built-in validation rules (required, email, min/max, custom patterns, etc.)
- Support for multi-step forms and conditional fields
- Auto-generates clean form HTML + associated workflow

### Workflow Builder
- Visual node-based workflow designer
- Support for conditions, branching, loops, and parallel steps
- Integration with forms and datasources
- Generates workflow JSON + minimal `handlers.js` skeleton

### Theming & Templates
- Visual CSS/theme editor using design tokens
- Easy management of template overrides
- Dark / Light mode preview

### Governance & Validation
- Real-time policy violation detection
- Automatic validation of manifest, routes, templates, and references
- Security and privacy compliance checks

---

## 2. Should-Have Features (Phase 2)

- AI Assistant (e.g., "Generate product detail page", "Create contact form with validation")
- Version history and rollback
- One-click build, package, and deployment tools
- Integrated browser test runner
- Internationalization (i18n) support, especially Tamil + English
- Diagnostics viewer (integrates with `window.thirai.support()`)
- Responsive / Mobile device preview

---

## 3. Nice-to-Have Features (Phase 3+)

- Real-time collaboration
- Plugin / extension system
- Advanced animation and micro-interaction builder
- Database schema → Datasource generator
- User & role management tools
- Performance analyzer (bundle size, render time, etc.)
- Export to other formats (future-proofing)

---

## 4. Technical Output Requirements

The Studio must generate **clean, valid, and governance-compliant** files:

- `manifest.json`
- `pages/pages.json`
- Individual page definition files
- Template overrides (`template.html`, `template.json`, `template.css`)
- Datasources + `datasources.json`
- Workflows + `workflows.json`
- Minimal and clean `handlers.js` (only when necessary)
- Assets (images, SVGs, fonts, CSS)

---

## 5. Non-Functional Requirements

- High performance (smooth editing even with large projects)
- Intuitive UI suitable for both developers and non-technical users
- Strong offline-first support (especially on Desktop version)
- All generated output must pass Thirai governance and validation checks
- Extensible architecture for new template types

---

## 6. Platform Strategy

- **Primary Platform**: Desktop Application (C# / WPF) — for best performance and IDE-like experience
- **Secondary Platform**: Web version — for quick access, sharing, and lighter use

---

**Last Updated**: July 11, 2026  
**Status**: Living Document