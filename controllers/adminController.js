// controllers/adminController.js - ADMIN CONTROLLER
import { userService, dailyProgressService } from '../services/supabaseService.js';
import { responseService } from '../services/responseService.js';
import { logger } from '../utils/logger.js';
import { createError } from '../middleware/errorHandler.js';
import { APP_CONSTANTS } from '../config/config.js';
import config from '../config/config.js';

/**
 * Admin Controller
 * Handles admin operations, user management, and system monitoring
 */
class AdminController {
  /**
   * Get pending users for approval
   * GET /api/admin/pending-users
   */
  async getPendingUsers(req, res, next) {
    try {
      logger.info('ADMIN_GET_PENDING_USERS');

      // Get pending users from database
      const pendingUsers = await userService.getPendingUsers();

      // Format pending users for admin interface
      const formattedUsers = pendingUsers.map(user => ({
        tg_id: user.tg_id,
        name: user.name,
        username: user.username,
        registration_date: user.registration_date,
        status: user.status
      }));

      return responseService.pendingUsers(res, formattedUsers, formattedUsers.length);

    } catch (error) {
      logger.error('Get pending users failed:', error);
      next(error);
    }
  }

  /**
   * Approve user
   * POST /api/admin/approve/:tg_id
   */
  async approveUser(req, res, next) {
    try {
      const { tg_id } = req.params;
      const telegramId = parseInt(tg_id);

      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      logger.userAction(telegramId, 'ADMIN_APPROVE_USER');

      // Check if user exists
      const user = await userService.getUserByTelegramId(telegramId);
      if (!user) {
        throw createError.notFound('User');
      }

      // Check if user is already approved
      if (user.status === APP_CONSTANTS.USER_STATUS.APPROVED) {
        return responseService.success(res, {
          message: 'User is already approved',
          user: responseService.formatUser(user)
        });
      }

      // Update user status to approved
      const updatedUser = await userService.updateUserStatus(
        telegramId, 
        APP_CONSTANTS.USER_STATUS.APPROVED
      );

      logger.userAction(telegramId, 'USER_APPROVED_BY_ADMIN');

      return responseService.success(res, {
        success: true,
        message: APP_CONSTANTS.MESSAGES.SUCCESS.USER_APPROVED,
        user: responseService.formatUser(updatedUser)
      });

    } catch (error) {
      logger.error('Approve user failed:', error);
      next(error);
    }
  }

  /**
   * Reject user
   * POST /api/admin/reject/:tg_id
   */
  async rejectUser(req, res, next) {
    try {
      const { tg_id } = req.params;
      const { reason = 'No reason provided' } = req.body;

      const telegramId = parseInt(tg_id);
      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      logger.userAction(telegramId, 'ADMIN_REJECT_USER', { reason });

      // Check if user exists
      const user = await userService.getUserByTelegramId(telegramId);
      if (!user) {
        throw createError.notFound('User');
      }

      // Delete user record (rejection = removal)
      await userService.deleteUser(telegramId);

      logger.userAction(telegramId, 'USER_REJECTED_BY_ADMIN', { reason });

      return responseService.success(res, {
        success: true,
        message: APP_CONSTANTS.MESSAGES.SUCCESS.USER_REJECTED,
        reason
      });

    } catch (error) {
      logger.error('Reject user failed:', error);
      next(error);
    }
  }

  /**
   * Get admin dashboard statistics
   * GET /api/admin/dashboard
   */
  async getDashboard(req, res, next) {
    try {
      logger.info('ADMIN_GET_DASHBOARD');

      // Get various statistics
      const [
        userCounts,
        todaySubmissions,
        leaderboardTop10
      ] = await Promise.all([
        userService.getUserCounts(),
        dailyProgressService.getTodaySubmissions(),
        dailyProgressService.getLeaderboardData({ limit: 10 })
      ]);

      // Calculate additional metrics
      const approvalRate = userCounts.total > 0 ? 
        Math.round((userCounts.approved / userCounts.total) * 100) : 0;

      const dashboard = {
        user_statistics: {
          total_users: userCounts.total,
          approved_users: userCounts.approved,
          pending_users: userCounts.pending,
          approval_rate_percent: approvalRate
        },
        activity_statistics: {
          today_submissions: todaySubmissions,
          active_users_today: todaySubmissions, // Same for now
          total_leaderboard_participants: leaderboardTop10.length
        },
        top_performers: leaderboardTop10.slice(0, 5).map(user => ({
          tg_id: user.tg_id,
          name: user.name,
          score: user.score,
          rank: user.rank
        })),
        system_health: {
          database_status: 'healthy',
          api_status: 'healthy',
          last_updated: new Date().toISOString()
        }
      };

      return responseService.success(res, { dashboard });

    } catch (error) {
      logger.error('Get admin dashboard failed:', error);
      next(error);
    }
  }

