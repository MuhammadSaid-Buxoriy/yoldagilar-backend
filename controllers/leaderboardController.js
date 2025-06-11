// controllers/leaderboardController.js - LEADERBOARD CONTROLLER
import { dailyProgressService, userService } from '../services/supabaseService.js';
import { responseService } from '../services/responseService.js';
import { logger } from '../utils/logger.js';
import { createError } from '../middleware/errorHandler.js';
import { APP_CONSTANTS } from '../config/config.js';

/**
 * Leaderboard Controller
 * Handles leaderboard calculations, rankings, and user positions
 */
class LeaderboardController {
  /**
   * Get leaderboard with filters
   * GET /api/leaderboard
   */
  async getLeaderboard(req, res, next) {
    try {
      const {
        period = 'all',
        type = 'overall',
        limit = 100,
        offset = 0
      } = req.query;

      logger.info('GET_LEADERBOARD', { period, type, limit, offset });

      // Validate parameters
      this.validateLeaderboardParams(period, type, limit, offset);

      // Get leaderboard data
      const leaderboardData = await dailyProgressService.getLeaderboardData({
        period,
        type,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Format leaderboard for response
      const formattedLeaderboard = leaderboardData.map((participant, index) => 
        responseService.formatLeaderboardParticipant(participant, participant.rank)
      );

      // Get total participants count (for pagination)
      const totalParticipants = await this.getTotalParticipants(period);

      return responseService.leaderboard(res, formattedLeaderboard, totalParticipants);

    } catch (error) {
      logger.error('Get leaderboard failed:', error);
      next(error);
    }
  }

  /**
   * Get user position in leaderboard
   * GET /api/leaderboard/position/:tg_id
   */
  async getUserLeaderboardPosition(req, res, next) {
    try {
      const { tg_id } = req.params;
      const { period = 'all', type = 'overall' } = req.query;

      const telegramId = parseInt(tg_id);
      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      logger.userAction(telegramId, 'GET_LEADERBOARD_POSITION', { period, type });

      // Validate user
      const user = await userService.getUserByTelegramId(telegramId);
      if (!user) {
        throw createError.notFound('User');
      }

      if (user.status !== APP_CONSTANTS.USER_STATUS.APPROVED) {
        throw createError.forbidden('User not approved yet');
      }

      // Get full leaderboard to find user position
      const fullLeaderboard = await dailyProgressService.getLeaderboardData({
        period,
        type,
        limit: 10000 // Get all users
      });

      // Find user position
      const userPosition = fullLeaderboard.findIndex(participant => 
        participant.tg_id === telegramId
      );

      if (userPosition === -1) {
        return responseService.success(res, {
          user_position: null,
          message: 'User not found in leaderboard (no submissions yet)',
          total_participants: fullLeaderboard.length
        });
      }

      const userRank = userPosition + 1;
      const userStats = fullLeaderboard[userPosition];

      // Get surrounding users (3 above, user, 3 below)
      const surroundingUsers = this.getSurroundingUsers(fullLeaderboard, userPosition);

      return responseService.success(res, {
        user_position: {
          rank: userRank,
          score: userStats.score,
          total_points: userStats.total_points,
          total_pages: userStats.total_pages,
          total_distance: userStats.total_distance,
          percentile: Math.round((1 - userPosition / fullLeaderboard.length) * 100)
        },
        surrounding_users: surroundingUsers,
        total_participants: fullLeaderboard.length,
        leaderboard_type: type,
        time_period: period
      });

    } catch (error) {
      logger.error('Get user leaderboard position failed:', error);
      next(error);
    }
  }

  /**
   * Get leaderboard statistics and insights
   * GET /api/leaderboard/stats
   */
  async getLeaderboardStats(req, res, next) {
    try {
      const { period = 'all' } = req.query;

      logger.info('GET_LEADERBOARD_STATS', { period });

      // Get all leaderboard data for analysis
      const leaderboardData = await dailyProgressService.getLeaderboardData({
        period,
        type: 'overall',
        limit: 10000
      });

      // Calculate statistics
      const stats = this.calculateLeaderboardStats(leaderboardData);

      return responseService.success(res, {
        period,
        statistics: stats,
        generated_at: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Get leaderboard stats failed:', error);
      next(error);
    }
  }

  /**
   * Get top performers by category
   * GET /api/leaderboard/top-performers
   */
  async getTopPerformers(req, res, next) {
    try {
      const { period = 'all', limit = 10 } = req.query;

      logger.info('GET_TOP_PERFORMERS', { period, limit });

      // Get top performers for each category
      const [
        overallTop,
        readingTop,
        distanceTop
      ] = await Promise.all([
        dailyProgressService.getLeaderboardData({ period, type: 'overall', limit: parseInt(limit) }),
        dailyProgressService.getLeaderboardData({ period, type: 'reading', limit: parseInt(limit) }),
        dailyProgressService.getLeaderboardData({ period, type: 'distance', limit: parseInt(limit) })
      ]);

      const topPerformers = {
        overall: overallTop.map(user => ({
          tg_id: user.tg_id,
          name: user.name,
          score: user.total_points,
          photo_url: user.photo_url,
          rank: user.rank
        })),
        reading: readingTop.map(user => ({
          tg_id: user.tg_id,
          name: user.name,
          score: user.total_pages,
          photo_url: user.photo_url,
          rank: user.rank
        })),
        distance: distanceTop.map(user => ({
          tg_id: user.tg_id,
          name: user.name,
          score: user.total_distance,
          photo_url: user.photo_url,
          rank: user.rank
        }))
      };

      return responseService.success(res, {
        period,
        top_performers: topPerformers,
        categories: ['overall', 'reading', 'distance']
      });

    } catch (error) {
      logger.error('Get top performers failed:', error);
      next(error);
    }
  }

  /**
   * Get leaderboard changes/movements
   * GET /api/leaderboard/movements
   */
  async getLeaderboardMovements(req, res, next) {
    try {
      const { limit = 20 } = req.query;

      logger.info('GET_LEADERBOARD_MOVEMENTS', { limit });

      // TODO: Implement leaderboard movement tracking
      // This would require storing historical leaderboard positions
      // For now, return empty structure

      const movements = {
        biggest_climbers: [],
        biggest_fallers: [],
        new_entries: [],
        consistency_awards: []
      };

      return responseService.success(res, {
        movements,
        period: 'week',
        note: 'Movement tracking will be implemented with historical data'
      });

    } catch (error) {
      logger.error('Get leaderboard movements failed:', error);
      next(error);
    }
  }

  /**
   * Get achievement leaderboard
   * GET /api/leaderboard/achievements
   */
  async getAchievementLeaderboard(req, res, next) {
    try {
      const { limit = 50 } = req.query;

      logger.info('GET_ACHIEVEMENT_LEADERBOARD', { limit });

      // Get all users with their statistics
      const allUsersData = await dailyProgressService.getLeaderboardData({
        period: 'all',
        type: 'overall',
        limit: parseInt(limit) * 2 // Get more to ensure we have enough with achievements
      });

      // Calculate achievements for each user
      const usersWithAchievements = allUsersData.map(user => {
        const achievements = this.calculateUserAchievements({
          total_points: user.total_points,
          total_pages: user.total_pages,
          total_distance: user.total_distance,
          days_count: user.days_count
        });

        return {
          ...user,
          achievements,
          achievement_count: achievements.length,
          achievement_score: this.calculateAchievementScore(achievements)
        };
      });

      // Sort by achievement score
      usersWithAchievements.sort((a, b) => b.achievement_score - a.achievement_score);

      // Take top performers
      const topAchievers = usersWithAchievements
        .slice(0, parseInt(limit))
        .map((user, index) => ({
          rank: index + 1,
          tg_id: user.tg_id,
          name: user.name,
          photo_url: user.photo_url,
          achievement_count: user.achievement_count,
          achievement_score: user.achievement_score,
          top_achievements: user.achievements.slice(0, 3), // Show top 3 achievements
          is_premium: user.is_premium
        }));

      return responseService.success(res, {
        achievement_leaderboard: topAchievers,
        total_participants: usersWithAchievements.length
      });

    } catch (error) {
      logger.error('Get achievement leaderboard failed:', error);
      next(error);
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Validate leaderboard parameters
   * @param {string} period - Time period
   * @param {string} type - Leaderboard type
   * @param {string} limit - Result limit
   * @param {string} offset - Result offset
   */
  validateLeaderboardParams(period, type, limit, offset) {
    // Validate period
    const validPeriods = Object.values(APP_CONSTANTS.TIME_PERIODS);
    if (!validPeriods.includes(period)) {
      throw createError.badRequest(`Invalid period. Must be one of: ${validPeriods.join(', ')}`);
    }

    // Validate type
    const validTypes = Object.values(APP_CONSTANTS.LEADERBOARD_TYPES);
    if (!validTypes.includes(type)) {
      throw createError.badRequest(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate limit
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      throw createError.badRequest('Limit must be between 1 and 1000');
    }

    // Validate offset
    const offsetNum = parseInt(offset);
    if (isNaN(offsetNum) || offsetNum < 0) {
      throw createError.badRequest('Offset must be >= 0');
    }
  }

  /**
   * Get total participants count
   * @param {string} period - Time period
   * @returns {Promise<number>} Total participants
   */
  async getTotalParticipants(period) {
    try {
      const allData = await dailyProgressService.getLeaderboardData({
        period,
        type: 'overall',
        limit: 10000
      });
      return allData.length;
    } catch (error) {
      logger.error('Get total participants failed:', error);
      return 0;
    }
  }

  /**
   * Get surrounding users in leaderboard
   * @param {Array} leaderboard - Full leaderboard array
   * @param {number} userPosition - User's position index
   * @returns {Array} Surrounding users
   */
  getSurroundingUsers(leaderboard, userPosition) {
    const surroundingCount = 3;
    const start = Math.max(0, userPosition - surroundingCount);
    const end = Math.min(leaderboard.length, userPosition + surroundingCount + 1);

    return leaderboard.slice(start, end).map((user, index) => ({
      rank: start + index + 1,
      tg_id: user.tg_id,
      name: user.name,
      score: user.score,
      photo_url: user.photo_url,
      is_current_user: start + index === userPosition
    }));
  }

  /**
   * Calculate leaderboard statistics
   * @param {Array} leaderboardData - Leaderboard data
   * @returns {Object} Statistics object
   */
  calculateLeaderboardStats(leaderboardData) {
    if (leaderboardData.length === 0) {
      return {
        total_participants: 0,
        average_points: 0,
        median_points: 0,
        top_10_percent_threshold: 0,
        most_active_score: 0,
        completion_distribution: {}
      };
    }

    const scores = leaderboardData.map(user => user.score).sort((a, b) => b - a);
    const totalParticipants = leaderboardData.length;

    // Calculate statistics
    const averagePoints = scores.reduce((sum, score) => sum + score, 0) / totalParticipants;
    const medianPoints = scores[Math.floor(totalParticipants / 2)];
    const top10PercentThreshold = scores[Math.floor(totalParticipants * 0.1)];
    const mostActiveScore = Math.max(...scores);

    // Calculate completion distribution
    const completionRanges = {
      '0-10': 0,
      '11-50': 0,
      '51-100': 0,
      '101-200': 0,
      '200+': 0
    };

    scores.forEach(score => {
      if (score <= 10) completionRanges['0-10']++;
      else if (score <= 50) completionRanges['11-50']++;
      else if (score <= 100) completionRanges['51-100']++;
      else if (score <= 200) completionRanges['101-200']++;
      else completionRanges['200+']++;
    });

    return {
      total_participants: totalParticipants,
      average_points: Math.round(averagePoints * 100) / 100,
      median_points: medianPoints,
      top_10_percent_threshold: top10PercentThreshold,
      most_active_score: mostActiveScore,
      completion_distribution: completionRanges
    };
  }

  /**
   * Calculate user achievements
   * @param {Object} stats - User statistics
   * @returns {Array} Array of achievements
   */
  calculateUserAchievements(stats) {
    const achievements = [];

    // Points achievements
    if (stats.total_points >= 500) {
      achievements.push({
        id: 'point_master',
        name: 'Point Master',
        description: '500+ total points',
        category: 'points',
        rarity: 'epic'
      });
    } else if (stats.total_points >= 100) {
      achievements.push({
        id: 'point_collector',
        name: 'Point Collector',
        description: '100+ total points',
        category: 'points',
        rarity: 'rare'
      });
    }

    // Reading achievements
    if (stats.total_pages >= 1000) {
      achievements.push({
        id: 'library_master',
        name: 'Library Master',
        description: '1000+ pages read',
        category: 'reading',
        rarity: 'legendary'
      });
    } else if (stats.total_pages >= 500) {
      achievements.push({
        id: 'book_lover',
        name: 'Book Lover',
        description: '500+ pages read',
        category: 'reading',
        rarity: 'epic'
      });
    } else if (stats.total_pages >= 100) {
      achievements.push({
        id: 'bookworm',
        name: 'Bookworm',
        description: '100+ pages read',
        category: 'reading',
        rarity: 'rare'
      });
    }

    // Distance achievements
    if (stats.total_distance >= 500) {
      achievements.push({
        id: 'ultra_runner',
        name: 'Ultra Runner',
        description: '500+ km covered',
        category: 'fitness',
        rarity: 'legendary'
      });
    } else if (stats.total_distance >= 200) {
      achievements.push({
        id: 'marathon_hero',
        name: 'Marathon Hero',
        description: '200+ km covered',
        category: 'fitness',
        rarity: 'epic'
      });
    } else if (stats.total_distance >= 50) {
      achievements.push({
        id: 'runner',
        name: 'Runner',
        description: '50+ km covered',
        category: 'fitness',
        rarity: 'rare'
      });
    }

    // Consistency achievements
    if (stats.days_count >= 100) {
      achievements.push({
        id: 'centurion',
        name: 'Centurion',
        description: '100+ days completed',
        category: 'consistency',
        rarity: 'legendary'
      });
    } else if (stats.days_count >= 30) {
      achievements.push({
        id: 'month_master',
        name: 'Month Master',
        description: '30+ days completed',
        category: 'consistency',
        rarity: 'epic'
      });
    } else if (stats.days_count >= 7) {
      achievements.push({
        id: 'week_warrior',
        name: 'Week Warrior',
        description: '7+ days completed',
        category: 'consistency',
        rarity: 'rare'
      });
    }

    return achievements;
  }

  /**
   * Calculate achievement score
   * @param {Array} achievements - User achievements
   * @returns {number} Achievement score
   */
  calculateAchievementScore(achievements) {
    const rarityScores = {
      'common': 10,
      'rare': 25,
      'epic': 50,
      'legendary': 100
    };

    return achievements.reduce((total, achievement) => {
      return total + (rarityScores[achievement.rarity] || 10);
    }, 0);
  }
}

export const leaderboardController = new LeaderboardController();
export default leaderboardController;