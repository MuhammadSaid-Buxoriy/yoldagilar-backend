// middleware/validation.js - REQUEST VALIDATION MIDDLEWARE
import Joi from 'joi';
import { createError } from './errorHandler.js';
import { logger } from '../utils/logger.js';
import { APP_CONSTANTS } from '../config/config.js';

// ==================== VALIDATION SCHEMAS ====================

/**
 * Telegram ID validation schema
 */
const telegramIdSchema = Joi.object({
  tg_id: Joi.alternatives().try(
    Joi.number().integer().positive().required(),
    Joi.string().pattern(/^\d+$/).custom((value) => parseInt(value))
  ).required().messages({
    'alternatives.match': 'Telegram ID must be a positive integer',
    'any.required': 'Telegram ID is required'
  })
});

/**
 * User registration validation schema
 */
const userRegistrationSchema = Joi.object({
  tg_id: Joi.alternatives().try(
    Joi.number().integer().positive(),
    Joi.string().pattern(/^\d+$/).custom((value) => parseInt(value))
  ).required().messages({
    'alternatives.match': 'Telegram ID must be a positive integer',
    'any.required': 'Telegram ID is required'
  }),
  
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .pattern(/^[a-zA-ZА-Яа-яЁёЎўҚқҒғҲҳ\s'.-]+$/)
    .required()
    .messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name must be less than 100 characters',
      'string.pattern.base': 'Name can only contain letters, spaces, apostrophes, and hyphens',
      'any.required': 'Name is required'
    }),
  
  username: Joi.string()
    .trim()
    .alphanum()
    .min(3)
    .max(32)
    .allow(null, '')
    .messages({
      'string.alphanum': 'Username can only contain letters and numbers',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username must be less than 32 characters'
    }),
  
  photo_url: Joi.string()
    .uri()
    .allow(null, '')
    .messages({
      'string.uri': 'Photo URL must be a valid URL'
    })
});

/**
 * Daily progress submission validation schema
 */
const dailyProgressSchema = Joi.object({
  tg_id: Joi.alternatives().try(
    Joi.number().integer().positive(),
    Joi.string().pattern(/^\d+$/).custom((value) => parseInt(value))
  ).required(),
  
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .default(() => new Date().toISOString().split('T')[0])
    .messages({
      'string.pattern.base': 'Date must be in YYYY-MM-DD format'
    }),
  
  tasks: Joi.object().pattern(
    /^[1-9]|10$/,
    Joi.boolean()
  ).default({}),
  
  task_inputs: Joi.object().pattern(
    /^[1-9]|10$/,
    Joi.alternatives().try(
      Joi.number().min(0),
      Joi.string().trim()
    )
  ).default({}),
  
  pages_read: Joi.number()
    .integer()
    .min(APP_CONSTANTS.TASKS.MIN_PAGES_READ)
    .max(APP_CONSTANTS.TASKS.MAX_PAGES_READ)
    .default(0)
    .messages({
      'number.min': `Pages read must be at least ${APP_CONSTANTS.TASKS.MIN_PAGES_READ}`,
      'number.max': `Pages read cannot exceed ${APP_CONSTANTS.TASKS.MAX_PAGES_READ}`
    }),
  
  distance_km: Joi.number()
    .min(APP_CONSTANTS.TASKS.MIN_DISTANCE)
    .max(APP_CONSTANTS.TASKS.MAX_DISTANCE)
    .precision(2)
    .default(0)
    .messages({
      'number.min': `Distance must be at least ${APP_CONSTANTS.TASKS.MIN_DISTANCE} km`,
      'number.max': `Distance cannot exceed ${APP_CONSTANTS.TASKS.MAX_DISTANCE} km`
    })
});

/**
 * Leaderboard query validation schema
 */
const leaderboardQuerySchema = Joi.object({
  period: Joi.string()
    .valid(...Object.values(APP_CONSTANTS.TIME_PERIODS))
    .default('all')
    .messages({
      'any.only': `Period must be one of: ${Object.values(APP_CONSTANTS.TIME_PERIODS).join(', ')}`
    }),
  
  type: Joi.string()
    .valid(...Object.values(APP_CONSTANTS.LEADERBOARD_TYPES))
    .default('overall')
    .messages({
      'any.only': `Type must be one of: ${Object.values(APP_CONSTANTS.LEADERBOARD_TYPES).join(', ')}`
    }),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(100)
    .messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 1000'
    }),
  
  offset: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .messages({
      'number.min': 'Offset must be >= 0'
    })
});

