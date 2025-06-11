// controllers/userController.js - USER MANAGEMENT CONTROLLER
import { userService, dailyProgressService, fileService } from '../services/supabaseService.js';
import { responseService } from '../services/responseService.js';
import { logger } from '../utils/logger.js';
import { createError } from '../middleware/errorHandler.js';
import { APP_CONSTANTS } from '../config/config.js';
import config from '../config/config.js';

/**
 * User Controller
 * Handles user profile, statistics, and file uploads
 */
class UserController {
  /**
   * Get user statistics
   * GET /api/user/statistics/:tg_id
   */
  async getUserStatistics(req, res, next) {
    try {
      const { tg_id } = req.params;
      const telegramId = parseInt(tg_id);

      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      logger.userAction(telegramId, 'GET_STATISTICS');

      // Check if user exists and is approved
      const user = await userService.getUserByTelegramId(telegramId);
      if (!user) {
        throw createError.notFound('User');
      }

      if (user.status !== APP_CONSTANTS.USER_STATUS.APPROVED) {
        throw createError.forbidden('User not approved yet');
      }

      // Get today's progress
      const today = new Date().toISOString().split('T')[0];
      const todayProgress = await dailyProgressService.getDailyProgress(telegramId, today);

      // Format today's stats
      const todayStats = {
        completed: todayProgress?.completed_count || 0,
        pages_read: todayProgress?.pages_read || 0,
        distance_km: todayProgress?.distance_km || 0,
        date: today
      };

      // Get all-time statistics
      const allTimeStats = await dailyProgressService.getUserAllTimeStats(telegramId);

      return responseService.userStatistics(res, todayStats, allTimeStats);

    } catch (error) {
      logger.error('Get user statistics failed:', error);
      next(error);
    }
  }

  /**
   * Get user profile by ID
   * GET /api/user/profile/:user_id
   */
  async getUserProfile(req, res, next) {
    try {
      const { user_id } = req.params;
      const userId = parseInt(user_id);

      if (isNaN(userId) || userId <= 0) {
        throw createError.badRequest('Invalid User ID format');
      }

      logger.userAction(userId, 'GET_PROFILE');

      const user = await userService.getUserByTelegramId(userId);
      if (!user) {
        throw createError.notFound('User profile');
      }

      // Only return public profile data
      const publicProfile = {
        tg_id: user.tg_id,
        name: user.name,
        photo_url: user.photo_url,
        is_premium: user.is_premium,
        member_since: user.registration_date,
        status: user.status === APP_CONSTANTS.USER_STATUS.APPROVED ? 'active' : 'inactive'
      };

      // Get basic statistics (if approved)
      if (user.status === APP_CONSTANTS.USER_STATUS.APPROVED) {
        const allTimeStats = await dailyProgressService.getUserAllTimeStats(userId);
        publicProfile.statistics = {
          total_points: allTimeStats.total_points,
          total_pages: allTimeStats.total_pages,
          total_distance: allTimeStats.total_distance,
          total_days: allTimeStats.total_days
        };
      }

      return responseService.success(res, {
        profile: publicProfile
      });

    } catch (error) {
      logger.error('Get user profile failed:', error);
      next(error);
    }
  }

