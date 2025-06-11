// middleware/errorHandler.js - COMPREHENSIVE ERROR HANDLING
import { logger } from '../utils/logger.js';
import { APP_CONSTANTS } from '../config/config.js';

/**
 * Custom error class for application-specific errors
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error class
 */
export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, APP_CONSTANTS.ERROR_CODES.VALIDATION_ERROR, details);
    this.name = 'ValidationError';
  }
}

/**
 * Database error class
 */
export class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500, APP_CONSTANTS.ERROR_CODES.DATABASE_ERROR);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

/**
 * Authentication error class
 */
export class AuthError extends AppError {
  constructor(message, statusCode = 401) {
    const errorCode = statusCode === 403 ? 
      APP_CONSTANTS.ERROR_CODES.FORBIDDEN : 
      APP_CONSTANTS.ERROR_CODES.UNAUTHORIZED;
    
    super(message, statusCode, errorCode);
    this.name = 'AuthError';
  }
}

/**
 * Not found error class
 */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, APP_CONSTANTS.ERROR_CODES.USER_NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

/**
 * Rate limit error class
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, APP_CONSTANTS.ERROR_CODES.RATE_LIMIT_EXCEEDED);
    this.name = 'RateLimitError';
  }
}

/**
 * Format error response based on error type
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @returns {Object} Formatted error response
 */
function formatErrorResponse(error, req) {
  const baseResponse = {
    success: false,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  // Handle operational errors (known errors)
  if (error.isOperational) {
    return {
      ...baseResponse,
      error: error.message,
      error_code: error.errorCode,
      ...(error.details && { details: error.details })
    };
  }

  // Handle Joi validation errors
  if (error.name === 'ValidationError' && error.details) {
    const validationErrors = {};
    error.details.forEach(detail => {
      const field = detail.path.join('.');
      validationErrors[field] = detail.message;
    });

    return {
      ...baseResponse,
      error: 'Validation failed',
      error_code: APP_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
      errors: validationErrors
    };
  }

  // Handle Supabase errors
  if (error.code && error.message) {
    let statusCode = 500;
    let errorCode = APP_CONSTANTS.ERROR_CODES.DATABASE_ERROR;
    let message = error.message;

    // Map specific Supabase error codes
    switch (error.code) {
      case 'PGRST116': // No rows found
        statusCode = 404;
        errorCode = APP_CONSTANTS.ERROR_CODES.USER_NOT_FOUND;
        message = 'Resource not found';
        break;
      case '23505': // Unique constraint violation
        statusCode = 409;
        errorCode = APP_CONSTANTS.ERROR_CODES.DUPLICATE_SUBMISSION;
        message = 'Duplicate entry detected';
        break;
      case '23503': // Foreign key violation
        statusCode = 400;
        errorCode = APP_CONSTANTS.ERROR_CODES.VALIDATION_ERROR;
        message = 'Invalid reference data';
        break;
    }

    return {
      ...baseResponse,
      error: message,
      error_code: errorCode,
      status_code: statusCode
    };
  }

  // Handle JSON parsing errors
  if (error instanceof SyntaxError && error.message.includes('JSON')) {
    return {
      ...baseResponse,
      error: 'Invalid JSON format',
      error_code: 'INVALID_JSON'
    };
  }

  // Handle unknown errors (don't expose details in production)
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    ...baseResponse,
    error: isProduction ? 'Internal server error' : error.message,
    error_code: APP_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
    ...((!isProduction && error.stack) && { stack: error.stack })
  };
}

/**
 * Main error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
export function errorHandler(err, req, res, next) {
  // Skip if response already sent
  if (res.headersSent) {
    return next(err);
  }

  // Log error details
  const errorDetails = {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    params: req.params,
    query: req.query,
    timestamp: new Date().toISOString()
  };

  // Log based on error severity
  if (err.isOperational) {
    logger.warn('Operational error:', errorDetails);
  } else {
    logger.error('Unexpected error:', errorDetails);
  }

  // Security logging for potential attacks
  if (err.name === 'ValidationError' || 
      err.message.includes('SQL') || 
      err.message.includes('injection')) {
    logger.security('Potential security issue', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      error: err.message,
      path: req.path
    });
  }

  // Format and send error response
  const errorResponse = formatErrorResponse(err, req);
  const statusCode = err.statusCode || errorResponse.status_code || 500;

  res.status(statusCode).json(errorResponse);
}

/**
 * 404 Not Found handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export function notFoundHandler(req, res) {
  const error = {
    success: false,
    error: `${req.method} ${req.path} endpoint not found`,
    error_code: 'ENDPOINT_NOT_FOUND',
    timestamp: new Date().toISOString(),
    available_endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      user: '/api/user',
      tasks: '/api/tasks',
      leaderboard: '/api/leaderboard',
      admin: '/api/admin'
    }
  };

  // Log 404 attempts for monitoring
  logger.warn(`404 Not Found: ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json(error);
}

/**
 * Async error handler wrapper
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function with error handling
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create standardized error responses
 */
export const createError = {
  /**
   * Bad request error
   * @param {string} message - Error message
   * @param {Object} details - Additional details
   */
  badRequest(message, details = null) {
    return new ValidationError(message, details);
  },

  /**
   * Unauthorized error
   * @param {string} message - Error message
   */
  unauthorized(message = 'Authentication required') {
    return new AuthError(message, 401);
  },

  /**
   * Forbidden error
   * @param {string} message - Error message
   */
  forbidden(message = 'Access forbidden') {
    return new AuthError(message, 403);
  },

  /**
   * Not found error
   * @param {string} resource - Resource name
   */
  notFound(resource = 'Resource') {
    return new NotFoundError(resource);
  },

  /**
   * Conflict error
   * @param {string} message - Error message
   */
  conflict(message) {
    return new AppError(message, 409, 'CONFLICT');
  },

  /**
   * Internal server error
   * @param {string} message - Error message
   */
  internal(message = 'Internal server error') {
    return new AppError(message, 500, APP_CONSTANTS.ERROR_CODES.INTERNAL_ERROR);
  },

  /**
   * Database error
   * @param {string} message - Error message
   * @param {Error} originalError - Original database error
   */
  database(message, originalError = null) {
    return new DatabaseError(message, originalError);
  },

  /**
   * Rate limit error
   * @param {string} message - Error message
   */
  rateLimit(message = 'Too many requests. Please try again later.') {
    return new RateLimitError(message);
  }
};

/**
 * Error reporting for production environments
 * @param {Error} error - Error to report
 * @param {Object} context - Additional context
 */
export function reportError(error, context = {}) {
  // In production, you might want to send errors to external services
  // like Sentry, Bugsnag, or custom logging service
  
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to external error reporting service
    // await sendToErrorReporting(error, context);
    
    // For now, just log to console with structured format
    logger.error('Production Error Report:', {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version
    });
  }
}

export default {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createError,
  AppError,
  ValidationError,
  DatabaseError,
  AuthError,
  NotFoundError,
  RateLimitError
};