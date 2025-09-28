const express = require('express');
const { Investment, InvestmentProduct } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const AIService = require('../utils/aiService');
const logger = require('../utils/logger');

const router = express.Router();

// Get portfolio overview
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    // Get portfolio value using the model method
    const portfolioValue = await Investment.getUserPortfolioValue(user_id);

    // Get all investments with product details
    const investments = await Investment.findAll({
      where: { user_id },
      include: [{
        model: InvestmentProduct,
        as: 'product'
      }],
      order: [['invested_at', 'DESC']]
    });

    // Enrich investments with calculated values
    const enrichedInvestments = investments.map(investment => ({
      ...investment.toJSON(),
      current_value: investment.getCurrentValue(),
      gain_loss: investment.getGainLoss(),
      days_to_maturity: investment.getDaysToMaturity()
    }));

    // Calculate additional metrics
    const activeInvestments = investments.filter(inv => inv.status === 'active');
    const maturedInvestments = investments.filter(inv => inv.status === 'matured');
    
    // Calculate diversification metrics
    const typeDistribution = {};
    const riskDistribution = {};
    
    investments.forEach(investment => {
      const type = investment.product.investment_type;
      const risk = investment.product.risk_level;
      const amount = parseFloat(investment.amount);
      
      typeDistribution[type] = (typeDistribution[type] || 0) + amount;
      riskDistribution[risk] = (riskDistribution[risk] || 0) + amount;
    });

    // Get AI insights
    let aiInsights = null;
    if (AIService.isEnabled() && portfolioValue.totalInvested > 0) {
      try {
        aiInsights = await AIService.getPortfolioInsights(portfolioValue);
      } catch (error) {
        logger.error('AI portfolio insights failed:', error);
      }
    }

    res.json({
      message: 'Portfolio retrieved successfully',
      data: {
        portfolio_value: portfolioValue,
        investments: enrichedInvestments,
        metrics: {
          active_investments_count: activeInvestments.length,
          matured_investments_count: maturedInvestments.length,
          average_investment_amount: portfolioValue.investmentCount > 0 
            ? portfolioValue.totalInvested / portfolioValue.investmentCount 
            : 0,
          diversification: {
            by_type: typeDistribution,
            by_risk: riskDistribution
          }
        },
        ai_insights: aiInsights
      }
    });
  } catch (error) {
    logger.error('Get portfolio error:', error);
    res.status(500).json({
      error: 'Failed to retrieve portfolio',
      message: 'Internal server error'
    });
  }
});

