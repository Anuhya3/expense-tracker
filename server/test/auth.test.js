const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');

const testUser = {
    name: 'Test User',
    email: `test.auth.${Date.now()}@example.com`,
    password: 'password123'
};

beforeAll(async () => {
    await new Promise((resolve) => {
          if (mongoose.connection.readyState === 1) return resolve();
          mongoose.connection.once('connected', resolve);
    });
});

afterAll(async () => {
    await mongoose.connection.collection('users').deleteMany({ email: testUser.email });
    await mongoose.connection.close();
});

describe('Auth routes', () => {
    it('rejects registration with an invalid email', async () => {
          const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Bad Email', email: 'not-an-email', password: 'password123' });
          expect(res.statusCode).toBe(400);
    });

           it('rejects registration with a short password', async () => {
                 const res = await request(app)
                   .post('/api/auth/register')
                   .send({ name: 'Short Pw', email: `short.${Date.now()}@example.com`, password: '123' });
                 expect(res.statusCode).toBe(400);
           });

           it('registers a new user and returns a JWT', async () => {
                 const res = await request(app).post('/api/auth/register').send(testUser);
                 expect(res.statusCode).toBe(201);
                 expect(res.body.token).toBeDefined();
                 expect(res.body.user.email).toBe(testUser.email);
                 expect(res.body.user.password).toBeUndefined();
           });

           it('rejects a duplicate email registration', async () => {
                 const res = await request(app).post('/api/auth/register').send(testUser);
                 expect(res.statusCode).toBe(400);
           });

           it('rejects login with the wrong password', async () => {
                 const res = await request(app)
                   .post('/api/auth/login')
                   .send({ email: testUser.email, password: 'wrongpassword' });
                 expect(res.statusCode).toBe(401);
           });

           it('logs in with correct credentials and returns a JWT', async () => {
                 const res = await request(app)
                   .post('/api/auth/login')
                   .send({ email: testUser.email, password: testUser.password });
                 expect(res.statusCode).toBe(200);
                 expect(res.body.token).toBeDefined();
           });

           it('returns the current user on /api/auth/me with a valid token', async () => {
                 const loginRes = await request(app)
                   .post('/api/auth/login')
                   .send({ email: testUser.email, password: testUser.password });

                  const meRes = await request(app)
                   .get('/api/auth/me')
                   .set('Authorization', `Bearer ${loginRes.body.token}`);

                  expect(meRes.statusCode).toBe(200);
                 expect(meRes.body.user.email).toBe(testUser.email);
           });

           it('rejects /api/auth/me without a token', async () => {
                 const res = await request(app).get('/api/auth/me');
                 expect(res.statusCode).toBe(401);
           });

           it('rejects /api/auth/me with a garbage token', async () => {
                 const res = await request(app)
                   .get('/api/auth/me')
                   .set('Authorization', 'Bearer not-a-real-token');
                 expect(res.statusCode).toBe(401);
           });
});
