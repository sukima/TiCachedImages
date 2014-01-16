[![Build Status](https://travis-ci.org/sukima/TiCachedImages.png?branch=master)](https://travis-ci.org/sukima/TiCachedImages)

# FileLoader

A caching file downloader for Titanium

Public Domain. Use, modify and distribute it any way you like. No attribution required.

NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

This is a reinvention of [David Geller's caching code][1]. It will download
a file and cache it on the device allowing the cached version to be used
instead of spawning repeated HTTP connections. It is based on the Promise/A+
specifications and uses a modified version of [then/promise][2] to facilitate
a promise based API for use in a Titanium project.

[1]: http://developer.appcelerator.com/question/125483/how-to-create-a-generic-image-cache-sample-code#answer-218718
[2]: https://github.com/then/promise

**Progress notifictions have been disabled in this release**

## Dependencies

- None

## Features

- Downloads files via Titanium's HTTPClient interface
- Store files on device as a cache
- Auto expire files based on time and re-download
- Offers a way to Garbage Collect stale cache files
- Prevent file I/O if remote file has not changed
- Auto throttle requests to prevent too many HTTP connections (good for
  TableViews with images)
- Uses a Promise/A+ compatible API
- Embeds a micro Promise/A+ implementation (No external promise dependencies)

## Rational

The core idea behind this library is to provide a convenient API to fetch a
file from a server and download it to a cache file. The management of this
needs handle asynchronous execution and multiple / repeated calls. What we want
is an application to just worry about two factors (maybe 3-4 depending). Asking
for a file by URL and what to do after the file is available. (The later two
factors being errors and progress indication).

The trouble with the built in image caching is that it is a blind cache. It
doesn't take into account expired caches or duplicated requests. To illustrate
if we have a TableView with 100 rows each with an ImageView all assigned the
*same* image URL. You will spawn 100 HTTP requests. If the table were to
refresh again you would get 100 cached images. See the problem?

Also there is no way to control when a cached object should be expired and
force a new download. Finally you don't get access to any metadata nor
activity. You can't, for instance, have a progress bar react to the downloading
of the data. Or announce to the use that something went wrong. Although the
later might be over kill for the example of ImageView it is still relevant to a
good caching algorithm and who knows what cool UX designs could come from this?

## Installing

This project includes both the library file (`file_loader.js`) and a working
Titanium app example. Although this example was designed for iOS. Functionally,
the FileLoader lib does work on Android.

TODO: This example app just looks like crap on Android till I get that fixed.

To install in your own app copy the [`file_loader.js`][3] file and install it
into either `Resources` or `app/lib` depending if your using Alloy or not.
Technically it does not matter where you place the file. In your code when you
want to use the FileLoader object require it.

    var FileLoader = require("file_loader");

[3]: https://raw.github.com/sukima/TiCachedImages/master/file_loader.js

## Usage

The basic usage is one simple function called `download()` this takes a URL and
will return a [promise][4] (see below). To help as many Titanium developers I've
also included the support to use callbacks in the same style as HTTPClient.
Although it' usage is highly discouraged for the power and expressiveness given
by using promises.

[4]: http://promises-aplus.github.io/promises-spec/

#### Prescribed usage example:

    FileLoader.download("http://example.com/image.png")
      .then(function(file) { ... });

#### Callbacks if you must:

    FileLoader.download({
      url:    "http://example.com/image.png",
      onload: function(file) { ... }
    });

The equivalent callback to promise method is as follows:

| Promise Method | Callback       |
|----------------|----------------|
| `then()`       | `onload`       |
| `fail()`       | `onerror`      |
| `progress()`   | `ondatastream` |

The then method can also take these in one shot:

    .then(thenFunction, failFunction, progressFunction);

#### File Object

The functions are passed a File object. This object has the following useful
methods and properties:

- `getFile()`  - Returns a `Ti.FilesystemFile` object. Used to pass to a
                 `ImageView.image`.
- `getPath()`  - Returns a string to the cached file. Used for properties
                 that need a string not a file object (`TableViewRow.leftImage`)
- `expired()`  - Returns true/false for when the expired time has elapsed
                 since this URL was last requested. By passing in true you will
                 invalidate this file's cache forcing a download on next
                 request.
- `downloaded` - true if this URL was just downloaded, false if it was
                 already in cached.
- `is_cached`  - true if this file has been cached or not.

There are few other ones. If you needed them I'm sure at that point you will
have found them in the source code.

#### Garbage Collection

Every time a particular URL is requested it stores a time stamp to determine if
the cache for that URL is stale or not. If it is it will download the file
again. This is to allow changes on the server to eventually change on the
downloaded media. Otherwise you would never be able to get new content from the
same URL. When the content is downloaded it is then checked to see if any
changes have been made. If so a new cache is created. Otherwise it is ignored
to prevent unnecessary file writes.

Because cache files are based off of the URL if you change it a new cache file
will be created. You could essentially force a new download by changing the URL
(ie `http://example.com/image.png?12345`). However, your better off using the
`expired(true)` to accomplish this. (`expunge()` is also available for really
paranoid users).

It is also easier to let the library handle the caching. The utility function
`FileLoader.gc()` will run through the cache expunge()'ing any cache files that
have since expired. This will clean up the file system and save space on the
device.

If you ever needed to clear the cache completely just pass true and all files
will be expunge()'ed:

    FileLoader.gc(true);

It is best to handle garbage collection on an event like `resumed` on iOS. Or
via a periodic interval (android).

    Ti.App.addEventListener("resumed", FileLoader.gc);
    // OR (not the best solution)
    setInterval(FileLoader.gc, 43200000); // every 12 hours

## Configuration

To set configuration when using Alloy set them in your `app/config.json`
Otherwise if Alloy is not used set them in `app.js` on `Ti.App`.

You can adjust the following variables:

- `caching_property_key` - The `Ti.App.Property` key to use for storing the
                           cache metadata.
- `cache_expiration` - How long a cached file is considered expired since
                       the last time it was requested.
- `cache_directory` - The directory to save the cache files. On iOS the
                      `applicationSupportDirectory` is prefixed. on all
                      others the `applicationDataDirectory` is prefixed.
- `cache_requests` - The number of simultaneous network requests allowed.

## Advance Promises

The implementation in this repository is exposed for use outside this library.
The source here is available for modification and so you could copy paste it
out if interested. Two methods of creating a promise are available:

    var resolvePromise, rejectPromise, notifyPromise;
    var promise = new FileLoader.Promise(function (resolve, reject, notify) {
      resolvePromise = resove;
      rejectPromise  = reject;
      notifyPromise  = notify;
    });

    resolvePromise("value"); // resolve the promise.

A more convinent helper is available:

    var defer = FileLoader.Promise.defer();
    var promise = defer.promise;

    defer.resolve("value"); // resolve the promise.

Promises offer several advantages. Usage is optional in this library. However,
the library itself uses promises internally.

#### Chaining

With the Promise/A+ spec each call to `then()` returns a new promise that is
fulfilled or rejected based on the state of the parent promise. So by chaining
each callback is waiting on the former to continue. However, errors will also
propagate allowing you to have a catch all if needed.

    FileLoader.pinkySwear()
      .then(step1)
      .then(step2)
      .fail(opps)
      .done();

step1 will receive the file object. What ever step1 returns becomes the value
passed into step2. If either download, step1, or step2 throw an exception then
opps will be called with the error passed in as the first argument.

#### Helpers

The modified implementation of  available in this library offers some
helper methods to aid in convenience.

If you want to execute a function when a promise is resolved or rejected
regardless (cleanup) use `fin()`. It does not interrupt the promise chain
allowing you to execute a callback and the original state of the promise is not
changed. The return value / exception thrown in the `fin()` callback is
ignored.

Many times you may be interested in a property or result from a method on the
object that gets passed as the fulfilled value. To add some convenience the
following methods can be used in the chain to narrow down or transform the
value you want later in the chain. An example of such would be the File object
that `download()` passes. It has a `getPath()` method for the string path and
also a `downloaded` property. Here are two examples of using those in a promise
chain. Be aware that the need for these is purely a style choice and are not
needed to interact with this library.

    var waitingForImage = FileLoader.download("http://...");
    waitingForImage.invoke("getPath").then(function(path_string) {
      Ti.API.info("Downloaded to " + path_string);
    });

    waitingForImage.get("downloaded").then(function(has_downloaded) {
      var message = (has_downloaded ? "by downloding" : "in cache");
      Ti.API.info("File found " + message + ".");
    });

#### Dealing with errors

If any of the functions executed by the promise callback chain throw an
exception the subsequent promises in the chain will be rejected. Unfortunatly
if there was a reason that an exception were thrown in the error callback the
exception would be confusingly lost and never sean. This is bad because as a
developer you would never know that there was a problem in your own error
checking code. Or if you never handled error checing at all any errors in the
normal callbacks would alsoo dissapear. To prevent this end your promise chain
with a `done()`. This will finish everything by throwing a final error if you
haven't taken care of it before. It return nothing so it trully is the end of
the chain. If you plan on passing the promise on do not use `done()` on it till
you sure you no longer need it.

    function promiseMe() {
      return FileLoader.download(...)
        .then(function(v) { ... });
      // Do not call done() here
    }

    var promise = promiseMe()
      .then(function(v) { ... });
      // Do not call done() here.

    promise.then(function(v) { ... })
      .fail(function(v) { ... })
      .done(); // I'm all done.

#### Progress Notifications

If you are interested in the progress of a download you can attach a callback
to `progress()` which will periodically be executed with an event object who
has a property called `progress`. It has a  value between `0.0` and `1.0`. If
you make your own `pinkySwear()` you can send those notifications by calling
the `notify()` method.

    FileLoader.download("http://...")
      .progress(function(e) {
        var progress = Math.floor(e.progress * 100);
        Ti.API.info("Progress: " + progress + "%");
      }).done();

#### Integrating with other promise libraries

The implementation of promises in this library is *extreamly* minimalistic.
There is much more power and expressiveness in other promise libraries. Because
pinkySwear is Promise/A+ complaint it is easy to have your preferred promise
implementation wrap this one. The following is an example of using the popular
[Q library][Q]:

    var Q          = require("q");
    var FileLoader = require("file_loader");

    var qPromise = Q(FileLoader.download("http://..."));
    qPromise.then(...).fail(...).done();

I highly encourage you to take a look at a full fledge promise library and
become comfortable using promises in your own code. For an example on ways that
promises can benifit a Titanium project take a look at my
[Titanium Promise Exmple][5] and for more examples on the power of promises my
[Promises Demo][6].

Have fun.

[Q]: http://documentup.com/kriskowal/q/
[5]: https://github.com/sukima/promises-titanium
[6]: http://sukima.github.io/promise-demo/

## Licensing

Copyright (c) 2013 Devin Weaver

This work is released under the MIT license.

This work includes an embedded and modified version of [then/promise][2] which
is Copyright (c) 2013 Forbes Lindesay and release under the MIT license.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
