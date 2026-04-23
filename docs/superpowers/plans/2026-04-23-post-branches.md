# Post Branches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub-style fork branching to posts: a new post can be created as a branch of an existing post (content pre-filled), and each post page shows a compact text tree of its ancestors + descendants.

**Architecture:** One nullable `parent_id` column on `posts` with `ON DELETE SET NULL`. Recursive CTEs return ancestors/descendants. A pure function converts the tree into flat rendering rows with connector metadata. EJS renders unicode box-drawing characters (no SVG, no JS graph lib). Branch creation is a GET with `?from=:id` that pre-fills the new-post form.

**Tech Stack:** Node.js, Express 5, better-sqlite3, EJS, Tailwind, vitest, supertest.

**Spec:** `docs/superpowers/specs/2026-04-23-post-branches-design.md`

---

## File Structure

Modified:
- `db/migrations/007_post_branches.sql` *(new)*
- `models/post.js` — add `parent_id` to create; add `findAncestors`, `findDescendants`, `findBranchTree`
- `lib/branchTree.js` *(new)* — pure helper turning `{ ancestors, current, descendants }` into flat rows with connector info
- `routes/posts.js` — handle `?from=` prefill, accept `parent_id`, pass `branchTree`
- `views/posts/new.ejs` — parent banner, prefilled values, hidden `parent_id`
- `views/posts/show.ejs` — Branch button, "Branched from" line, branch-tree sidebar card
- `views/partials/branch-tree.ejs` *(new)* — declarative render of flat rows
- `app.js` — small refactor: export app, wrap `listen` in `require.main` guard (so supertest can import without binding a port)
- `tests/models/post.branches.test.js` *(new)*
- `tests/routes/posts.branches.test.js` *(new)*

---

## Task 1: Schema Migration

**Files:**
- Create: `db/migrations/007_post_branches.sql`

- [ ] **Step 1: Write the migration**

Write to `db/migrations/007_post_branches.sql`:

```sql
ALTER TABLE posts ADD COLUMN parent_id INTEGER
    REFERENCES posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_id);
```

- [ ] **Step 2: Verify migration applies cleanly**

Run: `node -e "require('./db/connection')"`
Expected: `Migration applied: 007_post_branches.sql` printed on first run; on subsequent runs, no output (already applied).

- [ ] **Step 3: Verify schema**

Run: `sqlite3 db/share_page.sqlite '.schema posts' | grep parent_id`
Expected: one line containing `parent_id INTEGER REFERENCES posts(id) ON DELETE SET NULL`.

- [ ] **Step 4: Commit**

```bash
git add db/migrations/007_post_branches.sql
git commit -m "feat: add parent_id column for post branches"
```

---

## Task 2: Model — `Post.create` accepts `parent_id`

**Files:**
- Modify: `models/post.js:68-82`
- Test: `tests/models/post.branches.test.js` *(new)*

- [ ] **Step 1: Write the failing test**

Create `tests/models/post.branches.test.js`:

```js
import { createRequire } from 'module';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDB, teardownTestDB } from '../helpers/setup.js';

const require = createRequire(import.meta.url);

let db;
beforeEach(() => { db = setupTestDB(); });
afterEach(() => { teardownTestDB(db); });

describe('Post branches — create', () => {
  it('stores parent_id when provided', () => {
    const Post = require('../../models/post');
    const parentId = Post.create({ title: 'Parent', body: 'P', category: 'memos' });
    const childId = Post.create({ title: 'Child', body: 'C', category: 'memos', parent_id: parentId });
    const child = Post.findById(childId);
    expect(child.parent_id).toBe(parentId);
  });

  it('stores NULL parent_id when omitted', () => {
    const Post = require('../../models/post');
    const id = Post.create({ title: 'Solo', body: 'B', category: 'memos' });
    const post = Post.findById(id);
    expect(post.parent_id).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/models/post.branches.test.js`
Expected: both tests FAIL — `child.parent_id` is `undefined` because `Post.create` doesn't pass `parent_id` to the INSERT.

- [ ] **Step 3: Modify `Post.create` to accept `parent_id`**

Replace the `create` method in `models/post.js` (currently lines 68-82) with:

```js
  create({ title, body, category, parent_id, attachment_id, attachment_original_name, attachment_file_tree }) {
    const stmt = db.prepare(`
      INSERT INTO posts (title, body, category, parent_id, attachment_id, attachment_original_name, attachment_file_tree)
      VALUES (@title, @body, @category, @parent_id, @attachment_id, @attachment_original_name, @attachment_file_tree)
    `);
    const result = stmt.run({
      title,
      body,
      category,
      parent_id: parent_id || null,
      attachment_id: attachment_id || null,
      attachment_original_name: attachment_original_name || null,
      attachment_file_tree: attachment_file_tree ? JSON.stringify(attachment_file_tree) : null
    });
    return result.lastInsertRowid;
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/models/post.branches.test.js`
Expected: both tests PASS.

