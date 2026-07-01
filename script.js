const menu=document.querySelector('.menu'),nav=document.querySelector('#nav');
if(menu&&nav){menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!open));nav.classList.toggle('open',!open)});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{menu.setAttribute('aria-expanded','false');nav.classList.remove('open')}))}
const page=document.body.dataset.page;document.querySelector(`[data-nav="${page}"]`)?.classList.add('active');
document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');io.unobserve(entry.target)}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
const progress=document.querySelector('.progress');function setProgress(){const max=document.documentElement.scrollHeight-innerHeight;progress.style.width=`${max>0?scrollY/max*100:0}%`}addEventListener('scroll',setProgress,{passive:true});setProgress();
