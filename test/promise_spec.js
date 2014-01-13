// Tests FileLoader.Promise with the Promises / A+ Test Suite (https://github.com/promises-aplus/promises-tests)
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