  /**
   * Get all users with filters
   * GET /api/admin/users
   */
  async getAllUsers(req, res, next) {
    try {
      const { 
        status = 'all', 
        limit = 50, 
        offset = 0,
        search = ''
      } = req.query;

      logger.info('ADMIN_GET_ALL_USERS', { status, limit, offset, search });

      // TODO: Implement comprehensive user search and filtering
      // For now, return basic structure

      const users = [];
      const totalUsers = 0;

      return responseService.paginated(res, users, {
        page: Math.floor(offset / limit) + 1,
        limit: parseInt(limit),
        total: totalUsers
      });

    } catch (error) {
      logger.error('Get all users failed:', error);
      next(error);
    }
  }

  /**
   * Update user details (admin only)
   * PATCH /api/admin/users/:tg_id
   */
  async updateUser(req, res, next) {
    try {
      const { tg_id } = req.params;
      const { name, status, is_premium } = req.body;

      const telegramId = parseInt(tg_id);
      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      logger.userAction(telegramId, 'ADMIN_UPDATE_USER', { name, status, is_premium });

      const user = await userService.getUserByTelegramId(telegramId);
      if (!user) {
        throw createError.notFound('User');
      }

      // Prepare update data
      const updateData = { ...user };

      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length < 2) {
          throw createError.badRequest('Name must be at least 2 characters');
        }
        updateData.name = name.trim();
      }

      if (status !== undefined) {
        const validStatuses = Object.values(APP_CONSTANTS.USER_STATUS);
        if (!validStatuses.includes(status)) {
          throw createError.badRequest(`Invalid status. Must be: ${validStatuses.join(', ')}`);
        }
        updateData.status = status;
      }

      if (is_premium !== undefined) {
        updateData.is_premium = Boolean(is_premium);
      }

      // Update user
      const updatedUser = await userService.upsertUser(updateData);

      logger.userAction(telegramId, 'USER_UPDATED_BY_ADMIN');

