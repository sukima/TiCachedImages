var FileLoader = require("file_loader");

var args = arguments[0] || {};
var url = "http://photos.tritarget.org/photos/washington2012/" + args.photo;

function updateRow(file) {
  // Ti.API.info("Displaying " + file);
  $.photo.image = file.getFile();
  $.info.color = file.downloaded ? "#CF0000" : "#07D100";
  $.info.text = (file.downloaded ? "Downloaded" : "Cached") +
    "\n(" + file.id.substr(0, 12) + ")";
}

function progressDisplay(e) {
  var progress = e.progress;
  // Ti.API.debug("Pending progress for " + url + " ~> " + progress); // DEBUG
  $.info.color = "#0000CF";
  $.info.text = "Pending: " + Math.floor(progress * 100) + "%";
}

function onError(error) {
  var message = error.message || error.error || error;
  Ti.API.error("'" + message + "' while loading: " + url);
  // We don't want to throw an error here. It would be lost.
}

if (args.use_promises) {
  FileLoader.download(url)
    .progress(progressDisplay)
    .then(updateRow)
    .fail(onError)
    .done();
}
else {
  FileLoader.download({
    url:          url,
    onload:       updateRow,
    onerror:      onError,
    ondatastream: progressDisplay
  });
}

$.title.text = args.photo;
/* vim:set ts=2 sw=2 et fdm=marker: */
