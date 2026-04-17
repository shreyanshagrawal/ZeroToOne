const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const routes = require('./routes');
const errorMiddleware = require('./middlewares/error.middleware');
const AppError = require('./utils/AppError');

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));

// Core API Routes
app.use('/api', routes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'CodeMap AI servers are running.', environment: config.env });
});

// Handle 404 (Unmatched Routes)
app.use('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(errorMiddleware);

// Start the server
app.listen(config.port, () => {
  console.log(`🚀 Server initialized on port ${config.port} in ${config.env} mode`);
});
