/**
 * ToolzzHub Freemium Gate
 * Enforces free-tier limits and shows upgrade prompts.
 * No backend required — limits tracked in localStorage.
 * Replace localStorage with a real auth token check once Stripe is wired up.
 */

const Freemium = (() => {
  const STORAGE_KEY = 'tzh_usage';
  const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const LIMITS = {
    pdf_merge:       { daily: 3,  maxFileSizeMB: 10,  label: 'PDF Merge' },
    pdf_compress:    { daily: 1,  maxFileSizeMB: 10,  label: 'PDF Compress' },
    ocr:             { daily: 2,  maxFileSizeMB: 10,  label: 'Scan to Text' },
    qr_download:     { daily: 3,  maxFileSizeMB: null, label: 'QR Code Download' },
    image_edit:      { daily: 5,  maxFileSizeMB: 5,   label: 'Image Edit' },
    bg_remove:       { daily: 3,  maxFileSizeMB: 5,   label: 'Background Remover' },
    file_convert:    { daily: 3,  maxFileSizeMB: 10,  label: 'File Conversion' },
  };

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const data = JSON.parse(raw);
      // Reset counts if it's a new day
      if (data.date !== TODAY) return {};
      return data.counts || {};
    } catch {
      return {};
    }
  }

  function _save(counts) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: TODAY, counts }));
    } catch {}
  }

  function isPro() {
    // Future: check JWT / session token from Stripe
    return localStorage.getItem('tzh_pro') === 'true';
  }

  function getUsage(toolKey) {
    const counts = _load();
    return counts[toolKey] || 0;
  }

  function getRemainingUses(toolKey) {
    if (isPro()) return Infinity;
    const limit = LIMITS[toolKey];
    if (!limit) return Infinity;
    return Math.max(0, limit.daily - getUsage(toolKey));
  }

  /**
   * Check file size limit for a tool.
   * Returns { allowed: bool, message: string }
   */
  function checkFileSize(toolKey, fileSizeBytes) {
    if (isPro()) return { allowed: true };
    const limit = LIMITS[toolKey];
    if (!limit || !limit.maxFileSizeMB) return { allowed: true };
    const maxBytes = limit.maxFileSizeMB * 1024 * 1024;
    if (fileSizeBytes > maxBytes) {
      return {
        allowed: false,
        message: `Free plan: max file size is ${limit.maxFileSizeMB} MB. Upgrade to Pro for files up to 200 MB.`
      };
    }
    return { allowed: true };
  }

  /**
   * Check and increment usage counter.
   * Returns { allowed: bool, remaining: number, message: string }
   */
  function consume(toolKey) {
    if (isPro()) return { allowed: true, remaining: Infinity };
    const limit = LIMITS[toolKey];
    if (!limit) return { allowed: true, remaining: Infinity };

    const counts = _load();
    const used = counts[toolKey] || 0;

    if (used >= limit.daily) {
      return {
        allowed: false,
        remaining: 0,
        message: `You've used your ${limit.daily} free ${limit.label} uses for today. Upgrade to Pro for unlimited access.`
      };
    }

    counts[toolKey] = used + 1;
    _save(counts);
    const remaining = limit.daily - counts[toolKey];
    return { allowed: true, remaining };
  }

  /**
   * Show a non-blocking upgrade banner inside a container element.
   * container: CSS selector string or DOM element
   */
  function showUpgradeBanner(container, message) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;

    // Remove existing banner
    const existing = el.querySelector('.tzh-upgrade-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = 'tzh-upgrade-banner';
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = '';

    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '⭐ ';

    const text = document.createElement('span');
    text.textContent = message || 'Upgrade to Pro for unlimited access.';

    const upgradeBtn = document.createElement('a');
    upgradeBtn.href = '/pro.html';
    upgradeBtn.className = 'tzh-upgrade-btn';
    upgradeBtn.textContent = 'Upgrade to Pro';
    upgradeBtn.setAttribute('aria-label', 'Upgrade to Pro plan');

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tzh-banner-close';
    closeBtn.setAttribute('aria-label', 'Dismiss upgrade banner');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => banner.remove());

    banner.appendChild(icon);
    banner.appendChild(text);
    banner.appendChild(upgradeBtn);
    banner.appendChild(closeBtn);

    el.insertAdjacentElement('beforebegin', banner);
  }

  /**
   * Show remaining uses counter badge near a button.
   * btn: DOM element (the action button)
   * toolKey: string
   */
  function showUsageBadge(btn, toolKey) {
    if (isPro()) return;
    const limit = LIMITS[toolKey];
    if (!limit) return;
    const remaining = getRemainingUses(toolKey);

    let badge = btn.parentElement && btn.parentElement.querySelector('.tzh-usage-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'tzh-usage-badge';
      btn.insertAdjacentElement('afterend', badge);
    }
    badge.textContent = remaining > 0
      ? `${remaining} free use${remaining !== 1 ? 's' : ''} left today`
      : 'Daily limit reached';
    badge.setAttribute('aria-label', badge.textContent);
  }

  return { isPro, consume, checkFileSize, getRemainingUses, showUpgradeBanner, showUsageBadge, LIMITS };
})();

window.Freemium = Freemium;
