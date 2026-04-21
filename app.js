const express = require('express');
const path = require('path');
const morgan = require('morgan');
const compression = require('compression');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');

const config = require('./config/default');
const localsMiddleware = require('./middleware/locals');
const { notFoundHandler, errorHandler } = require('./middleware/errors');

const indexRouter = require('./routes/index');
const postsRouter = require('./routes/posts');
const apiRouter = require('./routes/api');
const adminRouter = require('./routes/admin');

const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Middleware
app.use(morgan('short'));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride((req) => {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    const method = req.body._method;
    delete req.body._method;
    return method;
  }
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(localsMiddleware);

// Routes
app.use('/', indexRouter);
app.use('/posts', postsRouter);
app.use('/api', apiRouter);
app.use('/admin', adminRouter);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, config.host, () => {
  console.log(`Lab Share Page running at http://${config.host}:${config.port}`);
});
