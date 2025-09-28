const { body, param, query, validationResult } = require('express-validator');

// Common validation rules
const commonValidations = {
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
    
  password: body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    
  firstName: body('first_name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name is required and must be less than 100 characters'),
    
  lastName: body('last_name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Last name must be less than 100 characters'),
    
  riskAppetite: body('risk_appetite')
    .optional()
    .isIn(['low', 'moderate', 'high'])
    .withMessage('Risk appetite must be low, moderate, or high'),
    
  uuid: (field) => param(field)
    .isUUID()
    .withMessage(`${field} must be a valid UUID`),
    
  amount: body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
    
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ]
};

// Validation rule sets for different endpoints
const validationRules = {
  // Auth validations
  signup: [
    commonValidations.email,
    commonValidations.password,
    commonValidations.firstName,
    commonValidations.lastName,
    commonValidations.riskAppetite
  ],
  
  login: [
    commonValidations.email,
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],
  
  forgotPassword: [
    commonValidations.email
  ],
  
  resetPassword: [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    commonValidations.password
  ],
  
  // Product validations
  createProduct: [
    body('name')
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Product name is required and must be less than 255 characters'),
    body('investment_type')
      .isIn(['bond', 'fd', 'mf', 'etf', 'other'])
      .withMessage('Investment type must be one of: bond, fd, mf, etf, other'),
    body('tenure_months')
      .isInt({ min: 1, max: 600 })
      .withMessage('Tenure must be between 1 and 600 months'),
    body('annual_yield')
      .isFloat({ min: 0, max: 100 })
      .withMessage('Annual yield must be between 0 and 100'),
    body('risk_level')
      .isIn(['low', 'moderate', 'high'])
      .withMessage('Risk level must be low, moderate, or high'),
    body('min_investment')
      .isFloat({ min: 0 })
      .withMessage('Minimum investment must be a positive number'),
    body('max_investment')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum investment must be a positive number'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters')
  ],
  
  updateProduct: [
    commonValidations.uuid('id'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Product name must be less than 255 characters'),
    body('investment_type')
      .optional()
      .isIn(['bond', 'fd', 'mf', 'etf', 'other'])
      .withMessage('Investment type must be one of: bond, fd, mf, etf, other'),
    body('tenure_months')
      .optional()
      .isInt({ min: 1, max: 600 })
      .withMessage('Tenure must be between 1 and 600 months'),
    body('annual_yield')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('Annual yield must be between 0 and 100'),
    body('risk_level')
      .optional()
      .isIn(['low', 'moderate', 'high'])
      .withMessage('Risk level must be low, moderate, or high'),
    body('min_investment')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum investment must be a positive number'),
    body('max_investment')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum investment must be a positive number'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters')
  ],
  
  // Investment validations
  createInvestment: [
    body('product_id')
      .isUUID()
      .withMessage('Product ID must be a valid UUID'),
    commonValidations.amount,
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Notes must be less than 500 characters')
  ],
  
  // Query validations
  getProducts: [
    query('type')
      .optional()
      .isIn(['bond', 'fd', 'mf', 'etf', 'other'])
      .withMessage('Type must be one of: bond, fd, mf, etf, other'),
    query('risk_level')
      .optional()
      .isIn(['low', 'moderate', 'high'])
      .withMessage('Risk level must be low, moderate, or high'),
    query('min_yield')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum yield must be a positive number'),
    query('max_yield')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum yield must be a positive number'),
    ...commonValidations.pagination
  ],
  
  getLogs: [
    query('start_date')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('end_date')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    query('status_code')
      .optional()
      .isInt({ min: 100, max: 599 })
      .withMessage('Status code must be a valid HTTP status code'),
    ...commonValidations.pagination
  ]
};

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value
    }));
    
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Please check your input data',
      details: formattedErrors
    });
  }
  
  next();
};

// Custom validation functions
const customValidations = {
  checkPasswordStrength: (password) => {
    const minLength = 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const issues = [];
    if (password.length < minLength) issues.push(`Password must be at least ${minLength} characters`);
    if (!hasUpper) issues.push('Password must contain uppercase letters');
    if (!hasLower) issues.push('Password must contain lowercase letters');
    if (!hasNumbers) issues.push('Password must contain numbers');
    if (!hasSpecial) issues.push('Password must contain special characters');
    
    return {
      isValid: issues.length === 0,
      issues,
      strength: issues.length === 0 ? 'strong' : issues.length <= 2 ? 'moderate' : 'weak'
    };
  },
  
  validateInvestmentAmount: (amount, product) => {
    if (amount < product.min_investment) {
      return {
        isValid: false,
        message: `Minimum investment amount is ₹${product.min_investment}`
      };
    }
    
    if (product.max_investment && amount > product.max_investment) {
      return {
        isValid: false,
        message: `Maximum investment amount is ₹${product.max_investment}`
      };
    }
    
    return { isValid: true };
  }
};

module.exports = {
  validationRules,
  handleValidationErrors,
  customValidations,
  commonValidations
};