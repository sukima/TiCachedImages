// FileLoader - A caching file downloader for Titanium
//
//
// This is a reinvention of [David Geller's caching code][1]. It will download
// a file and cache it on the device allowing the cached version to be used
// instead of spawning repeated HTTP connections. It is based on the Promise/A+
// specifications and uses a modified version of [then/promise][2] to facilitate
// a promise based API for use in a Titanium project.
//
// FileLoader, Copyright (c) 2013 Devin Weaver
// [then/promise][2], Copyright (c) 2013 Forbes Lindesay
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
//
// For the latest version visit: https://github.com/sukima/TiCachedImages
//
// ## Dependencies
// * None
//
// ## API
// Once required, the following methods are available:
//
// - `download()` - Attempt to download a file from a URL or offer a cached version.
// - `gc()` - Search the cache for any expired files and delete them (Garbage Collect).
//
// The `download()` method returns a [promise][3] object. This object can be
// used to attach callbacks to that you want to execute after the correct file
// path has been resolved (either by cache or downloaded). The callbacks are
// passed in a File object which has the following methods and properties:
//
// - `getFile()`  - Returns a `Ti.FilesystemFile` object. Used to pass to a
//                  `ImageView.image`.
// - `getPath()`  - Returns a string to the cached file. Used for properties
//                  that need a string not a file object (`TableViewRow.leftImage`)
// - `expired()`  - Returns true/false for when the expired time has elapsed
//                  since this URL was last requested. By passing in true you will
//                  invalidate this file's cache forcing a download on next
//                  request.
// - `downloaded` - true if this URL was just downloaded, false if it was
//                  already in cached.
// - `is_cached`  - true if this file has been cached or not.
//
// There are several others but these are the few you will need, if that. See more below.
//
// ## Promises
// The `download()` method returns a [then/promise][2] promise. You do not have
// to use promises if you do not want to. However I highly recommend their use.
// The internals are all managed via promises. If after reading this your still
// convinced to avoid them you can use callbacks like such:
//
//     FileLoader.download({
//       url:          "http://example.com/image.png",
//       onload:       function(file) { imageView.image = file.getFile(); },
//       onerror:      function(error) { ... },
//       ondatastream: function(progress) { ... }
//     });
//
// That so not pretty, Let us promise to write better code:
//
//     FileLoader.download("http://example.com/image.png")
//       .then(function(file) { ... })
//       .fail(function(error) { ... })
//       .progress(function(progress) { ... });
//
// Much better. A promise is an object which will remain pending till an event
// assigns it a fulfilled value. Like an HTTP request sending it the
// responseData. When a promise is fulfilled or rejected the corresponding
// functions attached are called. The advantage with promises is that you can
// chain them:
//
//     FileLoader.download("http://example.com/image.png")
//       .then(function(file) { return file.getFile(); })
//       .then(function(tiFile) { imageView.image = tiFile; });
//
// The modified [then/promise][2] implementation in this file even offers two
// convenience methods for the above:
//
//     FileLoader.download("http://example.com/image.png")
//       .invoke("getFile")
//       .then(function(tiFile) { imageView.image = tiFile; });
//
// With the modified Promise you have the following methods at your disposal:
//
// - `then(fn)`     - Attach callbacks (fulfilled, rejected, progress). Returns
//                    a new promise based on the return values / thrown
//                    exceptions of the callbacks.
// - `fail(fn)`     - Same as `then(null, fn)`
// - `progress(fn)` - Same as `then(null, null, fn)`
// - `always(fn)`   - Return a new promise which will resolve regardless if the
//                    former promise is fulfilled or rejected.
// - `fin(fn)`      - Execute the function when the promise is fulfilled or
//                    rejected regardless. Returns the original promise to
//                    continue the chain.
// - `done()`       - Any errors uncaught (or errors in the error function)
//                    will be rethrown. Ends the chain.
// - `get(prop)`    - Same as `then(function(value) { return value[prop]; })`
// - `invoke(prop, args...)` -
//             Same as `then(function(value) { return value[prop](args...); })`
//
// ## Configuration
//
// To set configuration when using Alloy set them in your `app/config.json`
// Otherwise if Alloy is not used set them in `app.js` on `Ti.App`.
//
// You can adjust the following variables:
//
// - `cache_property_key` - The `Ti.App.Property` key to use for storing the
//                            cache metadata.
// - `cache_expiration` - How long a cached file is considered expired since
//                        the last time it was requested.
// - `cache_directory` - The directory to save the cache files. On iOS the
//                       `applicationSupportDirectory` is prefixed. on all
//                       others the `applicationDataDirectory` is prefixed.
// - `cache_requests` - The number of simultaneous network requests allowed.
//
// [1]: http://developer.appcelerator.com/question/125483/how-to-create-a-generic-image-cache-sample-code#answer-218718
// [2]: https://github.com/then/promise
// [3]: http://promises-aplus.github.io/promises-spec/