/**
 * Photo upload validation schema
 */
const photoUploadSchema = Joi.object({
  tg_id: Joi.alternatives().try(
    Joi.number().integer().positive(),
    Joi.string().pattern(/^\d+$/).custom((value) => parseInt(value))
  ).required()
});

// ==================== VALIDATION MIDDLEWARE FACTORY ====================

/**
 * Create validation middleware
 * @param {Object} schema - Joi validation schema
 * @param {string} source - Data source (body, params, query)
 * @returns {Function} Express middleware
 */
function createValidationMiddleware(schema, source = 'body') {
  return (req, res, next) => {
    const dataToValidate = req[source];
    
    const { error, value } = schema.validate(dataToValidate, {
      stripUnknown: true,
      abortEarly: false,
      convert: true
    });

    if (error) {
      const validationErrors = {};
      
      error.details.forEach(detail => {
        const field = detail.path.join('.');
        validationErrors[field] = detail.message;
      });

      logger.warn('Validation failed:', {
        path: req.path,
        method: req.method,
        errors: validationErrors,
        ip: req.ip
      });

      throw createError.badRequest('Validation failed', validationErrors);
    }

    // Store validated data
    if (source === 'body') {
      req.validatedBody = value;
    } else if (source === 'params') {
      req.validatedParams = value;
    } else if (source === 'query') {
      req.validatedQuery = value;
    }

    next();
  };
}

// ==================== EXPORTED VALIDATION MIDDLEWARE ====================

/**
 * Validate Telegram ID in params
 */
export const validateTelegramId = createValidationMiddleware(telegramIdSchema, 'params');

/**
 * Validate user registration data
 */
export const validateUserRegistration = createValidationMiddleware(userRegistrationSchema, 'body');

/**
 * Validate daily progress submission
 */
export const validateDailyProgress = createValidationMiddleware(dailyProgressSchema, 'body');

/**
 * Validate leaderboard query parameters
 */
export const validateLeaderboardQuery = createValidationMiddleware(leaderboardQuerySchema, 'query');

/**
 * Validate photo upload data
 */
export const validatePhotoUpload = createValidationMiddleware(photoUploadSchema, 'body');

// ==================== SPECIFIC VALIDATION HELPERS ====================

/**
 * Validate file upload
 * @param {Array} allowedTypes - Allowed MIME types
 * @param {number} maxSize - Maximum file size in bytes
 * @returns {Function} Express middleware
 */
