/* v16: paginated overview history. Firebase queries/rendering are left untouched.
 * Rows are cached as DOM nodes after the existing renderer updates the table. */
(() => {
  'use strict';
  const tbody = document.getElementById('overviewBody');
  const viewport = document.getElementById('overviewViewport');
  const select = document.getElementById('overviewPageSize');
  const buttons = document.getElementById('overviewPageButtons');
  const summary = document.getElementById('overviewPageSummary');
  if (!tbody || !viewport || !select || !buttons || !summary) return;
  const permitted = new Set([5,10,50,100]);
  let size = 10;
  try { const stored = Number(localStorage.getItem('jokemoo.rows.overview')); if(permitted.has(stored)) size = stored; } catch {}
  select.value = String(size);
  let page = 0;
  let allRows = [];
  let emptyRow = null;
  let scheduled = false;
  function pages(){return Math.max(1,Math.ceil(allRows.length / size));}
  function pageNums(){
    const total = pages();
    if(total <= 7) return Array.from({length:total},(_,i)=>i);
    const wanted = new Set([0,total-1]);
    for(let i=Math.max(0,page-1); i<=Math.min(total-1,page+1); i++) wanted.add(i);
    if(page<3) [1,2,3].forEach(i=>wanted.add(i));
    if(page>=total-3) [total-2,total-3,total-4].forEach(i=>wanted.add(i));
    const ordered = [...wanted].sort((a,b)=>a-b), result=[];
    ordered.forEach((n,i)=>{if(i && n>ordered[i-1]+1) result.push(null);result.push(n);});
    return result;
  }
  const observer = new MutationObserver(()=>{
    if(scheduled) return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      // A different renderer has updated the table. Capture its complete result.
      const nodes=Array.from(tbody.children);
      emptyRow = nodes.length === 1 && nodes[0].querySelector('td[colspan]') ? nodes[0] : null;
      allRows=emptyRow ? [] : nodes;
      page=0;
      render();
    });
  });
  function render(){
    const count=pages(); page=Math.min(Math.max(0,page),count-1);
    observer.disconnect();
    const frag=document.createDocumentFragment();
    if(emptyRow && !allRows.length) frag.appendChild(emptyRow);
    else for(const el of allRows.slice(page*size,(page+1)*size))frag.appendChild(el);
    tbody.replaceChildren(frag);
    observer.observe(tbody,{childList:true});
    const start=allRows.length ? page*size+1 : 0;
    const end=Math.min((page+1)*size,allRows.length);
    summary.textContent=allRows.length ? `แสดง ${start.toLocaleString('th-TH')}–${end.toLocaleString('th-TH')} จาก ${allRows.length.toLocaleString('th-TH')} รายการ` : 'ไม่พบรายการในวันที่เลือก';
    const arr=[];
    const add=(target,label,disabled=false,cls='')=>`<button type="button" class="jm-page-button ${cls}${target===page && !cls?' is-current':''}" data-target="${target}" ${disabled?'disabled':''} ${target===page && !cls?'aria-current="page"':''} aria-label="ไปหน้า ${target+1}">${label}</button>`;
    arr.push(add(Math.max(0,page-1),'‹',page===0,'jm-page-arrow'));
    pageNums().forEach(n=>arr.push(n===null?'<span class="jm-page-ellipsis" aria-hidden="true">…</span>':add(n,String(n+1),n===page)));
    arr.push(add(Math.min(count-1,page+1),'›',page===count-1,'jm-page-arrow'));
    buttons.innerHTML=arr.join('');
  }
  buttons.addEventListener('click',e=>{
    const btn=e.target.closest('button[data-target]');if(!btn||btn.disabled)return;
    const target=Number(btn.dataset.target);
    if(!Number.isInteger(target)||target<0||target>=pages()||target===page)return;
    page=target;render();viewport.scrollTop=0;viewport.scrollLeft=0;
  });
  select.addEventListener('change',()=>{
    const n=Number(select.value);if(!permitted.has(n))return;
    size=n;page=0;try{localStorage.setItem('jokemoo.rows.overview',String(n));}catch{}
    render();viewport.scrollTop=0;
  });
  document.getElementById('overviewSearch')?.addEventListener('input',()=>{page=0;},true);
  observer.observe(tbody,{childList:true});
  // Initial rows may have been rendered before this script executed.
  if(tbody.children.length){allRows=[...tbody.children];render();}
  else render();
})();
