// middleware/cors.js - CORS CONFIGURATION
import cors from 'cors';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';

/**
 * CORS configuration based on environment
 */
const corsOptions = {
  // Allowed origins
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // In development, allow localhost with any port
    if (config.NODE_ENV === 'development') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }

    // Check against allowed origins
    if (config.ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // Telegram WebApp origins
    if (origin.includes('web.telegram.org')) {
      return callback(null, true);
    }

    // Log rejected origins for monitoring
    logger.security('CORS origin rejected', { 
      origin, 
      allowed: config.ALLOWED_ORIGINS 
    });
    
    const error = new Error(`CORS policy violation: Origin ${origin} not allowed`);
    error.status = 403;
    callback(error);
  },

  // Allowed HTTP methods
  methods: [
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'PATCH',
    'OPTIONS'
  ],

  // Allowed headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Methods',
    'X-API-Key',
    'X-Client-Version',
    'X-Request-ID'
  ],

  // Exposed headers (headers that client can access)
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],

  // Allow credentials (cookies, authorization headers)
  credentials: true,

  // Preflight request cache time (in seconds)
  maxAge: 86400, // 24 hours

  // Status code for successful OPTIONS requests
  optionsSuccessStatus: 200
};

/**
 * CORS middleware with logging
 */
export const corsMiddleware = cors({
  ...corsOptions,
  origin: function (origin, callback) {
    // Call the original origin function
    corsOptions.origin(origin, (err, allowed) => {
      if (err) {
        logger.warn('CORS rejection:', { origin, error: err.message });
        return callback(err);
      }

      if (allowed && config.NODE_ENV === 'development') {
        logger.debug('CORS allowed:', { origin });
      }

      callback(null, allowed);
    });
  }
});

/**
 * Custom CORS middleware for specific routes
 * @param {Array} allowedOrigins - Specific origins for this route
 * @returns {Function} CORS middleware
 */
export function createCustomCORS(allowedOrigins = []) {
  return cors({
    ...corsOptions,
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      const error = new Error(`Custom CORS policy: Origin ${origin} not allowed for this endpoint`);
      error.status = 403;
      callback(error);
    }
  });
}

/**
 * Strict CORS for admin endpoints
 */
export const adminCORS = cors({
  ...corsOptions,
  origin: function (origin, callback) {
    // Only allow specific admin origins
    const adminOrigins = [
      'http://localhost:3001', // Admin panel local
      'https://admin.yuldagilar.vercel.app' // Admin panel production
    ];

    if (!origin || adminOrigins.includes(origin)) {
      return callback(null, true);
    }

    logger.security('Admin CORS rejection:', { origin });
    const error = new Error('Admin access forbidden');
    error.status = 403;
    callback(error);
  },
  
  // More restrictive for admin
  methods: ['GET', 'POST'],
  credentials: true
});

/**
 * Public CORS for health checks and public endpoints
 */
export const publicCORS = cors({
  origin: '*', // Allow all origins for public endpoints
  methods: ['GET'],
  allowedHeaders: ['Content-Type'],
  credentials: false
});

/**
 * Development CORS (very permissive)
 */
export const devCORS = cors({
  origin: true, // Allow all origins in development
  methods: '*',
  allowedHeaders: '*',
  credentials: true,
  optionsSuccessStatus: 200
});

/**
 * CORS error handler
 * @param {Error} error - CORS error
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export function corsErrorHandler(error, req, res, next) {
  if (error.message && error.message.includes('CORS')) {
    logger.security('CORS violation attempt:', {
      origin: req.get('origin'),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      method: req.method,
      path: req.path
    });

    return res.status(403).json({
      success: false,
      error: 'CORS policy violation',
      error_code: 'CORS_VIOLATION',
      timestamp: new Date().toISOString()
    });
  }
  
  next(error);
}

/**
 * CORS configuration validator
 */
export function validateCORSConfig() {
  logger.info('🔧 CORS Configuration:');
  logger.info(`   Allowed Origins: ${config.ALLOWED_ORIGINS.join(', ')}`);
  logger.info(`   Credentials: ${corsOptions.credentials}`);
  logger.info(`   Max Age: ${corsOptions.maxAge}s`);
  logger.info(`   Methods: ${corsOptions.methods.join(', ')}`);
  
  if (config.NODE_ENV === 'development') {
    logger.warn('⚠️ Development mode: CORS is permissive for localhost');
  }
}

/**
 * Security headers middleware (complement to CORS)
 */
export function securityHeaders(req, res, next) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
  );
  
  next();
}

export default corsMiddleware;