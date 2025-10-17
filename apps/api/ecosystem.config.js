// PM2 Ecosystem Configuration for ICD API
// This file configures PM2 process manager for both development and production environments
// 
// Usage:
//   Development: pm2 start ecosystem.config.js --env development
//   Production:  pm2 start ecosystem.config.js --env production
//
// The .env file is automatically loaded and its variables are made available to the app

require('dotenv').config();

module.exports = {
  apps: [
    {
      // Application name shown in PM2 list
      name: 'icd-api',
      
      // Entry point for the application
      script: './src/server.js',
      
      // Number of instances (1 for single instance, or 'max' for cluster mode)
      instances: 1,
      
      // Execution mode: 'fork' or 'cluster'
      exec_mode: 'fork',
      
      // Auto-restart if the app crashes
      autorestart: true,
      
      // Watch for file changes and auto-restart (useful in development)
      watch: false,
      
      // Maximum memory before auto-restart (prevents memory leaks)
      max_memory_restart: '500M',
      
      // Merge logs into single files
      merge_logs: true,
      
      // Log timestamps
      time: true,
      
      // Development environment variables
      env_development: {
        NODE_ENV: 'development',
        PORT: process.env.PORT || 3000,
        LOG_LEVEL: 'debug',
        DATABASE_URL: process.env.DATABASE_URL,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        MAX_SUGGESTIONS: 8
      },
      
      // Production environment variables
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
        LOG_LEVEL: 'info',
        DATABASE_URL: process.env.DATABASE_URL,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        MAX_SUGGESTIONS: 8
      },
      
      // Error log file location
      error_file: './logs/api-error.log',
      
      // Output log file location
      out_file: './logs/api-out.log',
      
      // Log date format
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Minimum uptime before considering the app stable (prevents restart loops)
      min_uptime: '10s',
      
      // Maximum number of restart attempts
      max_restarts: 10,
      
      // Time to wait before restarting a crashed app
      restart_delay: 4000,
      
      // Kill timeout (time to wait before force killing the app)
      kill_timeout: 5000
    }
  ]
};

