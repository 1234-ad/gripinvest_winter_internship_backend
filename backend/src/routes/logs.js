const express = require('express');
const { TransactionLog } = require('../models');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');
const AIService = require('../utils/aiService');
const logger = require('../utils/logger');

const router = express.Router();

// Get user's transaction logs
router.get('/', authenticateToken, validationRules.getLogs, handleValidationErrors, async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      status_code,
      endpoint,
      page = 1,
      limit = 50
    } = req.query;

    const user_id = req.user.id;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const whereClause = { user_id };
    
    if (start_date || end_date) {
      whereClause.created_at = {};
      if (start_date) whereClause.created_at[require('sequelize').Op.gte] = new Date(start_date);
      if (end_date) whereClause.created_at[require('sequelize').Op.lte] = new Date(end_date);
    }
    
    if (status_code) {
      whereClause.status_code = parseInt(status_code);
    }
    
    if (endpoint) {
      whereClause.endpoint = {
        [require('sequelize').Op.like]: `%${endpoint}%`
      };
    }

    // Fetch logs
    const { count, rows: logs } = await TransactionLog.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
      attributes: [
        'id',
        'endpoint',
        'http_method',
        'status_code',
        'error_message',
        'response_time_ms',
        'created_at'
      ]
    });

    res.json({
      message: 'Transaction logs retrieved successfully',
      data: {
        logs,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(count / parseInt(limit)),
          total_items: count,
          items_per_page: parseInt(limit)
        },
        filters: {
          start_date,
          end_date,
          status_code,
          endpoint
        }
      }
    });
  } catch (error) {
    logger.error('Get transaction logs error:', error);
    res.status(500).json({
      error: 'Failed to retrieve transaction logs',
      message: 'Internal server error'
    });
  }
});

// Get error summary for user
router.get('/errors/summary', authenticateToken, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const user_id = req.user.id;

    // Get error summary
    const errorSummary = await TransactionLog.getErrorSummary(user_id, parseInt(days));

    // Get AI analysis of errors
    let aiAnalysis = null;
    if (AIService.isEnabled() && errorSummary.length > 0) {
      try {
        aiAnalysis = await AIService.summarizeErrors(errorSummary);
      } catch (error) {
        logger.error('AI error analysis failed:', error);
      }
    }

    res.json({
      message: 'Error summary retrieved successfully',
      data: {
        period_days: parseInt(days),
        error_summary: errorSummary,
        ai_analysis: aiAnalysis,
        total_error_types: errorSummary.length,
        total_errors: errorSummary.reduce((sum, error) => sum + parseInt(error.count), 0)
      }
    });
  } catch (error) {
    logger.error('Get error summary error:', error);
    res.status(500).json({
      error: 'Failed to retrieve error summary',
      message: 'Internal server error'
    });
  }
});

// Get API usage statistics for user
router.get('/usage/stats', authenticateToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const user_id = req.user.id;

    // Get usage statistics
    const usageStats = await TransactionLog.getApiUsageStats(user_id, parseInt(days));

    // Calculate totals
    const totalRequests = usageStats.reduce((sum, stat) => sum + parseInt(stat.dataValues.total_requests), 0);
    const totalErrors = usageStats.reduce((sum, stat) => sum + parseInt(stat.dataValues.error_count), 0);
    const avgResponseTime = usageStats.length > 0 
      ? usageStats.reduce((sum, stat) => sum + parseFloat(stat.dataValues.avg_response_time || 0), 0) / usageStats.length
      : 0;

    res.json({
      message: 'API usage statistics retrieved successfully',
      data: {
        period_days: parseInt(days),
        usage_by_endpoint: usageStats,
        summary: {
          total_requests: totalRequests,
          total_errors: totalErrors,
          error_rate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
          average_response_time: Math.round(avgResponseTime),
          unique_endpoints: usageStats.length
        }
      }
    });
  } catch (error) {
    logger.error('Get API usage stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve API usage statistics',
      message: 'Internal server error'
    });
  }
});

