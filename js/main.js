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