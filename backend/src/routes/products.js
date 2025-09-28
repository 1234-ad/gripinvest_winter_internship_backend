const express = require('express');
const { Op } = require('sequelize');
const { InvestmentProduct } = require('../models');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../utils/validation');
const AIService = require('../utils/aiService');
const logger = require('../utils/logger');

const router = express.Router();

// Get all products (public endpoint with optional auth for recommendations)
router.get('/', optionalAuth, validationRules.getProducts, handleValidationErrors, async (req, res) => {
  try {
    const {
      type,
      risk_level,
      min_yield,
      max_yield,
      page = 1,
      limit = 10,
      sort_by = 'annual_yield',
      sort_order = 'DESC'
    } = req.query;

    // Build where clause
    const whereClause = { is_active: true };
    
    if (type) whereClause.investment_type = type;
    if (risk_level) whereClause.risk_level = risk_level;
    
    if (min_yield || max_yield) {
      whereClause.annual_yield = {};
      if (min_yield) whereClause.annual_yield[Op.gte] = parseFloat(min_yield);
      if (max_yield) whereClause.annual_yield[Op.lte] = parseFloat(max_yield);
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Fetch products
    const { count, rows: products } = await InvestmentProduct.findAndCountAll({
      where: whereClause,
      order: [[sort_by, sort_order.toUpperCase()]],
      limit: parseInt(limit),
      offset
    });

    // Get AI recommendations if user is authenticated
    let recommendations = null;
    if (req.user && AIService.isEnabled()) {
      try {
        const recommendationText = await AIService.getInvestmentRecommendations(req.user, products);
        recommendations = recommendationText;
      } catch (error) {
        logger.error('Failed to get AI recommendations:', error);
      }
    }

    res.json({
      message: 'Products retrieved successfully',
      data: {
        products,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(count / parseInt(limit)),
          total_items: count,
          items_per_page: parseInt(limit)
        },
        filters: {
          type,
          risk_level,
          min_yield,
          max_yield
        },
        recommendations
      }
    });
  } catch (error) {
    logger.error('Get products error:', error);
    res.status(500).json({
      error: 'Failed to retrieve products',
      message: 'Internal server error'
    });
  }
});

// Get single product by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const product = await InvestmentProduct.findOne({
      where: { id, is_active: true }
    });

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'The requested investment product does not exist'
      });
    }

    res.json({
      message: 'Product retrieved successfully',
      data: product
    });
  } catch (error) {
    logger.error('Get product error:', error);
    res.status(500).json({
      error: 'Failed to retrieve product',
      message: 'Internal server error'
    });
  }
});

// Get product recommendations for authenticated user
router.get('/recommendations/for-me', authenticateToken, async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    // Get products matching user's risk appetite
    const products = await InvestmentProduct.getRecommendations(
      req.user.risk_appetite,
      parseInt(limit)
    );

    // Get AI-powered recommendations
    let aiRecommendations = null;
    if (AIService.isEnabled()) {
      try {
        aiRecommendations = await AIService.getInvestmentRecommendations(req.user, products);
      } catch (error) {
        logger.error('AI recommendations failed:', error);
      }
    }

    res.json({
      message: 'Recommendations retrieved successfully',
      data: {
        products,
        user_risk_appetite: req.user.risk_appetite,
        ai_recommendations: aiRecommendations
      }
    });
  } catch (error) {
    logger.error('Get recommendations error:', error);
    res.status(500).json({
      error: 'Failed to get recommendations',
      message: 'Internal server error'
    });
  }
});

