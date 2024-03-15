/* eslint-disable AppController test file */
import dbClient from '../../utils/db';

describe('+ AppController', () => {
  before(function (done) {
    this.timeout(10000);
    setupDatabase()
      .then(() => done())
      .catch((err) => done(err));
  });

  describe('+ GET: /status', () => {
    it('+ Services are online', function (done) {
      request.get('/status')
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body).to.deep.eql({ redis: true, db: true });
          done();
        });
    });
  });

  describe('+ GET: /stats', () => {
    it('+ Correct statistics about db collections', function (done) {
      request.get('/stats')
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body).to.deep.eql({ users: 0, files: 0 });
          done();
        });
    });

    it('+ Correct statistics about db collections [alt]', function (done) {
      this.timeout(10000);
      populateDatabase()
        .then(() => {
          request.get('/stats')
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              expect(res.body).to.deep.eql({ users: 1, files: 2 });
              done();
            });
        })
        .catch((err) => done(err));
    });
  });

  after(function (done) {
    cleanupDatabase()
      .then(() => done())
      .catch((err) => done(err));
  });

  // Helper functions
  function setupDatabase() {
    return Promise.all([dbClient.usersCollection(), dbClient.filesCollection()])
      .then(([usersCollection, filesCollection]) => Promise.all([usersCollection.deleteMany({}), filesCollection.deleteMany({})]));
  }

  function populateDatabase() {
    return Promise.all([dbClient.usersCollection(), dbClient.filesCollection()])
      .then(([usersCollection, filesCollection]) =>
        Promise.all([
          usersCollection.insertMany([{ email: 'john@mail.com' }]),
          filesCollection.insertMany([
            { name: 'foo.txt', type: 'file' },
            { name: 'pic.png', type: 'image' },
          ]),
        ]),
      );
  }

  function cleanupDatabase() {
    return Promise.all([dbClient.usersCollection(), dbClient.filesCollection()])
      .then(([usersCollection, filesCollection]) => Promise.all([usersCollection.deleteMany({}), filesCollection.deleteMany({})]));
  }
});
