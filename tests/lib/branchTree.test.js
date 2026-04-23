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