// Create new product (admin only)
router.post('/', authenticateToken, requireAdmin, validationRules.createProduct, handleValidationErrors, async (req, res) => {
  try {
    const productData = req.body;

    // Generate AI description if not provided
    if (!productData.description && AIService.isEnabled()) {
      try {
        productData.description = await AIService.generateProductDescription(productData);
      } catch (error) {
        logger.error('AI description generation failed:', error);
      }
    }

    const product = await InvestmentProduct.create(productData);

    logger.info(`New product created: ${product.name} by ${req.user.email}`);

    res.status(201).json({
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    logger.error('Create product error:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Product data validation failed',
        details: error.errors.map(e => ({
          field: e.path,
          message: e.message
        }))
      });
    }

    res.status(500).json({
      error: 'Failed to create product',
      message: 'Internal server error'
    });
  }
});

// Update product (admin only)
router.put('/:id', authenticateToken, requireAdmin, validationRules.updateProduct, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const product = await InvestmentProduct.findByPk(id);
    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'The requested investment product does not exist'
      });
    }

    // Regenerate AI description if product details changed
    if (AIService.isEnabled() && (updateData.name || updateData.investment_type || updateData.annual_yield)) {
      try {
        const updatedProductData = { ...product.toJSON(), ...updateData };
        updateData.description = await AIService.generateProductDescription(updatedProductData);
      } catch (error) {
        logger.error('AI description update failed:', error);
      }
    }

    await product.update(updateData);

    logger.info(`Product updated: ${product.name} by ${req.user.email}`);

    res.json({
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    logger.error('Update product error:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Product data validation failed',
        details: error.errors.map(e => ({
          field: e.path,
          message: e.message
        }))
      });
    }

    res.status(500).json({
      error: 'Failed to update product',
      message: 'Internal server error'
    });
  }
});

// Delete product (admin only) - soft delete by setting is_active to false
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const product = await InvestmentProduct.findByPk(id);
    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'The requested investment product does not exist'
      });
    }

    // Soft delete by setting is_active to false
    await product.update({ is_active: false });

    logger.info(`Product deleted: ${product.name} by ${req.user.email}`);

    res.json({
      message: 'Product deleted successfully'
    });
  } catch (error) {
    logger.error('Delete product error:', error);
    res.status(500).json({
      error: 'Failed to delete product',
      message: 'Internal server error'
    });
  }
});

// Generate AI description for existing product (admin only)
router.post('/:id/generate-description', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const product = await InvestmentProduct.findByPk(id);
    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'The requested investment product does not exist'
      });
    }

    if (!AIService.isEnabled()) {
      return res.status(503).json({
        error: 'AI service unavailable',
        message: 'AI description generation is not available'
      });
    }

    const description = await AIService.generateProductDescription(product);
    await product.update({ description });

    logger.info(`AI description generated for product: ${product.name} by ${req.user.email}`);

    res.json({
      message: 'AI description generated successfully',
      data: {
        description,
        product: product
      }
    });
  } catch (error) {
    logger.error('Generate AI description error:', error);
    res.status(500).json({
      error: 'Failed to generate description',
      message: 'Internal server error'
    });
  }
});

// Get product statistics (admin only)
router.get('/admin/statistics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await InvestmentProduct.findAll({
      attributes: [
        'investment_type',
        'risk_level',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
        [require('sequelize').fn('AVG', require('sequelize').col('annual_yield')), 'avg_yield'],
        [require('sequelize').fn('MIN', require('sequelize').col('annual_yield')), 'min_yield'],
        [require('sequelize').fn('MAX', require('sequelize').col('annual_yield')), 'max_yield']
      ],
      where: { is_active: true },
      group: ['investment_type', 'risk_level'],
      raw: true
    });

    const totalProducts = await InvestmentProduct.count({ where: { is_active: true } });
    const inactiveProducts = await InvestmentProduct.count({ where: { is_active: false } });

    res.json({
      message: 'Product statistics retrieved successfully',
      data: {
        total_active_products: totalProducts,
        total_inactive_products: inactiveProducts,
        statistics_by_type_and_risk: stats
      }
    });
  } catch (error) {
    logger.error('Get product statistics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      message: 'Internal server error'
    });
  }
});

module.exports = router;