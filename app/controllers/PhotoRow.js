var FileLoader = require("file_loader");

var args = arguments[0] || {};
var url = "http://photos.tritarget.org/photos/washington2012/" + args.photo;

function updateRow(file) {
  $.photo.image = file.getFile();
  $.info.color = file.downloaded ? "#CF0000" : "#07D100";
  $.info.text = (file.downloaded ? "Downloaded" : "Cached") +
    "\n(" + file.id.substr(0, 12) + ")";
}

function onError(error) {
  var message = error.message || error.error || error;
  Ti.API.error("" + message + " loading cache with url: " + url);
  // We don't want to throw an error here. That would be a mess.
}

if (args.use_promises) {
  FileLoader.download(url).then(updateRow).fail(onError).done();
}
else {
  FileLoader.download(url, {
    onload:  updateRow,
    onerror: onError,
  });
}

$.title.text = args.photo;
/* vim:set ts=2 sw=2 et fdm=marker: */
