// services/supabaseService.js - DATABASE OPERATIONS SERVICE
import { supabase } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { createError } from '../middleware/errorHandler.js';
import { APP_CONSTANTS } from '../config/config.js';

/**
 * Base service class with common database operations
 */
class BaseService {
  constructor(tableName) {
    this.tableName = tableName;
    this.supabase = supabase;
  }

  /**
   * Execute query with error handling and logging
   * @param {Function} queryFn - Supabase query function
   * @param {string} operation - Operation description for logging
   * @returns {Promise<Object>} Query result
   */
  async executeQuery(queryFn, operation = 'query') {
    const startTime = Date.now();
    
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      
      if (result.error) {
        logger.database(`${operation} ERROR`, this.tableName, duration, false);
        throw createError.database(`Database operation failed: ${result.error.message}`, result.error);
      }

      logger.database(operation, this.tableName, duration, true);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.database(`${operation} ERROR`, this.tableName, duration, false);
      
      if (error.isOperational) {
        throw error;
      }
      
      throw createError.database(`Database operation failed: ${error.message}`, error);
    }
  }
}

/**
 * User service for user-related database operations
 */
class UserService extends BaseService {
  constructor() {
    super('users');
  }

  /**
   * Get user by Telegram ID
   * @param {number} tgId - Telegram user ID
   * @returns {Promise<Object|null>} User data or null
   */
  async getUserByTelegramId(tgId) {
    const result = await this.executeQuery(
      () => this.supabase
        .from(this.tableName)
        .select('*')
        .eq('tg_id', tgId)
        .single(),
      'SELECT_USER'
    );

    return result.data;
  }

  /**
   * Create or update user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created/updated user
   */
  async upsertUser(userData) {
    const userToInsert = {
      tg_id: userData.tg_id,
      name: userData.name || userData.full_name,
      username: userData.username || null,
      photo_url: userData.photo_url || null,
      registration_date: userData.registration_date || new Date().toISOString(),
      status: userData.status || APP_CONSTANTS.USER_STATUS.PENDING,
      is_premium: userData.is_premium || false
    };

    const result = await this.executeQuery(
      () => this.supabase
        .from(this.tableName)
        .upsert(userToInsert, { 
          onConflict: 'tg_id',
          ignoreDuplicates: false 
        })
        .select()
        .single(),
      'UPSERT_USER'
    );

    return result.data;
  }

  /**
   * Update user status (approve/reject)
   * @param {number} tgId - Telegram user ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated user
   */
  async updateUserStatus(tgId, status) {
    const updateData = { 
      status,
      ...(status === APP_CONSTANTS.USER_STATUS.APPROVED && { 
        approval_date: new Date().toISOString() 
      })
    };

    const result = await this.executeQuery(
      () => this.supabase
        .from(this.tableName)
        .update(updateData)
        .eq('tg_id', tgId)
        .select()
        .single(),
      'UPDATE_USER_STATUS'
    );

    return result.data;
  }

  /**
   * Get pending users for admin approval
   * @returns {Promise<Array>} Pending users list
   */
  async getPendingUsers() {
    const result = await this.executeQuery(
      () => this.supabase
        .from(this.tableName)
        .select('tg_id, name, username, registration_date, status')
        .eq('status', APP_CONSTANTS.USER_STATUS.PENDING)
        .order('registration_date', { ascending: false }),
      'SELECT_PENDING_USERS'
    );

    return result.data || [];
  }

  /**
   * Delete user
   * @param {number} tgId - Telegram user ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteUser(tgId) {
    const result = await this.executeQuery(
      () => this.supabase
        .from(this.tableName)
        .delete()
        .eq('tg_id', tgId),
      'DELETE_USER'
    );

    return true;
  }

  /**
   * Update user photo
   * @param {number} tgId - Telegram user ID
   * @param {string} photoUrl - Photo URL
   * @returns {Promise<Object>} Updated user
   */
  async updateUserPhoto(tgId, photoUrl) {
    const result = await this.executeQuery(
      () => this.supabase
        .from(this.tableName)
        .update({ photo_url: photoUrl })
        .eq('tg_id', tgId)
        .select()
        .single(),
      'UPDATE_USER_PHOTO'
    );

    return result.data;
  }