  /**
   * Upload user profile photo
   * POST /api/user/upload-photo
   */
  async uploadPhoto(req, res, next) {
    try {
      const { tg_id } = req.body;
      const file = req.file;

      if (!tg_id) {
        throw createError.badRequest('tg_id is required');
      }

      if (!file) {
        throw createError.badRequest('No file uploaded');
      }

      const telegramId = parseInt(tg_id);
      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      logger.userAction(telegramId, 'UPLOAD_PHOTO', { 
        fileSize: file.size,
        mimeType: file.mimetype 
      });

      // Validate user exists and is approved
      const user = await userService.getUserByTelegramId(telegramId);
      if (!user) {
        throw createError.notFound('User');
      }

      if (user.status !== APP_CONSTANTS.USER_STATUS.APPROVED) {
        throw createError.forbidden('User not approved yet');
      }

      // Validate file type
      if (!config.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
        throw createError.badRequest(
          `Invalid file type. Allowed types: ${config.ALLOWED_FILE_TYPES.join(', ')}`
        );
      }

      // Validate file size
      if (file.size > config.MAX_FILE_SIZE) {
        throw createError.badRequest(
          `File too large. Maximum size: ${Math.round(config.MAX_FILE_SIZE / 1024 / 1024)}MB`
        );
      }

      // Generate unique filename
      const timestamp = Date.now();
      const extension = file.originalname.split('.').pop();
      const fileName = `user_${telegramId}_${timestamp}.${extension}`;

      // Upload to storage
      const photoUrl = await fileService.uploadFile(
        file.buffer,
        fileName,
        file.mimetype
      );

      // Update user record
      const updatedUser = await userService.updateUserPhoto(telegramId, photoUrl);

      // Delete old photo if exists (optional cleanup)
      if (user.photo_url && user.photo_url !== photoUrl) {
        try {
          const oldFileName = user.photo_url.split('/').pop();
          await fileService.deleteFile(oldFileName);
        } catch (deleteError) {
          logger.warn('Failed to delete old photo:', deleteError.message);
        }
      }

      return responseService.photoUpload(
        res,
        photoUrl,
        file.size,
        new Date().toISOString(),
        APP_CONSTANTS.MESSAGES.SUCCESS.PHOTO_UPLOADED
      );

    } catch (error) {
      logger.error('Photo upload failed:', error);
      next(error);
    }
  }

  /**
   * Update user preferences
   * PATCH /api/user/preferences/:tg_id
   */
  async updatePreferences(req, res, next) {
    try {
      const { tg_id } = req.params;
      const { notifications, language, timezone } = req.body;

      const telegramId = parseInt(tg_id);
      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      logger.userAction(telegramId, 'UPDATE_PREFERENCES', { 
        notifications, 
        language, 
        timezone 
      });

      const user = await userService.getUserByTelegramId(telegramId);
      if (!user) {
        throw createError.notFound('User');
      }

      // TODO: Implement user preferences table and update logic
      // For now, return success without actual update

      return responseService.success(res, {
        message: 'Preferences updated successfully',
        preferences: {
          notifications: notifications || true,
          language: language || 'uz',
          timezone: timezone || 'Asia/Tashkent'
        }
      });

    } catch (error) {
      logger.error('Update preferences failed:', error);
      next(error);
    }
  }

  /**
   * Get user achievements
   * GET /api/user/achievements/:tg_id
   */
  async getUserAchievements(req, res, next) {
    try {
      const { tg_id } = req.params;
      const telegramId = parseInt(tg_id);

      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      logger.userAction(telegramId, 'GET_ACHIEVEMENTS');

      const user = await userService.getUserByTelegramId(telegramId);
      if (!user) {
        throw createError.notFound('User');
      }

      if (user.status !== APP_CONSTANTS.USER_STATUS.APPROVED) {
        throw createError.forbidden('User not approved yet');
      }

      // Get user statistics for achievement calculation
      const allTimeStats = await dailyProgressService.getUserAllTimeStats(telegramId);

      // Calculate achievements based on stats
      const achievements = this.calculateAchievements(allTimeStats);

      return responseService.success(res, {
        achievements,
        total_achievements: achievements.length,
        user_stats: allTimeStats
      });

    } catch (error) {
      logger.error('Get user achievements failed:', error);
      next(error);
    }
  }

  /**
   * Get user activity history
   * GET /api/user/activity/:tg_id
   */
  async getUserActivity(req, res, next) {
    try {
      const { tg_id } = req.params;
      const { limit = 30, offset = 0 } = req.query;

      const telegramId = parseInt(tg_id);
      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      logger.userAction(telegramId, 'GET_ACTIVITY');

      const user = await userService.getUserByTelegramId(telegramId);
      if (!user) {
        throw createError.notFound('User');
      }

      if (user.status !== APP_CONSTANTS.USER_STATUS.APPROVED) {
        throw createError.forbidden('User not approved yet');
      }

      // TODO: Implement activity history query
      // For now, return mock data structure

      const activity = [];
      
      return responseService.paginated(res, activity, {
        page: Math.floor(offset / limit) + 1,
        limit: parseInt(limit),
        total: 0
      });

    } catch (error) {
      logger.error('Get user activity failed:', error);
      next(error);
    }
  }