- [ ] **Step 5: Run full test suite to ensure no regression**

Run: `npm test`
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add models/post.js tests/models/post.branches.test.js
git commit -m "feat(post): accept parent_id on create"
```

---

## Task 3: Model — `Post.findAncestors`

**Files:**
- Modify: `models/post.js` (add method after `findByIdWithTags`)
- Modify: `tests/models/post.branches.test.js` (append)

- [ ] **Step 1: Add failing tests**

Append to `tests/models/post.branches.test.js`:

```js
describe('Post branches — findAncestors', () => {
  it('returns empty array for root post', () => {
    const Post = require('../../models/post');
    const rootId = Post.create({ title: 'Root', body: 'R', category: 'memos' });
    expect(Post.findAncestors(rootId)).toEqual([]);
  });

  it('returns ancestors root-first, excluding self', () => {
    const Post = require('../../models/post');
    const aId = Post.create({ title: 'A', body: 'a', category: 'memos' });
    const bId = Post.create({ title: 'B', body: 'b', category: 'memos', parent_id: aId });
    const cId = Post.create({ title: 'C', body: 'c', category: 'memos', parent_id: bId });
    const dId = Post.create({ title: 'D', body: 'd', category: 'memos', parent_id: cId });

    const ancestors = Post.findAncestors(dId);
    expect(ancestors.map(a => a.title)).toEqual(['A', 'B', 'C']);
    expect(ancestors.every(a => a.id !== dId)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/models/post.branches.test.js`
Expected: new tests FAIL — `Post.findAncestors is not a function`.

- [ ] **Step 3: Implement `findAncestors`**

Add method to `models/post.js` after `findByIdWithTags` (before `create`):

```js
  findAncestors(id) {
    return db.prepare(`
      WITH RECURSIVE ancestors(id, parent_id, title, category, created_at, depth) AS (
        SELECT id, parent_id, title, category, created_at, 0
          FROM posts WHERE id = @id
        UNION ALL
        SELECT p.id, p.parent_id, p.title, p.category, p.created_at, a.depth + 1
          FROM posts p JOIN ancestors a ON p.id = a.parent_id
      )
      SELECT id, parent_id, title, category, created_at, depth
        FROM ancestors WHERE id != @id
        ORDER BY depth DESC
    `).all({ id });
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/models/post.branches.test.js`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add models/post.js tests/models/post.branches.test.js
git commit -m "feat(post): findAncestors via recursive CTE"
```

---

## Task 4: Model — `Post.findDescendants`

**Files:**
- Modify: `models/post.js` (add method after `findAncestors`)
- Modify: `tests/models/post.branches.test.js` (append)

- [ ] **Step 1: Add failing tests**

Append to `tests/models/post.branches.test.js`:

```js
describe('Post branches — findDescendants', () => {
  it('returns empty array for leaf post', () => {
    const Post = require('../../models/post');
    const rootId = Post.create({ title: 'Root', body: 'R', category: 'memos' });
    expect(Post.findDescendants(rootId)).toEqual([]);
  });

  it('returns descendants in DFS order with depth', () => {
    const Post = require('../../models/post');
    //       A
    //      / \
    //     B   C
    //     |
    //     D
    const aId = Post.create({ title: 'A', body: 'a', category: 'memos' });
    const bId = Post.create({ title: 'B', body: 'b', category: 'memos', parent_id: aId });
    const cId = Post.create({ title: 'C', body: 'c', category: 'memos', parent_id: aId });
    const dId = Post.create({ title: 'D', body: 'd', category: 'memos', parent_id: bId });

    const rows = Post.findDescendants(aId);
    expect(rows.map(r => ({ title: r.title, depth: r.depth }))).toEqual([
      { title: 'B', depth: 0 },
      { title: 'D', depth: 1 },
      { title: 'C', depth: 0 }
    ]);
  });

  it('promotes children to roots when parent is deleted', () => {
    const Post = require('../../models/post');
    const aId = Post.create({ title: 'A', body: 'a', category: 'memos' });
    const bId = Post.create({ title: 'B', body: 'b', category: 'memos', parent_id: aId });

    Post.delete(aId);
    expect(Post.findById(bId).parent_id).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/models/post.branches.test.js`
Expected: new tests FAIL — `Post.findDescendants is not a function`.

- [ ] **Step 3: Implement `findDescendants`**

Add method to `models/post.js` after `findAncestors`:

```js
  findDescendants(id) {
    return db.prepare(`
      WITH RECURSIVE descendants(id, parent_id, title, category, created_at, depth, path) AS (
        SELECT id, parent_id, title, category, created_at, 0,
               printf('%010d', id)
          FROM posts WHERE parent_id = @id
        UNION ALL
        SELECT p.id, p.parent_id, p.title, p.category, p.created_at, d.depth + 1,
               d.path || '/' || printf('%010d', p.id)
          FROM posts p JOIN descendants d ON p.parent_id = d.id
      )
      SELECT id, parent_id, title, category, created_at, depth
        FROM descendants ORDER BY path
    `).all({ id });
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/models/post.branches.test.js`
Expected: all tests PASS (including the FK cascade test — the `ON DELETE SET NULL` from Task 1's migration handles it).

- [ ] **Step 5: Commit**

```bash
git add models/post.js tests/models/post.branches.test.js
git commit -m "feat(post): findDescendants via recursive CTE"
```

---

## Task 5: Model — `Post.findBranchTree`

**Files:**
- Modify: `models/post.js` (add after `findDescendants`)
- Modify: `tests/models/post.branches.test.js` (append)

- [ ] **Step 1: Add failing test**

Append to `tests/models/post.branches.test.js`:

```js
describe('Post branches — findBranchTree', () => {
  it('returns ancestors, current, descendants shape', () => {
    const Post = require('../../models/post');
    const aId = Post.create({ title: 'A', body: 'a', category: 'memos' });
    const bId = Post.create({ title: 'B', body: 'b', category: 'memos', parent_id: aId });
    const cId = Post.create({ title: 'C', body: 'c', category: 'memos', parent_id: bId });

    const tree = Post.findBranchTree(bId);
    expect(tree.ancestors.map(n => n.title)).toEqual(['A']);
    expect(tree.current.title).toBe('B');
    expect(tree.descendants.map(n => n.title)).toEqual(['C']);
  });

  it('returns null current when post does not exist', () => {
    const Post = require('../../models/post');
    const tree = Post.findBranchTree(99999);
    expect(tree.current).toBeNull();
    expect(tree.ancestors).toEqual([]);
    expect(tree.descendants).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/models/post.branches.test.js`
Expected: new tests FAIL — `Post.findBranchTree is not a function`.

- [ ] **Step 3: Implement `findBranchTree`**

Add method to `models/post.js` after `findDescendants`:

```js
  findBranchTree(id) {
    const current = Post.findById(id) || null;
    if (!current) return { ancestors: [], current: null, descendants: [] };
    return {
      ancestors: Post.findAncestors(id),
      current,
      descendants: Post.findDescendants(id)
    };
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/models/post.branches.test.js`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add models/post.js tests/models/post.branches.test.js
git commit -m "feat(post): findBranchTree convenience method"
```

---

## Task 6: Pure Helper — `lib/branchTree.js`

**Files:**
- Create: `lib/branchTree.js`
- Create: `tests/lib/branchTree.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/branchTree.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

describe('branchTree.toRenderRows', () => {
  it('returns empty array when tree is empty', () => {
    const { toRenderRows } = require('../../lib/branchTree');
    const rows = toRenderRows({ ancestors: [], current: null, descendants: [] });
    expect(rows).toEqual([]);
  });

  it('marks current node with isCurrent=true', () => {
    const { toRenderRows } = require('../../lib/branchTree');
    const rows = toRenderRows({
      ancestors: [],
      current: { id: 1, title: 'Only', category: 'memos', created_at: 't' },
      descendants: []
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].isCurrent).toBe(true);
    expect(rows[0].depth).toBe(0);
  });

  it('assigns depth per node and current sits at ancestors.length', () => {
    const { toRenderRows } = require('../../lib/branchTree');
    const rows = toRenderRows({
      ancestors: [
        { id: 1, title: 'A', category: 'memos', created_at: 't', depth: 1 },
        { id: 2, title: 'B', category: 'memos', created_at: 't', depth: 0 }
      ],
      current: { id: 3, title: 'C', category: 'memos', created_at: 't' },
      descendants: [
        { id: 4, title: 'D', category: 'memos', created_at: 't', depth: 0 },
        { id: 5, title: 'E', category: 'memos', created_at: 't', depth: 1 }
      ]
    });
    expect(rows.map(r => ({ title: r.title, depth: r.depth }))).toEqual([
      { title: 'A', depth: 0 },
      { title: 'B', depth: 1 },
      { title: 'C', depth: 2 },
      { title: 'D', depth: 3 },
      { title: 'E', depth: 4 }
    ]);
  });

  it('counts direct children for current node', () => {
    const { toRenderRows } = require('../../lib/branchTree');
    const rows = toRenderRows({
      ancestors: [],
      current: { id: 1, title: 'Root', category: 'memos', created_at: 't' },
      descendants: [
        { id: 2, title: 'A', category: 'memos', created_at: 't', depth: 0 },
        { id: 3, title: 'B', category: 'memos', created_at: 't', depth: 0 },
        { id: 4, title: 'C', category: 'memos', created_at: 't', depth: 1 }
      ]
    });
    expect(rows[0].childrenCount).toBe(2);
  });

  it('flags isLastSibling correctly across siblings and subtrees', () => {
    const { toRenderRows } = require('../../lib/branchTree');
    //  Root         row 0  last at depth 0 overall
    //  ├─ A         row 1  has sibling C after subtree → not last
    //  │  └─ X      row 2  last at its depth within A-subtree
    //  └─ C         row 3  last at depth 1
    const rows = toRenderRows({
      ancestors: [],
      current: { id: 1, title: 'Root', category: 'memos', created_at: 't' },
      descendants: [
        { id: 2, title: 'A', category: 'memos', created_at: 't', depth: 0 },
        { id: 3, title: 'X', category: 'memos', created_at: 't', depth: 1 },
        { id: 4, title: 'C', category: 'memos', created_at: 't', depth: 0 }
      ]
    });
    expect(rows.map(r => ({ t: r.title, last: r.isLastSibling }))).toEqual([
      { t: 'Root', last: true },
      { t: 'A', last: false },
      { t: 'X', last: true },
      { t: 'C', last: true }
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/branchTree.test.js`
Expected: all tests FAIL — module doesn't exist.

- [ ] **Step 3: Implement the helper**

Create `lib/branchTree.js`:

```js
function toRenderRows({ ancestors, current, descendants }) {
  if (!current) return [];

  const ancestorRows = ancestors.map((node, i) => ({
    id: node.id,
    title: node.title,
    category: node.category,
    created_at: node.created_at,
    depth: i,
    isCurrent: false,
    childrenCount: 0
  }));

  const currentDepth = ancestors.length;
  const directChildren = descendants.filter(d => d.depth === 0).length;

  const currentRow = {
    id: current.id,
    title: current.title,
    category: current.category,
    created_at: current.created_at,
    depth: currentDepth,
    isCurrent: true,
    childrenCount: directChildren
  };

  const descendantRows = descendants.map(node => ({
    id: node.id,
    title: node.title,
    category: node.category,
    created_at: node.created_at,
    depth: currentDepth + 1 + node.depth,
    isCurrent: false,
    childrenCount: 0
  }));

  const rows = [...ancestorRows, currentRow, ...descendantRows];

  // Compute isLastSibling: a row is the last sibling at its depth iff no later
  // row has the same depth before a row with strictly lower depth appears.
  for (let i = 0; i < rows.length; i++) {
    let last = true;
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[j].depth < rows[i].depth) break;
      if (rows[j].depth === rows[i].depth) { last = false; break; }
    }
    rows[i].isLastSibling = last;
  }

  return rows;
}

module.exports = { toRenderRows };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/branchTree.test.js`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/branchTree.js tests/lib/branchTree.test.js
git commit -m "feat(lib): branchTree.toRenderRows helper"
```

---

## Task 7: Refactor `app.js` for supertest

**Files:**
- Modify: `app.js:50-52`

Supertest needs to import the Express app without the process binding a port. One-line refactor.

- [ ] **Step 1: Apply refactor**

Edit `app.js`. Replace the final block:

```js
app.listen(config.port, config.host, () => {
  console.log(`Lab Share Page running at http://${config.host}:${config.port}`);
});
```

with:

```js
if (require.main === module) {
  app.listen(config.port, config.host, () => {
    console.log(`Lab Share Page running at http://${config.host}:${config.port}`);
  });
}

module.exports = app;
```

- [ ] **Step 2: Verify the server still runs normally**

Run: `node app.js &`
Expected: prints `Lab Share Page running at http://...`. Then kill it: `kill %1`.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "refactor(app): export app, guard listen for supertest"
```

---

## Task 8: Route — `GET /posts/new?from=:id` prefill

**Files:**
- Modify: `routes/posts.js:12-14`
- Create: `tests/routes/posts.branches.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/routes/posts.branches.test.js`:

```js
import { createRequire } from 'module';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDB, teardownTestDB } from '../helpers/setup.js';

const require = createRequire(import.meta.url);

let db;
let app;
let request;

beforeEach(() => {
  db = setupTestDB();
  // Clear cached modules so they pick up the in-memory DB
  delete require.cache[require.resolve('../../app')];
  delete require.cache[require.resolve('../../routes/posts')];
  delete require.cache[require.resolve('../../routes/index')];
  delete require.cache[require.resolve('../../routes/api')];
  delete require.cache[require.resolve('../../routes/admin')];
  delete require.cache[require.resolve('../../middleware/locals')];
  app = require('../../app');
  request = require('supertest');
});
afterEach(() => { teardownTestDB(db); });

describe('GET /posts/new?from=:id', () => {
  it('prefills title with (branch) suffix and sets hidden parent_id', async () => {
    const Post = require('../../models/post');
    const parentId = Post.create({ title: 'Original', body: 'Body', category: 'memos' });

    const res = await request(app).get(`/posts/new?from=${parentId}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Original (branch)');
    expect(res.text).toContain(`name="parent_id" value="${parentId}"`);
    expect(res.text).toContain('Branched from');
  });

  it('renders normal form when from id does not exist', async () => {
    const res = await request(app).get('/posts/new?from=99999');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('Branched from');
    expect(res.text).not.toContain('name="parent_id"');
  });

  it('renders normal form when from param is absent', async () => {
    const res = await request(app).get('/posts/new');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('Branched from');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routes/posts.branches.test.js`
Expected: the first test FAILS — no `(branch)` suffix or hidden input. The others may pass incidentally (because absence of markers is easy) — that's fine.

- [ ] **Step 3: Update the route**

Replace the `/new` handler in `routes/posts.js` (currently lines 12-14):

```js
router.get('/new', (req, res) => {
  let parent = null;
  let prefillTags = '';
  if (req.query.from) {
    const from = Post.findByIdWithTags(req.query.from);
    if (from) {
      parent = {
        id: from.id,
        title: from.title,
        body: from.body,
        category: from.category,
        prefillTitle: `${from.title} (branch)`
      };
      prefillTags = (from.tags || []).map(t => t.name).join(', ');
    }
  }
  res.render('posts/new', { pageTitle: 'New Post', parent, prefillTags });
});
```

- [ ] **Step 4: Update `views/posts/new.ejs` to use `parent` + `prefillTags`**

At the top of the form body, right after `<h1 class="text-2xl font-bold text-gray-900 mb-6">New Post</h1>`, insert:

```ejs
<% if (parent) { %>
  <div class="mb-4 flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
    <div class="flex items-center gap-2 text-sm text-indigo-900">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 3v12m0 0a3 3 0 106 0m-6 0a3 3 0 116 0m0 0V9a3 3 0 013-3h3m-3 0l3-3m-3 3l3 3"/>
      </svg>
      <span>Branched from <a href="/posts/<%= parent.id %>" class="font-semibold hover:underline"><%= parent.title %></a></span>
    </div>
    <a href="/posts/new" class="text-xs text-indigo-600 hover:underline">Start from blank</a>
  </div>
<% } %>
```

Then update the existing inputs to use defaults. Replace the `title` input (currently around line 8-10):

```ejs
<input type="text" name="title" id="title" required
       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
       placeholder="게시글 제목을 입력하세요"
       value="<%= parent ? parent.prefillTitle : '' %>">
```

For the `category` select inside the `<% categoryTree.forEach... %>` loop, change the `<option>` lines to:

```ejs
<option value="<%= parent.slug %>" <%= (typeof parent !== 'undefined' && parent && parent.category === parent.slug) ? 'selected' : '' %>><%= parent.label %></option>
```

Wait — this collides with the `parent` var name for the branched-from post vs. the `parent` iteration variable of `categoryTree`. Rename the iteration variable to avoid shadowing. Replace the category `<select>` block (currently lines 15-23) with:

```ejs
<select name="category" id="category" required
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
  <% categoryTree.forEach(cat => { %>
    <option value="<%= cat.slug %>" <%= (parent && parent.category === cat.slug) ? 'selected' : '' %>><%= cat.label %></option>
    <% cat.children.forEach(child => { %>
      <option value="<%= child.slug %>" <%= (parent && parent.category === child.slug) ? 'selected' : '' %>>&nbsp;&nbsp;&nbsp;&nbsp;└ <%= child.label %></option>
    <% }) %>
  <% }) %>
</select>
```

For the `tags` input (currently around line 27-31), add `value`:

```ejs
<input type="text" name="tags" id="tags"
       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
       placeholder="콤마로 구분하여 태그 입력 (예: claude-code, skills, tips)"
       autocomplete="off"
       value="<%= prefillTags || '' %>">
```

For the `body` textarea (currently around line 37-39), place the body between the opening and closing tags:

```ejs
<textarea name="body" id="body" rows="16"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
          placeholder="Markdown으로 내용을 작성하세요..."><%= parent ? parent.body : '' %></textarea>
```

Finally, add the hidden input right before the closing `</form>` (or anywhere inside the form):

```ejs
<% if (parent) { %>
  <input type="hidden" name="parent_id" value="<%= parent.id %>">
<% } %>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/routes/posts.branches.test.js`
Expected: all three tests PASS.

- [ ] **Step 6: Commit**

```bash
git add routes/posts.js views/posts/new.ejs tests/routes/posts.branches.test.js
git commit -m "feat(posts): prefill new form from ?from= parent"
```

---

## Task 9: Route — `POST /posts` persists `parent_id`

**Files:**
- Modify: `routes/posts.js:16-47`
- Modify: `tests/routes/posts.branches.test.js` (append)

- [ ] **Step 1: Append failing tests**

Append to `tests/routes/posts.branches.test.js`:

```js
describe('POST /posts with parent_id', () => {
  it('persists parent_id when valid', async () => {
    const Post = require('../../models/post');
    const parentId = Post.create({ title: 'P', body: 'b', category: 'memos' });

    const res = await request(app)
      .post('/posts')
      .type('form')
      .send({ title: 'Child', body: 'c', category: 'memos', parent_id: String(parentId) });

    expect(res.status).toBe(302);
    const all = require('../../db/connection')
      .prepare('SELECT * FROM posts WHERE title = ?').get('Child');
    expect(all.parent_id).toBe(parentId);
  });

  it('coerces invalid parent_id to NULL', async () => {
    const res = await request(app)
      .post('/posts')
      .type('form')
      .send({ title: 'Orphan', body: 'o', category: 'memos', parent_id: '99999' });

    expect(res.status).toBe(302);
    const post = require('../../db/connection')
      .prepare('SELECT * FROM posts WHERE title = ?').get('Orphan');
    expect(post.parent_id).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routes/posts.branches.test.js`
Expected: the two new tests FAIL — `parent_id` is not passed to `Post.create`.

- [ ] **Step 3: Update `POST /` handler**

In `routes/posts.js`, replace the body of the POST `/` handler. Currently around line 41 (`const id = Post.create(...)`) — change it to validate and pass `parent_id`. Replace the full handler:

```js
router.post('/', upload.single('attachment'), (req, res) => {
  const { title, body, category } = req.body;

  let attachmentData = {};
  if (req.body.github_attachment_id) {
    attachmentData = {
      attachment_id: req.body.github_attachment_id,
      attachment_original_name: req.body.github_attachment_name,
      attachment_file_tree: JSON.parse(req.body.github_attachment_tree || '[]')
    };
  } else if (req.file) {
    try {
      const result = processUpload(req.file.path, req.file.originalname);
      attachmentData = {
        attachment_id: result.attachmentId,
        attachment_original_name: result.originalName,
        attachment_file_tree: result.fileTree
      };
    } catch (err) {
      console.error('File processing failed:', err);
    } finally {
      fs.unlinkSync(req.file.path);
    }
  }

  const rawParent = req.body.parent_id ? Number(req.body.parent_id) : null;
  const parent_id = rawParent && Post.findById(rawParent) ? rawParent : null;

  const id = Post.create({ title, body, category, parent_id, ...attachmentData });
  if (req.body.tags) {
    const tagNames = req.body.tags.split(',').map(t => t.trim()).filter(Boolean);
    Tag.syncPostTags(id, tagNames);
  }
  res.redirect(`/posts/${id}?msg=created`);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/routes/posts.branches.test.js`
Expected: all tests PASS.

- [ ] **Step 5: Run full test suite to ensure no regression**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add routes/posts.js tests/routes/posts.branches.test.js
git commit -m "feat(posts): accept and validate parent_id on create"
```

---

## Task 10: Route — `GET /posts/:id` passes `branchTree`

**Files:**
- Modify: `routes/posts.js:49-66`
- Modify: `tests/routes/posts.branches.test.js` (append)

- [ ] **Step 1: Append failing test**

Append to `tests/routes/posts.branches.test.js`:

```js
describe('GET /posts/:id branch tree', () => {
  it('renders Branch button and tree card when post has descendants', async () => {
    const Post = require('../../models/post');
    const aId = Post.create({ title: 'Parent', body: 'p', category: 'memos' });
    const bId = Post.create({ title: 'Child', body: 'c', category: 'memos', parent_id: aId });

    const res = await request(app).get(`/posts/${aId}`);
    expect(res.status).toBe(200);
    // Branch action button
    expect(res.text).toContain(`href="/posts/new?from=${aId}"`);
    // Branch tree sidebar title
    expect(res.text).toContain('Branch Tree');
    // Shows child title
    expect(res.text).toContain('Child');
  });

  it('renders Branched from banner on child page', async () => {
    const Post = require('../../models/post');
    const aId = Post.create({ title: 'Parent', body: 'p', category: 'memos' });
    const bId = Post.create({ title: 'Child', body: 'c', category: 'memos', parent_id: aId });

    const res = await request(app).get(`/posts/${bId}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Branched from');
    expect(res.text).toContain(`/posts/${aId}`);
  });

  it('omits Branch Tree card for root with no children', async () => {
    const Post = require('../../models/post');
    const id = Post.create({ title: 'Solo', body: 's', category: 'memos' });

    const res = await request(app).get(`/posts/${id}`);
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('Branch Tree');
    // Branch button still present
    expect(res.text).toContain(`href="/posts/new?from=${id}"`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routes/posts.branches.test.js`
Expected: the three new tests FAIL.

- [ ] **Step 3: Update `GET /:id` handler**

In `routes/posts.js`, replace the handler (currently lines 49-66) with:

```js
router.get('/:id', (req, res) => {
  const post = Post.findByIdWithTags(req.params.id);
  if (!post) return res.status(404).render('errors/404', { pageTitle: 'Not Found' });

  const renderedBody = renderMarkdown(post.body);
  const fileTree = post.attachment_file_tree ? JSON.parse(post.attachment_file_tree) : null;
  const categoryInfo = Category.findBySlug(post.category);
  const comments = Comment.findByPostId(post.id);

  const branchTree = Post.findBranchTree(post.id);
  const { toRenderRows } = require('../lib/branchTree');
  const branchRows = toRenderRows(branchTree);
  const hasBranchTree = branchTree.ancestors.length > 0 || branchTree.descendants.length > 0;
  const parentPost = post.parent_id ? Post.findById(post.parent_id) : null;

  res.render('posts/show', {
    pageTitle: post.title,
    post,
    renderedBody,
    fileTree,
    categoryInfo,
    comments,
    branchRows,
    hasBranchTree,
    parentPost
  });
});
```

- [ ] **Step 4: Update `views/posts/show.ejs` — Branch button + Branched-from + tree sidebar**

**4a. Branch button.** Locate the action buttons block (the `<div class="flex items-center gap-2 flex-shrink-0">` at about line 22). Add a Branch link between `Copy MD` and `Edit`:

```ejs
<a href="/posts/new?from=<%= post.id %>"
   class="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition">
  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" d="M6 3v12m0 0a3 3 0 106 0m-6 0a3 3 0 116 0m0 0V9a3 3 0 013-3h3m-3 0l3-3m-3 3l3 3"/>
  </svg>
  Branch
</a>
```

**4b. Branched-from line.** Immediately after the `<h1>` (`<h1 class="text-2xl font-bold text-gray-900"><%= post.title %></h1>` at about line 20), add:

```ejs
<% if (parentPost) { %>
  <div class="mt-1 text-xs text-gray-500">
    ↳ Branched from <a href="/posts/<%= parentPost.id %>" class="text-indigo-600 hover:underline"><%= parentPost.title %></a>
  </div>
<% } %>
```

**4c. Sidebar layout.** Change the column wrapper at line 42 to include the branch-tree condition:

```ejs
<div class="flex gap-6 <% if (fileTree || hasBranchTree) { %>flex-col lg:flex-row<% } %>">
```

**4d. Render branch-tree card.** At the end of the `<% if (fileTree) { %> ... <% } %>` block (around line 113 — inside the sticky container if keeping them in one column; or as a second card if splitting), add a second card for the branch tree. The simplest layout: when both exist, wrap them in the same `lg:w-80 flex-shrink-0` column, file tree first. Replace the entire sidebar section (the `<% if (fileTree) { %> <div class="lg:w-80 flex-shrink-0"> ... </div> <% } %>` block) with:

```ejs
<% if (fileTree || hasBranchTree) { %>
<div class="lg:w-80 flex-shrink-0 space-y-4">
  <% if (fileTree) { %>
  <div class="bg-white rounded-xl border sticky top-20">
    <div class="p-4 border-b flex items-center justify-between">
      <h3 class="font-semibold text-sm text-gray-900">
        <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"/></svg>
        <%= post.attachment_original_name || 'Attachment' %>
      </h3>
      <a href="/api/posts/<%= post.id %>/download" class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Download</a>
    </div>
    <div class="file-tree p-3 max-h-96 overflow-y-auto text-sm" id="file-tree" data-post-id="<%= post.id %>">
      <%- include('../partials/file-tree-items', { items: fileTree }) %>
    </div>
    <div id="file-preview-panel" class="border-t hidden">
      <div class="p-3 bg-gray-50 border-b flex items-center justify-between">
        <span id="preview-filename" class="text-xs font-medium text-gray-700 truncate"></span>
        <div class="flex items-center gap-2">
          <button id="preview-copy-btn" class="text-xs text-gray-500 hover:text-gray-700">Copy</button>
          <a id="preview-download-link" href="#" class="text-xs text-indigo-600 hover:text-indigo-800">Download</a>
          <button id="preview-close-btn" class="text-xs text-gray-400 hover:text-gray-600">✕</button>
        </div>
      </div>
      <div id="preview-content" class="p-3 max-h-80 overflow-auto"></div>
    </div>
  </div>
  <% } %>

  <% if (hasBranchTree) { %>
    <%- include('../partials/branch-tree', { rows: branchRows }) %>
  <% } %>
</div>
<% } %>
```

- [ ] **Step 5: Create `views/partials/branch-tree.ejs`** (actual render happens in Task 11; for this task, create a minimal version so the tests pass)

Create `views/partials/branch-tree.ejs`:

```ejs
<div class="bg-white rounded-xl border">
  <div class="p-4 border-b">
    <h3 class="font-semibold text-sm text-gray-900">Branch Tree</h3>
  </div>
  <div class="p-3 text-sm font-mono overflow-x-auto">
    <% rows.forEach(row => { %>
      <div class="<%= row.isCurrent ? 'bg-indigo-50 font-bold text-gray-900' : 'text-gray-700' %> py-0.5 pl-<%= row.depth * 3 %>">
        <% if (row.isCurrent) { %>●<% } else { %>·<% } %>
        <%= row.title %>
      </div>
    <% }) %>
  </div>
</div>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/routes/posts.branches.test.js`
Expected: all tests PASS.

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add routes/posts.js views/posts/show.ejs views/partials/branch-tree.ejs
git commit -m "feat(posts): branch button + tree sidebar on show page"
```

---

## Task 11: Polish `views/partials/branch-tree.ejs` rendering

Upgrades the minimal placeholder into the full spec: connectors, date, category badge, children-count badge. No new tests — visual task.

**Files:**
- Modify: `views/partials/branch-tree.ejs`

- [ ] **Step 1: Rewrite the partial**

Replace `views/partials/branch-tree.ejs` with:

```ejs
<div class="bg-white rounded-xl border">
  <div class="p-4 border-b flex items-center justify-between">
    <h3 class="font-semibold text-sm text-gray-900">
      <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 3v12m0 0a3 3 0 106 0m-6 0a3 3 0 116 0m0 0V9a3 3 0 013-3h3m-3 0l3-3m-3 3l3 3"/>
      </svg>
      Branch Tree
    </h3>
  </div>
  <div class="p-3 text-xs font-mono overflow-x-auto">
    <% rows.forEach((row) => { %>
      <% const indent = '  '.repeat(row.depth); %>
      <% const connector = row.depth === 0 ? '' : (row.isLastSibling ? '└─ ' : '├─ '); %>
      <% if (row.isCurrent) { %>
        <a href="/posts/<%= row.id %>" class="block -mx-3 px-3 py-1 bg-indigo-50 text-gray-900 font-semibold hover:bg-indigo-100">
          <span class="text-gray-400 whitespace-pre"><%= indent + connector %></span>
          ● <%= row.title %>
          <% if (row.childrenCount > 0) { %>
            <span class="ml-1 inline-block px-1.5 py-0.5 text-[10px] bg-indigo-100 text-indigo-700 rounded"><%= row.childrenCount %> branch<%= row.childrenCount === 1 ? '' : 'es' %></span>
          <% } %>
        </a>
      <% } else { %>
        <a href="/posts/<%= row.id %>" class="block py-1 text-gray-700 hover:text-indigo-600">
          <span class="text-gray-400 whitespace-pre"><%= indent + connector %></span>
          <%= row.title %>
        </a>
      <% } %>
    <% }) %>
  </div>
</div>
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `npm test`
Expected: all tests pass (including the Task 10 route tests which check for `Branch Tree` and child title substrings — both still present).

- [ ] **Step 3: Manual UI verification**

Run: `npm run dev` (in one terminal), `npm run css:build` if needed.

Walk through these steps in the browser:

1. Open an existing post. Confirm the new "Branch" button appears in the action row.
2. Click Branch. Confirm the new-post form opens with:
   - A "Branched from [title]" banner at the top
   - Title prefilled with `"… (branch)"`
   - Body prefilled with the parent's content
   - Category selected to match parent
   - Tags prefilled
   - Attachment area empty
   - Hidden `parent_id` in form (inspect via DevTools)
3. Submit. Confirm the new post page shows:
   - "↳ Branched from [parent title]" under the title
   - A "Branch Tree" sidebar card with the chain visible
   - The current node bolded with `●` marker
4. Branch again from the new post to build a 3-level chain A → B → C. Open each and verify the tree shows correct ancestors + descendants + connectors.
5. Create a second child of A (sibling to B). Open A and verify both children render under A.
6. Delete A. Open B — the "Branched from" banner should disappear and B's tree should show only B (and its descendants). No errors.
7. Open a post that has no parent and no children. Verify the Branch Tree sidebar card is NOT rendered, but the Branch button still is.

- [ ] **Step 4: Commit**

```bash
git add views/partials/branch-tree.ejs
git commit -m "feat(posts): polish branch tree partial with connectors and badges"
```

---

## Task 12: Final Regression Pass

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass — model tests, route tests, and lib tests.

- [ ] **Step 2: Verify dev server still boots**

Run: `node app.js &`
Expected: prints the listening message. Then `kill %1`.

- [ ] **Step 3: Final sanity check**

Run: `git status`
Expected: working tree clean.

Run: `git log --oneline -15`
Expected: 11 or 12 feature commits building up from `Add spec for post branches feature`.
