// FileLoader - A caching file downloader for Titanium
//
// Public Domain. Use, modify and distribute it any way you like. No attribution required.
//
// NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
//
// This is a reinvention of [David Geller's caching code][1]. It will download
// a file and cache it on the device allowing the cached version to be used
// instead of spawning repeated HTTP connections. It is based on the Promise/A+
// specifications and uses a modified version of [pinkySwear][2] to facilitate
// a promise based API for use in a Titanium project.
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
// The `download()` method returns a [pinkySwear][2] promise. You do not have
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
// The modified pinkySwear in this file even offers two convenience methods for
// the above:
//
//     FileLoader.download("http://example.com/image.png")
//       .invoke("getFile")
//       .then(function(tiFile) { imageView.image = tiFile; });
//
// With the modified pinkySwear promise you have the following methods at your
// disposal:
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
// - `get(prop)`    - Same as `then(function(value) { return value[prop]; })`
// - `invoke(prop, args...)` -
//             Same as `then(function(value) { return value[prop](args...); })`
//
// ## Configuration
//
// You can adjust the following variables either defined a globals or in your
// `Alloy.CFG` namespace:
//
// - `caching_property_key` - The `Ti.App.Property key to use for storing the
//                            cache metadata.
// - `cache_expiration` - How long a cached file is concidered expired since
//                        the last time it was requested.
// - `cache_directory` - The directory to save the cache files. On iOS the
//                       `applicationSupportDirectory` is prefixed. on all
//                       others the `applicationDataDirectory` is prefixed.
//
// [1]: http://developer.appcelerator.com/question/125483/how-to-create-a-generic-image-cache-sample-code#answer-218718
// [2]: https://github.com/timjansen/PinkySwear.js
// [3]: http://promises-aplus.github.io/promises-spec/

// Constants {{{1
// Load constants allowing them to be overwriten with configuration.
var HTTP_TIMEOUT    = 10000;
var MAX_ASYNC_TASKS = 10;
var CACHE_METADATA_PROPERTY, EXPIRATION_TIME, CACHE_PATH_PREFIX;
(function() {
  var have_alloy = (typeof Alloy !== 'undefined' && Alloy !== null && Alloy.CFG);

  if (have_alloy && Alloy.CFG.cache_metadata_property) {
    CACHE_METADATA_PROPERTY = Alloy.CFG.caching_property_key;
  }
  else if (typeof caching_property_key !== 'undefined' && caching_property_key !== null) {
    CACHE_METADATA_PROPERTY = CACHING_PROPERTY_KEY;
  }
  else {
    CACHE_METADATA_PROPERTY = "file_loader_cache_metadata";
  }

  if (have_alloy && Alloy.CFG.cache_expiration) {
    EXPIRATION_TIME = Alloy.CFG.cache_expiration;
  }
  else if (typeof cache_expiration !== 'undefined' && cache_expiration !== null) {
    EXPIRATION_TIME = cache_expiration;
  }
  else {
    EXPIRATION_TIME = 3600000; // 60 minutes
  }

  if (have_alloy && Alloy.CFG.cache_directory) {
    CACHE_PATH_PREFIX = Alloy.CFG.cache_directory;
  }
  else if (typeof cache_directory !== 'undefined' && cache_directory !== null) {
    CACHE_PATH_PREFIX = cache_directory;
  }
  else {
    CACHE_PATH_PREFIX = "cached_files";
  }
})();

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
  return cache_dir.resolve();
})();

// Class: File {{{1

// Constructor {{{2
function File(id) {
  this.id        = id;
  var cache_data = metadata[this.id];
  this.file_path = Ti.Filesystem.getFile(cache_path, this.id);

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
  this.file_path.write(data);
  this.md5 = File.getMD5(data);
  return this.exists();
};

// File::exists {{{2
File.prototype.exists = function() {
  return this.file_path.exists();
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
  this.file_path.deleteFile();
  delete metadata[this.id];
  saveMetaData();
  this.is_cached = false;
};

