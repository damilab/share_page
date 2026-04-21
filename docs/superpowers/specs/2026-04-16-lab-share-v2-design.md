# Lab Share Page v2 — Enhancement Design Spec

**Date:** 2026-04-16
**Approach:** Feature-First (A) — add tags + comments, improve code quality along the way
**Architecture:** Keep current SSR + EJS + SQLite stack

---

## 1. DB Migration System

### Problem
Current `schema.sql` runs all DDL on every startup. No way to track schema changes or evolve the database incrementally.

### Design
- `db/migrations/` directory with numbered SQL files: `001_initial.sql`, `002_tags.sql`, `003_comments.sql`
- `schema_version` table tracks which migrations have been applied
- `db/migrator.js` runs pending migrations on server startup, in order
- Existing schema becomes `001_initial.sql`; new features are separate migration files

### schema_version table
```sql
CREATE TABLE IF NOT EXISTS schema_version (
    version  INTEGER PRIMARY KEY,
    name     TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 2. Tags System

### DB Schema (migration 002)
```sql
CREATE TABLE tags (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE post_tags (
    post_id  INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX idx_post_tags_tag ON post_tags(tag_id);
```

### Backend
- **`models/tag.js`**: findAll, findByPostId, findOrCreate, attachToPost, detachFromPost, getPopular
- **`models/post.js` extension**: findAll accepts `tag` filter parameter; post detail includes tags via JOIN
- **API routes**:
  - `GET /api/tags?q=` — autocomplete search
  - `GET /api/tags/popular?limit=10` — popular tags by post count

### UI
- **Create/Edit form**: Tag input field below category. Comma-separated free text. Client-side JS shows autocomplete dropdown fetching from `/api/tags?q=`.
- **Post detail**: Tag badges displayed next to category badge. Each tag links to `/?tag=<tagname>`.
- **Home page**: Popular tag chips below category tabs. Clicking filters by tag. Combinable with category: `/?category=system-prompts&tag=claude-code`.
- **Search integration**: Tag names included in search results display.

---

## 3. Comments System

### DB Schema (migration 003)
```sql
CREATE TABLE comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author     TEXT NOT NULL DEFAULT 'Anonymous',
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_comments_post ON comments(post_id);
```

### Backend
- **`models/comment.js`**: create, findByPostId (ordered by created_at ASC), delete, countByPostId
- **Routes (in `routes/posts.js`)**:
  - Post detail loads comments alongside post data
  - `POST /posts/:id/comments` — create comment (form POST, redirect back)
  - `POST /posts/:id/comments/:commentId/delete` — delete comment (confirm popup)

### UI
- **Post detail page**: Comments section below rendered Markdown body
- **Comment form**: Nickname input (optional, defaults to "Anonymous") + body textarea + submit button
- **Comment display**: Chronological list. Each shows author, relative time, body text, delete button.
- **Comment count**: Shown on post cards in home page grid

### Scope Limits
- No comment editing (delete and rewrite)
- No threaded/nested replies (flat list)
- No notifications on new comments
- No Markdown in comments (plain text only)

---

## 4. Code Quality & Testing

### Test Infrastructure
- **Framework**: Vitest (fast, ESM-native, Jest-compatible API)
- **Test DB**: In-memory SQLite via `db/connection.js` factory function: `createDB({ inMemory: true })`
- **npm scripts**: `npm test` runs vitest, `npm run test:watch` for dev

### Test Coverage Priorities
1. **`models/post.js`** — CRUD operations, FTS5 search, pagination, category/tag filtering
2. **`models/tag.js`** — Tag CRUD, post-tag relationships, popular tags query
3. **`models/comment.js`** — Comment CRUD, cascade deletion
4. **`lib/archive.js`** — ZIP extraction, single file storage, file tree building
5. **`lib/markdown.js`** — GFM rendering (tables, code blocks, task lists)
6. **Integration tests** — HTTP route tests via supertest for main flows (create post, search, add comment)

### Code Structure Improvements
- DB connection module supports both singleton (production) and factory (test) patterns
- Models use consistent error handling patterns
- Route handlers wrapped in try-catch for consistent error responses
- File separation: one model per file (`post.js`, `tag.js`, `comment.js`)

### Out of Scope
- E2E browser tests (Playwright etc.)
- Refactoring code not touched by new features
- CI/CD pipeline setup

---

## 5. Implementation Order

1. **Phase 1: Foundation** — DB migration system + Vitest setup + connection factory
2. **Phase 2: Tags** — Schema migration + model + API + UI (form, badges, filter, autocomplete)
3. **Phase 3: Comments** — Schema migration + model + routes + UI (form, list, delete, count)
4. **Phase 4: Tests** — Model unit tests + integration tests for all new + existing features
5. **Phase 5: Polish** — Home page tag cloud, comment count on cards, search result tag display

---

## 6. Files to Create/Modify

### New Files
- `db/migrator.js` — Migration runner
- `db/migrations/001_initial.sql` — Current schema as first migration
- `db/migrations/002_tags.sql` — Tags + post_tags tables
- `db/migrations/003_comments.sql` — Comments table
- `models/tag.js` — Tag model
- `models/comment.js` — Comment model
- `public/js/tag-input.js` — Tag autocomplete client JS
- `tests/models/post.test.js`
- `tests/models/tag.test.js`
- `tests/models/comment.test.js`
- `tests/lib/archive.test.js`
- `tests/lib/markdown.test.js`
- `tests/routes/integration.test.js`
- `vitest.config.js`

### Modified Files
- `db/connection.js` — Add factory function for test DB
- `models/post.js` — Add tag filter to findAll, include tags in findById
- `routes/posts.js` — Add comment routes, tag handling in create/update
- `routes/api.js` — Add tag autocomplete + popular tags endpoints
- `routes/index.js` — Add tag filter to home page query
- `views/posts/new.ejs` — Add tag input field
- `views/posts/edit.ejs` — Add tag input field with existing tags
- `views/posts/show.ejs` — Add tag badges + comments section
- `views/home.ejs` — Add popular tags, comment count on cards
- `views/partials/navbar.ejs` — Tag filter chip display
- `views/layout.ejs` — Load tag-input.js on form pages
- `package.json` — Add vitest, supertest dev dependencies

---

## 7. Success Criteria

1. Tags can be added to posts during creation/editing, and posts can be filtered by tag
2. Comments can be posted on any article with optional nickname, and deleted by anyone
3. Tag autocomplete works when typing in the tag input field
4. All new models have unit tests passing
5. Integration tests cover create post with tags, add comment, search with tag filter
6. DB migrations run automatically on server startup without data loss
7. Existing functionality (CRUD, search, file upload, Markdown rendering) continues to work unchanged
