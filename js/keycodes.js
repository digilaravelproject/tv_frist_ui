var KEY = {
  BACKSPACE: 8,
  TAB: 9,
  ENTER: 13,
  ESCAPE: 27,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  KEY_0: 48, KEY_1: 49, KEY_2: 50, KEY_3: 51, KEY_4: 52,
  KEY_5: 53, KEY_6: 54, KEY_7: 55, KEY_8: 56, KEY_9: 57,
  BACK_ANDROID: 4,
  BACK_WEBOS: 461,
  BACK_TIZEN: 10009,
  BACK_TIZEN_EXIT: 10182
};

function isBackKey(e) {
  var code = e.keyCode || e.which;
  return code === KEY.BACKSPACE || code === KEY.ESCAPE ||
         code === KEY.BACK_ANDROID || code === KEY.BACK_WEBOS ||
         code === KEY.BACK_TIZEN || code === KEY.BACK_TIZEN_EXIT;
}

function isEnterKey(e) {
  return (e.keyCode || e.which) === KEY.ENTER;
}

function isArrowKey(e) {
  var code = e.keyCode || e.which;
  return code >= KEY.LEFT && code <= KEY.DOWN;
}

function isDigitKey(e) {
  var code = e.keyCode || e.which;
  return code >= KEY.KEY_0 && code <= KEY.KEY_9;
}

function getDigit(e) {
  return String.fromCharCode(e.keyCode || e.which);
}
