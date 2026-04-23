# Post Branches — Design

Date: 2026-04-23
Status: Approved, ready for implementation plan

## Summary

Add GitHub-style branching to posts. A user can create a new post as a "branch"
of an existing post. The new post's form is pre-filled with the parent's content.
Each post page shows a compact text-based tree of its ancestors and descendants
so the branching history can be checked at a glance.

Scope is intentionally narrow:

- **Fork semantics** — the parent's content is copied into the branch form; the
  posts are independent after creation. No diff tracking, no merges.
- **Local tree only** — each post page renders the ancestors + current + descendants
  for that post. No global/forest view.
- **Text tree** — pure HTML/Tailwind with unicode box-drawing characters. No SVG,
  no JS graph library.

## Design Decisions (from brainstorming)

| # | Decision | Value |
|---|----------|-------|
| Q1 | Branch semantics | (a) Fork — copy content, independent after creation |
| Q2 | Visualization scope | (a) Per-post local tree only |
| Q3 | Branch trigger UX | (a) "Branch" button on post detail page |
| Q3.1 | Pre-filled title | `"{parent title} (branch)"` |
| Q3.2 | Category / tags inheritance | Both inherited from parent |
| Q3.3 | Attachment inheritance | Not inherited (start empty) |
| Q4.1 | Tree layout | (1) Vertical text tree with `├─ └─` characters |
| Q4.2 | Node info | Title + date + category badge + children-count badge |
| Q4.3 | Placement | Right sidebar, sticky, below file-tree sidebar if present |
| Q4.4 | Delete behavior | (y) Promote children to roots via `ON DELETE SET NULL` |

## Data Model

New migration: `db/migrations/007_post_branches.sql`

```sql
ALTER TABLE posts ADD COLUMN parent_id INTEGER
    REFERENCES posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_id);
```

- `parent_id` is nullable. Root posts have NULL; branched posts point to their
  parent.
- `ON DELETE SET NULL` implements the delete policy at the DB layer. No app-level
  logic needed when a post with children is deleted.
- Index required for the descendants query.
- `posts_fts` and its triggers only replicate `title` and `body`, so they do not
  need changes.

## Model Layer (`models/post.js`)

### `Post.create` — accept `parent_id`

Add `parent_id` to the insert parameters. Value is `null` when absent.

### `Post.findAncestors(id)`

Recursive CTE returning ancestors from root down to immediate parent, excluding
the target post itself. Returns rows with `{ id, parent_id, title, category,
created_at, depth }` ordered by depth descending (root first).

```sql
WITH RECURSIVE ancestors(id, parent_id, title, category, created_at, depth) AS (
  SELECT id, parent_id, title, category, created_at, 0
    FROM posts WHERE id = ?
  UNION ALL
  SELECT p.id, p.parent_id, p.title, p.category, p.created_at, a.depth + 1
    FROM posts p JOIN ancestors a ON p.id = a.parent_id
)
SELECT * FROM ancestors WHERE id != ? ORDER BY depth DESC;
```

### `Post.findDescendants(id)`

Recursive CTE returning all descendants in DFS order (so siblings stay grouped).
A `path` column built from zero-padded ids guarantees deterministic sibling
ordering.

```sql
WITH RECURSIVE descendants(id, parent_id, title, category, created_at, depth, path) AS (
  SELECT id, parent_id, title, category, created_at, 0, printf('%010d', id)
    FROM posts WHERE parent_id = ?
  UNION ALL
  SELECT p.id, p.parent_id, p.title, p.category, p.created_at, d.depth + 1,
         d.path || '/' || printf('%010d', p.id)
    FROM posts p JOIN descendants d ON p.parent_id = d.id
)
SELECT * FROM descendants ORDER BY path;
```

### `Post.findBranchTree(id)`

Convenience wrapper the view can use directly:

```js
{ ancestors: [...], current: {...}, descendants: [...] }
```

## Route Layer (`routes/posts.js`)

### `GET /posts/new?from=:id`

When `from` is present and resolves to an existing post, build a `parent`
object with the parent's title, body, category, and pre-filled title
(`"{title} (branch)"`). Also assemble the comma-joined tag string from the
parent's tags. Pass both to the view.

Invalid or missing `from` silently renders the normal new post form.

### `POST /posts`

Read `parent_id` from the body. Validate by looking up the post; if missing or
invalid, coerce to `null`. Pass into `Post.create`.

### `GET /posts/:id`

Call `Post.findBranchTree(post.id)` and pass `branchTree` to the view.

### `POST /posts/:id` (edit)

`parent_id` is immutable. The update statement does not include it; any attempt
to submit it via the form is ignored server-side.

### `DELETE /posts/:id`

No changes. FK cascade handles child promotion.

## Views

### `views/posts/new.ejs`

Server may pass `parent` and `prefillTags`. When present:

