// controllers/authController.js - AUTHENTICATION CONTROLLER
import { userService } from '../services/supabaseService.js';
import { logger } from '../utils/logger.js';
import { createError } from '../middleware/errorHandler.js';
import { APP_CONSTANTS } from '../config/config.js';
import { responseService } from '../services/responseService.js';

/**
 * Authentication Controller
 * Handles user authentication and registration
 */
class AuthController {
  /**
   * Check user authentication status
   * GET /api/auth/check/:tg_id
   */
  async checkUser(req, res, next) {
    try {
      const { tg_id } = req.params;
      const telegramId = parseInt(tg_id);

      // Validate Telegram ID
      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      logger.userAction(telegramId, 'AUTH_CHECK');

      // Get user from database
      const user = await userService.getUserByTelegramId(telegramId);

      if (!user) {
        return responseService.success(res, {
          success: true,
          isRegistered: false,
          isApproved: false,
          user: null
        });
      }

      // Check if user is approved
      const isApproved = user.status === APP_CONSTANTS.USER_STATUS.APPROVED;

      if (!isApproved) {
        return responseService.success(res, {
          success: true,
          isRegistered: true,
          isApproved: false,
          user: {
            tg_id: user.tg_id,
            name: user.name,
            username: user.username,
            photo_url: user.photo_url,
            registration_date: user.registration_date,
            approval_date: null,
            status: user.status,
            is_premium: user.is_premium
          }
        });
      }

      // User is registered and approved
      return responseService.success(res, {
        success: true,
        isRegistered: true,
        isApproved: true,
        user: {
          tg_id: user.tg_id,
          name: user.name,
          username: user.username,
          photo_url: user.photo_url,
          registration_date: user.registration_date,
          approval_date: user.approval_date,
          status: user.status,
          is_premium: user.is_premium
        }
      });

    } catch (error) {
      logger.error('Auth check failed:', error);
      next(error);
    }
  }

  /**
   * Register new user
   * POST /api/auth/register
   */
  async registerUser(req, res, next) {
    try {
      const { tg_id, name, username, photo_url } = req.body;

      // Validate required fields
      if (!tg_id || !name) {
        throw createError.badRequest(
          'Missing required fields: tg_id and name are required'
        );
      }

      const telegramId = parseInt(tg_id);
      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      // Validate name
      if (typeof name !== 'string' || name.trim().length < 2) {
        throw createError.badRequest('Name must be at least 2 characters long');
      }

      if (name.trim().length > 100) {
        throw createError.badRequest('Name must be less than 100 characters');
      }

      logger.userAction(telegramId, 'REGISTRATION_ATTEMPT', { 
        name: name.trim(), 
        username 
      });

      // Check if user already exists
      const existingUser = await userService.getUserByTelegramId(telegramId);
      
      if (existingUser) {
        logger.userAction(telegramId, 'REGISTRATION_DUPLICATE');
        
        // Return existing user status
        return responseService.success(res, {
          success: true,
          message: 'User already registered',
          user_id: existingUser.tg_id,
          status: existingUser.status
        });
      }

      // Create new user
      const userData = {
        tg_id: telegramId,
        name: name.trim(),
        username: username ? username.trim() : null,
        photo_url: photo_url || null,
        registration_date: new Date().toISOString(),
        status: APP_CONSTANTS.USER_STATUS.PENDING,
        is_premium: false
      };

      const newUser = await userService.upsertUser(userData);

      logger.userAction(telegramId, 'REGISTRATION_SUCCESS', { 
        name: userData.name,
        status: userData.status 
      });

      return responseService.success(res, {
        success: true,
        message: APP_CONSTANTS.MESSAGES.SUCCESS.USER_REGISTERED,
        user_id: newUser.tg_id,
        status: newUser.status
      }, 201);

    } catch (error) {
      logger.error('User registration failed:', error);
      next(error);
    }
  }

