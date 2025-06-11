// utils/logger.js - PROFESSIONAL LOGGING SYSTEM
import util from 'util';

/**
 * Console colors for different log levels
 */
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

/**
 * Log levels with priority
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

/**
 * Current log level from environment
 */
const CURRENT_LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.info;

/**
 * Format timestamp
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Format log message with color and timestamp
 * @param {string} level - Log level
 * @param {string} color - Console color
 * @param {string} icon - Log icon
 * @param {Array} args - Log arguments
 */
function formatLog(level, color, icon, args) {
  if (LOG_LEVELS[level] > CURRENT_LOG_LEVEL) {
    return; // Skip if log level is too low
  }

  const timestamp = getTimestamp();
  const prefix = `${COLORS.gray}[${timestamp}]${COLORS.reset} ${color}${icon} ${level.toUpperCase()}${COLORS.reset}`;
  
  // Format arguments
  const formattedArgs = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      return util.inspect(arg, { 
        colors: true, 
        depth: 3, 
        compact: false,
        breakLength: 80
      });
    }
    return String(arg);
  });

  console.log(prefix, ...formattedArgs);
}

/**
 * Professional logger with multiple levels
 */
export const logger = {
  /**
   * Error level logging
   * @param {...any} args - Arguments to log
   */
  error(...args) {
    formatLog('error', COLORS.red, '❌', args);
  },

  /**
   * Warning level logging
   * @param {...any} args - Arguments to log
   */
  warn(...args) {
    formatLog('warn', COLORS.yellow, '⚠️', args);
  },

  /**
   * Info level logging
   * @param {...any} args - Arguments to log
   */
  info(...args) {
    formatLog('info', COLORS.blue, 'ℹ️', args);
  },

  /**
   * Success logging (special info)
   * @param {...any} args - Arguments to log
   */
  success(...args) {
    formatLog('info', COLORS.green, '✅', args);
  },

  /**
   * Debug level logging
   * @param {...any} args - Arguments to log
   */
  debug(...args) {
    formatLog('debug', COLORS.magenta, '🐛', args);
  },

  /**
   * Trace level logging
   * @param {...any} args - Arguments to log
   */
  trace(...args) {
    formatLog('trace', COLORS.cyan, '🔍', args);
  },

  /**
   * HTTP request logging
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {number} duration - Request duration in ms
   */
  http(req, res, duration) {
    const method = req.method;
    const url = req.url;
    const status = res.statusCode;
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ip = req.ip || req.connection.remoteAddress || 'Unknown';

    // Color code based on status
    let statusColor = COLORS.green;
    let icon = '✅';
    
    if (status >= 400) {
      statusColor = COLORS.red;
      icon = '❌';
    } else if (status >= 300) {
      statusColor = COLORS.yellow;
      icon = '⚠️';
    }

    const message = `${COLORS.blue}${method}${COLORS.reset} ${url} ${statusColor}${status}${COLORS.reset} - ${duration}ms`;
    const details = `${COLORS.gray}IP: ${ip} | UA: ${userAgent.substring(0, 50)}${COLORS.reset}`;
    
    formatLog('info', statusColor, icon, [message]);
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.debug) {
      formatLog('debug', COLORS.gray, '📝', [details]);
    }
  },

  /**
   * Database operation logging
   * @param {string} operation - Database operation (SELECT, INSERT, etc.)
   * @param {string} table - Table name
   * @param {number} duration - Operation duration in ms
   * @param {boolean} success - Whether operation was successful
   */
  database(operation, table, duration, success = true) {
    const icon = success ? '💾' : '❌';
    const color = success ? COLORS.green : COLORS.red;
    const message = `${operation} ${table} - ${duration}ms`;
    
    formatLog('debug', color, icon, [message]);
  },

  /**
   * API response logging
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Response data (will be truncated)
   * @param {number} duration - Response time in ms
   */
  api(endpoint, data, duration) {
    const message = `API Response: ${endpoint} - ${duration}ms`;
    const dataPreview = typeof data === 'object' ? 
      `${Object.keys(data).length} fields` : 
      String(data).substring(0, 100);
    
    formatLog('debug', COLORS.cyan, '📡', [message, `Data: ${dataPreview}`]);
  },

  /**
   * User action logging
   * @param {number} userId - User ID
   * @param {string} action - Action performed
   * @param {Object} details - Additional details
   */
  userAction(userId, action, details = {}) {
    const message = `User ${userId}: ${action}`;
    formatLog('info', COLORS.blue, '👤', [message, details]);
  },

  /**
   * Security event logging
   * @param {string} event - Security event type
   * @param {Object} details - Event details
   */
  security(event, details = {}) {
    formatLog('warn', COLORS.yellow, '🔒', [`Security: ${event}`, details]);
  },

  /**
   * Performance monitoring
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in ms
   * @param {Object} metadata - Additional metadata
   */
  performance(operation, duration, metadata = {}) {
    const color = duration > 1000 ? COLORS.red : duration > 500 ? COLORS.yellow : COLORS.green;
    const message = `Performance: ${operation} - ${duration}ms`;
    
    formatLog('debug', color, '⚡', [message, metadata]);
  },

  /**
   * System resource logging
   * @param {Object} resources - System resource usage
   */
  system(resources = {}) {
    const memory = process.memoryUsage();
    const uptime = process.uptime();
    
    const systemInfo = {
      uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
      memory: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
      ...resources
    };
    
    formatLog('debug', COLORS.magenta, '🖥️', ['System:', systemInfo]);
  },

  /**
   * Startup banner
   * @param {Object} config - Application configuration
   */
  banner(config = {}) {
    const banner = `
${COLORS.cyan}
╔══════════════════════════════════════════════════════════════╗
║                    🚀 YOLDAGILAR BACKEND                     ║
║                     Challenge Platform API                   ║
╠══════════════════════════════════════════════════════════════╣
║ Version: 2.0.0                                               ║
║ Environment: ${(config.NODE_ENV || 'development').padEnd(47)}║
║ Port: ${String(config.PORT || 3000).padEnd(54)}║
║ Database: ${(config.SUPABASE_URL ? 'Connected' : 'Disconnected').padEnd(50)}║
╚══════════════════════════════════════════════════════════════╝
${COLORS.reset}`;
    
    console.log(banner);
  },

  /**
   * Table formatter for structured data
   * @param {Array} data - Array of objects to display as table
   * @param {Array} columns - Column names to display
   */
  table(data, columns = []) {
    if (!Array.isArray(data) || data.length === 0) {
      this.warn('No data to display in table');
      return;
    }

    // Use provided columns or extract from first object
    const cols = columns.length > 0 ? columns : Object.keys(data[0]);
    
    // Calculate column widths
    const widths = cols.map(col => {
      const values = data.map(row => String(row[col] || ''));
      return Math.max(col.length, ...values.map(v => v.length));
    });

    // Header
    const header = cols.map((col, i) => col.padEnd(widths[i])).join(' | ');
    const separator = widths.map(w => '-'.repeat(w)).join('-+-');
    
    console.log(`${COLORS.bright}${header}${COLORS.reset}`);
    console.log(`${COLORS.gray}${separator}${COLORS.reset}`);
    
    // Rows
    data.forEach(row => {
      const rowStr = cols.map((col, i) => 
        String(row[col] || '').padEnd(widths[i])
      ).join(' | ');
      console.log(rowStr);
    });
  },

  /**
   * Progress bar for long operations
   * @param {number} current - Current progress
   * @param {number} total - Total items
   * @param {string} label - Progress label
   */
  progress(current, total, label = 'Progress') {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round(percentage / 2); // 50 chars max
    const empty = 50 - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const progress = `${COLORS.blue}${label}: [${bar}] ${percentage}% (${current}/${total})${COLORS.reset}`;
    
    // Clear line and write progress
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(progress);
    
    if (current === total) {
      console.log(); // New line when complete
    }
  }
};

/**
 * Request logging middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response  
 * @param {Function} next - Next middleware
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  
  // Override res.end to capture response
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;
    logger.http(req, res, duration);
    originalEnd.apply(this, args);
  };
  
  next();
}

export default logger;