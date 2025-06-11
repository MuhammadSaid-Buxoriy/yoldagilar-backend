// routes/health.js - HEALTH CHECK ROUTES
import express from 'express';
import { testDatabaseConnection, getDatabaseHealth } from '../config/database.js';
import { responseService } from '../services/responseService.js';
import { getRuntimeConfig } from '../config/config.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// ==================== HEALTH CHECK ROUTES ====================

/**
 * Basic health check
 * GET /api/health
 */
router.get('/', async (req, res, next) => {
  try {
    const startTime = Date.now();
    
    // Test database connection
    const dbHealth = await getDatabaseHealth();
    const responseTime = Date.now() - startTime;
    
    // Get runtime info
    const runtime = getRuntimeConfig();
    
    // Determine overall status
    const isHealthy = dbHealth.status === 'healthy';
    const status = isHealthy ? 'healthy' : 'unhealthy';
    
    const healthData = {
      status,
      timestamp: new Date().toISOString(),
      response_time_ms: responseTime,
      services: {
        database: dbHealth,
        api: {
          status: 'healthy',
          uptime_seconds: runtime.uptime,
          memory_usage: runtime.memory_usage,
          node_version: runtime.node_version
        }
      },
      config: {
        environment: runtime.env,
        version: '2.0.0',
        platform: runtime.platform
      }
    };

    return responseService.healthCheck(res, status, healthData.services, healthData.config);

  } catch (error) {
    logger.error('Health check failed:', error);
    
    return responseService.healthCheck(res, 'unhealthy', {
      database: { status: 'unhealthy', error: error.message },
      api: { status: 'healthy' }
    });
  }
});

/**
 * Database health check
 * GET /api/health/database
 */
router.get('/database', async (req, res, next) => {
  try {
    const startTime = Date.now();
    const dbTest = await testDatabaseConnection();
    const dbHealth = await getDatabaseHealth();
    const responseTime = Date.now() - startTime;

    const healthData = {
      connection_test: dbTest,
      detailed_health: dbHealth,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    };

    const status = dbTest.success && dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy';
    const statusCode = status === 'healthy' ? 200 : 503;

    return res.status(statusCode).json({
      status,
      database: healthData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Database health check failed:', error);
    
    return res.status(503).json({
      status: 'unhealthy',
      database: {
        connection_test: { success: false, error: error.message },
        response_time_ms: 0,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Get server time
 * GET /api/time
 */
router.get('/time', (req, res) => {
  const now = new Date();
  
  return responseService.success(res, {
    server_time: {
      iso: now.toISOString(),
      unix: Math.floor(now.getTime() / 1000),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      utc_offset: now.getTimezoneOffset()
    },
    uptime_seconds: process.uptime(),
    timestamp: now.toISOString()
  });
});

/**
 * System information
 * GET /api/health/system
 */
router.get('/system', (req, res) => {
  const runtime = getRuntimeConfig();
  
  const systemInfo = {
    server: {
      node_version: runtime.node_version,
      platform: runtime.platform,
      architecture: process.arch,
      uptime_seconds: runtime.uptime,
      started_at: runtime.started_at
    },
    memory: {
      usage: runtime.memory_usage,
      heap_used_mb: Math.round(runtime.memory_usage.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(runtime.memory_usage.heapTotal / 1024 / 1024),
      external_mb: Math.round(runtime.memory_usage.external / 1024 / 1024)
    },
    process: {
      pid: runtime.pid,
      version: process.version,
      versions: process.versions
    },
    environment: {
      node_env: runtime.env,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  };

  return responseService.success(res, { system: systemInfo });
});

/**
 * API endpoints status
 * GET /api/health/endpoints
 */
router.get('/endpoints', (req, res) => {
  const endpoints = {
    auth: {
      base_path: '/api/auth',
      endpoints_count: 6,
      status: 'active'
    },
    user: {
      base_path: '/api/user',
      endpoints_count: 7,
      status: 'active'
    },
    tasks: {
      base_path: '/api/tasks',
      endpoints_count: 5,
      status: 'active'
    },
    leaderboard: {
      base_path: '/api/leaderboard',
      endpoints_count: 6,
      status: 'active'
    },
    admin: {
      base_path: '/api/admin',
      endpoints_count: 13,
      status: 'active'
    },
    health: {
      base_path: '/api/health',
      endpoints_count: 4,
      status: 'active'
    }
  };

  const summary = {
    total_endpoints: Object.values(endpoints).reduce((sum, ep) => sum + ep.endpoints_count, 0),
    active_services: Object.keys(endpoints).length,
    all_services_healthy: Object.values(endpoints).every(ep => ep.status === 'active')
  };

  return responseService.success(res, {
    endpoints,
    summary,
    timestamp: new Date().toISOString()
  });
});

export default router;