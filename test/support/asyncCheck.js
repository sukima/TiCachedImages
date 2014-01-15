function check(done, fn) {
  try {
    fn();
    done();
  }
  catch (e) {
    done(e);
  }
}

module.exports = check;
