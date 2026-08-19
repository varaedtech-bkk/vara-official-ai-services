/**
 * PM2 process definition for the VARA EdTech AI Assistant on a VPS.
 *
 * Assumes the repo is cloned at /root/vara-official-ai-services.
 * Build once, then:
 *
 *   cd /root/vara-official-ai-services
 *   bash deploy/pm2.sh
 *   pm2 save
 *   pm2 startup
 *
 * Listens on 0.0.0.0:8080. Leads are stored in ./data (no LEADS_DIR).
 */
const path = require('path');

const APP_DIR = process.env.APP_DIR || '/root/vara-official-ai-services';

module.exports = {
  apps: [
    {
      name: 'vara-assistant',
      cwd: APP_DIR,
      script: path.join(APP_DIR, 'node_modules/next/dist/bin/next'),
      args: 'start -p 8080 -H 0.0.0.0',
      interpreter: 'node',

      instances: 1,
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'production',
        PORT: 8080,
        HOSTNAME: '0.0.0.0',
      },

      env_file: path.join(APP_DIR, '.env'),

      autorestart: true,
      max_restarts: 10,
      min_uptime: '20s',
      restart_delay: 3000,
      max_memory_restart: '500M',
      kill_timeout: 5000,
      listen_timeout: 10000,

      merge_logs: true,
      time: true,
    },
  ],
};