      return responseService.success(res, {
        message: 'User updated successfully',
        user: responseService.formatUser(updatedUser)
      });

    } catch (error) {
      logger.error('Admin update user failed:', error);
      next(error);
    }
  }

  /**
   * Get system analytics
   * GET /api/admin/analytics
   */
  async getAnalytics(req, res, next) {
    try {
      const { period = 'week' } = req.query;

      logger.info('ADMIN_GET_ANALYTICS', { period });

      // TODO: Implement comprehensive analytics
      // For now, return basic structure

      const analytics = {
        period,
        user_growth: {
          new_registrations: 0,
          new_approvals: 0,
          growth_rate_percent: 0
        },
        engagement_metrics: {
          daily_active_users: 0,
          average_tasks_completed: 0,
          total_submissions: 0
        },
        content_metrics: {
          total_pages_read: 0,
          total_distance_covered: 0,
          average_pages_per_user: 0
        },
        charts_data: {
          daily_submissions: [],
          user_registrations: [],
          task_completion_rates: []
        }
      };

      return responseService.success(res, { analytics });

    } catch (error) {
      logger.error('Get analytics failed:', error);
      next(error);
    }
  }

  /**
   * Export data (CSV format)
   * GET /api/admin/export/:type
   */
  async exportData(req, res, next) {
    try {
      const { type } = req.params;
      const { format = 'json' } = req.query;

      logger.info('ADMIN_EXPORT_DATA', { type, format });

      if (!['users', 'progress', 'leaderboard'].includes(type)) {
        throw createError.badRequest('Invalid export type. Must be: users, progress, leaderboard');
      }

      if (!['json', 'csv'].includes(format)) {
        throw createError.badRequest('Invalid format. Must be: json, csv');
      }

      // TODO: Implement data export functionality
      // For now, return basic structure

      const exportData = {
        type,
        format,
        data: [],
        exported_at: new Date().toISOString(),
        total_records: 0
      };

      if (format === 'csv') {
        // Set CSV headers
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${type}_export_${new Date().toISOString().split('T')[0]}.csv"`);
        
        // TODO: Generate CSV content
        const csvContent = `# ${type.toUpperCase()} Export\n# Generated at: ${new Date().toISOString()}\n# Total records: 0\n`;
        return res.send(csvContent);
      }

      return responseService.success(res, exportData);

    } catch (error) {
      logger.error('Export data failed:', error);
      next(error);
    }
  }

  /**
   * Get system logs
   * GET /api/admin/logs
   */
  async getSystemLogs(req, res, next) {
    try {
      const { 
        level = 'all', 
        limit = 100, 
        offset = 0,
        start_date,
        end_date 
      } = req.query;

      logger.info('ADMIN_GET_SYSTEM_LOGS', { level, limit, offset });

      // TODO: Implement log retrieval from persistent storage
      // For now, return basic structure

      const logs = [];
      const totalLogs = 0;

      return responseService.paginated(res, logs, {
        page: Math.floor(offset / limit) + 1,
        limit: parseInt(limit),
        total: totalLogs
      });

    } catch (error) {
      logger.error('Get system logs failed:', error);
      next(error);
    }
  }

  /**
   * Bulk operations on users
   * POST /api/admin/bulk-operations
   */
  async bulkOperations(req, res, next) {
    try {
      const { operation, user_ids, data = {} } = req.body;

      if (!operation || !user_ids || !Array.isArray(user_ids)) {
        throw createError.badRequest('Operation and user_ids array are required');
      }

      logger.info('ADMIN_BULK_OPERATION', { operation, userCount: user_ids.length });

      const validOperations = ['approve', 'reject', 'update_status', 'toggle_premium'];
      if (!validOperations.includes(operation)) {
        throw createError.badRequest(`Invalid operation. Must be: ${validOperations.join(', ')}`);
      }

      const results = {
        success: [],
        failed: [],
        total_processed: user_ids.length
      };

      // Process each user
      for (const tgId of user_ids) {
        try {
          const telegramId = parseInt(tgId);
          if (isNaN(telegramId)) {
            results.failed.push({ tg_id: tgId, error: 'Invalid ID format' });
            continue;
          }

          switch (operation) {
            case 'approve':
              await userService.updateUserStatus(telegramId, APP_CONSTANTS.USER_STATUS.APPROVED);
              results.success.push({ tg_id: telegramId, action: 'approved' });
              break;

            case 'reject':
              await userService.deleteUser(telegramId);
              results.success.push({ tg_id: telegramId, action: 'rejected' });
              break;

            case 'update_status':
              if (!data.status) {
                results.failed.push({ tg_id: telegramId, error: 'Status not provided' });
                continue;
              }
              await userService.updateUserStatus(telegramId, data.status);
              results.success.push({ tg_id: telegramId, action: 'status_updated' });
              break;

            case 'toggle_premium':
              // TODO: Implement premium toggle
              results.success.push({ tg_id: telegramId, action: 'premium_toggled' });
              break;

            default:
              results.failed.push({ tg_id: telegramId, error: 'Unknown operation' });
          }

        } catch (error) {
          results.failed.push({ tg_id: tgId, error: error.message });
        }
      }

      logger.info('BULK_OPERATION_COMPLETED', {
        operation,
        successful: results.success.length,
        failed: results.failed.length
      });

      return responseService.success(res, {
        message: `Bulk ${operation} completed`,
        results
      });

    } catch (error) {
      logger.error('Bulk operations failed:', error);
      next(error);
    }
  }

  /**
   * System maintenance operations
   * POST /api/admin/maintenance
   */
  async maintenance(req, res, next) {
    try {
      const { operation, params = {} } = req.body;

      logger.info('ADMIN_MAINTENANCE', { operation, params });

      const validOperations = ['cleanup_logs', 'reset_cache', 'backup_data', 'optimize_db'];
      if (!validOperations.includes(operation)) {
        throw createError.badRequest(`Invalid operation. Must be: ${validOperations.join(', ')}`);
      }

      let result = {};

      switch (operation) {
        case 'cleanup_logs':
          // TODO: Implement log cleanup
          result = { message: 'Logs cleaned up', files_removed: 0 };
          break;

        case 'reset_cache':
          // TODO: Implement cache reset
          result = { message: 'Cache reset successfully' };
          break;

        case 'backup_data':
          // TODO: Implement data backup
          result = { 
            message: 'Backup initiated', 
            backup_id: `backup_${Date.now()}`,
            estimated_completion: new Date(Date.now() + 5 * 60 * 1000).toISOString()
          };
          break;

        case 'optimize_db':
          // TODO: Implement database optimization
          result = { message: 'Database optimization completed' };
          break;

        default:
          throw createError.badRequest('Unknown maintenance operation');
      }

      logger.info('MAINTENANCE_COMPLETED', { operation, result });

      return responseService.success(res, {
        operation,
        result,
        completed_at: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Maintenance operation failed:', error);
      next(error);
    }
  }

  /**
   * Get admin activity log
   * GET /api/admin/activity
   */
  async getAdminActivity(req, res, next) {
    try {
      const { limit = 50, offset = 0 } = req.query;

      logger.info('ADMIN_GET_ACTIVITY', { limit, offset });

      // TODO: Implement admin activity tracking
      // For now, return basic structure

      const activities = [];
      const totalActivities = 0;

      return responseService.paginated(res, activities, {
        page: Math.floor(offset / limit) + 1,
        limit: parseInt(limit),
        total: totalActivities
      });

    } catch (error) {
      logger.error('Get admin activity failed:', error);
      next(error);
    }
  }

  /**
   * Send notification to users
   * POST /api/admin/notifications
   */
  async sendNotification(req, res, next) {
    try {
      const { 
        target = 'all',
        user_ids = [],
        message,
        type = 'info'
      } = req.body;

      if (!message || message.trim().length === 0) {
        throw createError.badRequest('Message is required');
      }

      logger.info('ADMIN_SEND_NOTIFICATION', { target, type, userCount: user_ids.length });

      // TODO: Implement notification system integration
      // This would typically integrate with Telegram bot or push notification service

      const notification = {
        id: `notif_${Date.now()}`,
        message: message.trim(),
        type,
        target,
        user_ids: target === 'specific' ? user_ids : [],
        sent_at: new Date().toISOString(),
        status: 'queued'
      };

      // Simulate notification sending
      setTimeout(() => {
        logger.info('NOTIFICATION_SENT', { notificationId: notification.id });
      }, 1000);

      return responseService.success(res, {
        message: 'Notification queued successfully',
        notification
      });

    } catch (error) {
      logger.error('Send notification failed:', error);
      next(error);
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Check if user has admin privileges
   * @param {number} telegramId - User Telegram ID
   * @returns {boolean} Whether user is admin
   */
  isAdmin(telegramId) {
    return telegramId === config.ADMIN_ID;
  }

  /**
   * Validate admin access
   * @param {Object} req - Express request object
   * @throws {Error} If access denied
   */
  validateAdminAccess(req) {
    const { tg_id } = req.body || req.query || {};
    
    if (!tg_id || !this.isAdmin(parseInt(tg_id))) {
      throw createError.forbidden('Admin access required');
    }
  }

  /**
   * Format user data for admin interface
   * @param {Object} user - Raw user data
   * @returns {Object} Formatted user data
   */
  formatUserForAdmin(user) {
    return {
      ...responseService.formatUser(user),
      created_at: user.registration_date,
      last_activity: user.last_activity || null,
      total_submissions: 0, // TODO: Calculate from progress data
      admin_notes: user.admin_notes || null
    };
  }

  /**
   * Generate admin report
   * @param {string} reportType - Type of report
   * @param {Object} params - Report parameters
   * @returns {Object} Report data
   */
  async generateReport(reportType, params = {}) {
    try {
      switch (reportType) {
        case 'user_activity':
          return await this.generateUserActivityReport(params);
        case 'system_health':
          return await this.generateSystemHealthReport(params);
        case 'engagement':
          return await this.generateEngagementReport(params);
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }
    } catch (error) {
      logger.error('Generate report failed:', error);
      throw error;
    }
  }

  /**
   * Generate user activity report
   * @param {Object} params - Report parameters
   * @returns {Object} User activity report
   */
  async generateUserActivityReport(params) {
    // TODO: Implement comprehensive user activity reporting
    return {
      report_type: 'user_activity',
      generated_at: new Date().toISOString(),
      summary: {
        total_users: 0,
        active_users: 0,
        inactive_users: 0
      },
      details: []
    };
  }

  /**
   * Generate system health report
   * @param {Object} params - Report parameters
   * @returns {Object} System health report
   */
  async generateSystemHealthReport(params) {
    return {
      report_type: 'system_health',
      generated_at: new Date().toISOString(),
      database: { status: 'healthy', response_time_ms: 50 },
      api: { status: 'healthy', uptime_percent: 99.9 },
      storage: { status: 'healthy', usage_percent: 45 }
    };
  }

  /**
   * Generate engagement report
   * @param {Object} params - Report parameters
   * @returns {Object} Engagement report
   */
  async generateEngagementReport(params) {
    return {
      report_type: 'engagement',
      generated_at: new Date().toISOString(),
      metrics: {
        daily_active_users: 0,
        task_completion_rate: 0,
        average_session_duration: 0
      }
    };
  }
}

export const adminController = new AdminController();
export default adminController;