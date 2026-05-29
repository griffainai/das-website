/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Countdown Timer — Driver Appreciation Week
   Target: September 13, 2026
   ============================================= */

(function () {
  // DAW 2026: September 13–19, 2026
  const DAW_TARGET = new Date('2026-09-13T00:00:00').getTime();

  function pad(n) { return String(n).padStart(2, '0'); }

  function set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = pad(val);
  }

  function tick() {
    const diff = DAW_TARGET - Date.now();

    if (diff <= 0) {
      // DAW is here or passed
      ['cd-days','cd-hours','cd-minutes','cd-seconds'].forEach(id => set(id, 0));
      ['ann-cd-days','ann-cd-hours','ann-cd-mins','ann-cd-secs'].forEach(id => set(id, 0));
      const subLabel = document.querySelector('.countdown-ent-sub-label');
      if (subLabel) subLabel.textContent = 'Happening Now';
      const deadline = document.querySelector('.countdown-ent-deadline');
      if (deadline) deadline.textContent = '🎉 Driver Appreciation Week Sep 13–19, 2026 — order now!';
      return;
    }

    const days    = Math.floor(diff / 86400000);
    const hours   = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000)  / 60000);
    const seconds = Math.floor((diff % 60000)    / 1000);

    set('cd-days',    days);
    set('cd-hours',   hours);
    set('cd-minutes', minutes);
    set('cd-seconds', seconds);

    // Announcement bar countdown (d · h · m · s)
    const ad = document.getElementById('ann-cd-days');
    const ah = document.getElementById('ann-cd-hours');
    const am = document.getElementById('ann-cd-mins');
    const as_ = document.getElementById('ann-cd-secs');
    if (ad)  ad.textContent  = days;
    if (ah)  ah.textContent  = pad(hours);
    if (am)  am.textContent  = pad(minutes);
    if (as_) as_.textContent = pad(seconds);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('cd-days') && !document.getElementById('ann-cd-days')) return;
    tick();
    setInterval(tick, 1000);
  });
})();
