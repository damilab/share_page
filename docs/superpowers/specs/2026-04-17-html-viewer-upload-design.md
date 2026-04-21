# HTML Viewer + Upload Enhancement Design Spec

**Date:** 2026-04-17
**Scope:** Add HTML rendering in new tab + multi-file auto-ZIP upload
**Architecture:** Extend existing SSR + Express routes, client-side dropzone

---

## 1. HTML Rendering View

### Problem
Currently `.html` files in attachments are treated as text and shown with syntax highlighting. Users want to view rendered HTML in a new browser tab, like the `proj_html_page` project does with `res.sendFile()`.

### API Route
- `GET /api/posts/:id/view/{*filepath}` — serves the file from `extracted/` directory via stream pipe
- Reuses existing path traversal protection (resolve + startsWith check)
- Sets appropriate Content-Type based on file extension (HTML defaults to `text/html`)

### File Type Classification
In `routes/api.js`, the `getFileType()` function gains a new return value:
- `.html`, `.htm` → `'html'` (new type, distinct from `'text'`)
- These extensions are removed from `TEXT_EXTENSIONS` set

### File Tree Preview Behavior
When a `.html` file is clicked in the file tree panel (`public/js/file-tree.js`):
- Show source code preview (syntax highlighted, same as current text files)
- Add a **"Open in new tab"** button in the preview header
- The button links to `/api/posts/:id/view/<filepath>` with `target="_blank"`

### Security
Internal network, trust-based — no sandboxing needed. Raw HTML/JS served as-is.

---

## 2. Multi-File Upload

### Problem
Currently the dropzone accepts one file or one folder. Users want to drag multiple individual files and have them automatically packaged.

### Client-Side Changes (`public/js/dropzone.js`)
- When multiple files are dropped (not a folder, not a single file):
  - Create a JSZip instance
  - Add all files to the zip
  - Generate blob and set as form upload (same pattern as folder → ZIP)
  - Show zip progress bar during packaging
- When a single non-ZIP file is dropped: unchanged (upload directly)
- When a folder is dropped: unchanged (JSZip packaging)
- When a ZIP is dropped: unchanged (upload directly)

### Form Changes (`views/posts/new.ejs`, `views/posts/edit.ejs`)
- Add `multiple` attribute to `<input type="file">`
- Update file-input change handler to process multiple files via JSZip

### Server-Side Changes
None — server already handles both ZIP (extract) and single files (store directly).

---

## 3. Files to Modify

| File | Change |
|------|--------|
| `routes/api.js` | Add `GET /api/posts/:id/view/{*filepath}` route; move `.html`/`.htm` from TEXT_EXTENSIONS to new HTML_EXTENSIONS; update `getFileType()` |
| `public/js/file-tree.js` | Add `html` type branch — show source preview + "Open in new tab" button |
| `public/js/dropzone.js` | Handle multi-file drop → auto JSZip; handle multi-file input selection |
| `views/posts/new.ejs` | Add `multiple` to file input |
| `views/posts/edit.ejs` | Add `multiple` to file input |

---

## 4. Success Criteria

1. Clicking an `.html` file in the file tree shows source preview + "Open in new tab" button
2. Clicking "Open in new tab" opens the HTML rendered in a new browser tab
3. Dropping multiple files auto-packages them into a ZIP and shows file tree after upload
4. Selecting multiple files via file picker also auto-packages into ZIP
5. Existing upload flows (single file, folder, ZIP) continue to work unchanged
6. Path traversal protection applies to the new view route
