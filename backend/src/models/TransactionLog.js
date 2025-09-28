const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TransactionLog = sequelize.define('TransactionLog', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  endpoint: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  http_method: {
    type: DataTypes.ENUM('GET', 'POST', 'PUT', 'DELETE'),
    allowNull: false
  },
  status_code: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  request_body: {
    type: DataTypes.JSON,
    allowNull: true
  },
  response_time_ms: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'transaction_logs',
  timestamps: false,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['email']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['status_code']
    },
    {
      fields: ['endpoint']
    }
  ]
});

// Class methods
TransactionLog.logTransaction = async function(logData) {
  try {
    return await this.create(logData);
  } catch (error) {
    console.error('Failed to log transaction:', error);
    // Don't throw error to avoid breaking the main request
  }
};

TransactionLog.findByUser = function(userId, options = {}) {
  const { limit = 50, offset = 0, startDate, endDate } = options;
  
  const whereClause = { user_id: userId };
  
  if (startDate || endDate) {
    whereClause.created_at = {};
    if (startDate) whereClause.created_at[sequelize.Op.gte] = startDate;
    if (endDate) whereClause.created_at[sequelize.Op.lte] = endDate;
  }
  
  return this.findAll({
    where: whereClause,
    order: [['created_at', 'DESC']],
    limit,
    offset
  });
};

TransactionLog.findByEmail = function(email, options = {}) {
  const { limit = 50, offset = 0 } = options;
  
  return this.findAll({
    where: { email },
    order: [['created_at', 'DESC']],
    limit,
    offset
  });
};

TransactionLog.getErrorSummary = async function(userId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const errors = await this.findAll({
    where: {
      user_id: userId,
      status_code: {
        [sequelize.Op.gte]: 400
      },
      created_at: {
        [sequelize.Op.gte]: startDate
      }
    },
    attributes: [
      'endpoint',
      'http_method',
      'status_code',
      'error_message',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['endpoint', 'http_method', 'status_code', 'error_message'],
    order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']]
  });
  
  return errors;
};

TransactionLog.getApiUsageStats = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const stats = await this.findAll({
    where: {
      user_id: userId,
      created_at: {
        [sequelize.Op.gte]: startDate
      }
    },
    attributes: [
      'endpoint',
      'http_method',
      [sequelize.fn('COUNT', sequelize.col('id')), 'total_requests'],
      [sequelize.fn('AVG', sequelize.col('response_time_ms')), 'avg_response_time'],
      [sequelize.fn('SUM', sequelize.literal('CASE WHEN status_code >= 400 THEN 1 ELSE 0 END')), 'error_count']
    ],
    group: ['endpoint', 'http_method'],
    order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']]
  });
  
  return stats;
};

module.exports = TransactionLog;