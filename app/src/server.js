'use strict';

const { createApp, APP_VERSION } = require('./app');

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`🐍 Snake (${APP_VERSION}) écoute sur http://0.0.0.0:${PORT}`);
});
