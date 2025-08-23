// Placeholder for future interactivity
console.log('Utility App loaded');

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