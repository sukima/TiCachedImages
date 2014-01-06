// FileLoader - A caching file downloader for Titanium

// TODO: Docs

// Constants {{{1
// Load constants allowing them to be overwriten with configuration.
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
File.prototype.expired = function() {
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

// Exports {{{1
var FileLoader = {};

// #download - Attempt to download and cache url {{{2
FileLoader.download = function(url, callbacks) {
  // Promises are better. Why would you not use them?!
  if (!callbacks) { return FileLoader.downloadP(url); }

  var file = File.fromURL(url);
  if (file.is_cached && !file.expired()) {
    file.updateLastUsedAt().save();
    // Poor man's nextTick:
    Ti.API.info("Cached " + file.id + ": " + url);
    setTimeout(function() { attemptCallback(file); }, 0);
    return;
  }

  // I hate this callback crap
  function onload() {
    if (!file.write(this.responseData)) {
      if (typeof callbacks.onerror === 'function') {
        callbacks.onerror({message: "Failed to save data from " + url + " to " + file.getPath()});
      }
      return;
    }
    file.updateLastUsedAt().save();
    attemptCallback(file);
  }

  function attemptCallback(value) {
    var cb = callbacks.onload || callbacks;
    if (typeof cb === 'function') {
      cb(value);
    }
  }

  var http = Ti.Network.createHTTPClient({
    onload:       onload,
    onerror:      callbacks.onerror,
    ondatastream: callbacks.ondatastream,
    timeout:      5000
  });
  http.open("GET", url);
  http.send();

  Ti.API.info("Downloading " + file.id + ": " + url);
};

// #downloadP - Same as #download but returns a promise {{{2
FileLoader.downloadP = function(url) {
  var Q;
  try { Q = require("q"); }
  catch (e) {
    throw new Error("Promises are not supported without the Q library. Install q.js into Resources/ or app/lib/");
  }

  var file = File.fromURL(url);
  if (file.is_cached && !file.expired()) {
    file.updateLastUsedAt().save();
    Ti.API.info("Cached " + file.id + ": " + url);
    return Q(file);
  }

  var waitForHttp = Q.defer();
  var http = Ti.Network.createHTTPClient({
    onload:       waitForHttp.resolve,
    onerror:      waitForHttp.reject,
    ondatastream: waitForHttp.notify,
    timeout:      5000
  });
  http.open("GET", url);
  http.send();

  Ti.API.info("Downloading " + file.id + ": " + url);

  return waitForHttp.promise
    .get("source")
    .get("responseData")
    .then(function(data) {
      if (!file.write(data)) {
        throw new Error("Failed to save data from " + url + " to " + file.getPath());
      }
      file.updateLastUsedAt().save();
      return file;
    });
};

// pruneStaleCache - (alias: gc) Remove stale cache files {{{2
FileLoader.pruneStaleCache = FileLoader.gc = function(force) {
  var id, file;
  for (id in metadata) {
    file = new File(id);
    if (force || file.expired()) {
      file.expunge();
    }
  }
};
// }}}1

module.exports = FileLoader;
/* vim:set ts=2 sw=2 et fdm=marker: */
