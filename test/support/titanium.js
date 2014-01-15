var mockti = require("mockti");

global.Ti = global.Titanium = mockti();

// Force max requests to a low number for testing.
Ti.App.cache_requests = 2;
