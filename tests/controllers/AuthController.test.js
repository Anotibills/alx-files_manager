/* eslint-disable test for AuthController */
import dbClient from '../../utils/db';

describe('+ AuthController', () => {
  const mockUser = {
    email: 'kaido@beast.com',
    password: 'hyakuju_no_kaido_wano',
  };
  let token = '';

  before(function (done) {
    this.timeout(10000);
    setupDatabase()
      .then(() => createUser())
      .then(() => done())
      .catch((err) => done(err));
  });

  describe('+ GET: /connect', () => {
    it('+ Fails with no "Authorization" header field', function (done) {
      request.get('/connect')
        .expect(401)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body).to.deep.eql({ error: 'Unauthorized' });
          done();
        });
    });

    it('+ Fails for a non-existent user', function (done) {
      request.get('/connect')
        .auth('foo@bar.com', 'raboof', { type: 'basic' })
        .expect(401)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body).to.deep.eql({ error: 'Unauthorized' });
          done();
        });
    });

    // Additional tests...

    it('+ Succeeds for an existing user', function (done) {
      request.get('/connect')
        .auth(mockUser.email, mockUser.password, { type: 'basic' })
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body.token).to.exist;
          expect(res.body.token.length).to.be.greaterThan(0);
          token = res.body.token;
          done();
        });
    });
  });

  describe('+ GET: /disconnect', () => {
    it('+ Fails with no "X-Token" header field', function (done) {
      request.get('/disconnect')
        .expect(401)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body).to.deep.eql({ error: 'Unauthorized' });
          done();
        });
    });

    // Additional tests...
  });

  after(function (done) {
    cleanupDatabase()
      .then(() => done())
      .catch((err) => done(err));
  });

  // Helper functions
  function setupDatabase() {
    return dbClient.usersCollection().then((usersCollection) => usersCollection.deleteMany({ email: mockUser.email }));
  }

  function createUser() {
    return request.post('/users')
      .send({
        email: mockUser.email,
        password: mockUser.password,
      })
      .expect(201)
      .then((res) => {
        expect(res.body.email).to.eql(mockUser.email);
        expect(res.body.id.length).to.be.greaterThan(0);
      });
  }

  function cleanupDatabase() {
    return dbClient.usersCollection().then((usersCollection) => usersCollection.deleteMany({ email: mockUser.email }));
  }
});
