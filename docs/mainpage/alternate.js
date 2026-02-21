function random(arr) {
  const randomIndex = Math.floor(Math.random() * arr.length);
  const item = arr[randomIndex];
  return item;
}

const subtitlefonts = ['Dela Gothic One', 'Space Grotesk', 'Consolas', 'Impact', 'Comic Sans MS', 'Ink Free', 'Minecraft', 'Brush Script MT', 'Segoe Script', 'Verdana', 'Webdings', 'Goldman', 'DynaPuff']

function subtitle() {
	const subtitlefont = random(subtitlefonts)
	document.documentElement.style.setProperty('--randfont', subtitlefont);
}

subtitle();
setInterval(() => {
	subtitle()
}, 1500);

// bg follow mouse
document.addEventListener('mousemove', (e) => {
    const top = document.querySelector('.top');
    if (!top) return;
    
    const rect = top.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    
	let moveX = 1
	let moveY = 1

	if (window.innerWidth < 1000) {
		moveX = x * 42;
    	moveY = y * 10;
	} else {
		moveX = x * 20;
    	moveY = y * 10;
	}
    
    top.style.setProperty('--mouse-x', `${moveX}px`);
    top.style.setProperty('--mouse-y', `${moveY}px`);
});