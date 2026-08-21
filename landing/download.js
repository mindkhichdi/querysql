(function () {
  var MAC_URL = "/downloads/QuerySQL_0.1.0_aarch64.dmg";
  var WIN_URL = "https://github.com/mindkhichdi/querysql/releases/download/querysql-v0.1.0/querysql_0.1.0_x64-setup.exe";

  var isWindows = /Win/.test(navigator.userAgent);

  var MAC_NOTE =
    '<p class="gk-lede"><strong>v0.1.0 · Apple Silicon · unsigned build.</strong> macOS will say it ' +
    '&ldquo;could not verify&rdquo; QuerySQL &mdash; that&rsquo;s Gatekeeper flagging any app without ' +
    'a $99/yr Apple Developer signature, not a sign anything&rsquo;s actually wrong. One-time fix:</p>' +
    '<ol class="gk-steps">' +
    '<li>Open <strong>System Settings &rarr; Privacy &amp; Security</strong></li>' +
    '<li>Scroll to the bottom and click <strong>Open Anyway</strong> next to QuerySQL</li>' +
    '<li>Confirm with <strong>Open Anyway</strong> once more in the dialog that pops up</li>' +
    '</ol>';

  var WIN_NOTE =
    '<p class="gk-lede"><strong>v0.1.0 · x64 · unsigned build.</strong> Windows SmartScreen will say ' +
    'it protected your PC &mdash; that&rsquo;s the same unsigned-build flag, not a sign anything&rsquo;s ' +
    'actually wrong. One-time fix:</p>' +
    '<ol class="gk-steps">' +
    '<li>Click <strong>More info</strong> on the SmartScreen dialog</li>' +
    '<li>Click <strong>Run anyway</strong></li>' +
    '</ol>';

  function apply() {
    document.querySelectorAll('[data-dl="primary"]').forEach(function (el) {
      el.href = isWindows ? WIN_URL : MAC_URL;
      el.textContent = isWindows ? el.dataset.winLabel || "Download for Windows" : el.dataset.macLabel || "Download for macOS";
      if (isWindows) {
        el.removeAttribute("download");
      } else {
        el.setAttribute("download", "");
      }
    });

    document.querySelectorAll('[data-dl="secondary"]').forEach(function (el) {
      el.href = isWindows ? MAC_URL : WIN_URL;
      el.textContent = isWindows ? el.dataset.macLabel || "macOS" : el.dataset.winLabel || "Windows";
      if (isWindows) {
        el.setAttribute("download", "");
      } else {
        el.removeAttribute("download");
      }
    });

    var note = document.getElementById("cta-note");
    if (note) {
      note.innerHTML = isWindows ? WIN_NOTE : MAC_NOTE;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
})();
