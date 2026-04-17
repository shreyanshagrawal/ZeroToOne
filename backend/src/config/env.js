const dotenv = require('dotenv');

// Load environment variables early
dotenv.config();

/**
 * Centralized environment configuration
 * - Defines explicit defaults.
 * - Makes it easier to add validaton for env vars later.
 */
const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  env: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  
  // Future external API keys
  githubToken: process.env.GITHUB_TOKEN || '',
};

module.exports = config;