// Constants {{{1
// Load constants allowing them to be overwritten with configuration.
var HTTP_TIMEOUT = 10000;
var CACHE_METADATA_PROPERTY, EXPIRATION_TIME, CACHE_PATH_PREFIX, MAX_ASYNC_TASKS;
(function(global) {
  var have_alloy = (typeof Alloy !== 'undefined' && Alloy !== null && Alloy.CFG);

  function loadConfig(name) {
    /* jshint eqnull:true */
    if (have_alloy && Alloy.CFG[name] != null) {
      return Alloy.CFG[name];
    }
    if (global[name] != null) {
      return global[name];
    }
  }

  CACHE_METADATA_PROPERTY = loadConfig("cache_property_key") || "file_loader_cache_metadata";
  CACHE_PATH_PREFIX       = loadConfig("cache_directory")    || "cached_files";
  EXPIRATION_TIME         = loadConfig("cache_expiration")   || 3600000; // 60 minutes
  MAX_ASYNC_TASKS         = loadConfig("cache_requests")     || 10;

})(Ti.App);

// Metadata {{{1
var metadata = Ti.App.Properties.getObject(CACHE_METADATA_PROPERTY) || {};

function saveMetaData() {
  Ti.App.Properties.setObject(CACHE_METADATA_PROPERTY, metadata);
}

// Cache path {{{1
// Make sure we have the directory to store files.
var cache_path = (function() {
  var os = Ti.Platform.osname;
  var data_dir = (os === "iphone" || os === "ipad") ?
    Ti.Filesystem.applicationSupportDirectory :
    Ti.Filesystem.applicationDataDirectory;
  var cache_dir = Ti.Filesystem.getFile(data_dir, CACHE_PATH_PREFIX);
  if (!cache_dir.exists()) {
    cache_dir.createDirectory();
  }
  return cache_dir;
})();

// Class: File {{{1

// Constructor {{{2
function File(id) {
  this.id        = id;
  var cache_data = metadata[this.id];
  this.file_path = Ti.Filesystem.getFile(cache_path.resolve(), this.id);

  if (cache_data) {
    this.is_cached    = this.exists();
    this.last_used_at = cache_data.last_used_at;
    this.md5          = cache_data.md5;
  }
  else {
    this.is_cached    = false;
    this.last_used_at = 0;
    this.md5          = null;
  }
}

// File::updateLastUsedAt {{{2
File.prototype.updateLastUsedAt = function() {
  this.last_used_at = new Date().getTime();
  return this;
};

// File::save {{{2
File.prototype.save = function() {
  metadata[this.id] = {
    last_used_at: this.last_used_at,
    md5:          this.md5
  };
  saveMetaData();
  this.is_cached = true;
  return this;
};

// File::write {{{2
File.prototype.write = function(data) {
  // A Titanium bug cause this to always return false. We need to manually
  // check it exists. And assume it worked.
  // (https://jira.appcelerator.org/browse/TIMOB-1658)
  this.getFile().write(data);
  this.md5 = File.getMD5(data);
  // Ti.API.debug("Wrote " + this.getPath() + " (" + this.md5 + ")"); // DEBUG
  return this.exists();
};

// File::exists {{{2
File.prototype.exists = function() {
  return this.getFile().exists();
};

// File::expired {{{2
File.prototype.expired = function(invalidate) {
  if (invalidate) {
    this.last_used_at = 0;
    this.save();
  }
  return ((new Date().getTime() - this.last_used_at) > EXPIRATION_TIME);
};

// File::expunge {{{2
File.prototype.expunge = function() {
  this.getFile().deleteFile();
  // Ti.API.debug("Expunged " + this.id); // DEBUG
  delete metadata[this.id];
  saveMetaData();
  this.is_cached = false;
};

// File::getPath {{{2
File.prototype.getPath = function() {
  return this.getFile().resolve();
};

// File::toString {{{2
File.prototype.toString = function() {
  return "" + this.id + ": " +
    (this.is_cached ? "cached" : "new") + " file" +
    (this.pending ? " (pending)" : "") +
    (this.downloaded ? " (downloaded)" : "") +
    (this.expired() ? " (expired)" : "") +
    (this.last_used_at ? ", Last used: " + this.last_used_at : "") +
    (this.md5 ? ", MD5: " + this.md5 : "") +
    " " + this.getPath();
};

