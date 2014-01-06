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

(function() {
  var tags = [
    "sun",
    "sea",
    "tree",
    "cat",
    "dog"
  ];

  function makeRowFor(tag) {
    var row = Ti.UI.createTableViewRow({ title: tag });
    FileLoader.download("http://flickholdr.com/128/128/" + tag)
      .then(function(path) { row.leftImage = path; }).done();
    return row;
  }

  var tag_index = 0, i, row, rows = [];
  for (i = 0; i < 100; i++) {
    rows.push(makeRowFor(tags[tag_index]));
    tag_index++;
    tag_index = (tag_index >= tags.length) ? 0 : tag_index;
  }

  $.tableList.setData(rows);
})();

$.callbackPicker.addEventListener("change", callbackImageChange);
$.promisePicker.addEventListener("change", promiseImageChange);

$.index.open();
