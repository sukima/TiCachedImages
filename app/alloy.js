// The contents of this file will be executed before any of
// your view controllers are ever executed, including the index.
// You have access to all functionality on the `Alloy` namespace.
//
// This is a great place to do any initialization for your app
// or create any global variables/functions that you'd like to
// make available throughout your app. You can easily make things
// accessible globally by attaching them to the `Alloy.Globals`
// object. For example:
//
// Alloy.Globals.someGlobalFunction = function(){};

// Expunge stale caches
// Uses a timeout for simplicity. Usually you might trigger this on a
// background task or some other application specific time.
var FileLoader = require("file_loader");

function cleanCache() {
  Ti.API.info("Cleaning stale cache");
  FileLoader.gc();
}

setInterval(FileLoader.gc, 60000); // Every minute
