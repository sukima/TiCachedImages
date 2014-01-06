var FileLoader = require("file_loader");

var args = arguments[0] || {};
var url = "http://photos.tritarget.org/photos/washington2012/" + args.photo;

FileLoader.download(url)
  .then(function(file) {
    // Ti.API.info("Displaying image: " + file.getPath());
    $.photo.image = file.getFile();
    $.info.color = file.downloaded ? "#CF0000" : "#07D100";
    $.info.text = (file.downloaded ? "Downloaded" : "Cached") +
      "\n(" + file.id.substr(0, 12) + ")";
  })
  .fail(function(error) {
    var message = error.message || error.error || error;
    Ti.API.error("" + message + " loading cache with url: " + url);
    // We don't want to throw an error here. That would be a mess.
  })
  .done();

$.title.text = args.photo;
/* vim:set ts=2 sw=2 et fdm=marker: */
