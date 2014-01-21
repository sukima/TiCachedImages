/* jshint expr:true */
require("./support/titanium");
var check      = require("./support/asyncCheck");
var sinon      = require("sinon");
var expect     = require("chai").expect;
var FileLoader = require("file_loader");

describe("FileLoader#download", function() {
  var sandbox = sinon.sandbox.create();
  var FakeHTTPClient = {
    open: function() { },
    send: function() { }
  };
  this.timeout(200);

  beforeEach(function() {
    this.test_data = "test data";
    this.response = {
      status:       200,
      responseData: this.test_data
    };
    this.url = "http://example.com/test_file.png";

    this.fileWriteStub    = sandbox.stub(FileLoader.File.prototype, "write").returns(true);
    this.fileExistsStub   = sandbox.stub(FileLoader.File.prototype, "exists");
    this.fileExpiredStub  = sandbox.stub(FileLoader.File.prototype, "expired");
    this.httpClientMock   = sandbox.mock(FakeHTTPClient);
    this.createClientStub = sandbox.stub(Ti.Network, "createHTTPClient")
      .returns(FakeHTTPClient);

    Ti.Network.online = true;
    FileLoader.setupTaskStack(); // Force a fresh queue for testing
  });

  afterEach(function() {
    this.httpClientMock.verify();
    sandbox.restore();
    Ti.Network.online = true;
  });

  it("rejects the promise when network unavailable", function(done) {
    var test = this;
    Ti.Network.online = false;
    FileLoader.download("http://test.example.com/image.png")
      .fail(function(reason) {
        check(done, function() {
          expect( test.createClientStub.called ).to.be.false;
          expect( reason ).to.match(/offline/i);
        });
      }).done();
  });

  it("rejects the promise when there is a network error", function(done) {
    this.createClientStub.yieldsToAsync("onerror", "test_error");
    FileLoader.download("http://test.example.com/image.png")
      .fail(function(reason) {
        check(done, function() {
          expect( reason ).to.equal("test_error");
        });
      }).done();
  });

  it("resolves the promise when file data has been written", function(done) {
    this.createClientStub.yieldsToAsync("onload", {source:{responseData: "xxx"}});

    FileLoader.download("http://test.example.com/image.png")
      .then(function(value) {
        check(done, function() {
          expect( value ).to.be.an.instanceof(FileLoader.File);
        });
      }).done();
  });

  describe("with cached files", function() {
    beforeEach(function() {
      var test_file = FileLoader.File.fromURL(this.url);
      test_file.md5 = Ti.Utils.md5HexDigest(this.test_data);
      test_file.save();

      this.fileExistsStub.returns(true);
      this.createClientStub.yieldsToAsync("onload", {source: this.response});
    });

    it("resolves when file is cached and not expired", function(done) {
      var test = this;
      this.fileExpiredStub.returns(false);

      FileLoader.download(this.url).then(function(value) {
        check(done, function() {
          expect( test.createClientStub.called ).to.be.false;
          expect( test.fileWriteStub.called ).to.be.false;
        });
      }).done();
    });

    it("requests new file when cache is expired", function(done) {
      var test = this;
      this.fileExpiredStub.returns(true);
      this.response.responseData = "changed_data";

      FileLoader.download(this.url).then(function(value) {
        check(done, function() {
          expect( test.createClientStub.called ).to.be.true;
          expect( test.fileWriteStub.called ).to.be.true;
        });
      }).done();
    });

    it("does not write file when data has not changed", function(done) {
      var test = this;
      this.fileExpiredStub.returns(true);

      FileLoader.download(this.url).then(function(value) {
        check(done, function() {
          expect( test.createClientStub.called ).to.be.true;
          expect( test.fileWriteStub.called ).to.be.false;
        });
      }).done();
    });
  });

  it("queues requests with a throttle limit", function(done) {
    var test = this;

    FileLoader.download("a");
    FileLoader.download("b");
    FileLoader.download("c");
    FileLoader.download("d");
    FileLoader.download("e");

    setTimeout(function() {
      check(done, function() {
        expect( test.createClientStub.callCount ).to.equal(Ti.App.cache_requests);
      });
    }, 10);
  });

  // FIXME: This feature has been removed and needs to be reinvented.
  it.skip("notifies promise while recieving network data", function(done) {
    var test = this;
    FileLoader.download("a").progress(function(value) {
      check(done, function() {
        expect( value ).to.have.property("progress", 0.9);
      });
    }).done();

    setTimeout(function() {
      var ondatastream = test.createClientStub.getCall(0).args[0].ondatastream;
      ondatastream({progress: 0.9});
    }, 10);
  });

  it("handles HTTPClient options", function(done) {
    var _this = this;
    this.createClientStub.yieldsToAsync("onload", {source: this.response});
    FileLoader.download("x", { username: "bob" }).then(function() {
      check(done, function() {
        sinon.assert.calledWith(_this.createClientStub, sinon.match.has("username", "bob"));
      });
    }).done();
  });

});
