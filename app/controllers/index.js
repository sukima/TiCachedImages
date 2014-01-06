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
    onload: function(file) {
      $.callbackImage.image = file.getFile();
    },
    onerror: showError
  });
}

function promiseImageChange(e) {
  var url = urlFromSelection(e.selectedValue[0]);
  Ti.API.info("Requested URL: " + url);
  FileLoader.download(url)
    .invoke("getFile")
    .then(function(file) {
      $.promiseImage.image = file;
    })
    .fail(showError)
    .done();
}

$.callbackPicker.addEventListener("change", callbackImageChange);
$.promisePicker.addEventListener("change", promiseImageChange);

$.index.open();
