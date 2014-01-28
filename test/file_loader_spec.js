/* jshint expr:true */
require("./support/titanium");
var check          = require("./support/asyncCheck");
var sinon          = require("sinon");
var chai           = require("chai");
var expect         = chai.expect;
var AssertionError = chai.AssertionError;
var FileLoader     = require("file_loader");
var Q              = require("q");
var fakeTimeout    = 10;

function fakeOnError(url, response) {
  Q.delay(fakeTimeout).then(function() {
    Ti.Network._requestURLs[url].onerror({error: response});
  });
}

function fakeOnLoad(url, response) {
  Q.delay(fakeTimeout).then(function() {
    Ti.Network._requestURLs[url].onload.call(response);
  });
}

function fakeOnDataStream(url, response) {
  Q.delay(fakeTimeout).then(function() {
    Ti.Network._requestURLs[url].ondatastream({progress: response});
  });
}

describe("FileLoader#download", function() {
  var sandbox = sinon.sandbox.create();
  this.timeout(200);

  before(function() {
    // Use the silly mocking system provided by mockti
    Ti.Network.fakeRequests = true;
    Ti.Network.online = true;
  });

  after(function() {
    Ti.Network.fakeRequests = false;
  });

  beforeEach(function() {
    this.test_data = "test data";
    this.response = {
      status:       200,
      responseData: this.test_data
    };
    this.url = "http://example.com/test_file.png";

    this.fileWriteStub   = sandbox.stub(FileLoader.File.prototype, "write").returns(true);
    this.fileExistsStub  = sandbox.stub(FileLoader.File.prototype, "exists");
    this.fileExpiredStub = sandbox.stub(FileLoader.File.prototype, "expired");
    this.createClientSpy = sandbox.spy(Ti.Network, "createHTTPClient");

    FileLoader.setupTaskStack(); // Force a fresh queue for testing
  });

  afterEach(function() {
    sandbox.restore();
    Ti.Network.online = true;
    Ti.Network._clear();
  });

  it("rejects the promise when network unavailable", function(done) {
    var test = this;
    Ti.Network.online = false;
    FileLoader.download("http://test.example.com/image.png")
      .fail(function(reason) {
        check(done, function() {
          sinon.assert.notCalled(test.createClientSpy);
          expect( reason ).to.match(/offline/i);
        });
      }).done();
  });

  it("rejects the promise when there is a network error", function(done) {
    FileLoader.download(this.url)
      .then(function(val) {
        done(new AssertionError("expected promise to be rejected (" + val + ")"));
      }, function(reason) {
        check(done, function() {
          expect( reason ).to.have.property("error", "test_error");
        });
      }).done();
    fakeOnError(this.url, "test_error");
  });

  it("resolves the promise when file data has been written", function(done) {
    FileLoader.download(this.url)
      .then(function(value) {
        check(done, function() {
          expect( value ).to.be.an.instanceof(FileLoader.File);
        });
      }).done();
    fakeOnLoad(this.url, this.response);
  });

  describe("with cached files", function() {
    beforeEach(function() {
      var test_file = FileLoader.File.fromURL(this.url);
      test_file.md5 = Ti.Utils.md5HexDigest(this.test_data);
      test_file.save();

      this.fileExistsStub.returns(true);
    });

    it("resolves when file is cached and not expired", function(done) {
      var test = this;
      this.fileExpiredStub.returns(false);

      FileLoader.download(this.url).then(function(value) {
        check(done, function() {
          sinon.assert.notCalled(test.createClientSpy);
          sinon.assert.notCalled(test.fileWriteStub);
        });
      }).done();
    });

    it("requests new file when cache is expired", function(done) {
      var test = this;
      this.fileExpiredStub.returns(true);
      this.response.responseData = "changed_data";

      FileLoader.download(this.url).then(function(value) {
        check(done, function() {
          sinon.assert.called(test.createClientSpy);
          sinon.assert.called(test.fileWriteStub);
        });
      }).done();

      fakeOnLoad(this.url, this.response);
    });

    it("does not write file when data has not changed", function(done) {
      var test = this;
      this.fileExpiredStub.returns(true);

      FileLoader.download(this.url).then(function(value) {
        check(done, function() {
          sinon.assert.called(test.createClientSpy);
          sinon.assert.notCalled(test.fileWriteStub);
        });
      }).done();

      fakeOnLoad(this.url, this.response);
    });
  });

  it("queues requests with a throttle limit", function(done) {
    var test = this;

    FileLoader.download("a");
    FileLoader.download("b");
    FileLoader.download("c");
    FileLoader.download("d");
    FileLoader.download("e");

    Q.delay(fakeTimeout).then(function() {
      check(done, function() {
        sinon.assert.callCount(test.createClientSpy, Ti.App.cache_requests);
      });
    });
  });

  // FIXME: This feature has been removed and needs to be reinvented.
  it.skip("notifies promise while recieving network data", function(done) {
    var test = this;
    FileLoader.download(this.url).progress(function(value) {
      check(done, function() {
        expect( value ).to.have.property("progress", 0.9);
      });
    }).done();
    fakeOnDataStream(this.url, 0.9);
  });

  it("handles HTTPClient options", function(done) {
    var test = this;
    FileLoader.download(this.url, { username: "bob" }).then(function() {
      check(done, function() {
        sinon.assert.calledWith(test.createClientSpy, sinon.match.has("username", "bob"));
      });
    }).done();

    fakeOnLoad(this.url, this.response);
  });

  describe("Redirects", function() {
    beforeEach(function() {
      this.response = {
        status:       200,
        responseData: "test_data",
        location:     "test_location",
      };
    });

    it("does not use the built-in autoRedirect", function(done) {
      var test = this;
      FileLoader.download("a").done();
      Q.delay(fakeTimeout).then(function() {
        check(done, function() {
          sinon.assert.calledWith(test.createClientSpy, sinon.match.has("autoRedirect", false));
        });
      });
    });

    function fakeRedirectedOnLoad(index, response) {
      Q.delay(fakeTimeout).then(function() {
        Ti.Network._requests[index].onload.call(response);
      });
    }

    function testRedirect(done, redirectCode, asserts) {
      var test = this;
      this.response._redirectStatus = redirectCode;
      FileLoader.download(this.url).then(function() {
        check(done, asserts);
      }, function(err) {
        done(new AssertionError("expected promise to be fulfilled: " + err));
      }).done();
      Q.delay(fakeTimeout).then(function() {
        test.response.status = redirectCode;
        Ti.Network._requests[0].onload.call(test.response);
      }).delay(fakeTimeout).then(function() {
        test.response.status = 200;
        Ti.Network._requests[1].onload.call(test.response);
      });
    }

    [301, 302].forEach(function(redirectCode) {
      it("handles a " + redirectCode + " redirect", function(done) {
        var test = this;
        testRedirect.call(this, done, redirectCode, function() {
          sinon.assert.calledTwice(test.createClientSpy);
          expect( Ti.Network._requestURLs ).to.have.property("test_location");
        });
      });
    });
  });
});
