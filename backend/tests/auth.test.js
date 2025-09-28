const request = require('supertest');
const app = require('../src/server');
const { User } = require('../src/models');

describe('Authentication Endpoints', () => {
  beforeEach(async () => {
    // Clean up test data
    await User.destroy({ where: {}, force: true });
  });

  describe('POST /api/auth/signup', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        first_name: 'Test',
        last_name: 'User',
        risk_appetite: 'moderate'
      };

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(201);

      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.token).toBeDefined();
      expect(response.body.passwordAnalysis).toBeDefined();
    });

    it('should return error for duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        first_name: 'Test',
        last_name: 'User'
      };

      // Create first user
      await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(409);

      expect(response.body.error).toBe('User already exists');
    });

    it('should return validation error for invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'TestPassword123!',
        first_name: 'Test'
      };

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return validation error for weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123',
        first_name: 'Test'
      };

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await User.createUser({
        email: 'test@example.com',
        password_hash: 'TestPassword123!',
        first_name: 'Test',
        last_name: 'User'
      });
    });

    it('should login successfully with correct credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.message).toBe('Login successful');
      expect(response.body.user.email).toBe(loginData.email);
      expect(response.body.token).toBeDefined();
    });

    it('should return error for incorrect password', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return error for non-existent user', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });
  });

  describe('POST /api/auth/check-password-strength', () => {
    it('should analyze password strength', async () => {
      const passwordData = {
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/check-password-strength')
        .send(passwordData)
        .expect(200);

      expect(response.body.message).toBe('Password analysis completed');
      expect(response.body.analysis).toBeDefined();
      expect(response.body.analysis.strength).toBeDefined();
      expect(response.body.analysis.score).toBeDefined();
    });

    it('should return error for missing password', async () => {
      const response = await request(app)
        .post('/api/auth/check-password-strength')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Password required');
    });
  });

  describe('GET /api/auth/verify-token', () => {
    let authToken;

    beforeEach(async () => {
      // Create and login user to get token
      await User.createUser({
        email: 'test@example.com',
        password_hash: 'TestPassword123!',
        first_name: 'Test',
        last_name: 'User'
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

      authToken = loginResponse.body.token;
    });

    it('should verify valid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-token')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Token is valid');
      expect(response.body.user).toBeDefined();
    });

    it('should return error for missing token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-token')
        .expect(401);

      expect(response.body.error).toBe('No token provided');
    });

    it('should return error for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-token')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });
  });
});