- Banner at top of form:
  `🌿 Branched from [parent title]` + small "Start from blank" link to `/posts/new`.
- `title` input `value = parent.prefillTitle`.
- `body` textarea content = `parent.body`.
- `category` select has `parent.category` marked selected.
- `tags` input `value = prefillTags`.
- Hidden `<input type="hidden" name="parent_id" value="{parent.id}">`.
- Attachment section unchanged, empty state.

When `parent` is null, the form renders exactly as today.

### `views/posts/show.ejs`

**Action buttons** — insert a `Branch` button (git-branch SVG icon) between
`Copy MD` and `Edit`. Links to `/posts/new?from={post.id}`.

**"Branched from" line** — directly below the title row, rendered only when
`post.parent_id` is present. Small gray text with left arrow:
`↳ Branched from [parent title]` (link to parent).

**Branch tree sidebar** — new partial `views/partials/branch-tree.ejs`. Placed
in the right column. When the file-tree sidebar is also present, both stack in
the right column, file-tree first. When no file tree exists, the branch tree
becomes the only sidebar card. When `branchTree.ancestors.length === 0 &&
branchTree.descendants.length === 0`, the sidebar card is omitted entirely.

### `views/partials/branch-tree.ejs`

Renders a single flat vertical list. Each row shows:

```
{connector}  {title}          {date}  {category-badge}  {branch-count-badge?}
```

- Connector characters drawn with `├─`, `└─`, `│`, `─` in a monospace column.
- Indentation proportional to `depth`.
- Current node row: `font-bold`, marker `●`, `bg-indigo-50` row background.
- Non-current rows: `<a href="/posts/{id}">` wraps the whole row.
- Children-count badge rendered when the node has descendants, showing
  `{n} branches` or hidden if zero.

The EJS template walks a pre-assembled flat list `[ ...ancestors, current,
...descendants ]` with per-row `{ depth, isCurrent, isLast, ... }` fields
assembled server-side (to keep the template declarative and avoid recursion in
EJS). Building this list is a helper in `routes/posts.js` or a small module
function; the exact location is an implementation detail.

## Data Flow — Creating a Branch

1. User clicks **Branch** on post A's show page.
2. Browser navigates to `GET /posts/new?from=A`.
3. Server fetches A (with tags), builds `parent` object + `prefillTags`, renders
   `new.ejs`.
4. Form is shown pre-filled; user edits and submits.
5. `POST /posts` receives `parent_id=A`. Server validates A exists, calls
   `Post.create({ ..., parent_id: A })`. Tags are synced as today.
6. Redirect to the new post B's show page.
7. B's show page resolves `branchTree` including A as the immediate parent; tree
   sidebar renders with A and B visible.

## Error & Edge Cases

| Case | Behavior |
|------|----------|
| `?from=<nonexistent>` | Silently render normal new form |
| Parent deleted while child exists | FK sets child's `parent_id=NULL`; child becomes root |
| Root post with no children | Branch tree sidebar not rendered |
| Post is branched while being edited by another session | No interaction — branches are new inserts, not updates |
| Cycles | Impossible — new post has no pre-existing id at insert time |
| Malicious `parent_id` on edit form | Update SQL ignores `parent_id`; value preserved |

## Testing

### Unit — `tests/models/post.branches.test.js`

- `create` persists `parent_id`
- `findAncestors` returns ordered chain (root first), excludes self
- `findDescendants` returns flat DFS-ordered list with correct depths
- `findBranchTree` returns the combined shape
- Deleting a parent promotes children to roots (FK verification)

### Integration — `tests/routes/posts.branches.test.js` (supertest)

- `GET /posts/new?from=:id` → 200, body contains parent title as prefill
- `GET /posts/new?from=99999` → 200, no parent banner
- `POST /posts` with `parent_id` → post created, parent_id stored
- `POST /posts` with invalid `parent_id` → post created with parent_id NULL
- `GET /posts/:id` for a branched post → body includes "Branched from" marker
  and tree rows for ancestors + descendants

### Manual UI verification

- Click Branch → form pre-filled with parent title+" (branch)", body, category,
  tags. Attachment empty.
- Create 3-level chain (A → B → C → D), open C, verify tree shows A, B, C (current), D.
- Create siblings (two children of B), verify both appear under B.
- Delete B, reload children — no "Branched from" banner, tree shows only
  themselves (as roots) and their descendants.

## Files Affected

Modified:
- `models/post.js`
- `routes/posts.js`
- `views/posts/show.ejs`
- `views/posts/new.ejs`

New:
- `db/migrations/007_post_branches.sql`
- `views/partials/branch-tree.ejs`
- `tests/models/post.branches.test.js`
- `tests/routes/posts.branches.test.js`

No changes:
- `posts_fts` virtual table and triggers
- Attachment / upload pipeline
- Comment / tag modules
- CSS (Tailwind utilities only)
