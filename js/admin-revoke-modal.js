(() => {
const modal=document.getElementById('jmRevokeConfirm');if(!modal)return;
const text=modal.querySelector('#jmRevokeTarget');let resolve=null,focus=null;
function done(value){modal.hidden=true;document.body.classList.remove('role-dialog-open');if(resolve){const fn=resolve;resolve=null;fn(value)}focus?.focus?.()}
modal.querySelectorAll('[data-jm-revoke-close]').forEach(node=>node.addEventListener('click',()=>done(false)));
modal.querySelector('#jmRevokeAccept').addEventListener('click',()=>done(true));
modal.addEventListener('keydown',e=>{if(e.key==='Escape')done(false);});
window.JOKEMOO_CONFIRM_REVOKE=name=>new Promise(res=>{resolve=res;focus=document.activeElement;text.textContent='@'+String(name||'admin');modal.hidden=false;document.body.classList.add('role-dialog-open');modal.querySelector('#jmRevokeCancel').focus();});
})();