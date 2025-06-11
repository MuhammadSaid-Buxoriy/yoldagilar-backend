// routes/tasks.js - DAILY TASKS ROUTES
import express from 'express';
import { tasksController } from '../controllers/tasksController.js';
import { responseService } from '../services/responseService.js';
import { 
  validateTelegramId, 
  validateDailyProgress 
} from '../middleware/validation.js';

const router = express.Router();

// ==================== TASKS ROUTES ====================

/**
 * Get daily tasks for user
 * GET /api/tasks/daily/:tg_id
 */
router.get('/daily/:tg_id',
  validateTelegramId,
  responseService.asyncResponse(tasksController.getDailyTasks)
);

/**
 * Submit daily progress
 * POST /api/tasks/submit
 */
router.post('/submit',
  validateDailyProgress,
  responseService.asyncResponse(tasksController.submitDailyProgress)
);

/**
 * Get task completion summary
 * GET /api/tasks/summary/:tg_id
 */
router.get('/summary/:tg_id',
  validateTelegramId,
  responseService.asyncResponse(tasksController.getTaskSummary)
);

/**
 * Get task templates/definitions
 * GET /api/tasks/templates
 */
router.get('/templates',
  responseService.asyncResponse(tasksController.getTaskTemplates)
);

/**
 * Get user's task completion streak
 * GET /api/tasks/streak/:tg_id
 */
router.get('/streak/:tg_id',
  validateTelegramId,
  responseService.asyncResponse(tasksController.getTaskStreak)
);

export default router;