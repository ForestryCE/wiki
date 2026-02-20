const fuse = new Fuse(data, {
  keys: ["title", "desc"],
  threshold: 0.3,
  ignoreLocation: true,
  includeScore: false,
  shouldSort: true,
});

function random(arr) {
  const randomIndex = Math.floor(Math.random() * arr.length);

  const item = arr[randomIndex];

  return item;
}


const subtitlefonts = ['Dela Gothic One', 'Space Grotesk', 'Consolas', 'Impact', 'Comic Sans MS', 'Ink Free', 'Minecraft', 'Brush Script MT', 'Segoe Script', 'Verdana', 'Webdings']

function subtitle() {
	const subtitlefont = random(subtitlefonts)
	document.documentElement.style.setProperty('--randfont', subtitlefont);
}

subtitle();
setInterval(() => {
	subtitle()
}, 1500);


const searchInput = document.getElementById("search");
const resultsDiv  = document.getElementById("results");



function renderResults(items) {
	resultsDiv.innerHTML = "";

	if (items.length === 0) {
		const msg = document.createElement("span");
		msg.className = "no-results";
		msg.textContent = "No matching links found.";
		msg.onclick = clearsearch;
		resultsDiv.appendChild(msg);
		return;
	}


	const fragment = document.createDocumentFragment();



// make doms
for (const item of items) {
	const div = document.createElement("div");
	div.className = "result-item";
	

	const a = document.createElement("a");
	a.href = item.link;
	a.rel = "noopener noreferrer";
	a.textContent = item.title;
	

	const p = document.createElement("p");
	p.className = "description";
	p.textContent = item.desc;
	

	div.appendChild(a);
	div.appendChild(p);
	

	fragment.appendChild(div);
}

resultsDiv.appendChild(fragment);
}



// search
function searching() {
  const query = searchInput.value.trim();

  if (query.length === 0) {
    renderResults(data);
    return;
  }

  const result = fuse.search(query);
  const matches = result.map(r => r.item);

  renderResults(matches);
}

searchInput.addEventListener("input", searching);
renderResults(data);



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


function clearsearch() {
	resultsDiv.innerHTML = "";
	renderResults(data);
	document.getElementById("search").value = "";
}