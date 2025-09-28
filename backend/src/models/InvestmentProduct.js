const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InvestmentProduct = sequelize.define('InvestmentProduct', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  investment_type: {
    type: DataTypes.ENUM('bond', 'fd', 'mf', 'etf', 'other'),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  tenure_months: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 600 // 50 years max
    }
  },
  annual_yield: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    validate: {
      min: 0,
      max: 100
    }
  },
  risk_level: {
    type: DataTypes.ENUM('low', 'moderate', 'high'),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  min_investment: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 1000.00,
    validate: {
      min: 0
    }
  },
  max_investment: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    validate: {
      min: 0
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'investment_products',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  validate: {
    maxInvestmentGreaterThanMin() {
      if (this.max_investment && this.max_investment <= this.min_investment) {
        throw new Error('Maximum investment must be greater than minimum investment');
      }
    }
  }
});

// Instance methods
InvestmentProduct.prototype.calculateExpectedReturn = function(amount, months = null) {
  const tenureMonths = months || this.tenure_months;
  const monthlyRate = this.annual_yield / 100 / 12;
  return amount * Math.pow(1 + monthlyRate, tenureMonths);
};

InvestmentProduct.prototype.isValidInvestmentAmount = function(amount) {
  if (amount < this.min_investment) return false;
  if (this.max_investment && amount > this.max_investment) return false;
  return true;
};

// Class methods
InvestmentProduct.findByType = function(type) {
  return this.findAll({ 
    where: { 
      investment_type: type,
      is_active: true 
    } 
  });
};

InvestmentProduct.findByRiskLevel = function(riskLevel) {
  return this.findAll({ 
    where: { 
      risk_level: riskLevel,
      is_active: true 
    } 
  });
};

InvestmentProduct.getRecommendations = function(userRiskAppetite, limit = 5) {
  return this.findAll({
    where: {
      risk_level: userRiskAppetite,
      is_active: true
    },
    order: [['annual_yield', 'DESC']],
    limit
  });
};

module.exports = InvestmentProduct;