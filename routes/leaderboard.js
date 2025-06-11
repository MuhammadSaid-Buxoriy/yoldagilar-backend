// routes/leaderboard.js - LEADERBOARD ROUTES
import express from 'express';
import { leaderboardController } from '../controllers/leaderboardController.js';
import { responseService } from '../services/responseService.js';
import { 
  validateTelegramId, 
  validateLeaderboardQuery 
} from '../middleware/validation.js';

const router = express.Router();

// ==================== LEADERBOARD ROUTES ====================

/**
 * Get leaderboard with filters
 * GET /api/leaderboard
 */
router.get('/',
  validateLeaderboardQuery,
  responseService.asyncResponse(leaderboardController.getLeaderboard)
);

/**
 * Get user position in leaderboard
 * GET /api/leaderboard/position/:tg_id
 */
router.get('/position/:tg_id',
  validateTelegramId,
  validateLeaderboardQuery,
  responseService.asyncResponse(leaderboardController.getUserLeaderboardPosition)
);

/**
 * Get leaderboard statistics and insights
 * GET /api/leaderboard/stats
 */
router.get('/stats',
  responseService.asyncResponse(leaderboardController.getLeaderboardStats)
);

/**
 * Get top performers by category
 * GET /api/leaderboard/top-performers
 */
router.get('/top-performers',
  responseService.asyncResponse(leaderboardController.getTopPerformers)
);

/**
 * Get leaderboard changes/movements
 * GET /api/leaderboard/movements
 */
router.get('/movements',
  responseService.asyncResponse(leaderboardController.getLeaderboardMovements)
);

/**
 * Get achievement leaderboard
 * GET /api/leaderboard/achievements
 */
router.get('/achievements',
  responseService.asyncResponse(leaderboardController.getAchievementLeaderboard)
);

export default router;