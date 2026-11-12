/* JOKEMOO v17: styled role picker + mobile drawer stability. No Firebase calls. */
(() => {
 'use strict';
 const select=document.getElementById('roleNewRole');
 const modal=document.getElementById('roleCreateModal');
 if(select && modal){
   const wrap=document.createElement('span');wrap.className='jm-role-picker';
   select.parentNode.insertBefore(wrap,select);wrap.append(select);
   select.classList.add('jm-role-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
   const trigger=document.createElement('button');trigger.type='button';trigger.className='jm-role-trigger';
   trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
   trigger.setAttribute('aria-label','เลือกยศของผู้ดูแล');
   trigger.innerHTML='<span class="jm-role-value">ADMIN</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
   wrap.append(trigger);
   const menu=document.createElement('div');menu.id='jmRoleOptions';menu.className='jm-role-options';menu.setAttribute('role','listbox');menu.hidden=true;
   document.body.append(menu);trigger.setAttribute('aria-controls',menu.id);
   let opened=false;
   function update(){
     const current=select.options[select.selectedIndex];trigger.querySelector('.jm-role-value').textContent=current?.textContent||'ADMIN';
     menu.innerHTML=[...select.options].map(o=>`<button type="button" class="jm-role-choice${o.value===select.value?' is-selected':''}" role="option" aria-selected="${o.value===select.value}" data-role="${o.value}" ${o.disabled?'disabled':''}><span class="jm-role-choice-text">${o.textContent}</span><small>${o.value==='dev'?'ดูแลระบบ':o.value==='owner'?'เจ้าของร้าน':'ผู้ดูแลทั่วไป'}</small><span class="jm-role-check" aria-hidden="true">✓</span></button>`).join('');
   }
   function position(){
     if(!opened)return;
     const r=trigger.getBoundingClientRect(),v=window.visualViewport;
     const h=v?.height||innerHeight,offset=v?.offsetTop||0;
     const mw=r.width, mh=menu.offsetHeight||165;
     const below=offset+h-r.bottom, above=r.top-offset;
     const y=(below>=mh+10||below>=above)?r.bottom+7:r.top-mh-7;
     menu.style.left=Math.max(10,Math.min(r.left,innerWidth-mw-10))+'px';
     menu.style.top=Math.max(offset+7,y)+'px';menu.style.width=mw+'px';
   }
   function close(focus=false){if(!opened)return;opened=false;menu.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.classList.remove('is-open');if(focus)trigger.focus();}
   function open(){if(modal.hidden)return;update();opened=true;menu.hidden=false;trigger.setAttribute('aria-expanded','true');trigger.classList.add('is-open');position();menu.querySelector('[aria-selected="true"]:not(:disabled)')?.focus()||menu.querySelector('button:not(:disabled)')?.focus();}
   trigger.addEventListener('click',()=>opened?close():open());
   menu.addEventListener('click',e=>{const b=e.target.closest('[data-role]');if(!b||b.disabled)return;select.value=b.dataset.role;select.dispatchEvent(new Event('change',{bubbles:true}));update();close(true);});
   menu.addEventListener('keydown',e=>{
     const choices=[...menu.querySelectorAll('button:not(:disabled)')];const i=choices.indexOf(document.activeElement);
     if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);return;}
     if(e.key==='Tab'){close();return;}
     if(e.key==='Enter'||e.key===' '){e.preventDefault();document.activeElement.click();return;}
     const next=e.key==='ArrowDown'?Math.min(i+1,choices.length-1):e.key==='ArrowUp'?Math.max(i-1,0):e.key==='Home'?0:e.key==='End'?choices.length-1:-1;
     if(next>=0){e.preventDefault();choices[next]?.focus();}
   });
   select.addEventListener('change',update);
   new MutationObserver(()=>{if(modal.hidden)close();else update();}).observe(modal,{attributes:true,attributeFilter:['hidden']});
   new MutationObserver(update).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
   document.addEventListener('pointerdown',e=>{if(opened&&!menu.contains(e.target)&&!wrap.contains(e.target))close();},true);
   document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened){e.stopImmediatePropagation();close(true);}},true);
   window.addEventListener('resize',position,{passive:true});window.addEventListener('scroll',position,{passive:true,capture:true});
   window.visualViewport?.addEventListener('resize',position,{passive:true});
   update();
 }
 // A filled-mode login animation used to override the drawer's translateX
 // on mobile. Always close it when switching pages / switching layouts.
 const sidebar=document.getElementById('sidebar');
 const overlay=document.getElementById('sidebarOverlay');
 if(sidebar&&overlay){
   function dismissDrawer(){sidebar.classList.remove('open');overlay.classList.remove('show');}
   sidebar.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',dismissDrawer));
   overlay.addEventListener('click',dismissDrawer);
   document.addEventListener('keydown',e=>{if(e.key==='Escape')dismissDrawer();});
   window.addEventListener('resize',()=>{if(innerWidth>960)dismissDrawer();},{passive:true});
 }
})();
