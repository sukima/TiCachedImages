var FileLoader = require("file_loader");
var use_promises = true;

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
    return Alloy.createController("PhotoRow", {photo: photo, use_promises: use_promises}).getView();
  }

  var photo_index = 0, i, row, rows = [];
  for (i = 0; i < 100; i++) {
    rows.push(makeRowFor(photos[photo_index]));
    photo_index++;
    photo_index = (photo_index >= photos.length) ? 0 : photo_index;
  }

  $.tableList.setData(rows);
}

function promptForSettigns() {
  var choice = Ti.UI.createOptionDialog({
    title:   "API Interface",
    cancel:  2,
    options: [
      "Use Promises" + (use_promises ? " *" : ""),
      "Use Callbacks" + (use_promises ? "" : " *"),
      "Cancel"
    ]
  });
  choice.addEventListener("click", function(e) {
    switch (e.index) {
      case 0:
        use_promises = true;
        break;
      case 1:
        use_promises = false;
        break;
    }
  });
  choice.show();
}

function promptForActions() {
  var choice = Ti.UI.createOptionDialog({
    title:       "Action",
    destructive: 1,
    cancel:      2,
    options:     ["Refresh Table", "Clear Cache", "Cancel"]
  });
  choice.addEventListener("click", function(e) {
    switch (e.index) {
      case 0:
        refreshTableData();
        break;
      case 1:
        FileLoader.gc(true);
        break;
    }
  });
  choice.show();
}

$.settingsButton.addEventListener("click", promptForSettigns);
$.clearCacheBtn.addEventListener("click", promptForActions);

refreshTableData();
/* vim:set ts=2 sw=2 et fdm=marker: */
