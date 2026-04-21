const { Marked } = require('marked');
const { markedHighlight } = require('marked-highlight');
const hljs = require('highlight.js');
const sanitizeHtml = require('sanitize-html');

const marked = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    }
  })
);

marked.use({
  gfm: true,
  breaks: true
});

function renderMarkdown(text) {
  const raw = marked.parse(text || '');
  return sanitizeHtml(raw, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'input', 'del', 'ins', 'details', 'summary',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'pre', 'code', 'span', 'div'
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class', 'id'],
      'input': ['type', 'checked', 'disabled'],
      'img': ['src', 'alt', 'title', 'width', 'height'],
      'a': ['href', 'target', 'rel'],
      'td': ['align'],
      'th': ['align']
    },
    allowedClasses: false
  });
}

module.exports = { renderMarkdown };
