const assert  = require('assert');
const autoadd = require('../');

describe('autoadd', function () {
    it('returns a function', function () {
        const func = autoadd('/');
        assert.ok(func instanceof Function);
    });

    it('throw an error when "remove" is not a boolean', function () {
        assert.throws(() => autoadd('/', { remove: 12 }));
    });

    it('throws an error when "interval" is not a number', function () {
        assert.throws(() => autoadd('/', { interval: '12' }));
    })
});
