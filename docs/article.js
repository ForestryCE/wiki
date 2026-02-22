(function() {

    // sets different static values
    document.getElementById("head").innerHTML += `<meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title id="pagetitle">Forestry: CE - Wiki</title>
            
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Space+Grotesk:wght@400;500;600&display=swap" rel="stylesheet">
            
            
            
            `
    document.getElementById("mainHeader").innerHTML = `<div class="header-left">
                <div class="image">
                    <a href="https://forestryce.github.io/wiki/"><img src="https://github.com/bluffcon/bluffcon.github.io/blob/main/forestrywikiicon.png?raw=true" alt="logo" class="logo"></a>
                  </div>
                    <div class="title-subtitle">
                    <h1>FORESTRY: CE Wiki</h1>
                    <div class="sub" id="sub"></div>
                  </div>
            </div>
                <div class="header-links">
                <a href="https://bluffcon.github.io/forestrycediscord.html">Discord</a>
                <a href="https://bluffcon.github.io/forestrycediscord.html">Get Forestry</a>
              </div>`






    function generateDynamicTOC() {
                const tocContainer = document.getElementById('dynamic-toc');
                if (!tocContainer) return;
                
                tocContainer.innerHTML = '';
                
                const contentArea = document.querySelector('.wiki-content');
                

                // sections
                const sections = document.querySelectorAll('.collapsible-section');
                let headings = [];

                    sections.forEach(section => {
                        const label = section.querySelector('.section-label');
                        if (label) headings.push(label);
                        
                        const subsections = section.querySelectorAll('.subsection h4');
                        headings.push(...subsections);
                    });
                
                if (headings.length === 0) {
                    const emptyMessage = document.createElement('li');
                    emptyMessage.textContent = 'Completely empty page';
                    emptyMessage.style.fontStyle = 'italic';
                    emptyMessage.style.color = '#666'; // demon
                    tocContainer.appendChild(emptyMessage);
                    return;
                }
                
                const headingCount = {};
                
                headings.forEach((heading, index) => {
                    const level = parseInt(heading.tagName[1]);
                    
                    const tocItem = document.createElement('li');
                    tocItem.className = `toc-item toc-level-${level}`;
                    // id stuff
                    let headingId = heading.id;
                    if (!headingId) {
                        headingId = heading.textContent
                            .toLowerCase()
                            .replace(/[^\w\s-]/g, '')
                            .replace(/\s+/g, '-')
                            .replace(/-+/g, '-');
                        

                        if (headingCount[headingId]) {
                            headingCount[headingId]++;
                            headingId = `${headingId}-${headingCount[headingId]}`;
                        } else {
                            headingCount[headingId] = 1;
                        }
                        
                        heading.id = headingId;
                    }
                    
                    const link = document.createElement('a');
                    link.href = `#${headingId}`;
                    link.textContent = heading.textContent;
                    
                    if (level > 2) {
                        link.style.paddingLeft = `${(level - 2) * 20}px`;
                        link.style.fontSize = '0.95em';
                        link.style.opacity = '0.9';
                    }
                    

                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const targetId = link.getAttribute('href').substring(1);
                        const targetElement = document.getElementById(targetId);
                        
                        if (targetElement) {
                            targetElement.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start'
                            });
                            window.scrollBy(0,-100);
                            
                            history.pushState(null, null, `#${targetId}`);
                        }
                    });
                    

                    tocItem.appendChild(link);
                    tocContainer.appendChild(tocItem);
                });
            }
            
            generateDynamicTOC();


            const header = document.getElementById('mainHeader');
            const shrinkClass = 'header-shrink';

            // shrinks when you scroll 60 px, expands when 15
            const SHRINK_THRESHOLD = 60;
            const EXPAND_THRESHOLD = 15;

            let isShrunk = false;

            function handleHeaderOnScroll() {
                const currentScroll = window.pageYOffset || document.documentElement.scrollTop;

                if (!isShrunk && currentScroll > SHRINK_THRESHOLD) {
                    header.classList.add(shrinkClass);
                    isShrunk = true;
                    removeSubtitle();
                } else if (isShrunk && currentScroll < EXPAND_THRESHOLD) {
                    header.classList.remove(shrinkClass);
                    isShrunk = false;
                    window.scrollTo(0,0);
                    refreshSubtitle();
                    // snaps to top
                }
            }

            // i hope at least someone will feel sad that someone broke up on the day theyre having fun and scrolling the forestry wiki
            const date = new Date();
            const yearsago = date.getFullYear() - Math.round(Math.random() * 6)
            const month = date.toLocaleString('en-US', { month: 'long' });
            const todayte = "we broke up in " + yearsago + " on the " + date.getDate() + "th of " + month

            function refreshSubtitle() {
                const subtitles = ["the best wiki", "funded by the governments. all of them.", "buzz buzz we are the bees", "shout out mezz", "shout out nedelosk", "1.21.1 any day now", "also check out gendustry:ce wiki", "shout out thedarkcolour", "shout out spear_", "protect the environment", "www.youtu.be/dQw4w9WgXcQ", "the o is silent", "the community edition", "hey! look at how much i can streeeeeeeeeeeeeeeeeeeeetch", "join the discord server too", "star the github repo too", "follow on modrinth too", "comment on curseforge too", "sorry that i couldnt do a proper greeting", "put this here to throw you off", todayte, "refresh the page"]
                const randomIndex = Math.floor(Math.random() * subtitles.length);
                document.getElementById("sub").innerText = subtitles[randomIndex];
            }
            refreshSubtitle();
            function removeSubtitle() {
                document.getElementById("sub").innerText = "";
            }


            

            window.addEventListener('scroll', handleHeaderOnScroll);

            const article = document.getElementById("articletitle").innerText;
            document.getElementById("pagetitle").innerText = "Forestry:CE Wiki - " + article
            




            // sets different static values
            const footercontent = document.getElementById("footer").innerHTML
            document.getElementById("footer").innerHTML = `<div class="footer-columns">
            <div class="footer-col">
                <h5>forestry ce</h5>
                <ul>
                    <li><a href="https://modrinth.com/mod/forestry-community-edition">Modrinth</a></li>
                    <li><a href="https://www.curseforge.com/minecraft/mc-mods/forestry-community-edition">CurseForge</a></li>
                    <li><a href="https://github.com/thedarkcolour/ForestryCE">GitHub</a></li>
                    <li><a href="https://bluffcon.github.io/forestrycediscord.html">Discord</a></li>
                </ul>
            </div>
            <div class="footer-col">
                <h5>others</h5>
                <ul>
                    <li><a href="https://modrinth.com/mod/gendustry-community-edition">Gendustry:CE Modrinth</a></li>
                    <li><a href="https://www.curseforge.com/minecraft/mc-mods/gendustry-community-edition">Gendustry:CE CurseForge</a></li>
                </ul>
            </div>
            <div class="footer-col">
                <h5>wiki</h5>
                <ul>
                    <li><a href="https://ko-fi.com/thedarkcolour">thedarkcolour</a></li>
                    <li><a href="https://github.com/ForestryCE/forestryce.github.io">Contribute</a></li>
                </ul>
            </div>
        </div>
        ` + footercontent
            


        
        })();