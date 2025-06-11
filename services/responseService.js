// services/responseService.js - STANDARDIZED API RESPONSES
import { logger } from '../utils/logger.js';

/**
 * Response Service for consistent API responses
 * Matches frontend API service expectations
 */
class ResponseService {
  /**
   * Send success response
   * @param {Object} res - Express response object
   * @param {Object} data - Response data
   * @param {number} statusCode - HTTP status code
   * @param {Object} meta - Additional metadata
   */
  success(res, data = {}, statusCode = 200, meta = {}) {
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      ...data,
      ...meta
    };

    // Log API response for debugging
    logger.api(res.req.path, response, res.locals.responseTime || 0);

    return res.status(statusCode).json(response);
  }

  /**
   * Send error response
   * @param {Object} res - Express response object
   * @param {string} error - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} errorCode - Application error code
   * @param {Object} details - Additional error details
   */
  error(res, error, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) {
    const response = {
      success: false,
      error,
      error_code: errorCode,
      timestamp: new Date().toISOString(),
      ...(details && { details })
    };

    // Log error response
    logger.error('API Error Response:', {
      path: res.req.path,
      method: res.req.method,
      statusCode,
      error,
      errorCode
    });

    return res.status(statusCode).json(response);
  }

  /**
   * Send validation error response
   * @param {Object} res - Express response object
   * @param {string} message - Main error message
   * @param {Object} errors - Field-specific errors
   */
  validationError(res, message = 'Validation failed', errors = {}) {
    const response = {
      success: false,
      error: message,
      error_code: 'VALIDATION_ERROR',
      errors,
      timestamp: new Date().toISOString()
    };

    return res.status(400).json(response);
  }

  /**
   * Send not found response
   * @param {Object} res - Express response object
   * @param {string} resource - Resource name that wasn't found
   */
  notFound(res, resource = 'Resource') {
    return this.error(
      res,
      `${resource} not found`,
      404,
      'NOT_FOUND'
    );
  }

  /**
   * Send unauthorized response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   */
  unauthorized(res, message = 'Authentication required') {
    return this.error(
      res,
      message,
      401,
      'UNAUTHORIZED'
    );
  }

  /**
   * Send forbidden response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   */
  forbidden(res, message = 'Access forbidden') {
    return this.error(
      res,
      message,
      403,
      'FORBIDDEN'
    );
  }

  /**
   * Send paginated response
   * @param {Object} res - Express response object
   * @param {Array} data - Array of items
   * @param {Object} pagination - Pagination info
   */
  paginated(res, data, pagination = {}) {
    const {
      page = 1,
      limit = 50,
      total = data.length,
      totalPages = Math.ceil(total / limit)
    } = pagination;

    const response = {
      success: true,
      data,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total_items: total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      },
      timestamp: new Date().toISOString()
    };

    // Add pagination headers
    res.set({
      'X-Total-Count': total,
      'X-Page-Count': totalPages,
      'X-Current-Page': page,
      'X-Per-Page': limit
    });

    return res.json(response);
  }

  // ==================== SPECIFIC RESPONSE FORMATS ====================

  /**
   * Auth check response format
   * @param {Object} res - Express response
   * @param {boolean} isRegistered - User registration status
   * @param {boolean} isApproved - User approval status
   * @param {Object} user - User data
   */
  authCheck(res, isRegistered, isApproved, user = null) {
    return this.success(res, {
      isRegistered,
      isApproved,
      user
    });
  }

  /**
   * User registration response
   * @param {Object} res - Express response
   * @param {number} userId - User ID
   * @param {string} status - Registration status
   * @param {string} message - Success message
   */
  userRegistered(res, userId, status, message = 'User registered successfully') {
    return this.success(res, {
      message,
      user_id: userId,
      status
    }, 201);
  }

  /**
   * User statistics response
   * @param {Object} res - Express response
   * @param {Object} todayStats - Today's statistics
   * @param {Object} allTimeStats - All-time statistics
   */
  userStatistics(res, todayStats, allTimeStats) {
    return this.success(res, {
      today: {
        completed: todayStats.completed || 0,
        pages_read: todayStats.pages_read || 0,
        distance_km: todayStats.distance_km || 0,
        date: todayStats.date || new Date().toISOString().split('T')[0]
      },
      all_time: {
        total_points: allTimeStats.total_points || 0,
        total_pages: allTimeStats.total_pages || 0,
        total_distance: allTimeStats.total_distance || 0,
        total_days: allTimeStats.total_days || 0
      }
    });
  }

  /**
   * Daily tasks response
   * @param {Object} res - Express response
   * @param {string} date - Date
   * @param {Object} tasks - Task completion status
   * @param {Object} taskInputs - Task input values
   * @param {number} pagesRead - Pages read
   * @param {number} distanceKm - Distance in km
   * @param {number} completedCount - Number of completed tasks
   * @param {boolean} isSubmittedToday - Whether submitted today
   * @param {string} submissionTime - Submission timestamp
   */
  dailyTasks(res, date, tasks, taskInputs, pagesRead, distanceKm, completedCount, isSubmittedToday, submissionTime) {
    return this.success(res, {
      date,
      tasks,
      task_inputs: taskInputs,
      pages_read: pagesRead,
      distance_km: distanceKm,
      completed_count: completedCount,
      is_submitted_today: isSubmittedToday,
      submission_time: submissionTime
    });
  }

  /**
   * Task submission response
   * @param {Object} res - Express response
   * @param {number} totalPoints - Total points earned
   * @param {Object} todayData - Today's data summary
   * @param {Object} achievementUnlocked - Any achievement unlocked
   * @param {string} submissionTime - Submission timestamp
   * @param {string} message - Success message
   */
  taskSubmission(res, totalPoints, todayData, achievementUnlocked = null, submissionTime, message = 'Data saved successfully') {
    return this.success(res, {
      message,
      total_points: totalPoints,
      today_data: todayData,
      achievement_unlocked: achievementUnlocked,
      submission_time: submissionTime
    });
  }

  /**
   * Leaderboard response
   * @param {Object} res - Express response
   * @param {Array} leaderboard - Leaderboard data
   * @param {number} totalParticipants - Total participants
   */
  leaderboard(res, leaderboard, totalParticipants) {
    return this.success(res, {
      total_participants: totalParticipants,
      leaderboard
    });
  }

  /**
   * Photo upload response
   * @param {Object} res - Express response
   * @param {string} photoUrl - Uploaded photo URL
   * @param {number} fileSize - File size in bytes
   * @param {string} uploadTime - Upload timestamp
   * @param {string} message - Success message
   */
  photoUpload(res, photoUrl, fileSize, uploadTime, message = 'Photo uploaded successfully') {
    return this.success(res, {
      message,
      photo_url: photoUrl,
      file_size: fileSize,
      upload_time: uploadTime
    });
  }

  /**
   * Admin pending users response
   * @param {Object} res - Express response
   * @param {Array} pendingUsers - Pending users list
   * @param {number} totalPending - Total pending count
   */
  pendingUsers(res, pendingUsers, totalPending) {
    return this.success(res, {
      pending_users: pendingUsers,
      total_pending: totalPending
    });
  }

  /**
   * Health check response
   * @param {Object} res - Express response
   * @param {string} status - Health status
   * @param {Object} services - Service statuses
   * @param {Object} config - Configuration info
   */
  healthCheck(res, status, services = {}, config = {}) {
    const statusCode = status === 'healthy' ? 200 : 503;
    
    return res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      services,
      config
    });
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Format user object for API response
   * @param {Object} user - Raw user object from database
   * @returns {Object} Formatted user object
   */
  formatUser(user) {
    if (!user) return null;

    return {
      tg_id: user.tg_id,
      name: user.name,
      username: user.username,
      photo_url: user.photo_url,
      registration_date: user.registration_date,
      approval_date: user.approval_date,
      status: user.status,
      is_premium: user.is_premium || false
    };
  }

  /**
   * Format leaderboard participant
   * @param {Object} participant - Raw participant data
   * @param {number} rank - Participant rank
   * @returns {Object} Formatted participant
   */
  formatLeaderboardParticipant(participant, rank) {
    return {
      tg_id: participant.tg_id,
      name: participant.name,
      rank,
      score: participant.score,
      total_points: participant.total_points,
      total_pages: participant.total_pages,
      total_distance: participant.total_distance,
      photo_url: participant.photo_url,
      achievements: participant.achievements || [],
      is_premium: participant.is_premium || false
    };
  }

  /**
   * Create response with execution time
   * @param {Object} res - Express response
   * @param {number} startTime - Request start time
   * @param {Object} data - Response data
   */
  withExecutionTime(res, startTime, data) {
    const executionTime = Date.now() - startTime;
    
    return this.success(res, {
      ...data,
      execution_time_ms: executionTime
    });
  }

  /**
   * Handle async controller responses
   * @param {Function} controllerFn - Async controller function
   * @returns {Function} Express middleware
   */
  asyncResponse(controllerFn) {
    return async (req, res, next) => {
      const startTime = Date.now();
      res.locals.responseTime = startTime;
      
      try {
        await controllerFn(req, res, next);
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Create standard API wrapper
   * @param {Function} serviceCall - Service function to call
   * @param {Function} responseFormatter - Response formatter function
   * @returns {Function} Express middleware
   */
  standardApiWrapper(serviceCall, responseFormatter) {
    return this.asyncResponse(async (req, res) => {
      const result = await serviceCall(req);
      responseFormatter(res, result);
    });
  }
}

// Export singleton instance
export const responseService = new ResponseService();
export default responseService;