(function(){
  'use strict';
  var ids={home:1,past:1,grade:1,study:1,universities:1,vu:1,practice:1};
  function show(id){
    if(!ids[id]) id='home';
    var sections=document.querySelectorAll('.section'),i;
    for(i=0;i<sections.length;i++){
      if(sections[i].id===id){sections[i].classList.add('active');sections[i].style.display='block';}
      else{sections[i].classList.remove('active');sections[i].style.display='none';}
    }
    var tabs=document.querySelectorAll('[data-tab]');
    for(i=0;i<tabs.length;i++) tabs[i].classList.toggle('active',tabs[i].getAttribute('data-tab')===id);
    try{if(window.location.hash!=='#'+id) history.replaceState(null,'','#'+id);}catch(e){}
  }
  function target(el){
    while(el&&el!==document){
      if(el.getAttribute){
        var id=el.getAttribute('data-tab')||el.getAttribute('data-open')||el.getAttribute('data-home-open');
        if(id&&ids[id]) return id;
      }
      el=el.parentNode;
    }
    return '';
  }
  document.addEventListener('click',function(e){
    if(e.defaultPrevented)return;
    var id=target(e.target);
    if(!id)return;
    if(e.preventDefault)e.preventDefault();
    show(id);
  },false);
  window.addEventListener('hashchange',function(){var id=window.location.hash.substring(1);if(ids[id])show(id);});
  window.EDUNIZAM_GUEST_NAV={show:show};
  var first=window.location.hash.substring(1);if(ids[first])show(first);
})();