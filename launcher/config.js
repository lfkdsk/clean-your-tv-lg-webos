window.CONFIG = {columns: 5, dockApps: ["youtube.leanback.v4", "netflix", "com.biliwebos.app", "com.emby.app", "org.moonfin.webos"], hiddenApps: [
  "com.gathin.tvhome", "com.local.nativehome",
  // LG promos
  "com.webos.app.lgchannels", "com.lgshop.app", "com.twin.app.gamingportal", "com.twin.app.audiochannel",
  "epoxyaisports", "com.lgtravel.app", "webos.day", "com.lgtvod.us.app", "com.webos.app.lifeonscreen",
  "com.webos.app.sportsteamsettings", "shortcutcopilot",
  // Unused third-party
  "com.movenetworks.app.sling-tv-sling-production", "com.tubitv.ott.tubi", "com.plutotv.app", "com.peacock.tv",
  "com.volley.lgshell", "com.miniclip.eightballpool", "amazon.alexa.view",
  // Tools: hide only, never uninstall
  "com.palmdts.devmode", "com.pirate.refresh"
]};
// Idle screensaver (Apple Aerial). idleSeconds: 0 disables it.
// quality: tried in order per clip; categories: null = all, or e.g. ["landscape", "city", "space", "underwater"].
window.SCREENSAVER = {service: "luna://com.gathin.tvhome.aerials/", idleSeconds: 180, quality: ["4K-SDR", "1080-SDR", "1080-H264"], categories: null, label: true, clock: true, cache: {count: 0, only: false}, everywhere: true};
