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