// File::getPath {{{2
File.prototype.getPath = function() {
  return this.file_path.resolve();
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
  // Insanely simple conversion to keep id unique to the url and prevent
  // possible illegal filesystem characters and removes path seperators.
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

// FileLoader.download - Attempt to download and cache url {{{2
FileLoader.download = function(args) {
  var waitingForPath;
  var url = args.url || args;
  var file = File.fromURL(url);

  if (pending_tasks[file.id]) {
    Ti.API.info("Pending " + file.id + ": " + url);
    pending_tasks[file.id].then(args.onload, args.onerror, args.ondatastream);
    return pending_tasks[file.id];
  }

  if (file.is_cached && !file.expired()) {
    file.updateLastUsedAt().save();
    Ti.API.info("Cached " + file.id + ": " + url);
    waitingForPath = pinkySwear();
    waitingForPath.then(args.onload, args.onerror, args.ondatastream);
    waitingForPath(true, [file]);
    return waitingForPath;
  }

  var waitingForDownload = requestDispatch()
    .then(function() {
      var waitForHttp = pinkySwear();
      spawnHTTPClient(url, waitForHttp);
      Ti.API.info("Downloading " + file.id + ": " + url);
      return waitForHttp;
    })
    .get("source")
    .get("responseData")
    .then(function(data) {
      if (!file.write(data)) {
        throw new Error("Failed to save data from " + url + " to " + file.getPath());
      }
      file.downloaded = true;
      file.updateLastUsedAt().save();
      return file;
    })
    .fin(function() {
      delete pending_tasks[file.id];
      dispatchNextTask();
    });

  pending_tasks[file.id] = waitingForDownload;
  dispatchNextTask();

  return waitingForDownload;
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

// Export File class {{{2
FileLoader.File = File;

// PinkySwear - Minimalistic implementation of the Promises/A+ spec {{{1
// Public Domain. Use, modify and distribute it any way you like. No attribution required.
// NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
// https://github.com/timjansen/PinkySwear.js
var pinkySwear = FileLoader.pinkySwear = (function() {
  /* jshint eqnull:true */
  function isFunction(f,o) { return typeof f == 'function'; }
  function defer(callback) { setTimeout(callback, 0); }

  function pinkySwear() {
    var state;           // undefined/null = pending, true = fulfilled, false = rejected
    var values = [];     // an array of values as arguments for the then() handlers
    var deferred = [];   // functions to call when set() is invoked
    var progress = [];   // functoins to call when notify() is invoked

    var set = function promise(newState, newValues) {
      if (state == null) {
        state = newState;
        values = newValues;
        defer(function() {
          for (var i = 0; i < deferred.length; i++)
            deferred[i]();
        });
      }
    };

    set.then = function(onFulfilled, onRejected, onProgress) {
      var newPromise = pinkySwear();
      var callCallbacks = function() {
        try {
          var f = (state ? onFulfilled : onRejected);
          if (isFunction(f)) {
            var r = f.apply(null, values);
            if (r && isFunction(r.then))
              r.then(
                function(value){newPromise(true,  [value]);},
                function(value){newPromise(false, [value]);}
              );
            else
              newPromise(true, [r]);
          }
          else
            newPromise(state, values);
        }
        catch (e) {
          newPromise(false, [e]);
        }
      };
      if (state != null)
        defer(callCallbacks);
      else
        deferred.push(callCallbacks);
      if (isFunction(onProgress))
        set.progress(function(value) {
          newPromise.notify(onProgress(value));
        });
      return newPromise;
    };

    set.notify = function(value) {
      defer(function() {
        for (var i = 0; i < progress.length; i++)
          progress[i](value);
      });
    };

    set.resolve = function(value) { set(true,  [value]); };
    set.reject  = function(value) { set(false, [value]); };

    set.progress = function(onProgress) { progress.push(onProgress); return set; };

    // always(func) is the same as then(func, func)
    set.always = function(func) { return set.then(func, func); };

    // fin(func) is like always() but doesn't modify the promise chain
    set.fin = function(func) { set.then(func, func); return set; };

    // error(func) is the same as then(0, func)
    set.error = set.fail = function(func) { return set.then(0, func); };

    set.get = function(prop) {
      return set.then(function(value) { return value[prop]; });
    };

    set.invoke = function(prop) {
      var args = [].slice.call(arguments, 1) || [];
      return set.then(function(value) { return value[prop].apply(value, args); });
    };

    return set;
  }

  return pinkySwear;
})();
// }}}1

module.exports  = FileLoader;
/* vim:set ts=2 sw=2 et fdm=marker: */
