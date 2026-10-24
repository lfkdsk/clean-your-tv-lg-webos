/* Input diagnostics: a small ring buffer in localStorage of what reached this page —
   keys, visibility, focus, relaunches — so "arrows did nothing right after start" can be
   read back over remote DevTools afterwards (localStorage 'tvhome.diag'). Logs key codes
   only, never text. */
(function () {
  'use strict';
  var KEY = 'tvhome.diag', MAX = 120, buf = [];
  try { buf = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { buf = []; }
  var t0 = Date.now(), dirty = false;
  function log(type, extra) {
    var e = {t: Date.now(), type: type, vis: document.visibilityState, focus: document.hasFocus()};
    if (extra) for (var k in extra) e[k] = extra[k];
    buf.push(e); if (buf.length > MAX) buf.splice(0, buf.length - MAX);
    if (!dirty) { dirty = true; setTimeout(flush, 1000); }
  }
  function flush() { dirty = false; try { localStorage.setItem(KEY, JSON.stringify(buf)); } catch (e) {} }
  log('load', {reason: window.PalmSystem && PalmSystem.launchReason});
  window.addEventListener('keydown', function (e) { log('key', {code: e.keyCode, saver: !!(window.Screensaver && Screensaver.isActive()), sinceLoad: Date.now() - t0}); }, true);
  document.addEventListener('visibilitychange', function () { log('visibility'); });
  window.addEventListener('focus', function () { log('focus'); });
  window.addEventListener('blur', function () { log('blur'); });
  document.addEventListener('webOSRelaunch', function () { log('relaunch'); });
  window.addEventListener('pagehide', flush);
})();