// File.getFile {{{2
File.prototype.getFile = function() {
  return this.file_path;
};

// File.getMD5 {{{2
File.getMD5 = function(data) {
  return Ti.Utils.md5HexDigest(data);
};

// File.idFromUrl {{{2
File.idFromUrl = function(url) {
  // Insanely simple conversion to keep id unique to the URL and prevent
  // possible illegal file system characters and removes path separators.
  // MD5 should be fast enough not that this is repeated so much.
  return Ti.Utils.md5HexDigest(url);
};

// File.fromURL {{{2
File.fromURL = function(url) {
  return new File(File.idFromUrl(url));
};

// FileLoader {{{1
var pending_tasks = {dispatch_queue:[]};
var FileLoader = {};

// requestDispatch (private) {{{2
function requestDispatch() {
  var waitForDispatch = pinkySwear();
  pending_tasks.dispatch_queue.push(waitForDispatch);
  return waitForDispatch;
}

// dispatchNextTask (private) {{{2
function dispatchNextTask() {
  var task;
  if (pending_tasks.dispatch_queue.length < MAX_ASYNC_TASKS) {
    task = pending_tasks.dispatch_queue.shift();
    if (!task) { return; }
    if (task.resolve) { task.resolve(); }
    else { poorMansNextTick(task); }
  }
}

// spawnHTTPClient (private) {{{2
function spawnHTTPClient(url, pinkyPromise) {
  var http = Ti.Network.createHTTPClient({
    onload:       pinkyPromise.resolve,
    onerror:      pinkyPromise.reject,
    ondatastream: pinkyPromise.notify,
    timeout:      HTTP_TIMEOUT
  });
  http.open("GET", url);
  http.send();
}

// FileLoader.download - Attempt to download and cache URL {{{2
FileLoader.download = function(args) {
  var waitingForPath;
  var url = args.url || args;
  var file = File.fromURL(url);

  function attachCallbacks(promise) {
    if (args.onload || args.onerror || args.ondatastream) {
      return promise
        .then(args.onload, args.onerror, args.ondatastream);
    }
    return promise;
  }

  if (pending_tasks[file.id]) {
    // Ti.API.debug("Pending " + url + ": " + file); // DEBUG
    return attachCallbacks(pending_tasks[file.id]);
  }

  if (file.is_cached && !file.expired()) {
    file.updateLastUsedAt().save();
    // Ti.API.debug("Cached " + url + ": " + file); // DEBUG
    waitingForPath = pinkySwear();
    waitingForPath(true, [file]);
    return attachCallbacks(waitingForPath);
  }

  if (!Ti.Network.online) {
    var offlinePromise = pinkySwear();
    offlinePromise(false, ["Network offline"]);
    return attachCallbacks(offlinePromise);
  }

  var waitingForDownload = requestDispatch()
    .then(function() {
      var waitForHttp = pinkySwear();
      spawnHTTPClient(url, waitForHttp);
      // Ti.API.debug("Downloading " + url + ": " + file); // DEBUG
      return waitForHttp;
    })
    .get("source")
    .get("responseData")
    .then(function(data) {
      if (!file.write(data)) {
        throw new Error("Failed to save data from " + url + ": " + file);
      }
      file.downloaded = true;
      file.updateLastUsedAt().save();
      return file;
    })
    .fin(function() {
      delete pending_tasks[file.id];
      file.pending = false;
      dispatchNextTask();
    });

  file.pending = true;
  pending_tasks[file.id] = waitingForDownload;
  dispatchNextTask();

  return attachCallbacks(waitingForDownload);
};

// FileLoader.pruneStaleCache - (alias: gc) Remove stale cache files {{{2
FileLoader.pruneStaleCache = FileLoader.gc = function(force) {
  var id, file;
  for (id in metadata) {
    file = new File(id);
    if (force || file.expired()) {
      file.expunge();
    }
  }
};

// Promise {{{1
//
// Promise is a minimalistic implementation of the Promise/A+ spec and is
// available at https://github.com/then/promise under the MIT License.
// Copyright (c) 2013 Forbes Lindesay
//
// This embeded version modified by Devin Weaver.
//
function asap(fn) { setTimeout(fn, 0); }

