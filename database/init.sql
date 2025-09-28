-- Grip Invest Database Schema
-- Winter Internship 2025

USE gripinvest;

-- Users Table
CREATE TABLE users (
   id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
   first_name VARCHAR(100) NOT NULL,
   last_name VARCHAR(100),
   email VARCHAR(255) UNIQUE NOT NULL,
   password_hash VARCHAR(255) NOT NULL,
   risk_appetite ENUM('low','moderate','high') DEFAULT 'moderate',
   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Investment Products Table
CREATE TABLE investment_products (
   id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
   name VARCHAR(255) NOT NULL,
   investment_type ENUM('bond','fd','mf','etf','other') NOT NULL,
   tenure_months INT NOT NULL,
   annual_yield DECIMAL(5,2) NOT NULL,
   risk_level ENUM('low','moderate','high') NOT NULL,
   min_investment DECIMAL(12,2) DEFAULT 1000.00,
   max_investment DECIMAL(12,2),
   description TEXT,
   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Investments Table
CREATE TABLE investments (
   id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
   user_id CHAR(36) NOT NULL,
   product_id CHAR(36) NOT NULL,
   amount DECIMAL(12,2) NOT NULL,
   invested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
   status ENUM('active','matured','cancelled') DEFAULT 'active',
   expected_return DECIMAL(12,2),
   maturity_date DATE,
   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
   FOREIGN KEY (product_id) REFERENCES investment_products(id) ON DELETE CASCADE
);

-- Transaction Logs Table
CREATE TABLE transaction_logs (
   id BIGINT AUTO_INCREMENT PRIMARY KEY,
   user_id CHAR(36),
   email VARCHAR(255),
   endpoint VARCHAR(255) NOT NULL,
   http_method ENUM('GET','POST','PUT','DELETE') NOT NULL,
   status_code INT NOT NULL,
   error_message TEXT,
   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
   FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_investments_user_id ON investments(user_id);
CREATE INDEX idx_investments_product_id ON investments(product_id);
CREATE INDEX idx_transaction_logs_user_id ON transaction_logs(user_id);
CREATE INDEX idx_transaction_logs_created_at ON transaction_logs(created_at);

-- Insert sample investment products
INSERT INTO investment_products (id, name, investment_type, tenure_months, annual_yield, risk_level, min_investment, max_investment, description) VALUES
(UUID(), 'Government Bond Series A', 'bond', 12, 7.50, 'low', 1000.00, 100000.00, 'Secure government-backed bonds with guaranteed returns. Perfect for conservative investors seeking stable income.'),
(UUID(), 'High Yield Fixed Deposit', 'fd', 24, 8.25, 'low', 5000.00, 500000.00, 'Premium fixed deposit offering competitive interest rates with capital protection guarantee.'),
(UUID(), 'Equity Growth Mutual Fund', 'mf', 36, 12.00, 'high', 500.00, 1000000.00, 'Diversified equity mutual fund targeting high growth potential with professional fund management.'),
(UUID(), 'Balanced ETF Portfolio', 'etf', 12, 9.75, 'moderate', 1000.00, 250000.00, 'Exchange-traded fund providing balanced exposure to equity and debt markets.'),
(UUID(), 'Corporate Bond Fund', 'bond', 18, 8.80, 'moderate', 2000.00, 200000.00, 'Investment-grade corporate bonds offering higher yields than government securities.'),
(UUID(), 'Technology Sector ETF', 'etf', 24, 15.20, 'high', 1500.00, 300000.00, 'Focused technology sector ETF with exposure to leading tech companies and innovation.'),
(UUID(), 'Conservative Hybrid Fund', 'mf', 12, 7.90, 'low', 1000.00, 150000.00, 'Low-risk hybrid fund with balanced allocation between equity and debt instruments.'),
(UUID(), 'Infrastructure Bond', 'bond', 60, 9.50, 'moderate', 10000.00, 1000000.00, 'Long-term infrastructure development bonds supporting national growth projects.');

-- Insert sample admin user (password: admin123)
INSERT INTO users (id, first_name, last_name, email, password_hash, risk_appetite) VALUES
(UUID(), 'Admin', 'User', 'admin@gripinvest.com', '$2b$10$rQZ8kHWKQYXHQQXHQQXHQeJ8kHWKQYXHQQXHQQXHQeJ8kHWKQYXHQQ', 'moderate');

-- Insert sample regular user (password: user123)
INSERT INTO users (id, first_name, last_name, email, password_hash, risk_appetite) VALUES
(UUID(), 'John', 'Doe', 'john.doe@example.com', '$2b$10$rQZ8kHWKQYXHQQXHQQXHQeJ8kHWKQYXHQQXHQQXHQeJ8kHWKQYXHQQ', 'moderate');