// Get portfolio performance over time
router.get('/performance', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { period = '1y' } = req.query;

    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '1m':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '3m':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '6m':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case '2y':
        startDate.setFullYear(startDate.getFullYear() - 2);
        break;
      default:
        startDate.setFullYear(startDate.getFullYear() - 1);
    }

    // Get investments within the period
    const investments = await Investment.findAll({
      where: {
        user_id,
        invested_at: {
          [require('sequelize').Op.gte]: startDate
        }
      },
      include: [{
        model: InvestmentProduct,
        as: 'product'
      }],
      order: [['invested_at', 'ASC']]
    });

    // Calculate performance data points
    const performanceData = [];
    let cumulativeInvested = 0;
    let cumulativeValue = 0;

    // Group investments by month for performance tracking
    const monthlyData = {};
    
    investments.forEach(investment => {
      const investmentDate = new Date(investment.invested_at);
      const monthKey = `${investmentDate.getFullYear()}-${String(investmentDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          date: monthKey,
          invested: 0,
          current_value: 0,
          count: 0
        };
      }
      
      monthlyData[monthKey].invested += parseFloat(investment.amount);
      monthlyData[monthKey].current_value += investment.getCurrentValue();
      monthlyData[monthKey].count++;
    });

    // Convert to array and calculate cumulative values
    Object.keys(monthlyData).sort().forEach(monthKey => {
      const monthData = monthlyData[monthKey];
      cumulativeInvested += monthData.invested;
      cumulativeValue += monthData.current_value;
      
      performanceData.push({
        date: monthKey,
        invested_amount: monthData.invested,
        current_value: monthData.current_value,
        cumulative_invested: cumulativeInvested,
        cumulative_value: cumulativeValue,
        monthly_gain: monthData.current_value - monthData.invested,
        cumulative_gain: cumulativeValue - cumulativeInvested,
        investment_count: monthData.count
      });
    });

    res.json({
      message: 'Portfolio performance retrieved successfully',
      data: {
        period,
        performance_data: performanceData,
        summary: {
          total_invested: cumulativeInvested,
          current_value: cumulativeValue,
          total_gain: cumulativeValue - cumulativeInvested,
          total_gain_percentage: cumulativeInvested > 0 
            ? ((cumulativeValue - cumulativeInvested) / cumulativeInvested) * 100 
            : 0
        }
      }
    });
  } catch (error) {
    logger.error('Get portfolio performance error:', error);
    res.status(500).json({
      error: 'Failed to retrieve portfolio performance',
      message: 'Internal server error'
    });
  }
});

// Get portfolio allocation breakdown
router.get('/allocation', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    const investments = await Investment.findAll({
      where: { user_id, status: 'active' },
      include: [{
        model: InvestmentProduct,
        as: 'product'
      }]
    });

    // Calculate allocations
    const typeAllocation = {};
    const riskAllocation = {};
    const tenureAllocation = {};
    let totalValue = 0;

    investments.forEach(investment => {
      const currentValue = investment.getCurrentValue();
      const type = investment.product.investment_type;
      const risk = investment.product.risk_level;
      const tenure = investment.product.tenure_months;
      
      totalValue += currentValue;
      
      // By type
      typeAllocation[type] = (typeAllocation[type] || 0) + currentValue;
      
      // By risk
      riskAllocation[risk] = (riskAllocation[risk] || 0) + currentValue;
      
      // By tenure (group into ranges)
      let tenureRange;
      if (tenure <= 12) tenureRange = '0-12 months';
      else if (tenure <= 24) tenureRange = '13-24 months';
      else if (tenure <= 36) tenureRange = '25-36 months';
      else tenureRange = '37+ months';
      
      tenureAllocation[tenureRange] = (tenureAllocation[tenureRange] || 0) + currentValue;
    });

    // Convert to percentages
    const convertToPercentages = (allocation) => {
      const result = {};
      Object.keys(allocation).forEach(key => {
        result[key] = {
          value: allocation[key],
          percentage: totalValue > 0 ? (allocation[key] / totalValue) * 100 : 0
        };
      });
      return result;
    };

    res.json({
      message: 'Portfolio allocation retrieved successfully',
      data: {
        total_portfolio_value: totalValue,
        allocation: {
          by_type: convertToPercentages(typeAllocation),
          by_risk: convertToPercentages(riskAllocation),
          by_tenure: convertToPercentages(tenureAllocation)
        },
        diversification_score: calculateDiversificationScore(typeAllocation, riskAllocation)
      }
    });
  } catch (error) {
    logger.error('Get portfolio allocation error:', error);
    res.status(500).json({
      error: 'Failed to retrieve portfolio allocation',
      message: 'Internal server error'
    });
  }
});

// Get upcoming maturities
router.get('/maturities', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { days = 30 } = req.query;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const upcomingMaturities = await Investment.findAll({
      where: {
        user_id,
        status: 'active',
        maturity_date: {
          [require('sequelize').Op.lte]: futureDate
        }
      },
      include: [{
        model: InvestmentProduct,
        as: 'product'
      }],
      order: [['maturity_date', 'ASC']]
    });

    const enrichedMaturities = upcomingMaturities.map(investment => ({
      ...investment.toJSON(),
      current_value: investment.getCurrentValue(),
      expected_return: investment.expected_return,
      days_to_maturity: investment.getDaysToMaturity(),
      gain_loss: investment.getGainLoss()
    }));

    const totalMaturityValue = enrichedMaturities.reduce(
      (sum, inv) => sum + parseFloat(inv.expected_return || inv.current_value), 
      0
    );

    res.json({
      message: 'Upcoming maturities retrieved successfully',
      data: {
        period_days: parseInt(days),
        upcoming_maturities: enrichedMaturities,
        summary: {
          count: enrichedMaturities.length,
          total_maturity_value: totalMaturityValue
        }
      }
    });
  } catch (error) {
    logger.error('Get upcoming maturities error:', error);
    res.status(500).json({
      error: 'Failed to retrieve upcoming maturities',
      message: 'Internal server error'
    });
  }
});

// Helper function to calculate diversification score
function calculateDiversificationScore(typeAllocation, riskAllocation) {
  const typeCount = Object.keys(typeAllocation).length;
  const riskCount = Object.keys(riskAllocation).length;
  
  // Simple diversification score based on number of types and risk levels
  // Max score is 100 (5 types * 3 risk levels = 15, normalized to 100)
  const maxTypes = 5;
  const maxRisks = 3;
  
  const typeScore = Math.min(typeCount / maxTypes, 1) * 60; // 60% weight for type diversity
  const riskScore = Math.min(riskCount / maxRisks, 1) * 40; // 40% weight for risk diversity
  
  return Math.round(typeScore + riskScore);
}

module.exports = router;