// Promise {{{2
function Promise(fn) {
  if (!(this instanceof Promise)) return new Promise(fn);
  if (typeof fn !== 'function') throw new TypeError('not a function');
  var state = null;
  var value = null;
  var progress_fns = null;
  var deferreds = [];
  var self = this;

  // Promise.then {{{3
  this.then = function(onFulfilled, onRejected, onProgress) {
    var newPromise = new Promise(function(resolve, reject) {
      handle(new Handler(onFulfilled, onRejected, resolve, reject));
    });
    newPromise.progress = function(onProgress) {
      self.progress(onProgress);
      return newPromise;
    };
    if (typeof onProgress === 'function') self.progress(onProgress);
    return newPromise;
  };

  // notify {{{3
  function notify(v) {
    function progressHandler(fn, v) {
      if (typeof fn === 'function') fn.call(void 0, v);
    }
    for (var i = 0, len = progress_fns.length; i < len; i++)
      asap(progressHandler(progress_fns[i], v));
  }

  // progress {{{3
  function progress(onProgress) {
    if (progress_fns === null) { progress_fns = []; }
    progress_fns.push(onProgress);
  }

  this.progress = function(onProgress) {
    progress(onProgress);
    return this;
  };

  // handle {{{3
  function handle(deferred) {
    if (state === null) {
      deferreds.push(deferred);
      return;
    }
    asap(function() {
      var cb = state ? deferred.onFulfilled : deferred.onRejected;
      if (cb === null) {
        (state ? deferred.resolve : deferred.reject)(value);
        return;
      }
      var ret;
      try {
        ret = cb(value);
      }
      catch (e) {
        deferred.reject(e);
        return;
      }
      deferred.resolve(ret);
    });
  }

  // resolve {{{3
  function resolve(newValue) {
    try { //Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
      if (newValue === self) throw new TypeError('A promise cannot be resolved with itself.');
      if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
        var then = newValue.then;
        if (typeof then === 'function') {
          doResolve(then.bind(newValue), resolve, reject);
          return;
        }
      }
      state = true;
      value = newValue;
      finale();
    } catch (e) { reject(e); }
  }

  // reject {{{3
  function reject(newValue) {
    state = false;
    value = newValue;
    finale();
  }

  // finale {{{3
  function finale() {
    for (var i = 0, len = deferreds.length; i < len; i++)
      handle(deferreds[i]);
    deferreds = null;
  }

  // Handler {{{3
  function Handler(onFulfilled, onRejected, resolve, reject){
    this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
    this.onRejected = typeof onRejected === 'function' ? onRejected : null;
    this.resolve = resolve;
    this.reject = reject;
  }

  // doResolve {{{3
  /**
   * Take a potentially misbehaving resolver function and make sure
   * onFulfilled and onRejected are only called once.
   *
   * Makes no guarantees about asynchrony.
   */
  function doResolve(fn, onFulfilled, onRejected, onNotify) {
    var done = false;
    try {
      fn(function (value) {
        if (done) return;
        done = true;
        onFulfilled(value);
      }, function (reason) {
        if (done) return;
        done = true;
        onRejected(reason);
      }, function (value) {
        if (done) return;
        onNotify(value);
      });
    } catch (ex) {
      if (done) return;
      done = true;
      onRejected(ex);
    }
  }
  // }}}3

  doResolve(fn, resolve, reject, notify);
}

// Promise::done {{{2
Promise.prototype.done = function (onFulfilled, onRejected) {
  var self = arguments.length ? this.then.apply(this, arguments) : this;
  self.then(null, function (err) {
    asap(function () {
      throw err;
    });
  });
};

// Promise::fail {{{2
Promise.prototype.fail = function(fn) {
  return this.then(null, fn);
};

// Promise::get {{{2
Promise.prototype.get = function(prop) {
  return this.then(function(obj) {
    return obj[prop];
  });
};

// Promise::invoke {{{2
Promise.prototype.invoke = function(prop /*...args*/) {
  var args = Array.prototype.slice.call(arguments, 1);
  return this.then(function(obj) {
    return obj[prop].apply(obj, args);
  });
};

// Promise::fin {{{2
Promise.prototype.fin = function(onFinished) {
  this.done(onFinished, onFinished);
  return this;
};

// Promise.defer {{{2
Promise.defer = function() {
  var resolver, rejecter, notifier;
  var defer = {};

  defer.promise = new Promise(function(resolve, reject, notify) {
    defer.resolve = resolve;
    defer.reject  = reject;
    defer.notify  = notify;
  });

  return defer;
};
// }}}1

FileLoader.File    = File;
FileLoader.Promise = Promise;
module.exports     = FileLoader;
/* vim:set ts=2 sw=2 et fdm=marker: */
