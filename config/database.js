// config/database.js - SUPABASE DATABASE CONFIGURATION
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

// Environment variables validation
function validateSupabaseConfig() {
  const required = ['SUPABASE_URL', 'SUPABASE_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required Supabase environment variables: ${missing.join(', ')}`);
  }

  // Validate URL format
  try {
    new URL(process.env.SUPABASE_URL);
  } catch (error) {
    throw new Error('Invalid SUPABASE_URL format');
  }

  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY
  };
}

// Initialize Supabase client
let supabase = null;

try {
  const config = validateSupabaseConfig();
  
  supabase = createClient(config.url, config.key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'X-Client-Info': 'yoldagilar-backend@2.0.0'
      }
    }
  });

  logger.info('📊 Supabase client initialized');
} catch (error) {
  logger.error('❌ Supabase initialization failed:', error.message);
  process.exit(1);
}

/**
 * Test database connection
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function testDatabaseConnection() {
  try {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    logger.info('🔍 Testing database connection...');
    
    // Test with a simple query
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    // PGRST116 means table is empty, which is fine
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    logger.success('✅ Database connection test successful');
    return { success: true };
    
  } catch (error) {
    logger.error('❌ Database connection test failed:', error.message);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Get database health status
 * @returns {Promise<Object>}
 */
export async function getDatabaseHealth() {
  try {
    const startTime = Date.now();
    
    // Test query performance
    const { data, error } = await supabase
      .from('users')
      .select('tg_id')
      .limit(1);
    
    const responseTime = Date.now() - startTime;
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Get some basic stats
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { count: progressCount } = await supabase
      .from('daily_progress')
      .select('*', { count: 'exact', head: true });

    return {
      status: 'healthy',
      response_time_ms: responseTime,
      tables: {
        users: userCount || 0,
        daily_progress: progressCount || 0
      },
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('❌ Database health check failed:', error.message);
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Create database tables if they don't exist
 * @returns {Promise<boolean>}
 */
export async function initializeTables() {
  try {
    logger.info('🏗️ Initializing database tables...');

    // Users table
    const { error: usersError } = await supabase.rpc('create_users_table_if_not_exists');
    if (usersError && !usersError.message.includes('already exists')) {
      logger.warn('⚠️ Users table initialization:', usersError.message);
    }

    // Daily progress table  
    const { error: progressError } = await supabase.rpc('create_daily_progress_table_if_not_exists');
    if (progressError && !progressError.message.includes('already exists')) {
      logger.warn('⚠️ Daily progress table initialization:', progressError.message);
    }

    logger.success('✅ Database tables initialized');
    return true;

  } catch (error) {
    logger.error('❌ Database table initialization failed:', error.message);
    return false;
  }
}

/**
 * Execute raw SQL query (admin only)
 * @param {string} query - SQL query
 * @returns {Promise<Object>}
 */
export async function executeRawQuery(query) {
  try {
    const { data, error } = await supabase.rpc('execute_sql', { query });
    
    if (error) {
      throw error;
    }

    return { success: true, data };
    
  } catch (error) {
    logger.error('❌ Raw query execution failed:', error.message);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Get database statistics
 * @returns {Promise<Object>}
 */
export async function getDatabaseStats() {
  try {
    const stats = await Promise.all([
      // Total users
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true }),
      
      // Approved users
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved'),
      
      // Today's submissions
      supabase
        .from('daily_progress')
        .select('*', { count: 'exact', head: true })
        .eq('date', new Date().toISOString().split('T')[0]),
      
      // Total progress entries
      supabase
        .from('daily_progress')
        .select('*', { count: 'exact', head: true })
    ]);

    return {
      total_users: stats[0].count || 0,
      approved_users: stats[1].count || 0,
      pending_users: (stats[0].count || 0) - (stats[1].count || 0),
      today_submissions: stats[2].count || 0,
      total_progress_entries: stats[3].count || 0,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('❌ Database stats query failed:', error.message);
    return {
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

export { supabase };
export default supabase;