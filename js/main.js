// Placeholder for future interactivity
console.log('Utility App loaded');

// Dropdown delay functionality
document.addEventListener('DOMContentLoaded', function() {
	const dropdowns = document.querySelectorAll('.nav-dropdown:not(.disabled-dropdown)');
	let hideTimeout;

	dropdowns.forEach(dropdown => {
		const dropdownContent = dropdown.querySelector('.dropdown-content');
		
		if (!dropdownContent) return;

		dropdown.addEventListener('mouseenter', function() {
			// Clear any existing timeout
			if (hideTimeout) {
				clearTimeout(hideTimeout);
				hideTimeout = null;
			}
			// Show dropdown immediately
			dropdownContent.classList.add('show');
		});

		dropdown.addEventListener('mouseleave', function() {
			// Set timeout to hide after 50 milliseconds
			hideTimeout = setTimeout(() => {
				dropdownContent.classList.remove('show');
			}, 50);
		});

		// If mouse re-enters dropdown content, cancel hide timeout
		dropdownContent.addEventListener('mouseenter', function() {
			if (hideTimeout) {
				clearTimeout(hideTimeout);
				hideTimeout = null;
			}
		});

		// If mouse leaves dropdown content, start hide timeout again
		dropdownContent.addEventListener('mouseleave', function() {
			hideTimeout = setTimeout(() => {
				dropdownContent.classList.remove('show');
			}, 50);
		});
	});
});

// Utility card blur and highlight effect
document.addEventListener('DOMContentLoaded', function() {
	const grid = document.querySelector('.card-grid');
	const cards = document.querySelectorAll('.service-card');
	let overlay = null;

	cards.forEach(card => {
		card.addEventListener('mouseenter', function() {
			// Add blur overlay
			if (!overlay) {
				overlay = document.createElement('div');
				overlay.className = 'blur-overlay';
				document.body.appendChild(overlay);
			}
			grid.classList.add('blur-active');
			card.classList.add('active');
		});
		card.addEventListener('mouseleave', function() {
			// Remove blur overlay
			if (overlay) {
				overlay.remove();
				overlay = null;
			}
			grid.classList.remove('blur-active');
			card.classList.remove('active');
		});
	});
});

// AdSense bottom anchor padding utility
// Ensures footer/content isn't overlapped by Auto Ads "anchor" banner
(function() {
	function getPx(value) {
		return typeof value === 'number' ? value : parseFloat(value || '0') || 0;
	}

	const originalPadding = (() => {
		try { return getPx(getComputedStyle(document.body).paddingBottom); } catch { return 0; }
	})();

	let applied = 0; // last applied padding by this script

	function updateAnchorPadding() {
		const anchor = document.getElementById('google_ads_bottom_anchor');
		if (anchor && anchor.offsetParent !== null) {
			const rect = anchor.getBoundingClientRect();
			const h = Math.max(0, Math.round(rect.height || 0));
			const target = Math.max(originalPadding, h);
			if (target !== applied) {
				document.body.style.paddingBottom = target ? target + 'px' : '';
				applied = target;
			}
		} else {
			if (applied) {
				// restore original
				document.body.style.paddingBottom = originalPadding ? originalPadding + 'px' : '';
				applied = 0;
			}
		}
	}

	// Observe DOM for injected anchor
	const mo = new MutationObserver(updateAnchorPadding);
	try {
		mo.observe(document.documentElement, { childList: true, subtree: true });
	} catch {}

	// Adjust on resize/orientation changes
	window.addEventListener('resize', updateAnchorPadding);
	window.addEventListener('orientationchange', updateAnchorPadding);
	window.addEventListener('load', updateAnchorPadding);
	document.addEventListener('DOMContentLoaded', updateAnchorPadding);
})();