  /**
   * Get user statistics count
   * @returns {Promise<Object>} User counts
   */
  async getUserCounts() {
    const [totalResult, approvedResult, pendingResult] = await Promise.all([
      this.executeQuery(
        () => this.supabase
          .from(this.tableName)
          .select('*', { count: 'exact', head: true }),
        'COUNT_TOTAL_USERS'
      ),
      this.executeQuery(
        () => this.supabase
          .from(this.tableName)
          .select('*', { count: 'exact', head: true })
          .eq('status', APP_CONSTANTS.USER_STATUS.APPROVED),
        'COUNT_APPROVED_USERS'
      ),
      this.executeQuery(
        () => this.supabase
          .from(this.tableName)
          .select('*', { count: 'exact', head: true })
          .eq('status', APP_CONSTANTS.USER_STATUS.PENDING),
        'COUNT_PENDING_USERS'
      )
    ]);

    return {
      total: totalResult.count || 0,
      approved: approvedResult.count || 0,
      pending: pendingResult.count || 0
    };
  }
}

/**
 * Daily progress service for task-related database operations
 */
class DailyProgressService extends BaseService {
  constructor() {
    super('daily_progress');
  }

  /**
   * Get daily progress for user and date
   * @param {number} tgId - Telegram user ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Object|null>} Daily progress data
   */
  async getDailyProgress(tgId, date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const result = await this.executeQuery(
      () => this.supabase
        .from(this.tableName)
        .select('*')
        .eq('tg_id', tgId)
        .eq('date', targetDate)
        .single(),
      'SELECT_DAILY_PROGRESS'
    );

    return result.data;
  }

  /**
   * Submit daily progress
   * @param {Object} progressData - Progress data
   * @returns {Promise<Object>} Saved progress
   */
  async submitDailyProgress(progressData) {
    const dataToInsert = {
      tg_id: progressData.tg_id,
      date: progressData.date || new Date().toISOString().split('T')[0],
      tasks: progressData.tasks || {},
      task_inputs: progressData.task_inputs || {},
      pages_read: progressData.pages_read || 0,
      distance_km: progressData.distance_km || 0,
      completed_count: progressData.completed_count || 0,
      submission_time: new Date().toISOString()
    };

    const result = await this.executeQuery(
      () => this.supabase
        .from(this.tableName)
        .upsert(dataToInsert, { 
          onConflict: ['tg_id', 'date'],
          ignoreDuplicates: false 
        })
        .select()
        .single(),
      'UPSERT_DAILY_PROGRESS'
    );

    return result.data;
  }

  /**
   * Get user's all-time statistics
   * @param {number} tgId - Telegram user ID
   * @returns {Promise<Object>} All-time stats
   */
  async getUserAllTimeStats(tgId) {
    const result = await this.executeQuery(
      () => this.supabase
        .from(this.tableName)
        .select('completed_count, pages_read, distance_km, date')
        .eq('tg_id', tgId),
      'SELECT_USER_ALL_STATS'
    );

    const data = result.data || [];
    
    return {
      total_points: data.reduce((sum, day) => sum + (day.completed_count || 0), 0),
      total_pages: data.reduce((sum, day) => sum + (day.pages_read || 0), 0),
      total_distance: data.reduce((sum, day) => sum + (day.distance_km || 0), 0),
      total_days: data.length
    };
  }

