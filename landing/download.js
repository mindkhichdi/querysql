(function () {
  var MAC_URL = "/downloads/QuerySQL_0.1.0_aarch64.dmg";
  var WIN_URL = "https://github.com/mindkhichdi/querysql/releases/download/querysql-v0.1.0/querysql_0.1.0_x64-setup.exe";

  var isWindows = /Win/.test(navigator.userAgent);

  var MAC_NOTE =
    'v0.1.0 · Apple Silicon · unsigned build — macOS will warn it can’t be verified. ' +
    'Open <strong>System Settings → Privacy &amp; Security</strong>, scroll to the bottom, ' +
    'and click <strong>Open Anyway</strong> next to QuerySQL (only needed the first time).';

  var WIN_NOTE =
    'v0.1.0 · x64 · unsigned build — Windows SmartScreen will warn it’s from an ' +
    'unknown publisher. Click <strong>More info</strong>, then <strong>Run anyway</strong> ' +
    '(only needed the first time).';

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
