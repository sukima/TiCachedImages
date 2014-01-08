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
  FileLoader.download({
    url:    url,
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
    .fail(showError);
}

var toastTimeout;
$.toastView  = Ti.UI.createView($.createStyle({classes:["toastView"],   apiName:"View"}));
$.toastLabel = Ti.UI.createLabel($.createStyle({classes:["toastLabel"], apiName:"Label"}));
$.toastView.add($.toastLabel);
function toastMessage(message) {
  $.toastLabel.text = message.message || message;
  function hideToast() {
    toastTimeout = null;
    $.index.remove($.toastView);
  }
  if (toastTimeout) { clearTimeout(toastTimeout); }
  $.index.add($.toastView);
  toastTimeout = setTimeout(hideToast, 3000);
}

$.index.addEventListener("close", function() {
  Ti.App.removeEventListener("toast", toastMessage);
  if (toastTimeout) { clearTimeout(toastTimeout); }
  $.destroy();
});
Ti.App.addEventListener("toast", toastMessage);

if (!OS_ANDROID) {
  $.callbackPicker.addEventListener("change", callbackImageChange);
  $.promisePicker.addEventListener("change", promiseImageChange);
  $.index.open();
}
else {
  $.listWindow.getView().open();
}
