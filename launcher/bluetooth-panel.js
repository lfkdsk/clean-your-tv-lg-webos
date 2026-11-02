/* Bluetooth audio panel: paired headphones and speakers at the top (OK connects or disconnects
   A2DP), and a scan that lists nearby devices in pairing mode so one OK pairs and connects.
   Opened from the Bluetooth pill; up/down/left/right move, Back closes. The pill shows the
   connected device's name. Shares the Home settings card styling. */
(function () {
  'use strict';
  var BT = 'luna://com.webos.service.bluetooth2/';
  var SCAN_MS = 30000, NEARBY_MAX = 8;
  var adapter = null, devices = [], scanning = false, scanned = false, scanUntil = 0, scanTimer = null;
  var pending = {}; // address -> '连接中…' / '断开中…' / '配对中…'
  var agent = null;

  function call(method, params, cb) {
    var bridge = null;
    try {
      bridge = new PalmServiceBridge();
      bridge.onservicecallback = function (raw) { var r; try { r = JSON.parse(raw); } catch (e) { r = {returnValue: false}; } if (cb) cb(r); };
      bridge.call(BT + method, JSON.stringify(params || {}));
    } catch (e) { if (cb) cb({returnValue: false, errorText: String(e)}); }
    return bridge;
  }
  function cancel(bridge) { if (bridge) try { bridge.cancel(); } catch (e) {} }
  function withAdapter(p) { p.adapterAddress = adapter; return p; }

  // Headphones and speakers are classic (BR/EDR) devices; the remote and most BLE beacons are not.
  function classic(d) { return d.typeOfDevice !== 'ble'; }
  function isAudio(d) { return ((d.classOfDevice >> 8) & 0x1f) === 4; }
  function connected(d) { return (d.connectedProfiles || []).indexOf('a2dp') >= 0; }
  function paired() { return devices.filter(function (d) { return d.paired && classic(d); }); }
  function nearby() {
    return devices.filter(function (d) { return !d.paired && d.name && classic(d); })
      .sort(function (a, b) { return (isAudio(b) - isAudio(a)) || (a.name < b.name ? -1 : 1); })
      .slice(0, NEARBY_MAX);
  }

  var panel = document.createElement('section');
  panel.id = 'btPanel'; panel.className = 'hidden'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', '蓝牙音频');
  panel.innerHTML = '<div class="renewal-card"><div class="renewal-heading"><h2>蓝牙耳机和音箱</h2></div>' +
    '<p>OK 连接或断开已配对的设备。新设备先让它进入配对模式，再选「搜索新设备」。</p>' +
    '<div id="btRows"></div>' +
    '<div id="btStatus" aria-live="polite"></div>' +
    '<div class="renewal-actions"><button id="btScan">搜索新设备</button><button id="btClose">返回</button></div></div>';
  document.body.appendChild(panel);
  var rowsEl = document.getElementById('btRows'), statusEl = document.getElementById('btStatus'), scanBtn = document.getElementById('btScan');

  function toast(t) { var o = document.getElementById('toast'); o.textContent = t; o.classList.add('shown'); clearTimeout(toast.timer); toast.timer = setTimeout(function () { o.classList.remove('shown'); }, 2600); }
  function fail(what, r) { toast(what + '失败' + (r && r.errorText ? '：' + r.errorText : '')); }

  // ---- actions ----

  function connect(d) {
    var other = paired().filter(function (x) { return connected(x) && x.address !== d.address; })[0];
    pending[d.address] = '连接中…'; render();
    function go() {
      call('a2dp/connect', withAdapter({address: d.address}), function (r) {
        delete pending[d.address];
        if (r.returnValue === false) fail('连接「' + d.name + '」', r); else toast('已连接「' + d.name + '」');
        render();
      });
    }
    // The TV plays to one A2DP sink at a time.
    if (other) call('a2dp/disconnect', withAdapter({address: other.address}), go); else go();
  }
  function disconnect(d) {
    pending[d.address] = '断开中…'; render();
    call('a2dp/disconnect', withAdapter({address: d.address}), function (r) {
      delete pending[d.address];
      if (r.returnValue === false) fail('断开', r);
      render();
    });
  }
  function pair(d) {
    stopScan();
    pending[d.address] = '配对中…'; render();
    startAgent();
    var done = false, bridge = call('adapter/pair', withAdapter({address: d.address, subscribe: true}), function (r) {
      if (done) return;
      if (r.returnValue === false) { done = true; cancel(bridge); stopAgent(); delete pending[d.address]; fail('配对「' + d.name + '」', r); render(); return; }
      if (r.request === 'endPairing' || r.subscribed === false) {
        done = true; cancel(bridge); stopAgent(); delete pending[d.address];
        call('device/setState', withAdapter({address: d.address, trusted: true}));
        connect(d);
      }
    });
    // Some stacks never send endPairing; fall back to the device list showing it paired.
    var watch = setInterval(function () {
      var now = devices.filter(function (x) { return x.address === d.address; })[0];
      if (done) { clearInterval(watch); return; }
      if (now && now.paired) { done = true; clearInterval(watch); cancel(bridge); stopAgent(); delete pending[d.address]; connect(now); }
    }, 1000);
    setTimeout(function () { if (!done) { done = true; clearInterval(watch); cancel(bridge); stopAgent(); delete pending[d.address]; toast('配对超时，确认设备在配对模式后重试'); render(); } }, 45000);
  }
  // Headphones normally pair with "just works"; answer the rarer passkey and PIN requests.
  function startAgent() {
    if (agent) return;
    agent = call('adapter/awaitPairingRequests', withAdapter({subscribe: true}), function (r) {
      var a = r.address;
      if (r.request === 'confirmPasskey') { call('adapter/supplyPasskeyConfirmation', withAdapter({address: a, accept: true})); toast('配对码 ' + r.passkey); }
      else if (r.request === 'displayPasskey' || r.request === 'displayPinCode') toast('在设备上输入 ' + (r.passkey || r.pin));
      else if (r.request === 'pinCode') call('adapter/supplyPinCode', withAdapter({address: a, pin: '0000'}));
      else if (r.request === 'passkey') call('adapter/supplyPasskey', withAdapter({address: a, passkey: 0}));
    });
  }
  function stopAgent() { cancel(agent); agent = null; }

  // The adapter stops discovery on its own after ~10 s; keep restarting it until SCAN_MS is up.
  function startScan() {
    scanning = scanned = true; scanUntil = Date.now() + SCAN_MS;
    call('adapter/startDiscovery', withAdapter({}));
    clearInterval(scanTimer);
    scanTimer = setInterval(function () {
      if (Date.now() >= scanUntil) { stopScan(); render(); return; }
      call('adapter/startDiscovery', withAdapter({}));
      render();
    }, 9000);
    render();
  }
  function stopScan() {
    if (!scanning) return;
    scanning = false; clearInterval(scanTimer);
    call('adapter/cancelDiscovery', withAdapter({}));
  }

  // ---- rendering ----

  var model = [], buttons = [], index = 0, shown = '';
  function rows() {
    var list = [];
    paired().forEach(function (d) {
      var on = connected(d);
      list.push({key: 'p' + d.address, label: d.name || d.address, value: pending[d.address] || (on ? '已连接' : '未连接'),
        run: function () { if (!pending[d.address]) (on ? disconnect : connect)(d); }});
    });
    if (!list.length) list.push({key: 'none', label: '还没有配对过的耳机或音箱', value: '', disabled: true});
    // The service keeps every device it ever saw; only list them after a scan in this visit.
    var near = scanned ? nearby() : [];
    if (scanning || near.length) list.push({key: 'h', heading: scanning ? '附近的设备（搜索中…）' : '附近的设备'});
    near.forEach(function (d) {
      list.push({key: 'n' + d.address, label: d.name, value: pending[d.address] || (isAudio(d) ? '配对并连接' : '配对'),
        run: function () { if (!pending[d.address]) pair(d); }});
    });
    return list;
  }
  function render() {
    updatePill();
    if (!openNow()) return;
    var focusedKey = buttons[index] && buttons[index].dataset.key;
    var next = rows(), sig = JSON.stringify([next, scanning, adapter]);
    // A scan floods device updates; only rebuild when something visible changed.
    if (sig === shown) return;
    shown = sig; model = next;
    rowsEl.innerHTML = '';
    model.forEach(function (r) {
      if (r.heading) { var h = document.createElement('h3'); h.textContent = r.heading; rowsEl.appendChild(h); return; }
      var b = document.createElement('button'); b.className = 'saver-row'; b.disabled = !!r.disabled; b.dataset.key = r.key;
      b.innerHTML = '<span class="saver-label"></span><span class="saver-value"></span>';
      b.firstChild.textContent = r.label; b.lastChild.textContent = r.value;
      b.onclick = r.run || null;
      rowsEl.appendChild(b);
    });
    scanBtn.textContent = scanning ? '停止搜索' : '搜索新设备';
    scanBtn.dataset.key = 'scan'; document.getElementById('btClose').dataset.key = 'close';
    statusEl.textContent = adapter ? '' : '电视的蓝牙没有打开，或启动器拿不到蓝牙服务。';
    buttons = Array.prototype.slice.call(panel.querySelectorAll('button'));
    buttons.forEach(function (b, i) { b.onmouseover = function () { focus(i); }; });
    var keep = buttons.map(function (b) { return b.dataset.key; }).indexOf(focusedKey);
    focus(keep >= 0 ? keep : Math.min(index, buttons.length - 1));
  }
  function updatePill() {
    var on = paired().filter(connected)[0], label = document.getElementById('btLabel');
    if (label) label.textContent = on ? on.name : '蓝牙';
  }

  function openNow() { return !panel.classList.contains('hidden'); }
  function focus(i) {
    var direction = i < index ? -1 : 1;
    for (var n = 0; n < buttons.length; n++, i += direction) { var j = (i + buttons.length * 2) % buttons.length; if (!buttons[j].disabled) { index = j; buttons[index].focus(); return; } }
  }
  function close() { stopScan(); panel.classList.add('hidden'); }
  document.getElementById('btClose').onclick = close;
  scanBtn.onclick = function () { if (scanning) stopScan(); else startScan(); render(); };

  document.addEventListener('keydown', function (e) {
    if (!openNow()) return;
    var k = e.keyCode;
    if ([37, 38, 39, 40, 13, 461, 27].indexOf(k) < 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (k === 461 || k === 27) close();
    else if (k === 13) { if (!e.repeat) buttons[index].click(); }
    else focus(index + (k === 37 || k === 38 ? -1 : 1));
  }, true);

  // One long-lived subscription keeps both the panel and the pill label current.
  call('adapter/getStatus', {}, function (r) {
    var a = (r.adapters || []).filter(function (x) { return x.powered; })[0];
    if (!a) return;
    adapter = a.adapterAddress;
    call('device/getStatus', {subscribe: true}, function (r) { if (r.devices) { devices = r.devices; render(); } });
  });

  window.BtPanel = {isOpen: openNow, open: function () { panel.classList.remove('hidden'); index = 0; shown = ''; scanned = false; buttons = []; render(); }};
})();
