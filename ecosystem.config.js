module.exports = {
  apps: [{
    name: 'lab-share-page',
    script: './app.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      PORT: 3333
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    merge_logs: true,
    time: true
  }]
};
