// app.js - STEP 1: Adding Auth Routes
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import auth routes
import authRoutes from './routes/auth.js';

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ==================== BASIC MIDDLEWARE ====================

// CORS
app.use(cors({
  origin: ['http://localhost:5173', 'https://yuldagilar.vercel.app'],
  credentials: true
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ==================== ROUTES ====================

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Yoldagilar Challenge API',
    version: '2.0.0',
    status: 'step_1_auth_routes',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    available_routes: [
      'GET /',
      'GET /ping',
      'GET /api/health',
      'GET /api/test-db',
      'GET /api/env',
      'GET /api/auth/check/:tg_id',
      'POST /api/auth/register'
    ]
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '2.0.0'
  });
});

// Ping endpoint
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString() 
  });
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Supabase credentials not found in environment'
      });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({
      success: true,
      message: 'Database connection successful',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Environment info
app.get('/api/env', (req, res) => {
  res.json({
    node_version: process.version,
    platform: process.platform,
    environment: process.env.NODE_ENV || 'development',
    has_supabase_url: !!process.env.SUPABASE_URL,
    has_supabase_key: !!process.env.SUPABASE_KEY,
    has_bot_token: !!process.env.BOT_TOKEN,
    timestamp: new Date().toISOString()
  });
});

// ==================== AUTH ROUTES ====================

// Mount auth routes
app.use('/api/auth', authRoutes);

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.path}`,
    available_endpoints: [
      'GET /',
      'GET /ping', 
      'GET /api/health',
      'GET /api/test-db',
      'GET /api/env',
      'GET /api/auth/check/:tg_id',
      'POST /api/auth/register'
    ],
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// ==================== SERVER STARTUP ====================

app.listen(PORT, () => {
  console.log('\n🎉 STEP 1: AUTH ROUTES ADDED!');
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth Check: http://localhost:${PORT}/api/auth/check/123456789`);
  console.log('\n📡 New Auth Endpoints:');
  console.log('   GET  /api/auth/check/:tg_id   - Check user');
  console.log('   POST /api/auth/register       - Register user');
  console.log('\n🛑 To stop: Ctrl + C\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Server stopping...');
  process.exit(0);
});

export default app;