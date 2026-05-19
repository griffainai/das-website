/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Countdown Timer — Driver Appreciation Week
   Target: September 13, 2026
   ============================================= */

(function () {
  // DAW 2026: September 13–19, 2026
  const DAW_TARGET = new Date('2026-09-07T00:00:00').getTime();

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
      const subLabel = document.querySelector('.countdown-ent-sub-label');
      if (subLabel) subLabel.textContent = 'Happening Now';
      const deadline = document.querySelector('.countdown-ent-deadline');
      if (deadline) deadline.textContent = '🎉 Driver Appreciation Week Sep 7–13, 2026 — order now!';
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

    // Nav pill
    const nd = document.getElementById('nav-cd-days');
    const nh = document.getElementById('nav-cd-hours');
    const nm = document.getElementById('nav-cd-mins');
    if (nd) nd.textContent = days;
    if (nh) nh.textContent = pad(hours);
    if (nm) nm.textContent = pad(minutes);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('cd-days') && !document.getElementById('nav-cd-days')) return;
    tick();
    setInterval(tick, 1000);
  });
})();
