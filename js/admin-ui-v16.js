/* JOKEMOO v16: accessible custom page-size menu + auth transition garnish.
   Firebase Authentication and existing login/logout listeners are not modified. */
(() => {
  'use strict';
  const sizes=[5,10,50,100];
  const menus=[];
  function closeAll(except){
    for(const m of menus){if(m!==except)m.close();}
  }
  for(const name of ['overview','codes','history']){
    const native=document.getElementById(name+'PageSize');
    if(!native)continue;
    const wrapper=document.createElement('span');wrapper.className='jm-size-picker';
    const trigger=document.createElement('button');trigger.type='button';trigger.className='jm-size-trigger';
    const list=document.createElement('div');list.className='jm-size-menu';list.id=name+'SizeOptions';list.setAttribute('role','listbox');list.hidden=true;
    trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-controls',list.id);
    trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label','เลือกจำนวนแถวต่อหน้า');
    trigger.innerHTML='<span class="jm-size-current"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    list.innerHTML=sizes.map(n=>`<button type="button" role="option" class="jm-size-option" id="${name}Size${n}" aria-selected="false" data-size="${n}"><span>${n}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg></button>`).join('');
    native.parentNode.insertBefore(wrapper,native);
    wrapper.append(native,trigger,list);
    native.classList.add('jm-size-native');native.setAttribute('aria-hidden','true');native.tabIndex=-1;
    const options=[...list.querySelectorAll('[data-size]')];
    let isOpen=false;
    function sync(){
      trigger.querySelector('.jm-size-current').textContent=native.value;
      options.forEach(option=>{
        const selected=option.dataset.size===native.value;
        option.setAttribute('aria-selected',String(selected));option.classList.toggle('is-selected',selected);
      });
    }
    function close(restoreFocus=false){
      if(!isOpen)return;
      isOpen=false;list.hidden=true;wrapper.classList.remove('is-open');trigger.setAttribute('aria-expanded','false');
      if(restoreFocus)trigger.focus();
    }
    function open(){
      closeAll(api);isOpen=true;list.hidden=false;wrapper.classList.add('is-open');trigger.setAttribute('aria-expanded','true');
      sync();(options.find(o=>o.dataset.size===native.value)||options[0]).focus();
    }
    const api={close};menus.push(api);
    trigger.addEventListener('click',()=>isOpen?close():open());
    native.addEventListener('change',sync);
    list.addEventListener('click',event=>{
      const option=event.target.closest('button[data-size]');if(!option)return;
      native.value=option.dataset.size;
      native.dispatchEvent(new Event('change',{bubbles:true}));
      close(true);
    });
    list.addEventListener('keydown',event=>{
      const index=options.indexOf(document.activeElement);
      let next=index;
      if(event.key==='ArrowDown')next=(index+1)%options.length;
      else if(event.key==='ArrowUp')next=(index-1+options.length)%options.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=options.length-1;
      else if(event.key==='Escape'){event.preventDefault();close(true);return;}
      else if(event.key==='Enter'||event.key===' '){event.preventDefault();document.activeElement.click();return;}
      else if(event.key==='Tab'){close();return;}
      else return;
      event.preventDefault();options[next].focus();
    });
    sync();
  }
  document.addEventListener('pointerdown',event=>{
    if(!event.target.closest('.jm-size-picker'))closeAll();
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape')closeAll();
  },true);

  // Wheel over horizontal data tables: allow sideways scrolling when their
  // vertical content fits. Normal vertical scrolling remains native.
  for(const id of ['overviewViewport','codesViewport','historyViewport']){
    const viewport=document.getElementById(id);if(!viewport)continue;
    viewport.addEventListener('wheel',event=>{
      const verticalAvailable=viewport.scrollHeight>viewport.clientHeight+2;
      const horizontalAvailable=viewport.scrollWidth>viewport.clientWidth+2;
      if(!horizontalAvailable||verticalAvailable||event.ctrlKey||Math.abs(event.deltaY)<Math.abs(event.deltaX))return;
      const before=viewport.scrollLeft;
      viewport.scrollLeft+=event.deltaY;
      if(viewport.scrollLeft!==before)event.preventDefault();
    },{passive:false});
  }

  const loginScreen=document.getElementById('loginScreen');
  const form=document.getElementById('loginForm');
  const loginButton=document.getElementById('loginBtn');
  const adminApp=document.getElementById('adminApp');
  const logoutButton=document.getElementById('logoutBtn');
  if(!form||!loginButton||!adminApp)return;
  let loginTimer=0;
  function stopLogin(){
    loginScreen?.classList.remove('jm-auth-loading');
    loginButton.removeAttribute('aria-busy');
    clearTimeout(loginTimer);
  }
  form.addEventListener('submit',()=>{
    if(!form.checkValidity())return;
    loginScreen?.classList.add('jm-auth-loading');
    loginButton.setAttribute('aria-busy','true');
    // Timeout only resets visual state if auth doesn't resolve; no auth action is changed.
    clearTimeout(loginTimer);loginTimer=setTimeout(stopLogin,12000);
  },true);
  const loginMessage=document.getElementById('loginMessage');
  if(loginMessage)new MutationObserver(()=>{
    const message=loginMessage.textContent.trim();
    if(message && !/(กำลัง|loading|ตรวจสอบ|signing)/i.test(message))stopLogin();
  }).observe(loginMessage,{childList:true,subtree:true,characterData:true});
  const shade=document.createElement('div');shade.className='jm-signout-shade';shade.setAttribute('aria-hidden','true');
  shade.innerHTML='<div class="jm-signout-orb" aria-hidden="true"><span></span></div><strong>กำลังออกจากระบบ</strong><small>JOKEMOO CONTROL</small>';
  document.body.append(shade);
  let shadeTimer=0;
  function signoutAnimation(){
    shade.classList.add('is-active');clearTimeout(shadeTimer);
    shadeTimer=setTimeout(()=>shade.classList.remove('is-active'),600);
  }
  logoutButton?.addEventListener('click',signoutAnimation,true);
  new MutationObserver(()=>{
    if(!adminApp.hidden){
      stopLogin();adminApp.classList.remove('jm-admin-arrived');
      requestAnimationFrame(()=>adminApp.classList.add('jm-admin-arrived'));
    }
  }).observe(adminApp,{attributes:true,attributeFilter:['hidden']});
})();
