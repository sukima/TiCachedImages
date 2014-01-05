var FileLoader = require("file_loader");

function urlFromSelection(selection) {
  return "http://localhost:3000/" + selection.toLowerCase() + ".jpg";
}

function showError(e) {
  Ti.API.error(JSON.stringify(e, null, 2));
  alert(e.message);
}

function callbackImageChange(e) {
  var url = urlFromSelection(e.selectedValue[0]);
  Ti.API.info("Requested URL: " + url);
  FileLoader.download(url, {
    onload: function(file_path) {
      $.callbackImage.image = file_path;
    },
    onerror: showError
  });
}

function promiseImageChange(e) {
  var url = urlFromSelection(e.selectedValue[0]);
  Ti.API.info("Requested URL: " + url);
  FileLoader.download(url)
    .then(function(file_path) {
      $.promiseImage.image = file_path;
    })
    .fail(showError)
    .done();
}

$.callbackPicker.addEventListener("change", callbackImageChange);
$.promisePicker.addEventListener("change", promiseImageChange);

$.index.open();
