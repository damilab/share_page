CREATE TABLE IF NOT EXISTS categories (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    slug  TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT 'gray',
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- Migrate the 4 existing categories
INSERT OR IGNORE INTO categories (slug, label, description, color, sort_order) VALUES
  ('system-prompts', 'System Prompts', 'Claude Code .claude/ configurations and CLAUDE.md files', 'indigo', 1),
  ('md-skills', 'MD Skills', 'Markdown-based skill definitions for Claude Code', 'emerald', 2),
  ('meeting-materials', 'Meeting Materials', 'Slides, notes, and recordings from lab meetings', 'amber', 3),
  ('memos', 'Memos', 'General notes, tips, and documentation', 'sky', 4);
