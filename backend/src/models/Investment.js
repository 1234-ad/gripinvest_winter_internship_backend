const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Investment = sequelize.define('Investment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  product_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'investment_products',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  invested_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  status: {
    type: DataTypes.ENUM('active', 'matured', 'cancelled'),
    defaultValue: 'active',
    allowNull: false
  },
  expected_return: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  actual_return: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  maturity_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'investments',
  timestamps: false,
  hooks: {
    beforeCreate: async (investment) => {
      // Calculate maturity date and expected return
      const product = await sequelize.models.InvestmentProduct.findByPk(investment.product_id);
      if (product) {
        const maturityDate = new Date(investment.invested_at);
        maturityDate.setMonth(maturityDate.getMonth() + product.tenure_months);
        investment.maturity_date = maturityDate;
        
        investment.expected_return = product.calculateExpectedReturn(investment.amount);
      }
    }
  }
});

// Instance methods
Investment.prototype.getCurrentValue = function() {
  if (this.status === 'matured' && this.actual_return) {
    return this.actual_return;
  }
  
  // Calculate current value based on time elapsed
  const now = new Date();
  const investedDate = new Date(this.invested_at);
  const maturityDate = new Date(this.maturity_date);
  
  const totalDuration = maturityDate.getTime() - investedDate.getTime();
  const elapsedDuration = now.getTime() - investedDate.getTime();
  
  if (elapsedDuration <= 0) return this.amount;
  if (elapsedDuration >= totalDuration) return this.expected_return;
  
  const progress = elapsedDuration / totalDuration;
  const currentValue = this.amount + (this.expected_return - this.amount) * progress;
  
  return Math.round(currentValue * 100) / 100;
};

Investment.prototype.getGainLoss = function() {
  const currentValue = this.getCurrentValue();
  return {
    absolute: currentValue - this.amount,
    percentage: ((currentValue - this.amount) / this.amount) * 100
  };
};

Investment.prototype.getDaysToMaturity = function() {
  if (this.status === 'matured') return 0;
  
  const now = new Date();
  const maturityDate = new Date(this.maturity_date);
  const diffTime = maturityDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
};

// Class methods
Investment.findByUser = function(userId) {
  return this.findAll({
    where: { user_id: userId },
    include: [{
      model: sequelize.models.InvestmentProduct,
      as: 'product'
    }],
    order: [['invested_at', 'DESC']]
  });
};

Investment.getUserPortfolioValue = async function(userId) {
  const investments = await this.findByUser(userId);
  
  let totalInvested = 0;
  let currentValue = 0;
  
  investments.forEach(investment => {
    totalInvested += parseFloat(investment.amount);
    currentValue += investment.getCurrentValue();
  });
  
  return {
    totalInvested,
    currentValue,
    totalGain: currentValue - totalInvested,
    totalGainPercentage: totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0,
    investmentCount: investments.length
  };
};

module.exports = Investment;