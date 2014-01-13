// Tests FileLoader.Promise with the Promises / A+ Test Suite (https://github.com/promises-aplus/promises-tests)
// Includes tests for custom features.
require("./support/titanium");
var expect             = require("chai").expect;
var promisesAplusTests = require("promises-aplus-tests").mocha;
var FileLoader         = require("file_loader");

function getAdapter(Promise) {
  return {
    deferred: Promise.defer
  };
}

describe("Promises/A+ Tests", function () {
  promisesAplusTests(getAdapter(FileLoader.Promise));
});

describe("Promise Extentions", function(){
  var adapter = getAdapter(FileLoader.Promise);
  this.timeout(200);

  describe("#progress / #notify", function() {
    beforeEach(function() {
      this.deferred = adapter.deferred();
    });

    it("calls the onProgress function", function(done) {
      this.deferred.promise.progress(function(v) {
        expect( v ).to.equal("test");
        done();
      });
      this.deferred.notify("test");
    });

    it("calls the onProgress function when chained", function(done) {
      function onFullfilled(v) { return v; }
      this.deferred.promise
        .then(onFullfilled)
        .then(onFullfilled)
        .progress(function(v) {
          expect( v ).to.equal("test");
          done();
        }).done();
      this.deferred.notify("test");
    });

    it("accepts onProgress via then() function");

    it("does a noop if promise is fulfilled/rejected");
  });

  describe("#get", function() {
    it("returns the value from the promises's value object");

    it("rejects the promise if the object does not have requested property");
  });

  describe("#invoke", function() {
    it("calls the function on the promise's value object");

    it("rejects promise if object does not have requested function");
  });

  describe("#fin", function() {
    it("calls function on resolved");

    it("calls function on rejected");

    it("returns the same promise");
  });
});
