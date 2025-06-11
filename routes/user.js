// routes/user.js - USER MANAGEMENT ROUTES
import express from 'express';
import multer from 'multer';
import { userController } from '../controllers/userController.js';
import { responseService } from '../services/responseService.js';
import { 
  validateTelegramId, 
  validatePhotoUpload,
  validateFileUpload 
} from '../middleware/validation.js';
import config from '../config/config.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.MAX_FILE_SIZE,
    files: 1
  }
});

// ==================== USER ROUTES ====================

/**
 * Get user statistics
 * GET /api/user/statistics/:tg_id
 */
router.get('/statistics/:tg_id',
  validateTelegramId,
  responseService.asyncResponse(userController.getUserStatistics)
);

/**
 * Get user profile by ID
 * GET /api/user/profile/:user_id
 */
router.get('/profile/:tg_id',
  validateTelegramId,
  responseService.asyncResponse(userController.getUserProfile)
);

/**
 * Upload user profile photo
 * POST /api/user/upload-photo
 */
router.post('/upload-photo',
  upload.single('photo'),
  validatePhotoUpload,
  validateFileUpload(config.ALLOWED_FILE_TYPES, config.MAX_FILE_SIZE),
  responseService.asyncResponse(userController.uploadPhoto)
);

/**
 * Update user preferences
 * PATCH /api/user/preferences/:tg_id
 */
router.patch('/preferences/:tg_id',
  validateTelegramId,
  responseService.asyncResponse(userController.updatePreferences)
);

/**
 * Get user achievements
 * GET /api/user/achievements/:tg_id
 */
router.get('/achievements/:tg_id',
  validateTelegramId,
  responseService.asyncResponse(userController.getUserAchievements)
);

/**
 * Get user activity history
 * GET /api/user/activity/:tg_id
 */
router.get('/activity/:tg_id',
  validateTelegramId,
  responseService.asyncResponse(userController.getUserActivity)
);

/**
 * Delete user account
 * DELETE /api/user/account/:tg_id
 */
router.delete('/account/:tg_id',
  validateTelegramId,
  responseService.asyncResponse(userController.deleteAccount)
);

export default router;