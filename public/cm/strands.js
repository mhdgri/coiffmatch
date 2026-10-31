/**
 * Coiff'Match – les mèches de l'accueil : de gauche à droite, chaque mèche passe
 * du raide au crépu. Elles ondulent doucement et s'écartent au passage de la souris.
 * Mouvement désactivé si l'utilisateur a demandé moins d'animations.
 */
(function () {
	var c = document.querySelector('.hero3__strands');
	if (!c || !c.getContext) return;
	var g = c.getContext('2d');
	var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	var mouse = { x: -9999, y: -9999 };
	var raf = 0, visible = true;

	function size() {
		var dpr = Math.min(window.devicePixelRatio || 1, 2);
		c.width = Math.round(c.clientWidth * dpr);
		c.height = Math.round(c.clientHeight * dpr);
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	function draw(t) {
		var w = c.clientWidth, h = c.clientHeight;
		g.clearRect(0, 0, w, h);
		var narrow = w < 760;
		var left = narrow ? w * 0.05 : w * 0.46;
		var span = narrow ? w * 1.0 : w * 0.6;
		var n = narrow ? 34 : 72;
		var bottom = (narrow || /band/.test(c.parentElement.className)) ? h + 10 : h * 0.86;
		for (var i = 0; i < n; i++) {
			var u = i / (n - 1);
			var x0 = left + u * span;
			var amp = 1.5 + u * u * 15;
			var freq = 0.004 + u * u * 0.085;
			var sway = Math.sin(t / 1500 + i * 0.33) * 7;
			g.beginPath();
			for (var y = -10; y <= bottom; y += 3) {
				var x = x0 + sway * (y / h) + Math.sin(y * freq + i) * amp;
				if (u > 0.82) x += ((Math.floor(y / 5) % 2) ? 1 : -1) * (u - 0.82) * 14;
				var dx = x - mouse.x, dy = y - mouse.y, d2 = dx * dx + dy * dy;
				if (d2 < 14400) x += (dx >= 0 ? 1 : -1) * (1 - d2 / 14400) * 18;
				if (y === -10) g.moveTo(x, y); else g.lineTo(x, y);
			}
			var gold = i % 7 === 3;
			g.strokeStyle = gold ? 'rgba(226, 184, 100, ' + (narrow ? 0.4 : 0.85) + ')' : 'rgba(240, 242, 238, ' + (narrow ? 0.05 + 0.08 * u : 0.1 + 0.2 * u) + ')';
			g.lineWidth = gold ? 1.8 : 1.4;
			g.stroke();
		}
		if (!reduce && visible) raf = requestAnimationFrame(draw);
	}

	size();
	window.addEventListener('resize', function () { size(); if (reduce) draw(0); });
	c.parentElement.addEventListener('pointermove', function (e) {
		var r = c.getBoundingClientRect();
		mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
	});
	c.parentElement.addEventListener('pointerleave', function () { mouse.x = mouse.y = -9999; });
	if ('IntersectionObserver' in window) {
		new IntersectionObserver(function (es) {
			visible = es[0].isIntersecting;
			if (visible && !reduce) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
		}).observe(c);
	}
	draw(0);
	if (!reduce) raf = requestAnimationFrame(draw);
})();
