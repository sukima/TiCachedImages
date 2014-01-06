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

var photos = [
  "IMG_7651_t.png",
  "IMG_7654_t.png",
  "IMG_7656_t.png",
  "IMG_7660_v1_t.png",
  "IMG_7663_t.png",
  "IMG_7672_v1_t.png",
  "IMG_7688_t.png",
  "IMG_7690_t.png",
  "IMG_7691_t.png",
  "IMG_7699_v1_t.png",
  "IMG_7766_t.png",
  "IMG_7778_t.png",
  "IMG_7784_t.png",
  "IMG_7786_t.png",
  "IMG_7789_t.png",
  "IMG_7790_t.png",
  "IMG_7809_v1_t.png"
];

function refreshTableData() {
  function makeRowFor(photo) {
    return Alloy.createController("PhotoRow", {photo: photo}).getView();
  }

  var photo_index = 0, i, row, rows = [];
  for (i = 0; i < 100; i++) {
    rows.push(makeRowFor(photos[photo_index]));
    photo_index++;
    photo_index = (photo_index >= photos.length) ? 0 : photo_index;
  }

  $.tableList.setData(rows);
}

$.callbackPicker.addEventListener("change", callbackImageChange);
$.promisePicker.addEventListener("change", promiseImageChange);
$.clearCacheBtn.addEventListener("click", function() {
  FileLoader.gc(true);
  refreshTableData();
});

refreshTableData();
$.index.open();
