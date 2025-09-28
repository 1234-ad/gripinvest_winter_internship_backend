const express = require('express');
const { sequelize } = require('../config/database');
const { User, InvestmentProduct, Investment, TransactionLog } = require('../models');
const AIService = require('../utils/aiService');
const logger = require('../utils/logger');

const router = express.Router();

// Basic health check
router.get('/', async (req, res) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services: {}
    };

    // Check database connection
    try {
      await sequelize.authenticate();
      healthCheck.services.database = {
        status: 'healthy',
        message: 'Database connection successful'
      };
    } catch (error) {
      healthCheck.status = 'unhealthy';
      healthCheck.services.database = {
        status: 'unhealthy',
        message: 'Database connection failed',
        error: error.message
      };
    }

    // Check AI service
    healthCheck.services.ai = {
      status: AIService.isEnabled() ? 'healthy' : 'disabled',
      message: AIService.isEnabled() ? 'AI service available' : 'AI service not configured'
    };

    // Set appropriate status code
    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json(healthCheck);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error.message
    });
  }
});

// Detailed health check with database statistics
router.get('/detailed', async (req, res) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      services: {},
      database_stats: {}
    };

    // Check database connection and get statistics
    try {
      await sequelize.authenticate();
      
      // Get database statistics
      const [userCount, productCount, investmentCount, logCount] = await Promise.all([
        User.count(),
        InvestmentProduct.count(),
        Investment.count(),
        TransactionLog.count()
      ]);

      healthCheck.services.database = {
        status: 'healthy',
        message: 'Database connection successful'
      };

      healthCheck.database_stats = {
        users: userCount,
        products: productCount,
        investments: investmentCount,
        transaction_logs: logCount
      };

      // Get recent activity (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const [recentUsers, recentInvestments, recentLogs] = await Promise.all([
        User.count({ where: { created_at: { [require('sequelize').Op.gte]: yesterday } } }),
        Investment.count({ where: { invested_at: { [require('sequelize').Op.gte]: yesterday } } }),
        TransactionLog.count({ where: { created_at: { [require('sequelize').Op.gte]: yesterday } } })
      ]);

      healthCheck.recent_activity = {
        new_users_24h: recentUsers,
        new_investments_24h: recentInvestments,
        api_calls_24h: recentLogs
      };

    } catch (error) {
      healthCheck.status = 'unhealthy';
      healthCheck.services.database = {
        status: 'unhealthy',
        message: 'Database connection failed',
        error: error.message
      };
    }

    // Check AI service
    healthCheck.services.ai = {
      status: AIService.isEnabled() ? 'healthy' : 'disabled',
      message: AIService.isEnabled() ? 'AI service available' : 'AI service not configured'
    };

    // Check system resources
    const loadAverage = require('os').loadavg();
    const freeMemory = require('os').freemem();
    const totalMemory = require('os').totalmem();

    healthCheck.system = {
      load_average: loadAverage,
      memory_usage_percentage: Math.round(((totalMemory - freeMemory) / totalMemory) * 100),
      free_memory_mb: Math.round(freeMemory / 1024 / 1024),
      total_memory_mb: Math.round(totalMemory / 1024 / 1024)
    };

    // Set appropriate status code
    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json(healthCheck);
  } catch (error) {
    logger.error('Detailed health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Detailed health check failed',
      message: error.message
    });
  }
});

// Readiness probe (for Kubernetes/Docker)
router.get('/ready', async (req, res) => {
  try {
    // Check if the application is ready to serve requests
    await sequelize.authenticate();
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      message: 'Application is ready to serve requests'
    });
  } catch (error) {
    logger.error('Readiness check error:', error);
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: 'Application not ready',
      message: error.message
    });
  }
});

// Liveness probe (for Kubernetes/Docker)
router.get('/live', (req, res) => {
  // Simple liveness check - if the process is running, it's alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: 'Application is alive'
  });
});

// Database connection test
router.get('/db', async (req, res) => {
  try {
    const startTime = Date.now();
    await sequelize.authenticate();
    const responseTime = Date.now() - startTime;

    // Test a simple query
    const testQuery = await sequelize.query('SELECT 1 as test', { 
      type: require('sequelize').QueryTypes.SELECT 
    });

    res.json({
      status: 'healthy',
      database: 'connected',
      response_time_ms: responseTime,
      test_query_result: testQuery[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Database health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;