  /**
   * Get leaderboard data
   * @param {Object} options - Leaderboard options
   * @returns {Promise<Array>} Leaderboard data
   */
  async getLeaderboardData(options = {}) {
    const { period = 'all', type = 'overall', limit = 100 } = options;
    
    let query = this.supabase
      .from(this.tableName)
      .select(`
        tg_id,
        completed_count,
        pages_read,
        distance_km,
        date
      `);

    // Apply date filter for period
    if (period !== 'all') {
      const dateFilter = this.getDateFilter(period);
      if (dateFilter) {
        query = query.gte('date', dateFilter);
      }
    }

    const result = await this.executeQuery(() => query, 'SELECT_LEADERBOARD_DATA');
    const progressData = result.data || [];

    // Get user details
    const userIds = [...new Set(progressData.map(p => p.tg_id))];
    const usersResult = await this.executeQuery(
      () => this.supabase
        .from('users')
        .select('tg_id, name, photo_url, is_premium')
        .in('tg_id', userIds)
        .eq('status', APP_CONSTANTS.USER_STATUS.APPROVED),
      'SELECT_LEADERBOARD_USERS'
    );

    const users = usersResult.data || [];
    
    // Calculate aggregated stats
    const userStats = {};
    progressData.forEach(progress => {
      const userId = progress.tg_id;
      if (!userStats[userId]) {
        userStats[userId] = {
          total_points: 0,
          total_pages: 0,
          total_distance: 0,
          days_count: 0
        };
      }
      
      userStats[userId].total_points += progress.completed_count || 0;
      userStats[userId].total_pages += progress.pages_read || 0;
      userStats[userId].total_distance += progress.distance_km || 0;
      userStats[userId].days_count += 1;
    });

    // Build leaderboard
    const leaderboard = Object.entries(userStats).map(([userId, stats]) => {
      const user = users.find(u => u.tg_id == userId);
      if (!user) return null;

      return {
        tg_id: parseInt(userId),
        name: user.name,
        photo_url: user.photo_url,
        is_premium: user.is_premium,
        ...stats
      };
    }).filter(Boolean);

    // Sort by type
    const sortKey = type === 'reading' ? 'total_pages' : 
                   type === 'distance' ? 'total_distance' : 'total_points';
    
    leaderboard.sort((a, b) => b[sortKey] - a[sortKey]);

    // Add rank and score
    return leaderboard.slice(0, limit).map((user, index) => ({
      ...user,
      rank: index + 1,
      score: user[sortKey],
      achievements: [] // TODO: Calculate achievements
    }));
  }

  /**
   * Get date filter for period
   * @param {string} period - Time period
   * @returns {string|null} Date filter
   */
  getDateFilter(period) {
    const now = new Date();
    
    switch (period) {
      case 'daily':
        return now.toISOString().split('T')[0];
      case 'weekly':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return weekAgo.toISOString().split('T')[0];
      case 'monthly':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return monthAgo.toISOString().split('T')[0];
      default:
        return null;
    }
  }

  /**
   * Get today's submission count
   * @returns {Promise<number>} Today's submissions
   */
  async getTodaySubmissions() {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await this.executeQuery(
      () => this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('date', today),
      'COUNT_TODAY_SUBMISSIONS'
    );

    return result.count || 0;
  }
}

/**
 * File upload service
 */
class FileService {
  constructor() {
    this.bucket = 'photos';
    this.supabase = supabase;
  }

  /**
   * Upload file to Supabase storage
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} fileName - File name
   * @param {string} mimeType - MIME type
   * @returns {Promise<string>} Public URL
   */
  async uploadFile(fileBuffer, fileName, mimeType) {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucket)
        .upload(fileName, fileBuffer, {
          contentType: mimeType,
          upsert: true
        });

      if (error) {
        throw createError.internal(`File upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from(this.bucket)
        .getPublicUrl(fileName);

      return urlData.publicUrl;
      
    } catch (error) {
      logger.error('File upload error:', error);
      throw createError.internal('File upload failed');
    }
  }

  /**
   * Delete file from storage
   * @param {string} fileName - File name to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(fileName) {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucket)
        .remove([fileName]);

      if (error) {
        logger.warn('File deletion failed:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('File deletion error:', error);
      return false;
    }
  }
}

// Export service instances
export const userService = new UserService();
export const dailyProgressService = new DailyProgressService();
export const fileService = new FileService();

export default {
  userService,
  dailyProgressService,
  fileService
};