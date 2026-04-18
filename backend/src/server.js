const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const connectDB = require('./config/db');
const routes = require('./routes');
const errorMiddleware = require('./middlewares/error.middleware');
const AppError = require('./utils/AppError');

// Connect to Database
connectDB();

const app = express();

const corsOptions = {
  origin: [
    'https://zero-to-one-blond.vercel.app',
    'http://localhost:5173', // Local frontend
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight requests

app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));

// simple request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

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
