/* DAS TOP NAV — behaviour ported 1:1 from odndr-web/lib/marketing-chrome.ts.
   Drives: the scrolled state, the pop-out open/close (Menu button, burger, hover,
   Escape, scrim), drop positioning under the header, and the lazy paint of the
   pop-out tile photographs from their data-bg attributes.
   The .odf3 footer-photo observer from the source is NOT ported - that element is
   Off Duty's footer and does not exist here. */
(function(){
  var wrap=document.getElementById('odn-wrap');
  if(wrap){window.addEventListener('scroll',function(){wrap.classList.toggle('odn-scrolled',window.scrollY>4)},{passive:true});}
  var drop=document.getElementById('odn-drop'),scrim=document.getElementById('odn-scrim'),burger=document.getElementById('odn-burger'),menu=document.getElementById('odn-menu'),hideT;
  function place(){if(!drop||!wrap)return;var r=wrap.getBoundingClientRect();drop.style.setProperty('--odn-drop-top',Math.max(8,r.bottom+8)+'px');}
  function paintTiles(){if(!drop)return;var t=drop.querySelectorAll('[data-bg]');for(var i=0;i<t.length;i++){t[i].style.backgroundImage='url('+t[i].getAttribute('data-bg')+')';t[i].removeAttribute('data-bg');}}
  function setOpen(open){if(!drop)return;if(open)paintTiles();place();drop.classList.toggle('odn-open',open);scrim.classList.toggle('odn-open',open);if(burger)burger.setAttribute('aria-expanded',open?'true':'false');if(menu)menu.setAttribute('aria-expanded',open?'true':'false');if(window.matchMedia('(max-width:1023px)').matches)document.body.style.overflow=open?'hidden':'';else document.body.style.overflow='';}
  function isOpen(){return !!drop&&drop.classList.contains('odn-open');}
  if(drop&&scrim){
    if(burger)burger.addEventListener('click',function(){setOpen(!isOpen());});
    if(menu){menu.addEventListener('click',function(){setOpen(!isOpen());});
      var hov=window.matchMedia('(hover:hover) and (min-width:1024px)');
      function enter(){if(!hov.matches)return;clearTimeout(hideT);setOpen(true);}
      function leave(){if(!hov.matches)return;clearTimeout(hideT);hideT=setTimeout(function(){setOpen(false);},220);}
      menu.addEventListener('mouseenter',enter);menu.addEventListener('mouseleave',leave);drop.addEventListener('mouseenter',enter);drop.addEventListener('mouseleave',leave);}
    scrim.addEventListener('click',function(){setOpen(false);});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&isOpen()){setOpen(false);(menu&&menu.offsetParent?menu:burger)&&(menu&&menu.offsetParent?menu:burger).focus();}});
    drop.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('a'))setOpen(false);});
    window.addEventListener('resize',function(){if(isOpen())place();});
  }
  // Active link. Off Duty's hrefs are root-absolute ("/about-us") so it compared whole paths.
  // DAS is a static site with RELATIVE hrefs ("/shop.html", and "../shop.html" from /blog/), so a
  // whole-path compare never matches. Compare the file name instead, with "" and "/index.html"
  // both meaning home.
  function leaf(u){
    u = (u || '').split('?')[0].split('#')[0].replace(/\/$/, '');
    u = u.slice(u.lastIndexOf('/') + 1);
    return (u === '' || u === '/index.html') ? '/index.html' : u;
  }
  var path = leaf(window.location.pathname);
  Array.prototype.slice.call(document.querySelectorAll('.odn-links a,.odn-tab')).forEach(function(a){
    if (leaf(a.getAttribute('data-path') || a.getAttribute('href')) === path) a.classList.add('odn-active');
  });
})();
