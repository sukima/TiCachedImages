// var FileLoader = require("file_loader");

function urlFromSelection(selection) {
  return "http://localhost:3000/" + selection.toLowerCase() + ".jpg";
}

function callbackImageChange(e) {
  var url = urlFromSelection(e.selectedValue[0]);
  Ti.API.info("Requested URL: " + url);
  $.callbackImage.image = url;
}

function promiseImageChange(e) {
  var url = urlFromSelection(e.selectedValue[0]);
  Ti.API.info("Requested URL: " + url);
  $.promiseImage.image = url;
}

$.callbackPicker.addEventListener("change", callbackImageChange);
$.promisePicker.addEventListener("change", promiseImageChange);

$.index.open();
