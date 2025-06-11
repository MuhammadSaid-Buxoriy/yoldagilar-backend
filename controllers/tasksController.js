// controllers/tasksController.js - DAILY TASKS CONTROLLER
import { userService, dailyProgressService } from '../services/supabaseService.js';
import { responseService } from '../services/responseService.js';
import { logger } from '../utils/logger.js';
import { createError } from '../middleware/errorHandler.js';
import { APP_CONSTANTS } from '../config/config.js';

/**
 * Tasks Controller
 * Handles daily task management and progress submission
 */
class TasksController {
  /**
   * Get daily tasks for user
   * GET /api/tasks/daily/:tg_id
   */
  async getDailyTasks(req, res, next) {
    try {
      const { tg_id } = req.params;
      const { date } = req.query;

      const telegramId = parseInt(tg_id);
      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      logger.userAction(telegramId, 'GET_DAILY_TASKS', { date });

      // Check if user exists and is approved
      const user = await userService.getUserByTelegramId(telegramId);
      if (!user) {
        throw createError.notFound('User');
      }

      if (user.status !== APP_CONSTANTS.USER_STATUS.APPROVED) {
        throw createError.forbidden('User not approved yet');
      }

      // Get target date (today if not specified)
      const targetDate = date || new Date().toISOString().split('T')[0];

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        throw createError.badRequest('Invalid date format. Use YYYY-MM-DD');
      }

      // Get daily progress for the date
      const progress = await dailyProgressService.getDailyProgress(telegramId, targetDate);

      // Format response data
      const tasks = progress?.tasks || {};
      const taskInputs = progress?.task_inputs || {};
      const pagesRead = progress?.pages_read || 0;
      const distanceKm = progress?.distance_km || 0;
      const completedCount = progress?.completed_count || 0;
      const isSubmittedToday = !!progress;
      const submissionTime = progress?.submission_time || null;

      return responseService.dailyTasks(
        res,
        targetDate,
        tasks,
        taskInputs,
        pagesRead,
        distanceKm,
        completedCount,
        isSubmittedToday,
        submissionTime
      );

    } catch (error) {
      logger.error('Get daily tasks failed:', error);
      next(error);
    }
  }

  /**
   * Submit daily progress
   * POST /api/tasks/submit
   */
  async submitDailyProgress(req, res, next) {
    try {
      const {
        tg_id,
        tasks = {},
        task_inputs = {},
        pages_read = 0,
        distance_km = 0,
        date
      } = req.body;

      const telegramId = parseInt(tg_id);
      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      logger.userAction(telegramId, 'SUBMIT_DAILY_PROGRESS', {
        tasks,
        pages_read,
        distance_km,
        date
      });

      // Validate user
      const user = await userService.getUserByTelegramId(telegramId);
      if (!user) {
        throw createError.notFound('User');
      }

      if (user.status !== APP_CONSTANTS.USER_STATUS.APPROVED) {
        throw createError.forbidden('User not approved yet');
      }

      // Validate submission data
      this.validateSubmissionData(tasks, task_inputs, pages_read, distance_km);

      // Get target date
      const targetDate = date || new Date().toISOString().split('T')[0];

      // Calculate completed count
      const completedCount = Object.values(tasks).filter(Boolean).length;

      // Prepare progress data
      const progressData = {
        tg_id: telegramId,
        date: targetDate,
        tasks,
        task_inputs,
        pages_read: parseInt(pages_read) || 0,
        distance_km: parseFloat(distance_km) || 0,
        completed_count: completedCount,
        submission_time: new Date().toISOString()
      };

      // Save progress
      const savedProgress = await dailyProgressService.submitDailyProgress(progressData);

      // Calculate total points for today
      const totalPoints = completedCount;

      // Format today's data summary
      const todayData = {
        completed: completedCount,
        pages_read: progressData.pages_read,
        distance_km: progressData.distance_km
      };

      // Check for achievements (simple implementation)
      const achievementUnlocked = await this.checkForAchievements(telegramId, savedProgress);

      return responseService.taskSubmission(
        res,
        totalPoints,
        todayData,
        achievementUnlocked,
        savedProgress.submission_time,
        APP_CONSTANTS.MESSAGES.SUCCESS.DATA_SAVED
      );

    } catch (error) {
      logger.error('Submit daily progress failed:', error);
      next(error);
    }
  }

  /**
   * Get task completion summary
   * GET /api/tasks/summary/:tg_id
   */
  async getTaskSummary(req, res, next) {
    try {
      const { tg_id } = req.params;
      const { period = 'week' } = req.query;

      const telegramId = parseInt(tg_id);
      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      logger.userAction(telegramId, 'GET_TASK_SUMMARY', { period });

      const user = await userService.getUserByTelegramId(telegramId);
      if (!user) {
        throw createError.notFound('User');
      }

      if (user.status !== APP_CONSTANTS.USER_STATUS.APPROVED) {
        throw createError.forbidden('User not approved yet');
      }

      // Get date range based on period
      const dateRange = this.getDateRange(period);
      
      // TODO: Implement task summary query for date range
      // For now, return basic structure

      const summary = {
        period,
        date_range: dateRange,
        total_days: 0,
        completed_days: 0,
        total_points: 0,
        average_completion: 0,
        task_breakdown: {
          task_1: { completed: 0, total: 0 },
          task_2: { completed: 0, total: 0 },
          task_3: { completed: 0, total: 0 },
          task_4: { completed: 0, total: 0 },
          task_5: { completed: 0, total: 0 },
          task_6: { completed: 0, total: 0 },
          task_7: { completed: 0, total: 0 },
          task_8: { completed: 0, total: 0 },
          task_9: { completed: 0, total: 0 },
          task_10: { completed: 0, total: 0 }
        },
        reading_stats: {
          total_pages: 0,
          average_pages_per_day: 0
        },
        distance_stats: {
          total_distance: 0,
          average_distance_per_day: 0
        }
      };

      return responseService.success(res, { summary });

    } catch (error) {
      logger.error('Get task summary failed:', error);
      next(error);
    }
  }

  /**
   * Get task templates/definitions
   * GET /api/tasks/templates
   */
  async getTaskTemplates(req, res, next) {
    try {
      logger.info('GET_TASK_TEMPLATES');

      // Define the 10 daily tasks
      const taskTemplates = [
        {
          id: 1,
          title: "Bomdod namozini o'qish",
          description: "Bomdod vaqtida namoz o'qish",
          type: "boolean",
          category: "spiritual",
          points: 1
        },
        {
          id: 2,
          title: "Peshin namozini o'qish",
          description: "Peshin vaqtida namoz o'qish",
          type: "boolean",
          category: "spiritual",
          points: 1
        },
        {
          id: 3,
          title: "Asr namozini o'qish",
          description: "Asr vaqtida namoz o'qish",
          type: "boolean",
          category: "spiritual",
          points: 1
        },
        {
          id: 4,
          title: "Shom namozini o'qish",
          description: "Shom vaqtida namoz o'qish",
          type: "boolean",
          category: "spiritual",
          points: 1
        },
        {
          id: 5,
          title: "Kitob o'qish",
          description: "Kundalik kitob o'qish (sahifalar soni)",
          type: "number",
          category: "education",
          points: 1,
          input_label: "O'qilgan sahifalar soni",
          min_value: 0,
          max_value: 1000
        },
        {
          id: 6,
          title: "Xufton namozini o'qish",
          description: "Xufton vaqtida namoz o'qish",
          type: "boolean",
          category: "spiritual",
          points: 1
        },
        {
          id: 7,
          title: "Ota-onaga xizmat qilish",
          description: "Ota-onaga yordam berish va xizmat qilish",
          type: "boolean",
          category: "family",
          points: 1
        },
        {
          id: 8,
          title: "Axloqli munosabat",
          description: "Odamlar bilan yaxshi munosabatda bo'lish",
          type: "boolean",
          category: "social",
          points: 1
        },
        {
          id: 9,
          title: "Foydali ish qilish",
          description: "Jamiyat uchun foydali ish qilish",
          type: "boolean",
          category: "social",
          points: 1
        },
        {
          id: 10,
          title: "Sport bilan shug'ullanish",
          description: "Jismoniy mashqlar (km da masofa)",
          type: "number",
          category: "health",
          points: 1,
          input_label: "Yugurilgan/yurilgan masofa (km)",
          min_value: 0,
          max_value: 100
        }
      ];

      return responseService.success(res, {
        tasks: taskTemplates,
        total_tasks: taskTemplates.length,
        categories: ['spiritual', 'education', 'family', 'social', 'health']
      });

    } catch (error) {
      logger.error('Get task templates failed:', error);
      next(error);
    }
  }

  /**
   * Get user's task completion streak
   * GET /api/tasks/streak/:tg_id
   */
  async getTaskStreak(req, res, next) {
    try {
      const { tg_id } = req.params;
      const telegramId = parseInt(tg_id);

      if (isNaN(telegramId) || telegramId <= 0) {
        throw createError.badRequest('Invalid Telegram ID format');
      }

      logger.userAction(telegramId, 'GET_TASK_STREAK');

      const user = await userService.getUserByTelegramId(telegramId);
      if (!user) {
        throw createError.notFound('User');
      }

      if (user.status !== APP_CONSTANTS.USER_STATUS.APPROVED) {
        throw createError.forbidden('User not approved yet');
      }

      // TODO: Implement streak calculation
      // For now, return basic structure

      const streak = {
        current_streak: 0,
        longest_streak: 0,
        last_submission: null,
        streak_broken_date: null,
        total_submission_days: 0
      };

      return responseService.success(res, { streak });

    } catch (error) {
      logger.error('Get task streak failed:', error);
      next(error);
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Validate submission data
   * @param {Object} tasks - Task completion data
   * @param {Object} taskInputs - Task input values
   * @param {number} pagesRead - Pages read
   * @param {number} distanceKm - Distance in km
   */
  validateSubmissionData(tasks, taskInputs, pagesRead, distanceKm) {
    // Validate tasks object
    if (typeof tasks !== 'object' || tasks === null) {
      throw createError.badRequest('Tasks must be an object');
    }

    // Validate task values (should be boolean for tasks 1-4, 6-9)
    const booleanTasks = [1, 2, 3, 4, 6, 7, 8, 9];
    booleanTasks.forEach(taskId => {
      if (tasks[taskId] !== undefined && typeof tasks[taskId] !== 'boolean') {
        throw createError.badRequest(`Task ${taskId} must be boolean`);
      }
    });

    // Validate task inputs
    if (typeof taskInputs !== 'object' || taskInputs === null) {
      throw createError.badRequest('Task inputs must be an object');
    }

    // Validate pages read (task 5)
    if (pagesRead !== undefined) {
      const pages = parseInt(pagesRead);
      if (isNaN(pages) || pages < 0 || pages > APP_CONSTANTS.TASKS.MAX_PAGES_READ) {
        throw createError.badRequest(
          `Pages read must be between ${APP_CONSTANTS.TASKS.MIN_PAGES_READ} and ${APP_CONSTANTS.TASKS.MAX_PAGES_READ}`
        );
      }
    }

    // Validate distance (task 10)
    if (distanceKm !== undefined) {
      const distance = parseFloat(distanceKm);
      if (isNaN(distance) || distance < 0 || distance > APP_CONSTANTS.TASKS.MAX_DISTANCE) {
        throw createError.badRequest(
          `Distance must be between ${APP_CONSTANTS.TASKS.MIN_DISTANCE} and ${APP_CONSTANTS.TASKS.MAX_DISTANCE} km`
        );
      }
    }
  }

  /**
   * Check for achievements based on progress
   * @param {number} telegramId - User Telegram ID
   * @param {Object} progress - Daily progress data
   * @returns {Object|null} Achievement unlocked or null
   */
  async checkForAchievements(telegramId, progress) {
    try {
      // Get user's all-time stats
      const allTimeStats = await dailyProgressService.getUserAllTimeStats(telegramId);

      // Simple achievement checks
      if (allTimeStats.total_days === 1) {
        return {
          id: 'first_day',
          name: 'First Step',
          description: 'Complete your first day',
          type: APP_CONSTANTS.ACHIEVEMENTS.NEWCOMER
        };
      }

      if (allTimeStats.total_days === 7) {
        return {
          id: 'week_warrior',
          name: 'Week Warrior',
          description: 'Complete 7 days',
          type: APP_CONSTANTS.ACHIEVEMENTS.CONSISTENT
        };
      }

      if (progress.completed_count === APP_CONSTANTS.TASKS.TOTAL_DAILY_TASKS) {
        return {
          id: 'perfect_day',
          name: 'Perfect Day',
          description: 'Complete all 10 tasks in a day',
          type: APP_CONSTANTS.ACHIEVEMENTS.PERFECTIONIST
        };
      }

      return null;

    } catch (error) {
      logger.error('Achievement check failed:', error);
      return null;
    }
  }

  /**
   * Get date range for summary period
   * @param {string} period - Time period (week, month, year)
   * @returns {Object} Date range object
   */
  getDateRange(period) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    let startDate;
    
    switch (period) {
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = monthAgo.toISOString().split('T')[0];
        break;
      case 'year':
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        startDate = yearAgo.toISOString().split('T')[0];
        break;
      default:
        startDate = today;
    }

    return {
      start_date: startDate,
      end_date: today
    };
  }
}

export const tasksController = new TasksController();
export default tasksController;