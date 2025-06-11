// routes/index.js - API ROUTES AGGREGATOR
import express from 'express';
import { logger } from '../utils/logger.js';

// Import route modules
import authRoutes from './auth.js';
import userRoutes from './user.js';
import tasksRoutes from './tasks.js';
import leaderboardRoutes from './leaderboard.js';
import adminRoutes from './admin.js';
import healthRoutes from './health.js';

const router = express.Router();

// Request timing middleware
router.use((req, res, next) => {
  res.locals.startTime = Date.now();
  next();
});

// API versioning header
router.use((req, res, next) => {
  res.setHeader('X-API-Version', '2.0.0');
  res.setHeader('X-Powered-By', 'Yoldagilar Backend');
  next();
});

// ==================== ROUTE MOUNTING ====================

// Health routes (no auth required)
router.use('/health', healthRoutes);

// Authentication routes
router.use('/auth', authRoutes);

// User management routes
router.use('/user', userRoutes);

// Daily tasks routes
router.use('/tasks', tasksRoutes);

// Leaderboard routes
router.use('/leaderboard', leaderboardRoutes);

// Admin routes (auth protected)
router.use('/admin', adminRoutes);

// ==================== API DOCUMENTATION ENDPOINT ====================

router.get('/', (req, res) => {
  const apiDocs = {
    name: 'Yoldagilar Challenge API',
    version: '2.0.0',
    description: 'Professional backend API for Yoldagilar challenge platform',
    endpoints: {
      health: {
        base: '/api/health',
        endpoints: [
          'GET /api/health - System health check',
          'GET /api/health/database - Database health',
          'GET /api/time - Server time'
        ]
      },
      auth: {
        base: '/api/auth',
        endpoints: [
          'GET /api/auth/check/:tg_id - Check user authentication',
          'POST /api/auth/register - Register new user',
          'POST /api/auth/refresh/:tg_id - Refresh user data',
          'GET /api/auth/access/:tg_id - Check feature access',
          'PATCH /api/auth/profile/:tg_id - Update profile',
          'POST /api/auth/logout/:tg_id - Logout user'
        ]
      },
      user: {
        base: '/api/user',
        endpoints: [
          'GET /api/user/statistics/:tg_id - Get user statistics',
          'GET /api/user/profile/:user_id - Get user profile',
          'POST /api/user/upload-photo - Upload profile photo',
          'PATCH /api/user/preferences/:tg_id - Update preferences',
          'GET /api/user/achievements/:tg_id - Get achievements',
          'GET /api/user/activity/:tg_id - Get activity history',
          'DELETE /api/user/account/:tg_id - Delete account'
        ]
      },
      tasks: {
        base: '/api/tasks',
        endpoints: [
          'GET /api/tasks/daily/:tg_id - Get daily tasks',
          'POST /api/tasks/submit - Submit daily progress',
          'GET /api/tasks/summary/:tg_id - Get task summary',
          'GET /api/tasks/templates - Get task templates',
          'GET /api/tasks/streak/:tg_id - Get task streak'
        ]
      },
      leaderboard: {
        base: '/api/leaderboard',
        endpoints: [
          'GET /api/leaderboard - Get leaderboard',
          'GET /api/leaderboard/position/:tg_id - Get user position',
          'GET /api/leaderboard/stats - Get leaderboard statistics',
          'GET /api/leaderboard/top-performers - Get top performers',
          'GET /api/leaderboard/movements - Get rank movements',
          'GET /api/leaderboard/achievements - Get achievement leaderboard'
        ]
      },
      admin: {
        base: '/api/admin',
        endpoints: [
          'GET /api/admin/pending-users - Get pending users',
          'POST /api/admin/approve/:tg_id - Approve user',
          'POST /api/admin/reject/:tg_id - Reject user',
          'GET /api/admin/dashboard - Get admin dashboard',
          'GET /api/admin/users - Get all users',
          'PATCH /api/admin/users/:tg_id - Update user',
          'GET /api/admin/analytics - Get analytics',
          'GET /api/admin/export/:type - Export data',
          'GET /api/admin/logs - Get system logs',
          'POST /api/admin/bulk-operations - Bulk operations',
          'POST /api/admin/maintenance - System maintenance',
          'GET /api/admin/activity - Get admin activity',
          'POST /api/admin/notifications - Send notifications'
        ]
      }
    },
    authentication: {
      type: 'Telegram ID based',
      description: 'Most endpoints require valid Telegram user ID'
    },
    rate_limiting: {
      window: '15 minutes',
      max_requests: 100,
      headers: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset'
      ]
    },
    response_format: {
      success: {
        success: true,
        timestamp: 'ISO 8601',
        data: 'Endpoint specific data'
      },
      error: {
        success: false,
        error: 'Human readable error message',
        error_code: 'MACHINE_READABLE_CODE',
        timestamp: 'ISO 8601'
      }
    },
    cors: {
      allowed_origins: ['http://localhost:5173', 'https://yuldagilar.vercel.app'],
      allowed_methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      credentials: true
    },
    status_codes: {
      200: 'Success',
      201: 'Created',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      503: 'Service Unavailable'
    }
  };

  res.json(apiDocs);
});

// ==================== API METRICS ENDPOINT ====================

router.get('/metrics', (req, res) => {
  const metrics = {
    server: {
      uptime_seconds: process.uptime(),
      memory_usage: process.memoryUsage(),
      node_version: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV || 'development'
    },
    api: {
      version: '2.0.0',
      total_endpoints: 35,
      categories: ['auth', 'user', 'tasks', 'leaderboard', 'admin', 'health']
    },
    timestamp: new Date().toISOString()
  };

  res.json(metrics);
});

// ==================== CATCH-ALL HANDLER ====================

router.use('*', (req, res) => {
  logger.warn(`Unknown API endpoint: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    success: false,
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    error_code: 'ENDPOINT_NOT_FOUND',
    available_endpoints: [
      '/api/health',
      '/api/auth',
      '/api/user',
      '/api/tasks',
      '/api/leaderboard',
      '/api/admin'
    ],
    documentation: '/api',
    timestamp: new Date().toISOString()
  });
});

export default router;