  /**
   * Delete user account
   * DELETE /api/user/account/:tg_id
   */
  async deleteAccount(req, res, next) {
    try {
      const { tg_id } = req.params;
      const { confirm } = req.body;

      if (!confirm || confirm !== 'DELETE_MY_ACCOUNT') {
        throw createError.badRequest('Account deletion not confirmed');
      }

      const telegramId = parseInt(tg_id);
      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      logger.userAction(telegramId, 'DELETE_ACCOUNT_REQUEST');

      const user = await userService.getUserByTelegramId(telegramId);
      if (!user) {
        throw createError.notFound('User');
      }

      // Delete user photo if exists
      if (user.photo_url) {
        try {
          const fileName = user.photo_url.split('/').pop();
          await fileService.deleteFile(fileName);
        } catch (deleteError) {
          logger.warn('Failed to delete user photo:', deleteError.message);
        }
      }

      // Delete user record (this will cascade to daily_progress due to foreign key)
      await userService.deleteUser(telegramId);

      logger.userAction(telegramId, 'ACCOUNT_DELETED');

      return responseService.success(res, {
        message: 'Account deleted successfully'
      });

    } catch (error) {
      logger.error('Delete account failed:', error);
      next(error);
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Calculate user achievements based on statistics
   * @param {Object} stats - User statistics
   * @returns {Array} List of achievements
   */
  calculateAchievements(stats) {
    const achievements = [];

    // Consistency achievements
    if (stats.total_days >= 7) {
      achievements.push({
        id: 'week_warrior',
        name: 'Week Warrior',
        description: 'Complete 7 days',
        type: APP_CONSTANTS.ACHIEVEMENTS.CONSISTENT,
        unlocked_at: new Date().toISOString()
      });
    }

    if (stats.total_days >= 30) {
      achievements.push({
        id: 'month_master',
        name: 'Month Master',
        description: 'Complete 30 days',
        type: APP_CONSTANTS.ACHIEVEMENTS.CONSISTENT,
        unlocked_at: new Date().toISOString()
      });
    }

    // Reading achievements
    if (stats.total_pages >= 100) {
      achievements.push({
        id: 'bookworm',
        name: 'Bookworm',
        description: 'Read 100+ pages',
        type: APP_CONSTANTS.ACHIEVEMENTS.READER,
        unlocked_at: new Date().toISOString()
      });
    }

    if (stats.total_pages >= 1000) {
      achievements.push({
        id: 'library_master',
        name: 'Library Master',
        description: 'Read 1000+ pages',
        type: APP_CONSTANTS.ACHIEVEMENTS.READER,
        unlocked_at: new Date().toISOString()
      });
    }

    // Distance achievements
    if (stats.total_distance >= 50) {
      achievements.push({
        id: 'runner',
        name: 'Runner',
        description: 'Cover 50+ km total',
        type: APP_CONSTANTS.ACHIEVEMENTS.ATHLETE,
        unlocked_at: new Date().toISOString()
      });
    }

    if (stats.total_distance >= 200) {
      achievements.push({
        id: 'marathon_hero',
        name: 'Marathon Hero',
        description: 'Cover 200+ km total',
        type: APP_CONSTANTS.ACHIEVEMENTS.ATHLETE,
        unlocked_at: new Date().toISOString()
      });
    }

    // Points achievements
    if (stats.total_points >= 100) {
      achievements.push({
        id: 'point_collector',
        name: 'Point Collector',
        description: 'Earn 100+ total points',
        type: APP_CONSTANTS.ACHIEVEMENTS.PERFECTIONIST,
        unlocked_at: new Date().toISOString()
      });
    }

    return achievements;
  }
}

export const userController = new UserController();
export default userController;