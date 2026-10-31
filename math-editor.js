(function(){
  const $=id=>document.getElementById(id);
  const panel=$('mathEditorPanel'),toggle=$('mathModeBtn'),input=$('mathInput'),preview=$('mathPreview');
  if(!panel||!toggle||!input||!preview)return;

  let renderTimer=null;

  function insertAtCursor(text){
    const start=input.selectionStart??input.value.length;
    const end=input.selectionEnd??start;
    input.value=input.value.slice(0,start)+text+input.value.slice(end);
    let cursor=start+text.length;
    const firstEmpty=text.indexOf('{}');
    if(firstEmpty>=0)cursor=start+firstEmpty+1;
    input.focus();
    input.setSelectionRange(cursor,cursor);
    scheduleRender();
  }

  function scheduleRender(){
    clearTimeout(renderTimer);
    renderTimer=setTimeout(renderPreview,120);
  }

  async function renderPreview(){
    const raw=input.value.trim();
    if(!raw){preview.textContent='Type an equation to preview it.';return;}
    preview.textContent='\\['+raw+'\\]';
    try{
      if(window.MathJax?.typesetPromise){
        await window.MathJax.typesetClear?.([preview]);
        await window.MathJax.typesetPromise([preview]);
      }else{
        preview.textContent=raw;
      }
    }catch(e){
      preview.textContent='Preview error — check the equation syntax.';
    }
  }

  function buildMathPrompt(){
    const expr=input.value.trim();
    if(!expr)return '';
    return 'Solve this mathematical expression step-by-step. Show clear working, formulas used, simplification, and final answer. Equation (LaTeX): \\('+expr+'\\)';
  }

  toggle.addEventListener('click',()=>{
    panel.classList.toggle('hidden');
    toggle.classList.toggle('active',!panel.classList.contains('hidden'));
    if(!panel.classList.contains('hidden')){input.focus();scheduleRender();}
  });

  document.querySelectorAll('[data-math-insert]').forEach(btn=>{
    btn.addEventListener('click',()=>insertAtCursor(btn.dataset.mathInsert||''));
  });

  input.addEventListener('input',scheduleRender);

  $('insertMathPromptBtn')?.addEventListener('click',()=>{
    const prompt=buildMathPrompt();
    if(!prompt)return alert('Enter an equation first.');
    const ai=$('aiPrompt');
    ai.value=(ai.value.trim()?ai.value.trim()+'\n\n':'')+prompt;
    ai.focus();
    if($('aiOutput'))$('aiOutput').textContent='Equation added to AI Solve prompt.';
  });

  $('copyLatexBtn')?.addEventListener('click',async()=>{
    const text=input.value.trim();
    if(!text)return;
    try{await navigator.clipboard.writeText(text);$('aiOutput').textContent='LaTeX copied.'}
    catch(e){input.select();document.execCommand('copy');$('aiOutput').textContent='LaTeX copied.'}
  });

  $('clearMathBtn')?.addEventListener('click',()=>{
    input.value='';
    preview.textContent='Type an equation to preview it.';
    input.focus();
  });

  window.EduNizamMath={
    openWith(expression=''){
      panel.classList.remove('hidden');
      toggle.classList.add('active');
      input.value=expression;
      input.focus();
      scheduleRender();
    },
    getLatex(){return input.value.trim();},
    buildPrompt:buildMathPrompt
  };
})();