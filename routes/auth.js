// routes/auth.js - WITH PROPER ENVIRONMENT HANDLING
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const router = express.Router();

// Initialize Supabase client with validation
let supabase = null;

try {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('❌ Missing Supabase environment variables!');
    console.error('SUPABASE_URL:', !!process.env.SUPABASE_URL);
    console.error('SUPABASE_KEY:', !!process.env.SUPABASE_KEY);
  } else {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    console.log('✅ Supabase client initialized in auth routes');
  }
} catch (error) {
  console.error('❌ Failed to initialize Supabase client:', error);
}

// ==================== AUTH ROUTES WITH DATABASE ====================

/**
 * Check user authentication status
 * GET /api/auth/check/:tg_id
 */
router.get('/check/:tg_id', async (req, res) => {
  try {
    const { tg_id } = req.params;
    const telegramId = parseInt(tg_id);

    console.log(`🔍 Checking auth for user: ${telegramId}`);

    if (isNaN(telegramId) || telegramId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Telegram ID format',
        error_code: 'INVALID_TELEGRAM_ID',
        timestamp: new Date().toISOString()
      });
    }

    // Check if Supabase is available
    if (!supabase) {
      console.error('❌ Supabase client not initialized');
      return res.status(500).json({
        success: false,
        error: 'Database not available',
        error_code: 'DATABASE_NOT_AVAILABLE',
        timestamp: new Date().toISOString()
      });
    }

    // Get user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('tg_id', telegramId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Database error:', error);
      throw error;
    }

    if (!user) {
      // User not found
      console.log(`❌ User ${telegramId} not found in database`);
      return res.json({
        success: true,
        isRegistered: false,
        isApproved: false,
        user: null
      });
    }

    const isApproved = user.status === 'approved';
    
    console.log(`✅ User ${telegramId} found - Status: ${user.status}`);

    return res.json({
      success: true,
      isRegistered: true,
      isApproved: isApproved,
      user: {
        tg_id: user.tg_id,
        name: user.name,
        username: user.username,
        photo_url: user.photo_url,
        registration_date: user.registration_date,
        approval_date: user.approval_date,
        status: user.status,
        is_premium: user.is_premium || false
      }
    });

  } catch (error) {
    console.error('❌ Auth check failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Database connection failed',
      error_code: 'DATABASE_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Register new user
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { tg_id, name, username, photo_url } = req.body;

    console.log(`📝 Registration attempt:`, { tg_id, name, username });

    // Validation
    if (!tg_id || !name) {
      return res.status(400).json({
        success: false,
        error: 'tg_id and name are required',
        error_code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    const telegramId = parseInt(tg_id);
    if (isNaN(telegramId) || telegramId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Telegram ID format',
        error_code: 'INVALID_TELEGRAM_ID',
        timestamp: new Date().toISOString()
      });
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('tg_id, status')
      .eq('tg_id', telegramId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Database check error:', checkError);
      throw checkError;
    }

    if (existingUser) {
      console.log(`⚠️ User ${telegramId} already exists with status: ${existingUser.status}`);
      return res.json({
        success: true,
        message: 'User already registered',
        user_id: telegramId,
        status: existingUser.status
      });
    }

    // Insert new user
    const userData = {
      tg_id: telegramId,
      name: name.trim(),
      username: username || null,
      photo_url: photo_url || null,
      registration_date: new Date().toISOString(),
      status: 'pending'
    };

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Database insert error:', insertError);
      throw insertError;
    }

    console.log(`✅ User ${telegramId} registered successfully in database`);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user_id: newUser.tg_id,
      status: newUser.status
    });

  } catch (error) {
    console.error('❌ Registration failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Registration failed - database error',
      error_code: 'DATABASE_ERROR',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Test database connection
 * GET /api/auth/test-db
 */
router.get('/test-db', async (req, res) => {
  try {
    console.log('🧪 Testing database connection...');
    
    // Test query
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Get total users count
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    console.log('✅ Database connection successful');

    return res.json({
      success: true,
      message: 'Database connection successful',
      total_users: count || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Database test failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Database connection failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get all users (for debugging)
 * GET /api/auth/debug-users
 */
router.get('/debug-users', async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('tg_id, name, username, status, registration_date')
      .order('registration_date', { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      users: users || [],
      count: users?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Debug users failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;