  /**
   * Refresh user data (for syncing with latest info)
   * POST /api/auth/refresh/:tg_id
   */
  async refreshUser(req, res, next) {
    try {
      const { tg_id } = req.params;
      const telegramId = parseInt(tg_id);

      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      const user = await userService.getUserByTelegramId(telegramId);

      if (!user) {
        throw createError.notFound('User');
      }

      logger.userAction(telegramId, 'AUTH_REFRESH');

      return responseService.success(res, {
        success: true,
        user: {
          tg_id: user.tg_id,
          name: user.name || user.full_name,
          username: user.username,
          photo_url: user.photo_url,
          registration_date: user.registration_date,
          approval_date: user.approval_date,
          status: user.status,
          is_premium: user.is_premium
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('User refresh failed:', error);
      next(error);
    }
  }

  /**
   * Check if user has access to specific features
   * GET /api/auth/access/:tg_id
   */
  async checkAccess(req, res, next) {
    try {
      const { tg_id } = req.params;
      const { feature } = req.query;

      const telegramId = parseInt(tg_id);
      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      const user = await userService.getUserByTelegramId(telegramId);

      if (!user) {
        return responseService.success(res, {
          hasAccess: false,
          reason: 'User not found'
        });
      }

      if (user.status !== APP_CONSTANTS.USER_STATUS.APPROVED) {
        return responseService.success(res, {
          hasAccess: false,
          reason: 'User not approved'
        });
      }

      // Feature-specific access checks
      let hasAccess = true;
      let reason = null;

      switch (feature) {
        case 'premium':
          hasAccess = user.is_premium;
          reason = hasAccess ? null : 'Premium subscription required';
          break;
        
        case 'admin':
          hasAccess = false; // Implement admin check logic
          reason = 'Admin access denied';
          break;
        
        default:
          hasAccess = true;
      }

      logger.userAction(telegramId, 'ACCESS_CHECK', { feature, hasAccess });

      return responseService.success(res, {
        hasAccess,
        reason,
        user_status: user.status,
        is_premium: user.is_premium
      });

    } catch (error) {
      logger.error('Access check failed:', error);
      next(error);
    }
  }

  /**
   * Update user profile (limited fields)
   * PATCH /api/auth/profile/:tg_id
   */
  async updateProfile(req, res, next) {
    try {
      const { tg_id } = req.params;
      const { name, username } = req.body;

      const telegramId = parseInt(tg_id);
      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      const user = await userService.getUserByTelegramId(telegramId);
      if (!user) {
        throw createError.notFound('User');
      }

      // Validate updates
      const updates = {};
      
      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length < 2) {
          throw createError.badRequest('Name must be at least 2 characters long');
        }
        updates.name = name.trim();
      }

      if (username !== undefined) {
        updates.username = username ? username.trim() : null;
      }

      if (Object.keys(updates).length === 0) {
        throw createError.badRequest('No valid updates provided');
      }

      // Update user
      const updatedUser = await userService.upsertUser({
        ...user,
        ...updates
      });

      logger.userAction(telegramId, 'PROFILE_UPDATE', updates);

      return responseService.success(res, {
        success: true,
        message: 'Profile updated successfully',
        user: {
          tg_id: updatedUser.tg_id,
          name: updatedUser.name,
          username: updatedUser.username,
          photo_url: updatedUser.photo_url,
          status: updatedUser.status,
          is_premium: updatedUser.is_premium
        }
      });

    } catch (error) {
      logger.error('Profile update failed:', error);
      next(error);
    }
  }

  /**
   * Logout user (clear any sessions if implemented)
   * POST /api/auth/logout/:tg_id
   */
  async logout(req, res, next) {
    try {
      const { tg_id } = req.params;
      const telegramId = parseInt(tg_id);

      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      logger.userAction(telegramId, 'LOGOUT');

      // TODO: Implement session cleanup if sessions are used

      return responseService.success(res, {
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      logger.error('Logout failed:', error);
      next(error);
    }
  }
}

export const authController = new AuthController();
export default authController;