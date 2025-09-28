const request = require('supertest');
const app = require('../src/server');
const { User, InvestmentProduct } = require('../src/models');

describe('Products Endpoints', () => {
  let authToken;
  let adminToken;
  let testProduct;

  beforeEach(async () => {
    // Clean up test data
    await InvestmentProduct.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });

    // Create test user
    const user = await User.createUser({
      email: 'test@example.com',
      password_hash: 'TestPassword123!',
      first_name: 'Test',
      last_name: 'User'
    });

    // Create admin user
    const admin = await User.createUser({
      email: 'admin@gripinvest.com',
      password_hash: 'AdminPassword123!',
      first_name: 'Admin',
      last_name: 'User'
    });

    // Get auth tokens
    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'TestPassword123!'
      });
    authToken = userLogin.body.token;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@gripinvest.com',
        password: 'AdminPassword123!'
      });
    adminToken = adminLogin.body.token;

    // Create test product
    testProduct = await InvestmentProduct.create({
      name: 'Test Bond',
      investment_type: 'bond',
      tenure_months: 12,
      annual_yield: 8.5,
      risk_level: 'low',
      min_investment: 1000,
      max_investment: 100000,
      description: 'Test bond product'
    });
  });

  describe('GET /api/products', () => {
    it('should get all products', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.body.message).toBe('Products retrieved successfully');
      expect(response.body.data.products).toHaveLength(1);
      expect(response.body.data.products[0].name).toBe('Test Bond');
    });

    it('should filter products by type', async () => {
      // Create another product of different type
      await InvestmentProduct.create({
        name: 'Test MF',
        investment_type: 'mf',
        tenure_months: 24,
        annual_yield: 12.0,
        risk_level: 'high',
        min_investment: 500
      });

      const response = await request(app)
        .get('/api/products?type=bond')
        .expect(200);

      expect(response.body.data.products).toHaveLength(1);
      expect(response.body.data.products[0].investment_type).toBe('bond');
    });

    it('should filter products by risk level', async () => {
      const response = await request(app)
        .get('/api/products?risk_level=low')
        .expect(200);

      expect(response.body.data.products).toHaveLength(1);
      expect(response.body.data.products[0].risk_level).toBe('low');
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/products?page=1&limit=1')
        .expect(200);

      expect(response.body.data.pagination.current_page).toBe(1);
      expect(response.body.data.pagination.items_per_page).toBe(1);
    });
  });

  describe('GET /api/products/:id', () => {
    it('should get single product by ID', async () => {
      const response = await request(app)
        .get(`/api/products/${testProduct.id}`)
        .expect(200);

      expect(response.body.message).toBe('Product retrieved successfully');
      expect(response.body.data.name).toBe('Test Bond');
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app)
        .get(`/api/products/${fakeId}`)
        .expect(404);

      expect(response.body.error).toBe('Product not found');
    });
  });

  describe('GET /api/products/recommendations/for-me', () => {
    it('should get recommendations for authenticated user', async () => {
      const response = await request(app)
        .get('/api/products/recommendations/for-me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Recommendations retrieved successfully');
      expect(response.body.data.products).toBeDefined();
      expect(response.body.data.user_risk_appetite).toBe('moderate');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/products/recommendations/for-me')
        .expect(401);

      expect(response.body.error).toBe('Access token required');
    });
  });

  describe('POST /api/products', () => {
    it('should create new product as admin', async () => {
      const productData = {
        name: 'New Test Product',
        investment_type: 'fd',
        tenure_months: 18,
        annual_yield: 7.5,
        risk_level: 'low',
        min_investment: 2000,
        max_investment: 200000
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(productData)
        .expect(201);

      expect(response.body.message).toBe('Product created successfully');
      expect(response.body.data.name).toBe(productData.name);
    });

    it('should require admin access', async () => {
      const productData = {
        name: 'New Test Product',
        investment_type: 'fd',
        tenure_months: 18,
        annual_yield: 7.5,
        risk_level: 'low',
        min_investment: 2000
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(productData)
        .expect(403);

      expect(response.body.error).toBe('Admin access required');
    });

    it('should validate product data', async () => {
      const invalidProductData = {
        name: '',
        investment_type: 'invalid',
        tenure_months: -1,
        annual_yield: 150,
        risk_level: 'invalid'
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidProductData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('PUT /api/products/:id', () => {
    it('should update product as admin', async () => {
      const updateData = {
        name: 'Updated Test Bond',
        annual_yield: 9.0
      };

      const response = await request(app)
        .put(`/api/products/${testProduct.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Product updated successfully');
      expect(response.body.data.name).toBe(updateData.name);
      expect(parseFloat(response.body.data.annual_yield)).toBe(updateData.annual_yield);
    });

    it('should require admin access', async () => {
      const updateData = {
        name: 'Updated Test Bond'
      };

      const response = await request(app)
        .put(`/api/products/${testProduct.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.error).toBe('Admin access required');
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = {
        name: 'Updated Test Bond'
      };

      const response = await request(app)
        .put(`/api/products/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.error).toBe('Product not found');
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('should soft delete product as admin', async () => {
      const response = await request(app)
        .delete(`/api/products/${testProduct.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Product deleted successfully');

      // Verify product is soft deleted
      const deletedProduct = await InvestmentProduct.findByPk(testProduct.id);
      expect(deletedProduct.is_active).toBe(false);
    });

    it('should require admin access', async () => {
      const response = await request(app)
        .delete(`/api/products/${testProduct.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.error).toBe('Admin access required');
    });
  });

  describe('GET /api/products/admin/statistics', () => {
    it('should get product statistics as admin', async () => {
      const response = await request(app)
        .get('/api/products/admin/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Product statistics retrieved successfully');
      expect(response.body.data.total_active_products).toBe(1);
      expect(response.body.data.statistics_by_type_and_risk).toBeDefined();
    });

    it('should require admin access', async () => {
      const response = await request(app)
        .get('/api/products/admin/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.error).toBe('Admin access required');
    });
  });
});