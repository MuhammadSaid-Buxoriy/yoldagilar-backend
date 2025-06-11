// config/config.js - ENVIRONMENT & APPLICATION CONFIGURATION
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

// Load environment variables
dotenv.config();

/**
 * Validate and return environment configuration
 * @returns {Object} Validated configuration object
 */
export function validateEnvironment() {
  const requiredEnvs = [
    'SUPABASE_URL',
    'SUPABASE_KEY', 
    'BOT_TOKEN',
    'ADMIN_ID'
  ];

  const missingEnvs = requiredEnvs.filter(env => !process.env[env]);

  if (missingEnvs.length > 0) {
    logger.error('❌ Missing required environment variables:');
    missingEnvs.forEach(env => logger.error(`   - ${env}`));
    logger.info('\n💡 Create .env file with required variables!');
    process.exit(1);
  }

  // Validate specific formats
  validateBotToken(process.env.BOT_TOKEN);
  validateAdminId(process.env.ADMIN_ID);
  validateSupabaseUrl(process.env.SUPABASE_URL);

  const config = {
    // Server Configuration
    PORT: parseInt(process.env.PORT) || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // Database Configuration
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    
    // Telegram Configuration
    BOT_TOKEN: process.env.BOT_TOKEN,
    ADMIN_ID: parseInt(process.env.ADMIN_ID),
    MINI_APP_URL: process.env.MINI_APP_URL || 'https://yuldagilar.vercel.app',
    
    // Security Configuration
    ADMIN_SECRET: process.env.ADMIN_SECRET || 'change_this_secret_key',
    JWT_SECRET: process.env.JWT_SECRET || 'jwt_secret_change_this',
    
    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    
    // File Upload
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
    ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
    
    // CORS Configuration
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,https://yuldagilar.vercel.app').split(','),
    
    // Application Settings
    SESSION_TTL: parseInt(process.env.SESSION_TTL) || 30 * 60 * 1000, // 30 minutes
    PAGINATION_LIMIT: parseInt(process.env.PAGINATION_LIMIT) || 50,
    DEFAULT_LEADERBOARD_LIMIT: parseInt(process.env.DEFAULT_LEADERBOARD_LIMIT) || 100,
    
    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_FORMAT: process.env.LOG_FORMAT || 'combined',
    
    // Feature Flags
    ENABLE_PHOTO_UPLOAD: process.env.ENABLE_PHOTO_UPLOAD !== 'false',
    ENABLE_ACHIEVEMENTS: process.env.ENABLE_ACHIEVEMENTS !== 'false',
    ENABLE_ADMIN_PANEL: process.env.ENABLE_ADMIN_PANEL !== 'false',
    
    // Cache Settings
    CACHE_TTL: parseInt(process.env.CACHE_TTL) || 5 * 60 * 1000, // 5 minutes
    ENABLE_CACHING: process.env.ENABLE_CACHING !== 'false'
  };

  // Log configuration summary
  if (config.NODE_ENV === 'development') {
    logger.info('🔧 Configuration loaded:');
    logger.info(`   Environment: ${config.NODE_ENV}`);
    logger.info(`   Port: ${config.PORT}`);
    logger.info(`   Database: ${config.SUPABASE_URL ? 'Configured' : 'Not configured'}`);
    logger.info(`   Bot: ${config.BOT_TOKEN ? 'Configured' : 'Not configured'}`);
    logger.info(`   Admin ID: ${config.ADMIN_ID}`);
    logger.info(`   Frontend URL: ${config.FRONTEND_URL}`);
    logger.info(`   Mini App URL: ${config.MINI_APP_URL}`);
  }

  return config;
}

/**
 * Validate Telegram Bot Token format
 * @param {string} token - Bot token
 */
function validateBotToken(token) {
  const tokenRegex = /^\d+:[A-Za-z0-9_-]{35}$/;
  if (!tokenRegex.test(token)) {
    logger.error('❌ BOT_TOKEN has invalid format!');
    logger.info('   Expected format: 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ1234567890');
    process.exit(1);
  }
}

/**
 * Validate Admin ID format
 * @param {string} adminId - Admin Telegram ID
 */
function validateAdminId(adminId) {
  const id = parseInt(adminId);
  if (isNaN(id) || id <= 0) {
    logger.error('❌ ADMIN_ID must be a positive integer!');
    process.exit(1);
  }
}

/**
 * Validate Supabase URL format
 * @param {string} url - Supabase URL
 */
function validateSupabaseUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.includes('supabase.co')) {
      logger.warn('⚠️ SUPABASE_URL does not appear to be a valid Supabase URL');
    }
  } catch (error) {
    logger.error('❌ SUPABASE_URL has invalid URL format!');
    process.exit(1);
  }
}

/**
 * Get runtime configuration info
 * @returns {Object} Runtime config
 */
export function getRuntimeConfig() {
  return {
    node_version: process.version,
    platform: process.platform,
    uptime: process.uptime(),
    memory_usage: process.memoryUsage(),
    env: process.env.NODE_ENV || 'development',
    pid: process.pid,
    started_at: new Date().toISOString()
  };
}

/**
 * Application constants
 */
export const APP_CONSTANTS = {
  // User status types
  USER_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    SUSPENDED: 'suspended'
  },

  // Task related constants
  TASKS: {
    TOTAL_DAILY_TASKS: 10,
    MIN_PAGES_READ: 0,
    MAX_PAGES_READ: 1000,
    MIN_DISTANCE: 0,
    MAX_DISTANCE: 100
  },

  // Leaderboard types
  LEADERBOARD_TYPES: {
    OVERALL: 'overall',
    READING: 'reading',
    DISTANCE: 'distance',
    CONSISTENCY: 'consistency'
  },

  // Time periods
  TIME_PERIODS: {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    ALL: 'all'
  },

  // Achievement types
  ACHIEVEMENTS: {
    CONSISTENT: 'consistent',
    READER: 'reader',
    ATHLETE: 'athlete',
    PERFECTIONIST: 'perfectionist',
    NEWCOMER: 'newcomer'
  },

  // Error codes
  ERROR_CODES: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    USER_NOT_APPROVED: 'USER_NOT_APPROVED',
    DUPLICATE_SUBMISSION: 'DUPLICATE_SUBMISSION',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR'
  },

  // Response messages (Uzbek)
  MESSAGES: {
    SUCCESS: {
      USER_REGISTERED: 'Foydalanuvchi muvaffaqiyatli ro\'yxatdan o\'tdi',
      DATA_SAVED: 'Ma\'lumotlar muvaffaqiyatli saqlandi',
      PHOTO_UPLOADED: 'Rasm muvaffaqiyatli yuklandi',
      USER_APPROVED: 'Foydalanuvchi tasdiqlandi',
      USER_REJECTED: 'Foydalanuvchi rad etildi'
    },
    ERROR: {
      USER_NOT_FOUND: 'Foydalanuvchi topilmadi',
      USER_NOT_APPROVED: 'Foydalanuvchi hali tasdiqlanmagan',
      INVALID_DATA: 'Noto\'g\'ri ma\'lumotlar kiritildi',
      DATABASE_ERROR: 'Ma\'lumotlar bazasi xatosi',
      PERMISSION_DENIED: 'Ruxsat berilmagan',
      FILE_TOO_LARGE: 'Fayl hajmi juda katta',
      INVALID_FILE_TYPE: 'Noto\'g\'ri fayl turi'
    }
  }
};

// Export default configuration
export default validateEnvironment();