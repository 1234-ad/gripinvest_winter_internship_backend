const express = require('express');
const { Investment, InvestmentProduct, User } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { validationRules, handleValidationErrors, customValidations } = require('../utils/validation');
const logger = require('../utils/logger');

const router = express.Router();

// Create new investment
router.post('/', authenticateToken, validationRules.createInvestment, handleValidationErrors, async (req, res) => {
  try {
    const { product_id, amount, notes } = req.body;
    const user_id = req.user.id;

    // Fetch the investment product
    const product = await InvestmentProduct.findOne({
      where: { id: product_id, is_active: true }
    });

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'The selected investment product is not available'
      });
    }

    // Validate investment amount
    const amountValidation = customValidations.validateInvestmentAmount(amount, product);
    if (!amountValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid investment amount',
        message: amountValidation.message
      });
    }

    // Create the investment
    const investment = await Investment.create({
      user_id,
      product_id,
      amount: parseFloat(amount),
      notes
    });

    // Fetch the created investment with product details
    const createdInvestment = await Investment.findByPk(investment.id, {
      include: [{
        model: InvestmentProduct,
        as: 'product'
      }]
    });

    logger.info(`New investment created: ${amount} in ${product.name} by ${req.user.email}`);

    res.status(201).json({
      message: 'Investment created successfully',
      data: {
        investment: createdInvestment,
        expected_return: createdInvestment.expected_return,
        maturity_date: createdInvestment.maturity_date,
        current_value: createdInvestment.getCurrentValue(),
        gain_loss: createdInvestment.getGainLoss(),
        days_to_maturity: createdInvestment.getDaysToMaturity()
      }
    });
  } catch (error) {
    logger.error('Create investment error:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Investment data validation failed',
        details: error.errors.map(e => ({
          field: e.path,
          message: e.message
        }))
      });
    }

    res.status(500).json({
      error: 'Failed to create investment',
      message: 'Internal server error'
    });
  }
});

// Get user's investments
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const user_id = req.user.id;

    // Build where clause
    const whereClause = { user_id };
    if (status) {
      whereClause.status = status;
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Fetch investments
    const { count, rows: investments } = await Investment.findAndCountAll({
      where: whereClause,
      include: [{
        model: InvestmentProduct,
        as: 'product'
      }],
      order: [['invested_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Add calculated fields to each investment
    const enrichedInvestments = investments.map(investment => ({
      ...investment.toJSON(),
      current_value: investment.getCurrentValue(),
      gain_loss: investment.getGainLoss(),
      days_to_maturity: investment.getDaysToMaturity()
    }));

    res.json({
      message: 'Investments retrieved successfully',
      data: {
        investments: enrichedInvestments,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(count / parseInt(limit)),
          total_items: count,
          items_per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get investments error:', error);
    res.status(500).json({
      error: 'Failed to retrieve investments',
      message: 'Internal server error'
    });
  }
});

// Get single investment by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const investment = await Investment.findOne({
      where: { id, user_id },
      include: [{
        model: InvestmentProduct,
        as: 'product'
      }]
    });

    if (!investment) {
      return res.status(404).json({
        error: 'Investment not found',
        message: 'The requested investment does not exist or does not belong to you'
      });
    }

    res.json({
      message: 'Investment retrieved successfully',
      data: {
        investment: investment.toJSON(),
        current_value: investment.getCurrentValue(),
        gain_loss: investment.getGainLoss(),
        days_to_maturity: investment.getDaysToMaturity()
      }
    });
  } catch (error) {
    logger.error('Get investment error:', error);
    res.status(500).json({
      error: 'Failed to retrieve investment',
      message: 'Internal server error'
    });
  }
});

// Update investment notes
router.put('/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const user_id = req.user.id;

    const investment = await Investment.findOne({
      where: { id, user_id }
    });

    if (!investment) {
      return res.status(404).json({
        error: 'Investment not found',
        message: 'The requested investment does not exist or does not belong to you'
      });
    }

    await investment.update({ notes });

    logger.info(`Investment notes updated: ${id} by ${req.user.email}`);

    res.json({
      message: 'Investment notes updated successfully',
      data: investment
    });
  } catch (error) {
    logger.error('Update investment notes error:', error);
    res.status(500).json({
      error: 'Failed to update investment notes',
      message: 'Internal server error'
    });
  }
});

// Cancel investment (only if not matured)
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const investment = await Investment.findOne({
      where: { id, user_id }
    });

    if (!investment) {
      return res.status(404).json({
        error: 'Investment not found',
        message: 'The requested investment does not exist or does not belong to you'
      });
    }

    if (investment.status === 'matured') {
      return res.status(400).json({
        error: 'Cannot cancel matured investment',
        message: 'This investment has already matured and cannot be cancelled'
      });
    }

    if (investment.status === 'cancelled') {
      return res.status(400).json({
        error: 'Investment already cancelled',
        message: 'This investment is already cancelled'
      });
    }

    await investment.update({ status: 'cancelled' });

    logger.info(`Investment cancelled: ${id} by ${req.user.email}`);

    res.json({
      message: 'Investment cancelled successfully',
      data: investment
    });
  } catch (error) {
    logger.error('Cancel investment error:', error);
    res.status(500).json({
      error: 'Failed to cancel investment',
      message: 'Internal server error'
    });
  }
});

// Get investment statistics for user
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    // Get all user investments
    const investments = await Investment.findAll({
      where: { user_id },
      include: [{
        model: InvestmentProduct,
        as: 'product'
      }]
    });

    // Calculate statistics
    let totalInvested = 0;
    let currentValue = 0;
    let activeInvestments = 0;
    let maturedInvestments = 0;
    let cancelledInvestments = 0;
    const investmentsByType = {};
    const investmentsByRisk = {};

    investments.forEach(investment => {
      const amount = parseFloat(investment.amount);
      const current = investment.getCurrentValue();
      
      totalInvested += amount;
      currentValue += current;

      // Count by status
      if (investment.status === 'active') activeInvestments++;
      else if (investment.status === 'matured') maturedInvestments++;
      else if (investment.status === 'cancelled') cancelledInvestments++;

      // Group by type
      const type = investment.product.investment_type;
      if (!investmentsByType[type]) {
        investmentsByType[type] = { count: 0, invested: 0, current_value: 0 };
      }
      investmentsByType[type].count++;
      investmentsByType[type].invested += amount;
      investmentsByType[type].current_value += current;

      // Group by risk
      const risk = investment.product.risk_level;
      if (!investmentsByRisk[risk]) {
        investmentsByRisk[risk] = { count: 0, invested: 0, current_value: 0 };
      }
      investmentsByRisk[risk].count++;
      investmentsByRisk[risk].invested += amount;
      investmentsByRisk[risk].current_value += current;
    });

    const totalGain = currentValue - totalInvested;
    const totalGainPercentage = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

    res.json({
      message: 'Investment statistics retrieved successfully',
      data: {
        summary: {
          total_invested: totalInvested,
          current_value: currentValue,
          total_gain: totalGain,
          total_gain_percentage: totalGainPercentage,
          total_investments: investments.length,
          active_investments: activeInvestments,
          matured_investments: maturedInvestments,
          cancelled_investments: cancelledInvestments
        },
        by_type: investmentsByType,
        by_risk: investmentsByRisk
      }
    });
  } catch (error) {
    logger.error('Get investment statistics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve investment statistics',
      message: 'Internal server error'
    });
  }
});

module.exports = router;