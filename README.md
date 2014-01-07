FileLoader - A caching file downloader for Titanium

Public Domain. Use, modify and distribute it any way you like. No attribution required.

NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

This is a reinvention of [David Geller's caching code][1]. It will download
a file and cache it on the device allowing the cached version to be used
instead of spawning repeated HTTP connections. It is based on the Promise/A+
specifications and uses a modified version of [pinkySwear][2] to facilitate
a promise based API for use in a Titanium project.

## Dependencies
* None

## API
Once required, the following methods are available:

- `download()` - Attempt to download a file from a URL or offer a cached version.
- `gc()` - Search the cache for any expired files and delete them (Garbage Collect).

The `download()` method returns a [promise][3] object. This object can be
used to attach callbacks to that you want to execute after the correct file
path has been resolved (either by cache or downloaded). The callbacks are
passed in a File object which has the following methods and properties:

- `getFile()`  - Returns a `Ti.FilesystemFile` object. Used to pass to a
                 `ImageView.image`.
- `getPath()`  - Returns a string to the cached file. Useed for properties
                 that need a string not a file object (`TableViewRow.leftImage`)
- `expired()`  - Returns true/false for when the expired time has elapsed
                 since this URL was last requested.
- `downloaded` - true if this URL was just downloaded, false if it was
                 already in cached.
- `is_cached`  - true if this file has been cached or not.

There are several others but these are the few you will need, if that. See more below.

## Promises
The `download()` method returns a [pinkySwear][2] promise. You do not have
to use promises if you do not want to. However I highly recommend their use.
The internals are all managed via promises. If after reading this your still
convinced to avoid them you can use callbacks like such:

    FileLoader.download({
      url:          "http://example.com/image.png",
      onload:       function(file) { imageView.image = file.getFile(); },
      onerror:      function(error) { ... },
      ondatastream: function(progress) { ... }
    });

That so not pretty, Let us promise to write better code:

    FileLoader.download("http://example.com/image.png")
      .then(function(file) { ... })
      .fail(function(error) { ... })
      .progress(function(progress) { ... });

Much better. A promise is an object which will remain pending till an event
assigns it a fulfilled value. Like an HTTP request sending it the
responseData. When a promise is fulfilled or rejected the corresponding
functions attached are called. The advantage with promises is that you can
chain them:

    FileLoader.download("http://example.com/image.png")
      .then(function(file) { return file.getFile(); })
      .then(function(tiFile) { imageView.image = tiFile; });

The modified pinkySwear in this file even offers two convenience methods for
the above:

    FileLoader.download("http://example.com/image.png")
      .invoke("getFile")
      .then(function(tiFile) { imageView.image = tiFile; });

With the modified pinkySwear promise you have the following methods at your
disposal:

- `then(fn)`     - Attach callbacks (fulfilled, rejected, progress). Returns
                   a new promise based on the return values / thrown
                   exceptions of the callbacks.
- `fail(fn)`     - Same as `then(null, fn)`
- `progress(fn)` - Same as `then(null, null, fn)`
- `always(fn)`   - Return a new promise which will resolve regardless if the
                   former promise is fulfilled or rejected.
- `fin(fn)`      - Execute the function when the promise is fulfilled or
                   rejected regardless. Returns the original promise to
                   continue the chain.
- `get(prop)`    - Same as `then(function(value) { return value[prop]; })`
- `invoke(prop, args...)` -
            Same as `then(function(value) { return value[prop](args...); })`

## Configuration

You can adjust the following variables either defined a globals or in your
`Alloy.CFG` namespace:

- `caching_property_key` - The `Ti.App.Property key to use for storing the
                           cache metadata.
- `cache_expiration` - How long a cached file is concidered expired since
                       the last time it was requested.
- `cache_directory` - The directory to save the cache files. On iOS the
                      `applicationSupportDirectory` is prefixed. on all
                      others the `applicationDataDirectory` is prefixed.

## Licensing

Public Domain. Use, modify and distribute it any way you like. No attribution required.
To the extent possible under law, Tim Jansen has waived all copyright and related or neighboring rights to PinkySwear.
Please see http://creativecommons.org/publicdomain/zero/1.0/