// Admin: Get all transaction logs
router.get('/admin/all', authenticateToken, requireAdmin, validationRules.getLogs, handleValidationErrors, async (req, res) => {
  try {
    const {
      user_id,
      email,
      start_date,
      end_date,
      status_code,
      endpoint,
      page = 1,
      limit = 100
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const whereClause = {};
    
    if (user_id) whereClause.user_id = user_id;
    if (email) whereClause.email = { [require('sequelize').Op.like]: `%${email}%` };
    
    if (start_date || end_date) {
      whereClause.created_at = {};
      if (start_date) whereClause.created_at[require('sequelize').Op.gte] = new Date(start_date);
      if (end_date) whereClause.created_at[require('sequelize').Op.lte] = new Date(end_date);
    }
    
    if (status_code) whereClause.status_code = parseInt(status_code);
    if (endpoint) whereClause.endpoint = { [require('sequelize').Op.like]: `%${endpoint}%` };

    // Fetch logs
    const { count, rows: logs } = await TransactionLog.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
      include: [{
        model: require('../models').User,
        as: 'user',
        attributes: ['id', 'email', 'first_name', 'last_name'],
        required: false
      }]
    });

    res.json({
      message: 'All transaction logs retrieved successfully',
      data: {
        logs,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(count / parseInt(limit)),
          total_items: count,
          items_per_page: parseInt(limit)
        },
        filters: {
          user_id,
          email,
          start_date,
          end_date,
          status_code,
          endpoint
        }
      }
    });
  } catch (error) {
    logger.error('Get all transaction logs error:', error);
    res.status(500).json({
      error: 'Failed to retrieve transaction logs',
      message: 'Internal server error'
    });
  }
});

// Admin: Get system-wide error analysis
router.get('/admin/errors/analysis', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get error statistics
    const errorStats = await TransactionLog.findAll({
      where: {
        status_code: {
          [require('sequelize').Op.gte]: 400
        },
        created_at: {
          [require('sequelize').Op.gte]: startDate
        }
      },
      attributes: [
        'endpoint',
        'http_method',
        'status_code',
        'error_message',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
        [require('sequelize').fn('COUNT', require('sequelize').fn('DISTINCT', require('sequelize').col('user_id'))), 'affected_users']
      ],
      group: ['endpoint', 'http_method', 'status_code', 'error_message'],
      order: [[require('sequelize').fn('COUNT', require('sequelize').col('id')), 'DESC']],
      limit: 50,
      raw: true
    });

    // Get AI analysis
    let aiAnalysis = null;
    if (AIService.isEnabled() && errorStats.length > 0) {
      try {
        aiAnalysis = await AIService.summarizeErrors(errorStats);
      } catch (error) {
        logger.error('AI system error analysis failed:', error);
      }
    }

    // Calculate summary metrics
    const totalErrors = errorStats.reduce((sum, stat) => sum + parseInt(stat.count), 0);
    const totalAffectedUsers = errorStats.reduce((sum, stat) => sum + parseInt(stat.affected_users), 0);
    const mostCommonError = errorStats[0];

    res.json({
      message: 'System error analysis retrieved successfully',
      data: {
        period_days: parseInt(days),
        error_statistics: errorStats,
        ai_analysis: aiAnalysis,
        summary: {
          total_errors: totalErrors,
          total_affected_users: totalAffectedUsers,
          unique_error_types: errorStats.length,
          most_common_error: mostCommonError
        }
      }
    });
  } catch (error) {
    logger.error('Get system error analysis error:', error);
    res.status(500).json({
      error: 'Failed to retrieve system error analysis',
      message: 'Internal server error'
    });
  }
});

// Admin: Get system performance metrics
router.get('/admin/performance', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get performance metrics
    const performanceStats = await TransactionLog.findAll({
      where: {
        created_at: {
          [require('sequelize').Op.gte]: startDate
        },
        response_time_ms: {
          [require('sequelize').Op.not]: null
        }
      },
      attributes: [
        'endpoint',
        'http_method',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'total_requests'],
        [require('sequelize').fn('AVG', require('sequelize').col('response_time_ms')), 'avg_response_time'],
        [require('sequelize').fn('MIN', require('sequelize').col('response_time_ms')), 'min_response_time'],
        [require('sequelize').fn('MAX', require('sequelize').col('response_time_ms')), 'max_response_time'],
        [require('sequelize').fn('SUM', require('sequelize').literal('CASE WHEN status_code >= 400 THEN 1 ELSE 0 END')), 'error_count']
      ],
      group: ['endpoint', 'http_method'],
      order: [[require('sequelize').fn('AVG', require('sequelize').col('response_time_ms')), 'DESC']],
      raw: true
    });

    // Calculate overall metrics
    const totalRequests = performanceStats.reduce((sum, stat) => sum + parseInt(stat.total_requests), 0);
    const totalErrors = performanceStats.reduce((sum, stat) => sum + parseInt(stat.error_count), 0);
    const avgResponseTime = performanceStats.length > 0
      ? performanceStats.reduce((sum, stat) => sum + parseFloat(stat.avg_response_time), 0) / performanceStats.length
      : 0;

    res.json({
      message: 'System performance metrics retrieved successfully',
      data: {
        period_days: parseInt(days),
        performance_by_endpoint: performanceStats,
        summary: {
          total_requests: totalRequests,
          total_errors: totalErrors,
          error_rate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
          average_response_time: Math.round(avgResponseTime),
          unique_endpoints: performanceStats.length
        }
      }
    });
  } catch (error) {
    logger.error('Get system performance metrics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve system performance metrics',
      message: 'Internal server error'
    });
  }
});

module.exports = router;