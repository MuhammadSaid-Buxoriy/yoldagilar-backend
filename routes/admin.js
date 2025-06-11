// routes/admin.js - ADMIN ROUTES
import express from 'express';
import { adminController } from '../controllers/adminController.js';
import { responseService } from '../services/responseService.js';
import { 
  validateTelegramId,
  validateAdminAccess 
} from '../middleware/validation.js';
import config from '../config/config.js';

const router = express.Router();

// Admin authentication middleware
const requireAdmin = validateAdminAccess(config.ADMIN_ID);

// ==================== ADMIN ROUTES ====================

/**
 * Get pending users for approval
 * GET /api/admin/pending-users
 */
router.get('/pending-users',
  requireAdmin,
  responseService.asyncResponse(adminController.getPendingUsers)
);

/**
 * Approve user
 * POST /api/admin/approve/:tg_id
 */
router.post('/approve/:tg_id',
  validateTelegramId,
  requireAdmin,
  responseService.asyncResponse(adminController.approveUser)
);

/**
 * Reject user
 * POST /api/admin/reject/:tg_id
 */
router.post('/reject/:tg_id',
  validateTelegramId,
  requireAdmin,
  responseService.asyncResponse(adminController.rejectUser)
);

/**
 * Get admin dashboard statistics
 * GET /api/admin/dashboard
 */
router.get('/dashboard',
  requireAdmin,
  responseService.asyncResponse(adminController.getDashboard)
);

/**
 * Get all users with filters
 * GET /api/admin/users
 */
router.get('/users',
  requireAdmin,
  responseService.asyncResponse(adminController.getAllUsers)
);

/**
 * Update user details (admin only)
 * PATCH /api/admin/users/:tg_id
 */
router.patch('/users/:tg_id',
  validateTelegramId,
  requireAdmin,
  responseService.asyncResponse(adminController.updateUser)
);

/**
 * Get system analytics
 * GET /api/admin/analytics
 */
router.get('/analytics',
  requireAdmin,
  responseService.asyncResponse(adminController.getAnalytics)
);

/**
 * Export data (CSV/JSON format)
 * GET /api/admin/export/:type
 */
router.get('/export/:type',
  requireAdmin,
  responseService.asyncResponse(adminController.exportData)
);

/**
 * Get system logs
 * GET /api/admin/logs
 */
router.get('/logs',
  requireAdmin,
  responseService.asyncResponse(adminController.getSystemLogs)
);

/**
 * Bulk operations on users
 * POST /api/admin/bulk-operations
 */
router.post('/bulk-operations',
  requireAdmin,
  responseService.asyncResponse(adminController.bulkOperations)
);

/**
 * System maintenance operations
 * POST /api/admin/maintenance
 */
router.post('/maintenance',
  requireAdmin,
  responseService.asyncResponse(adminController.maintenance)
);

/**
 * Get admin activity log
 * GET /api/admin/activity
 */
router.get('/activity',
  requireAdmin,
  responseService.asyncResponse(adminController.getAdminActivity)
);

/**
 * Send notification to users
 * POST /api/admin/notifications
 */
router.post('/notifications',
  requireAdmin,
  responseService.asyncResponse(adminController.sendNotification)
);

export default router;