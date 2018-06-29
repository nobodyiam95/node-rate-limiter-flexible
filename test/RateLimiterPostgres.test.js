const {
  describe, it, beforeEach, afterEach,
} = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const RateLimiterPostgres = require('../lib/RateLimiterPostgres');

describe('RateLimiterPostgres with fixed window', function () {
  this.timeout(5000);
  const pgClient = {
    query: () => {},
  };

  let pgClientStub;

  beforeEach(() => {
    pgClientStub = sinon.stub(pgClient, 'query').callsFake(() => Promise.resolve());
  });

  afterEach(() => {
    pgClientStub.restore();
  });

  it('throw error if can not create table', () => {
    pgClientStub.restore();
    pgClientStub = sinon.stub(pgClient, 'query').callsFake(() => Promise.reject(Error('test')));

    try {
      const rateLimiter = new RateLimiterPostgres({ storeClient: pgClient, points: 2, duration: 5 }); // eslint-disable-line
    } catch (e) {
      expect(e instanceof Error).to.equal(true);
    }
  });

  it('consume 1 point', (done) => {
    const testKey = 'consume1';

    const rateLimiter = new RateLimiterPostgres({ storeClient: pgClient, points: 2, duration: 5 });
    rateLimiter._tableCreated = true;
    pgClientStub.restore();
    pgClientStub = sinon.stub(pgClient, 'query').resolves({
      rows: [{ points: 1, expire: 5000 }],
    });

    rateLimiter.consume(testKey)
      .then((res) => {
        expect(res.consumedPoints).to.equal(1);
        done();
      })
      .catch((err) => {
        done(err);
      });
  });

  it('rejected when consume more than maximum points', (done) => {
    const testKey = 'consumerej';

    const rateLimiter = new RateLimiterPostgres({ storeClient: pgClient, points: 1, duration: 5 });
    rateLimiter._tableCreated = true;
    pgClientStub.restore();
    pgClientStub = sinon.stub(pgClient, 'query').resolves({
      rows: [{ points: 2, expire: 5000 }],
    });
    rateLimiter.consume(testKey, 2)
      .then(() => {
        done(Error('have to reject'));
      })
      .catch((err) => {
        expect(err.consumedPoints).to.equal(2);
        done();
      });
  });

  it('blocks key for block duration when consumed more than points', (done) => {
    const testKey = 'block';

    const rateLimiter = new RateLimiterPostgres({
      storeClient: pgClient, points: 1, duration: 1, blockDuration: 2,
    });
    rateLimiter._tableCreated = true;
    pgClientStub.restore();
    pgClientStub = sinon.stub(pgClient, 'query').resolves({
      rows: [{ points: 2, expire: 1000 }],
    });

    rateLimiter.consume(testKey, 2)
      .then(() => {
        done(Error('must not resolve'));
      })
      .catch((rej) => {
        expect(rej.msBeforeNext > 1000).to.equal(true);
        done();
      });
  });

  it('return correct data with _getRateLimiterRes', () => {
    const rateLimiter = new RateLimiterPostgres({ points: 5, storeClient: pgClient });

    const res = rateLimiter._getRateLimiterRes('test', 1, {
      rows: [{ points: 3, expire: new Date(Date.now() + 1000).toISOString() }],
    });

    expect(res.msBeforeNext <= 1000
      && res.consumedPoints === 3
      && res.isFirstInDuration === false
      && res.remainingPoints === 2).to.equal(true);
  });

  it('get points', (done) => {
    const testKey = 'get';

    const rateLimiter = new RateLimiterPostgres({ storeClient: pgClient, points: 2, duration: 5 });
    rateLimiter._tableCreated = true;
    pgClientStub.restore();
    pgClientStub = sinon.stub(pgClient, 'query').resolves({
      rows: [{ points: 1, expire: 5000 }],
    });

    rateLimiter.get(testKey)
      .then((res) => {
        expect(res.consumedPoints).to.equal(1);
        done();
      })
      .catch((err) => {
        done(err);
      });
  });
});
