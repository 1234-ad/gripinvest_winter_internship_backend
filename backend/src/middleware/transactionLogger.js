const { TransactionLog } = require('../models');
const logger = require('../utils/logger');

const transactionLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Store original res.json to capture response
  const originalJson = res.json;
  let responseBody = null;
  
  res.json = function(body) {
    responseBody = body;
    return originalJson.call(this, body);
  };

  // Store original res.end to log after response
  const originalEnd = res.end;
  res.end = function(...args) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Log the transaction asynchronously
    setImmediate(async () => {
      try {
        const logData = {
          user_id: req.user?.id || null,
          email: req.user?.email || extractEmailFromRequest(req),
          endpoint: req.originalUrl || req.url,
          http_method: req.method,
          status_code: res.statusCode,
          error_message: res.statusCode >= 400 ? getErrorMessage(responseBody) : null,
          request_body: shouldLogRequestBody(req) ? sanitizeRequestBody(req.body) : null,
          response_time_ms: responseTime,
          ip_address: getClientIP(req),
          user_agent: req.get('User-Agent') || null
        };

        await TransactionLog.logTransaction(logData);
        
        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
          logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${responseTime}ms`);
        }
      } catch (error) {
        logger.error('Failed to log transaction:', error);
      }
    });

    return originalEnd.apply(this, args);
  };

  next();
};

// Helper functions
function extractEmailFromRequest(req) {
  // Try to extract email from request body for login/signup
  if (req.body && req.body.email) {
    return req.body.email;
  }
  return null;
}

function getErrorMessage(responseBody) {
  if (!responseBody) return null;
  
  if (typeof responseBody === 'string') return responseBody;
  
  if (responseBody.error) return responseBody.error;
  if (responseBody.message) return responseBody.message;
  
  return JSON.stringify(responseBody);
}

function shouldLogRequestBody(req) {
  // Don't log request body for GET requests or sensitive endpoints
  if (req.method === 'GET') return false;
  
  const sensitiveEndpoints = ['/api/auth/login', '/api/auth/signup', '/api/auth/reset-password'];
  return !sensitiveEndpoints.some(endpoint => req.originalUrl.includes(endpoint));
}

function sanitizeRequestBody(body) {
  if (!body) return null;
  
  const sanitized = { ...body };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'password_hash', 'token', 'otp'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

function getClientIP(req) {
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         'unknown';
}

module.exports = transactionLogger;