// Tests FileLoader.Promise with the Promises / A+ Test Suite (https://github.com/promises-aplus/promises-tests)
// Includes tests for custom features.
/* jshint expr:true */
require("./support/titanium");
var check              = require("./support/asyncCheck");
var expect             = require("chai").expect;
var promisesAplusTests = require("promises-aplus-tests").mocha;
var Promise            = require("file_loader").Promise;

function getAdapter(Promise) {
  return {
    deferred: Promise.defer
  };
}

describe("Promises/A+ Tests", function () {
  promisesAplusTests(getAdapter(Promise));
});

describe("Promise Extentions", function(){
  var adapter = getAdapter(Promise);
  this.timeout(200);

  beforeEach(function() {
    this.defer = adapter.deferred();
  });

  describe("#fail", function() {
    it("calls the fail callback when promise is rejected", function(done) {
      this.defer.promise
        .fail(function(reason) {
          check(done, function() {
            expect( reason ).to.equal("testing fail callback");
          });
        }).done();
      this.defer.reject("testing fail callback");
    });
  });

  describe("#progress / #notify", function() {
    it("calls the onProgress function", function(done) {
      this.defer.promise.progress(function(v) {
        check(done, function() {
          expect( v ).to.equal("test");
        });
      });
      this.defer.notify("test");
    });

    it("calls the onProgress function when chained", function(done) {
      function onFullfilled(v) { return v; }
      this.defer.promise
        .then(onFullfilled)
        .then(onFullfilled)
        .progress(function(v) {
          check(done, function() {
            expect( v ).to.equal("test");
          });
        }).done();
      this.defer.notify("test");
    });

    it("accepts onProgress via then() function", function(done) {
      this.defer.promise.then(null, null, function(v) {
        check(done, function() {
          expect( v ).to.equal("test");
        });
      });
      this.defer.notify("test");
    });

    it("does a noop if promise is fulfilled/rejected", function(done) {
      this.defer.resolve("test");
      this.defer.promise.progress(function(v) {
        done(new Error("expected progress callback to not have been called"));
      });
      this.defer.notify("test");
      setTimeout(done, 180);
    });

    it("does nothing if no progress callbacks have been defined", function(done) {
      try { this.defer.notify("test"); }
      catch (e) { done(e); }
      setTimeout(done, 10);
    });

    it("propagates notifications from a returned promise", function(done) {
      var defer2 = adapter.deferred();
      var promise2 = this.defer.promise.then(function() {
        return defer2.promise;
      });

      this.defer.resolve();

      promise2.progress(function(v) {
        check(done, function() {
          expect( v ).to.equal("test");
        });
      }).done();

      setTimeout(function() { defer2.notify("test"); }, 10);
    });
  });

  describe("#get", function() {
    it("fulfills a promise", function(done) {
      this.defer.resolve({ test_prop: "test prop value" });
      this.defer.promise
        .get("test_prop")
        .then(function(value) {
          check(done, function() {
            expect( value ).to.equal("test prop value");
          });
        }).done();
    });

    it("propagates a rejection", function(done) {
      var exception = new Error("boo!");
      this.defer.reject(exception);
      this.defer.promise
        .get("test_prop")
        .then(null, function(reason) {
          check(done, function() {
            expect(reason).to.equal(exception);
          });
        }).done();
    });
  });

  describe("#invoke", function() {
    it("calls the function on the promise's value object", function(done) {
      var v = {
        foo: function(value) {
          return "foo " + value;
        }
      };
      this.defer.promise
        .invoke("foo", "test value")
        .then(function (value) {
          check(done, function() {
            expect( value ).to.equal("foo test value");
          });
        }).done();
      this.defer.resolve(v);
    });

    it("rejects promise if object does not have requested function", function(done) {
      var v = {};
      this.defer.promise
        .invoke("foo", "test value")
        .then(null, function (reason) {
          check(done, function() {
            expect( reason ).to.be.an.instanceof(Error);
          });
        }).done();
      this.defer.resolve(v);
    });
  });

  describe("#fin", function() {
    it("calls function on resolved", function(done) {
      function callback() { done(); }
      this.defer.promise.fin(callback);
      this.defer.resolve("foo");
    });

    it("calls function on rejected", function(done) {
      function callback() { done(); }
      this.defer.promise.fin(callback);
      this.defer.reject("bar");
    });

    it("returns the same promise", function() {
      function callback() { }
      var promise = this.defer.promise.fin(callback);
      expect( promise ).to.equal(this.defer.promise);
    });
  });
});