export function validateFileUpload(allowedTypes = [], maxSize = 5 * 1024 * 1024) {
  return (req, res, next) => {
    if (!req.file) {
      throw createError.badRequest('No file uploaded');
    }

    const file = req.file;

    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
      throw createError.badRequest(
        `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
      );
    }

    // Check file size
    if (file.size > maxSize) {
      throw createError.badRequest(
        `File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`
      );
    }

    logger.debug('File validation passed:', {
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    next();
  };
}

/**
 * Validate admin access
 * @param {number} adminId - Admin Telegram ID
 * @returns {Function} Express middleware
 */
export function validateAdminAccess(adminId) {
  return (req, res, next) => {
    const { admin_tg_id } = req.body || req.query || req.headers;
    
    if (!admin_tg_id) {
      throw createError.unauthorized('Admin authentication required');
    }

    const providedAdminId = parseInt(admin_tg_id);
    if (isNaN(providedAdminId) || providedAdminId !== adminId) {
      logger.security('Invalid admin access attempt:', {
        provided_id: admin_tg_id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      throw createError.forbidden('Admin access denied');
    }

    logger.info('Admin access granted:', { 
      admin_id: providedAdminId,
      path: req.path,
      method: req.method 
    });

    next();
  };
}

/**
 * Validate user approval status
 * @returns {Function} Express middleware
 */
export function validateUserApproval() {
  return async (req, res, next) => {
    try {
      const { tg_id } = req.params || req.body;
      
      if (!tg_id) {
        throw createError.badRequest('Telegram ID required');
      }

      const telegramId = parseInt(tg_id);
      if (isNaN(telegramId)) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      // TODO: Check user approval status from database
      // This would require importing userService, but we want to avoid circular dependencies
      // For now, we'll skip this check and handle it in controllers
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validate request rate limiting
 * @param {number} maxRequests - Maximum requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} Express middleware
 */
export function validateRateLimit(maxRequests = 10, windowMs = 60000) {
  const requests = new Map();

  return (req, res, next) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    // Clean old entries
    for (const [id, data] of requests.entries()) {
      if (now - data.firstRequest > windowMs) {
        requests.delete(id);
      }
    }

    // Get or create client data
    let clientData = requests.get(clientId);
    if (!clientData) {
      clientData = {
        count: 0,
        firstRequest: now
      };
      requests.set(clientId, clientData);
    }

    // Reset if window expired
    if (now - clientData.firstRequest > windowMs) {
      clientData.count = 0;
      clientData.firstRequest = now;
    }

    // Check limit
    if (clientData.count >= maxRequests) {
      const resetTime = new Date(clientData.firstRequest + windowMs);
      
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', resetTime.toISOString());

      logger.warn('Rate limit exceeded:', {
        ip: clientId,
        path: req.path,
        count: clientData.count
      });

      throw createError.rateLimit();
    }

    // Increment counter
    clientData.count++;

    // Set headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - clientData.count);
    res.setHeader('X-RateLimit-Reset', new Date(clientData.firstRequest + windowMs).toISOString());

    next();
  };
}

/**
 * Validate request body size
 * @param {number} maxSize - Maximum body size in bytes
 * @returns {Function} Express middleware
 */
export function validateBodySize(maxSize = 1024 * 1024) {
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    
    if (contentLength > maxSize) {
      logger.warn('Request body too large:', {
        contentLength,
        maxSize,
        ip: req.ip,
        path: req.path
      });

      throw createError.badRequest(
        `Request body too large. Maximum size: ${Math.round(maxSize / 1024)}KB`
      );
    }

    next();
  };
}

/**
 * Validate JSON content type
 * @returns {Function} Express middleware
 */
export function validateJsonContentType() {
  return (req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const contentType = req.get('Content-Type');
      
      if (!contentType || !contentType.includes('application/json')) {
        throw createError.badRequest('Content-Type must be application/json');
      }
    }

    next();
  };
}

/**
 * Validate required headers
 * @param {Array} requiredHeaders - List of required header names
 * @returns {Function} Express middleware
 */
export function validateRequiredHeaders(requiredHeaders = []) {
  return (req, res, next) => {
    const missingHeaders = requiredHeaders.filter(header => 
      !req.get(header)
    );

    if (missingHeaders.length > 0) {
      throw createError.badRequest(
        `Missing required headers: ${missingHeaders.join(', ')}`
      );
    }

    next();
  };
}

/**
 * Sanitize input data
 * @returns {Function} Express middleware
 */
export function sanitizeInput() {
  return (req, res, next) => {
    // Sanitize strings in body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    next();
  };
}

/**
 * Sanitize object recursively
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj) {
  const sanitized = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Remove HTML tags and potential XSS
      sanitized[key] = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ==================== VALIDATION ERROR FORMATTER ====================

/**
 * Format validation errors for consistent response
 * @param {Object} joiError - Joi validation error
 * @returns {Object} Formatted error object
 */
export function formatValidationError(joiError) {
  const errors = {};
  
  joiError.details.forEach(detail => {
    const field = detail.path.join('.');
    errors[field] = detail.message;
  });

  return {
    message: 'Validation failed',
    errors,
    total_errors: joiError.details.length
  };
}

export default {
  validateTelegramId,
  validateUserRegistration,
  validateDailyProgress,
  validateLeaderboardQuery,
  validatePhotoUpload,
  validateFileUpload,
  validateAdminAccess,
  validateUserApproval,
  validateRateLimit,
  validateBodySize,
  validateJsonContentType,
  validateRequiredHeaders,
  sanitizeInput,
  formatValidationError
};