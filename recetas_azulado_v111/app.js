(() => {
  'use strict';
  const L = window.RecetasLogic;
  const KEY = 'recetas_azulado_v1';
  const defaultRecipes = [{
    id: 'az-cookies-doble-choco', name: 'Cookies doble choco', category: 'Cookies',
    yield: 378, yieldUnit: 'cookies', demo: true,
    notes: 'Transcripción de la foto “Cookies doble choco ×6”. Se toma el lote fotografiado como referencia para 378 cookies. Confirmar rendimiento real, unidades y las cantidades marcadas antes de usarla en producción.',
    instructions: 'Preparación pendiente de cargar. Podés agregar los pasos desde “Editar receta”.',
    updatedAt: '2026-10-18T00:00:00.000Z',
    ingredients: [
      { name: 'Manteca noisette', amount: 1440, unit: 'g' },
      { name: 'Azúcar rubia', amount: 1200, unit: 'g' },
      { name: 'Azúcar común', amount: 720, unit: 'g' },
      { name: 'Huevo', amount: 12, unit: 'unid.' },
      { name: 'Yema', amount: 12, unit: 'unid.' },
      { name: 'Vainilla', amount: 12, unit: 'g', review: true },
      { name: 'Cacao alcalino', amount: 540, unit: 'g' },
      { name: 'Harina 0000', amount: 2160, unit: 'g' },
      { name: 'Bicarbonato', amount: 15, unit: 'g' },
      { name: 'Sal', amount: 15, unit: 'g' },
      { name: 'Chocolate Picos del Sur', amount: 1100, unit: 'g', review: true },
      { name: 'Fénix con leche', amount: 1200, unit: 'g', review: true }
    ]
  }];
  const app = document.getElementById('app');
  const toastElement = document.getElementById('toast');
  const state = {
    recipes: load(), page: 'home', selectedId: null, quickId: null,
    filter: 'Todas', search: '', target: 378, quickTarget: 378,
    checked: new Set(), modal: null, editingId: null, draft: null, backTo: 'home',
    scanBusy: false, scanMessage: '', scanError: '', canRetryScan: false, aiDraft: false, aiYieldVerified: false, aiWarnings: [],
    hasGroqKey: !!(window.RecetasAndroid && window.RecetasAndroid.hasGroqKey())
  };
  let toastTimeout = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw !== null) {
        const data = JSON.parse(raw);
        if (Array.isArray(data)) return data.map(L.validateRecipe);
      }
    } catch (_) { /* Se evita sobreescribir un respaldo inválido. */ }
    return defaultRecipes.map(r => L.validateRecipe(r));
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(state.recipes)); }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  const e = escapeHtml;
  function icon(name) {
    const paths = {
      home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
      book:'<path d="M12 7c-2-2-6-2-9-1v15c4-1 7-1 9 1 2-2 5-2 9-1V6c-3-1-7-1-9 1zM12 7v15"/>',
      calculate:'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h2m4 0h2M8 15h2m4 0h2M8 19h2m4 0h2"/>',
      database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
      plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>',
      back:'<path d="m15 18-6-6 6-6M9 12h12"/>', chevron:'<path d="m9 18 6-6-6-6"/>',
      search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      edit:'<path d="m16 4 4 4-12 12H4v-4L16 4zM14 6l4 4"/>',
      trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
      check:'<path d="m5 12 4 4L19 6"/>',
      share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.5 10.5 7-4m-7 7 7 4"/>',
      download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
      upload:'<path d="M12 17V4M7 9l5-5 5 5M4 17v4h16v-4"/>',
      info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
      alert:'<path d="M12 3 2 21h20L12 3zM12 9v5M12 18h.01"/>',
      clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
      copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/>',
      scale:'<path d="M12 2v3M4 8h16l2 11H2L4 8zM12 9l3 4M7 19v3m10-3v3"/>',
      layers:'<path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>',
      close:'<path d="M18 6 6 18M6 6l12 12"/>',
      camera:'<path d="M14 4h-4l-2 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-4z"/><circle cx="12" cy="14" r="3"/>',
      image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
      key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9 2 2-3 3 1 2-2 2-2-1-3 3"/>'
    };
    return `<svg aria-hidden="true" viewBox="0 0 24 24">${paths[name]||paths.info}</svg>`;
  }
  function toast(message) {
    toastElement.textContent = message;
    toastElement.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toastElement.classList.remove('visible'), 3200);
  }
  function getRecipe(id) { return state.recipes.find(r => r.id === id); }
  function art(recipe) {
    const category = (recipe.category || '').toLowerCase();
    let art = '🥣', type = 'otro';
    if (category.includes('cookie') || category.includes('gallet')) { art='🍪'; type='cookie'; }
    else if (category.includes('torta') || category.includes('pastel')) { art='🍰'; type='torta'; }
    else if (category.includes('rellen') || category.includes('crema')) { art='🍮'; type='relleno'; }
    else if (category.includes('masa') || category.includes('pan') || category.includes('budin')) { art='🥐'; type='masa'; }
    return `<div class="recipe-art ${type}" aria-hidden="true">${art}</div>`;
  }
  function topbar() {
    return `<header class="topbar"><img class="brand-mark-img" src="brand-logo.png" alt="Logo Azulado"><div class="brand-copy"><div class="brand-name">Recetas Azulado</div><div class="brand-sub">Tu cocina, bien organizada</div></div><button class="icon-btn accent" data-action="new" aria-label="Nueva receta">${icon('plus')}</button></header>`;
  }
  function nav() {
    return `<nav class="bottom-nav" aria-label="Navegación principal">
      <button data-action="home" class="nav-item ${state.page==='home'?'active':''}">${icon('book')}<span>Recetas</span></button>
      <button data-action="quick" class="nav-item ${state.page==='quick'?'active':''}">${icon('calculate')}<span>Calculadora</span></button>
      <button data-action="scan" class="nav-item ${state.page==='scan'||state.page==='ai-settings'?'active':''}">${icon('camera')}<span>Foto IA</span></button>
      <button data-action="backup" class="nav-item ${state.page==='backup'?'active':''}">${icon('database')}<span>Respaldo</span></button>
    </nav>`;
  }
  function heading(title, action='back', right='') {
    return `<header class="detail-header"><button class="icon-btn" data-action="${action}" aria-label="Volver">${icon('back')}</button><b>${e(title)}</b>${right}</header>`;
  }
  function filtered() {
    const q = state.search.toLocaleLowerCase('es-AR').trim();
    return state.recipes.filter(r => (state.filter === 'Todas' || r.category === state.filter) && (!q || `${r.name} ${r.category} ${r.ingredients.map(i=>i.name).join(' ')}`.toLocaleLowerCase('es-AR').includes(q)));
  }
  function recipeCard(recipe) {
    return `<button class="recipe-card" data-action="detail" data-id="${e(recipe.id)}">
      ${art(recipe)}<div class="recipe-card-body"><div class="recipe-title">${e(recipe.name)}</div><div class="recipe-desc"><span>${e(recipe.category)}</span> ${recipe.ingredients.length} ingredientes</div><div class="recipe-yield">Rinde ${L.pretty(recipe.yield)} ${e(recipe.yieldUnit)}</div></div><div class="recipe-arrow">${icon('chevron')}</div>
    </button>`;
  }
  function listHtml() {
    const recipes = filtered();
    return recipes.length ? `<div class="recipe-list">${recipes.map(recipeCard).join('')}</div>` :
      `<div class="empty-state"><div class="empty-art">🧁</div><h3>No encontramos recetas</h3><p>Probá otra búsqueda o cargá tu primera elaboración.</p><button class="button-secondary" data-action="new">${icon('plus')} Nueva receta</button></div>`;
  }
  function home() {
    const categories = ['Todas', ...new Set(state.recipes.map(r => r.category).filter(Boolean))];
    return `${topbar()}<section class="home-head"><div class="eyebrow">TU RECETARIO</div><h1>Tus recetas,<br>siempre a mano.</h1><p class="subtext">Todo lo que preparás, organizado en un solo lugar.</p></section>
      <section class="hero"><div class="hero-text"><h2>La cantidad justa, sin hacer cuentas.</h2><p>Elegí cuántas unidades necesitás y calculá cada ingrediente.</p><button data-action="quick">Abrir calculadora ${icon('chevron')}</button></div><span class="hero-illustration" aria-hidden="true">🥐</span></section>
      <button class="ai-hero" data-action="scan"><span class="ai-hero-symbol">${icon('camera')}</span><span><strong>Importar receta desde una foto</strong><small>La IA interpreta ingredientes y te pide verificarlos.</small></span>${icon('chevron')}</button>
      <div class="row-between section-head"><h2>Mis recetas</h2><span class="count">${state.recipes.length} ${state.recipes.length===1?'guardada':'guardadas'}</span></div>
      <label class="search-box">${icon('search')}<input id="recipe-search" placeholder="Buscar recetas o ingredientes" value="${e(state.search)}" autocomplete="off" aria-label="Buscar recetas"></label>
      <div class="chips" aria-label="Filtrar por categoría">${categories.map(c=>`<button class="chip ${c===state.filter?'selected':''}" data-action="filter" data-value="${e(c)}">${e(c)}</button>`).join('')}</div>
      <div id="recipe-list">${listHtml()}</div>`;
  }
  function normalizeTarget(recipe, key) {
    const n = L.number(state[key]);
    if (!Number.isFinite(n) || n <= 0 || n > 10000000) return recipe.yield;
    return n;
  }
  function calculator(recipe, key) {
    const target = normalizeTarget(recipe, key);
    const factor = L.scale(recipe, target).factor;
    return `<section class="calculator-panel"><h3>¿Cuántas ${e(recipe.yieldUnit)} necesitás?</h3>
      <p class="help">Receta de referencia: ${L.pretty(recipe.yield)} ${e(recipe.yieldUnit)}.</p>
      <div class="counter"><input id="target-input" aria-label="Cantidad deseada" inputmode="numeric" type="number" min="1" max="10000000" step="1" value="${target}"><button class="step" data-action="decrement" aria-label="Restar una unidad">${icon('minus')}</button><button class="step" data-action="increment" aria-label="Sumar una unidad">${icon('plus')}</button></div>
      <div class="preset-row">${[.5,1,2].map((n,i)=>`<button class="preset ${Math.abs(target-recipe.yield*n)<.000001?'active':''}" data-action="preset" data-value="${n}">${['½ tanda','1 tanda','2 tandas'][i]}</button>`).join('')}</div>
      <div id="factor-line">${factorLine(factor)}</div>
    </section>`;
  }
  function factorLine(factor) { return `<div class="factorbar"><span>Factor de escala</span><strong>× ${L.pretty(factor, 4)}</strong></div>`; }
  function ingredientList(recipe, target) {
    const scaled = L.scale(recipe, target);
    const rows = scaled.ingredients.map((ing, index) => {
      const checked = state.checked.has(index);
      return `<div class="ingredient-row ${checked?'checked':''}">
        <button class="ingredient-check" data-action="check" data-index="${index}" aria-label="${checked?'Desmarcar':'Marcar'} ${e(ing.name)}">${icon('check')}</button>
        <div><div class="ingredient-name">${e(ing.name)}${ing.review ? ' <span class="review-text" title="Dato por confirmar">*</span>' : ''}</div><div class="ingredient-base">Base: ${L.quantity(ing.amount, ing.unit)}</div></div>
        <div class="ingredient-quantity">${L.quantity(ing.scaled, ing.unit)}</div>
      </div>`;
    }).join('');
    const fractionalUnits = scaled.ingredients.some(i=>i.unit==='unid.' && Math.abs(i.scaled-Math.round(i.scaled))>.0001);
    return `<div class="ingredient-list">${rows}</div>${fractionalUnits?`<div class="note-box section-gap">${icon('info')}Las cantidades fraccionarias de huevos o yemas requieren ajuste según la elaboración.</div>`:''}`;
  }
  function ingredientSection(recipe, target) {
    return `<div class="ingredient-head"><div><h2>Ingredientes calculados</h2><small>Para ${L.pretty(target)} ${e(recipe.yieldUnit)}</small></div><span class="count">${recipe.ingredients.length} en total</span></div>
      <div id="ingredient-results">${ingredientList(recipe, target)}</div>`;
  }
  function detail() {
    const r = getRecipe(state.selectedId);
    if (!r) { state.page='home'; return home(); }
    const target = normalizeTarget(r,'target');
    const right = `<button class="detail-icon" data-action="edit" aria-label="Editar receta">${icon('edit')}</button><button class="detail-icon" data-action="share" aria-label="Compartir ingredientes">${icon('share')}</button>`;
    return `${heading('Mi receta','back',right)}
      <div class="detail-banner"><span class="badge-label">${e(r.category)}</span><h1>${e(r.name)}</h1><span class="emoji" aria-hidden="true">${r.category==='Cookies'?'🍪':'🧁'}</span></div>
      <div class="detail-meta"><div class="meta-pill">${icon('layers')} ${L.pretty(r.yield)} ${e(r.yieldUnit)}</div><div class="meta-pill">${icon('scale')} ${r.ingredients.length} ingredientes</div></div>
      ${r.demo ? `<div class="note-box">${icon('alert')}Receta importada de una foto. Revisá los valores marcados con * y confirmá el rendimiento antes de producir.</div>` : ''}
      ${calculator(r,'target')}${ingredientSection(r,target)}
      <div class="detail-actions"><button class="button-secondary" data-action="share">${icon('share')} Compartir</button><button class="button-primary" data-action="edit">${icon('edit')} Editar</button></div>
      ${r.instructions?`<section class="section-gap"><h2>Preparación</h2><div class="instructions">${e(r.instructions)}</div></section>`:''}
      ${r.notes?`<section class="section-gap"><h2>Notas</h2><div class="instructions">${e(r.notes)}</div></section>`:''}
      <div class="divider"></div><button class="text-danger" data-action="delete">Eliminar esta receta</button>`;
  }
  function quick() {
    const r = getRecipe(state.quickId) || state.recipes[0];
    if (r && state.quickId !== r.id) { state.quickId = r.id; state.quickTarget = r.yield; }
    return `${topbar()}<section class="home-head"><div class="eyebrow">ESCALADO AUTOMÁTICO</div><h1>Calculadora<br>de recetas.</h1><p class="subtext">Sin reglas de tres. Todas las cantidades se ajustan juntas.</p></section>
      <div class="section-kicker">RECETA SELECCIONADA</div>
      ${r?`<button class="quick-select" data-action="choose-quick">${art(r)}<div><div class="name">${e(r.name)}</div><div class="base">${L.pretty(r.yield)} ${e(r.yieldUnit)} de referencia</div></div>${icon('chevron')}</button>
      ${calculator(r,'quickTarget')}${ingredientSection(r,normalizeTarget(r,'quickTarget'))}
      <button class="button-primary full section-gap" data-action="share">${icon('share')} Compartir lista de ingredientes</button>`:
      `<div class="empty-state"><div class="empty-art">🍮</div><h3>Agregá tu primera receta</h3><p>Necesitás una receta para calcular proporciones.</p><button class="button-primary" data-action="new">Nueva receta</button></div>`}`;
  }
  function scan() {
    return `${heading('Escanear receta')}<div class="home-head"><div class="eyebrow">LECTURA INTELIGENTE</div><h1>De una foto<br>a tu recetario.</h1><p class="subtext">Fotografiá una receta escrita a mano o seleccioná una imagen. La IA extrae ingredientes y cantidades para que los compruebes antes de guardarlos.</p></div>
      <section class="ai-panel"><div class="ai-illustration">${icon('camera')}</div>
        <div class="ai-status">${state.scanBusy?'Analizando imagen…':state.hasGroqKey?'Groq está configurado':'Falta configurar Groq'}</div>
        <p>${state.scanBusy?'Puede tardar algunos segundos. Mantené abierta la aplicación.':state.hasGroqKey?'Modelo: Qwen 3.8 27B · Requiere conexión a Internet.':'Ingresá tu propia clave de Groq antes de comenzar.'}</p>
        <button class="button-primary full" data-action="take-photo" ${state.scanBusy?'disabled':''}>${icon('camera')} Sacar foto</button>
        <button class="button-secondary full" data-action="pick-photo" ${state.scanBusy?'disabled':''}>${icon('image')} Elegir foto de la galería</button>
        <button class="ai-link" data-action="ai-settings">${icon('key')} ${state.hasGroqKey?'Cambiar clave de Groq':'Configurar clave de Groq'}</button>
        ${state.scanError?`<section class="ai-scan-error" role="alert"><div class="ai-scan-error-title">${icon('alert')} No se pudo procesar la foto</div><p>${e(state.scanError)}</p>${state.canRetryScan?`<button class="button-secondary full" data-action="retry-photo" ${state.scanBusy?'disabled':''}>${icon('image')} Reintentar con la misma foto</button>`:''}</section>`:''}
      </section>
      <div class="note-box">${icon('alert')} <div>Antes de guardar tendrás que verificar <b>cada ingrediente</b>, sus cantidades, unidades y el rendimiento de la receta. Los datos ilegibles no se completarán automáticamente.</div></div>
      <div class="plain-alert">Tu foto se envía a Groq para analizarla. No se sube a nuestro propio servidor. La clave se guarda cifrada en el celular y no se incluye en el respaldo JSON.</div>`;
  }
  function aiSettings() {
    return `${heading('Configurar Groq')}<section class="home-head"><div class="eyebrow">CONEXIÓN A LA IA</div><h1>Tu clave<br>de Groq.</h1><p class="subtext">Usamos Qwen 3.8 27B para interpretar recetas fotografiadas.</p></section>
      <section class="form-section"><div class="config-state">${state.hasGroqKey?'✓ Hay una clave guardada en este teléfono.':'Todavía no hay una clave configurada.'}</div>
      <label class="field"><span class="field-label">Groq API Key</span><input id="groq-key-input" type="password" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="gsk_…"></label>
      <button class="button-primary full" data-action="save-groq-key">${icon('check')} Guardar clave en el dispositivo</button>
      ${state.hasGroqKey?'<button class="text-danger" data-action="clear-groq-key">Eliminar clave guardada</button>':''}</section>
      <p class="small-print">Creá una clave en console.groq.com/keys. No copies la clave en el código ni la publiques. Solo se envía a Groq para autenticar cada análisis.</p>
      <div class="plain-alert">El almacenamiento utiliza el sistema Android Keystore con cifrado AES-GCM. Al desinstalar la aplicación, puede ser necesario configurar la clave otra vez.</div>`;
  }
  function ingredientEditorRow(ingredient, i) {
    return `<div class="form-ingredient" data-ingredient-row="${i}"><div class="row-between"><span class="ingredient-index">INGREDIENTE ${i+1}</span><button class="tiny-delete" data-action="remove-ingredient" data-index="${i}" aria-label="Eliminar ingrediente ${i+1}">${icon('trash')}</button></div>
      <label class="field"><span class="field-label">Nombre</span><input data-field="name" placeholder="Ej: Harina 0000" value="${e(ingredient.name)}" maxlength="240"></label>
      <div class="grid-2"><label class="field"><span class="field-label">Cantidad</span><input data-field="amount" type="number" inputmode="decimal" step="any" min="0.000001" placeholder="Ej: 250" value="${e(ingredient.amount)}"></label>
      <label class="field"><span class="field-label">Unidad</span><select data-field="unit">${L.UNITS.map(u=>`<option value="${e(u)}" ${u===ingredient.unit?'selected':''}>${e(u)}</option>`).join('')}</select></label></div>
      <label class="field" style="flex-direction:row;align-items:center;gap:9px"><input data-field="review" type="checkbox" ${ingredient.review?'checked':''} style="width:17px;min-height:17px;accent-color:#ad623d"><span class="field-label">${state.aiDraft?'Pendiente de verificar (desmarcá al confirmar)':'Dato por confirmar'}</span></label></div>`;
  }
  function editor() {
    const d = state.draft;
    const isEditing = !!state.editingId;
    return `${heading(state.aiDraft?'Verificar receta':isEditing?'Editar receta':'Nueva receta')}
      <div class="home-head"><div class="eyebrow">${isEditing?'MODIFICAR ELABORACIÓN':'CARGAR ELABORACIÓN'}</div><h1>${state.aiDraft?'Revisá cada dato.':isEditing?'Ajustá tu receta.':'Guardá una receta.'}</h1><p class="subtext">Ingresá las cantidades de una tanda de referencia. Después podrás calcular cualquier producción.</p></div>
      ${state.aiDraft?`<div class="ai-review-banner">${icon('alert')} <div><strong>Verificá la transcripción antes de guardar.</strong><p>Todos los ingredientes extraídos están pendientes. Corregí nombres, cantidades y unidades, y desmarcá cada ingrediente que hayas comprobado.</p>${state.aiWarnings.length?`<ul>${state.aiWarnings.map(x=>`<li>${e(x)}</li>`).join('')}</ul>`:''}</div></div>`:''}
      <section class="form-section"><h3>Datos generales</h3>
        <label class="field"><span class="field-label">Nombre de la receta <span class="required">*</span></span><input id="edit-name" placeholder="Ej: Cookies de chocolate" maxlength="240" value="${e(d.name)}"></label>
        <label class="field"><span class="field-label">Categoría</span><input id="edit-category" placeholder="Ej: Cookies, Tortas, Rellenos" list="category-suggestions" value="${e(d.category)}"><datalist id="category-suggestions">${['Cookies','Tortas','Budines','Masas','Rellenos','Cremas','Alfajores','Otros',...state.recipes.map(r=>r.category)].filter((x,i,a)=>a.indexOf(x)===i).map(x=>`<option value="${e(x)}"></option>`).join('')}</datalist></label>
        <div class="grid-2"><label class="field"><span class="field-label">Rinde (cantidad) <span class="required">*</span></span><input id="edit-yield" type="number" inputmode="numeric" min="1" step="1" value="${e(d.yield)}"></label>
        <label class="field"><span class="field-label">Tipo de unidad</span><input id="edit-yieldunit" placeholder="Ej: cookies" value="${e(d.yieldUnit)}"></label></div>
      </section>
      <section class="form-section"><div class="row-between" style="margin-bottom:15px"><h3 style="margin:0">Ingredientes <span class="required">*</span></h3><span class="small-print">${d.ingredients.length} cargados</span></div>
        <div id="editor-ingredients">${d.ingredients.map(ingredientEditorRow).join('')}</div>
        <button class="button-secondary full" data-action="add-ingredient">${icon('plus')} Agregar ingrediente</button></section>
      <section class="form-section"><h3>Instrucciones y observaciones</h3>
        <label class="field"><span class="field-label">Pasos de preparación</span><textarea id="edit-instructions" placeholder="Describí la elaboración, temperaturas, tiempos...">${e(d.instructions)}</textarea></label>
        <label class="field"><span class="field-label">Notas internas</span><textarea id="edit-notes" placeholder="Marcas, consejos, sustituciones...">${e(d.notes)}</textarea></label>
        ${state.aiDraft?`<label class="ai-yield-check"><input id="ai-yield-verified" type="checkbox" ${state.aiYieldVerified?'checked':''}><span>Revisé el rendimiento y el tipo de unidad de esta receta.</span></label>`:''}
        ${d.demo?`<label class="field" style="flex-direction:row;align-items:center;gap:10px;margin-top:8px"><input type="checkbox" id="edit-confirm" style="width:18px;min-height:18px;accent-color:#b85b36"><span class="field-label">Confirmé el rendimiento y los valores de esta receta</span></label>`:''}</section>
      <div class="form-footer"><button class="button-secondary" data-action="back">Cancelar</button><button class="button-primary" data-action="save-recipe">${icon('check')} ${state.aiDraft?'Confirmar y guardar':'Guardar receta'}</button></div>`;
  }
  function backup() {
    return `${topbar()}<section class="home-head"><div class="eyebrow">TUS DATOS</div><h1>Respaldo y<br>seguridad.</h1><p class="subtext">Tus recetas se guardan en este dispositivo, incluso cuando no tenés Internet.</p></section>
      <div class="data-card"><div class="data-icon">${icon('download')}</div><h3>Exportar recetario</h3><p>Guardá una copia de tus ${state.recipes.length} recetas en un archivo JSON. Podés trasladarla a otro celular o conservarla como respaldo.</p><button class="button-primary full" data-action="export">${icon('download')} Descargar respaldo</button></div>
      <div class="data-card"><div class="data-icon">${icon('upload')}</div><h3>Importar recetario</h3><p>Restaurá tus recetas desde un respaldo anterior. Se reemplazará el recetario actual, luego de tu confirmación.</p><button class="button-secondary full" data-action="import">${icon('upload')} Seleccionar archivo</button><input type="file" id="import-file" accept=".json,application/json" hidden></div>
      <div class="plain-alert">${icon('info')} <b>Funciona sin conexión.</b> No necesitás una cuenta. La información queda almacenada en la aplicación; si la desinstalás o borrás sus datos, podrías perder las recetas que no hayas exportado.</div>
      <div class="divider"></div><button class="text-danger" data-action="reset">Eliminar todas mis recetas</button><p class="small-print">Versión 1.1.1 · Recetas Azulado · Datos almacenados localmente</p>`;
  }
  function modal() {
    return state.modal==='quick-picker' ? `<div class="selector-modal" id="sheet-overlay"><div class="selector-sheet" role="dialog" aria-modal="true" aria-label="Elegir receta"><div class="row-between"><h2>Elegí una receta</h2><button class="icon-btn" data-action="dismiss" aria-label="Cerrar">${icon('close')}</button></div>${state.recipes.map(r=>`<button class="selector-item" data-action="pick-quick" data-id="${e(r.id)}">${e(r.name)} · ${L.pretty(r.yield)} ${e(r.yieldUnit)}</button>`).join('')}</div></div>` : '';
  }
  function render(scroll = true) {
    const view = ({home,detail,quick,editor,backup,scan,'ai-settings':aiSettings}[state.page] || home)();
    app.innerHTML = `<main class="page">${view}</main>${nav()}${state.page==='home'?`<button class="floating-plus" data-action="new" aria-label="Crear receta">${icon('plus')}</button>`:''}${modal()}`;
    if (scroll) window.scrollTo({top:0,behavior:'instant'});
  }
  function setPage(page, backTo) {
    if (backTo) state.backTo=backTo;
    state.page=page; state.modal=null;render();
  }
  function openDetail(id, previous = 'home') {
    const recipe = getRecipe(id); if (!recipe) return;
    state.selectedId=id; state.target=recipe.yield;state.checked=new Set();setPage('detail',previous);
  }
  function openEditor(id) {
    const recipe = id && getRecipe(id);
    state.editingId=recipe?recipe.id:null;
    state.aiDraft=false;state.aiYieldVerified=false;state.aiWarnings=[];
    state.draft=recipe?JSON.parse(JSON.stringify(recipe)):{id:'',name:'',category:'Cookies',yield:12,yieldUnit:'unidades',ingredients:[{name:'',amount:'',unit:'g',review:false}],instructions:'',notes:'',demo:false};
    setPage('editor',recipe?'detail':state.page);
  }
  function saveDraftFromForm() {
    const d=state.draft; if (!d || state.page!=='editor') return;
    const input=id=>document.getElementById(id);
    d.name=input('edit-name').value; d.category=input('edit-category').value;
    d.yield=input('edit-yield').value;d.yieldUnit=input('edit-yieldunit').value;
    d.instructions=input('edit-instructions').value;d.notes=input('edit-notes').value;
    if (state.aiDraft) state.aiYieldVerified=!!input('ai-yield-verified')?.checked;
    if (input('edit-confirm')?.checked) d.demo=false;
    d.ingredients=Array.from(document.querySelectorAll('[data-ingredient-row]')).map(row=>({
      name:row.querySelector('[data-field="name"]').value,
      amount:row.querySelector('[data-field="amount"]').value,
      unit:row.querySelector('[data-field="unit"]').value,
      review:row.querySelector('[data-field="review"]').checked
    }));
  }
  function saveDraft() {
    try {
      saveDraftFromForm();
      if(state.aiDraft){
        const pending=state.draft.ingredients.filter(i=>i.review).length;
        if(pending) throw new Error(`Te faltan verificar ${pending} ingredientes. Desmarcá cada uno después de revisarlo.`);
        if(!state.aiYieldVerified) throw new Error('Confirmá el rendimiento y el tipo de unidad antes de guardar.');
      }
      const editing=!!state.editingId;
      state.draft.id = editing ? state.editingId : 'az-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
      state.draft.updatedAt = new Date().toISOString();
      const recipe=L.validateRecipe(state.draft);
      if (editing) state.recipes=state.recipes.map(r=>r.id===recipe.id?recipe:r);
      else state.recipes.unshift(recipe);
      save(); state.editingId=null;state.draft=null;state.aiDraft=false;state.aiYieldVerified=false; state.selectedId=recipe.id;state.target=recipe.yield;state.checked=new Set();
      setPage('detail', 'home');toast(editing?'Receta actualizada correctamente.':'Receta guardada correctamente.');
    } catch(err) { toast(err.message || 'No se pudo guardar la receta.'); }
  }
  function updateCalculation() {
    const r=state.page==='quick'?getRecipe(state.quickId):getRecipe(state.selectedId);
    if (!r) return;
    const target=L.number(document.getElementById('target-input')?.value);
    if (!(target>0 && target<=10000000)) {
      const fact=document.getElementById('factor-line');
      if(fact) fact.innerHTML='<div class="factorbar">Ingresá una cantidad válida</div>';
      return;
    }
    const key=state.page==='quick'?'quickTarget':'target';state[key]=target;
    const fact=document.getElementById('factor-line');if(fact) fact.innerHTML=factorLine(L.scale(r,target).factor);
    const results=document.getElementById('ingredient-results');if(results) results.innerHTML=ingredientList(r,target);
    document.querySelectorAll('[data-action="preset"]').forEach(b=>b.classList.toggle('active',Math.abs(target-r.yield*Number(b.dataset.value))<.000001));
    const sub=document.querySelector('.ingredient-head small');if(sub)sub.textContent=`Para ${L.pretty(target)} ${r.yieldUnit}`;
  }
  function recipeForShare() {
    const r=state.page==='quick'?getRecipe(state.quickId):getRecipe(state.selectedId);
    if (!r) return '';
    const target=normalizeTarget(r,state.page==='quick'?'quickTarget':'target');
    const scaled=L.scale(r,target);
    return `${r.name} · Recetas Azulado\nCantidad: ${L.pretty(target)} ${r.yieldUnit}\nFactor: × ${L.pretty(scaled.factor,4)}\n\n${scaled.ingredients.map(i=>`• ${i.name}: ${L.quantity(i.scaled,i.unit)}${i.review?' (revisar)':''}`).join('\n')}${r.demo?'\n\n⚠ Receta de ejemplo: verificar datos de la foto antes de producir.':''}`;
  }
  async function shareRecipe() {
    const text=recipeForShare();if(!text)return;
    if(window.RecetasAndroid) {window.RecetasAndroid.shareText(text);return;}
    try {
      if(navigator.share){await navigator.share({title:'Ingredientes · Recetas Azulado',text});return;}
      await navigator.clipboard.writeText(text);toast('Ingredientes copiados al portapapeles.');
    }catch(err){if(err.name!=='AbortError')toast('No se pudo compartir.');}
  }
  function backupData() {return JSON.stringify({app:'Recetas Azulado',version:1,exportedAt:new Date().toISOString(),recipes:state.recipes},null,2);}
  function exportBackup() {
    const text=backupData();
    if(window.RecetasAndroid){window.RecetasAndroid.exportBackup(text);return;}
    const blob=new Blob([text],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`recetas-azulado-${new Date().toISOString().slice(0,10)}.json`;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1200);toast('Respaldo preparado.');
  }
  function importBackup(raw) {
    try {
      const imported=L.validateBackup(raw);
      if(!confirm(`El archivo contiene ${imported.length} recetas. ¿Reemplazar las ${state.recipes.length} recetas actuales por este respaldo?`))return;
      state.recipes=imported;state.filter='Todas';state.search='';state.quickId=null;state.selectedId=null;save();setPage('home');toast('Recetario restaurado correctamente.');
    }catch(err){toast(`No se pudo importar: ${err.message}`);}
  }
  window.receiveBackupJson=(json)=>importBackup(json);
  window.nativeActionResult=message=>toast(message);
  window.azGroqKeyResult=message=>{
    const input=document.getElementById('groq-key-input');if(input)input.value='';
    state.hasGroqKey=!!(window.RecetasAndroid && window.RecetasAndroid.hasGroqKey());
    toast(message);render(false);
  };
  window.azScanStarted=message=>{
    state.scanBusy=true;state.scanMessage=message;state.scanError='';
    if(state.page==='scan')render(false);
  };
  window.azScanFailed=message=>{
    state.scanBusy=false;state.scanMessage='';
    state.scanError=message||'No se pudo analizar la foto.';
    state.canRetryScan=!!(window.RecetasAndroid && window.RecetasAndroid.canRetryPhoto && window.RecetasAndroid.canRetryPhoto());
    if(state.page==='scan')render(false);
    else toast('No se pudo leer la foto. Revisá el detalle en Foto IA.');
  };
  window.azScanFinished=raw=>{
    state.scanBusy=false;state.scanError='';
    try {
      const response=JSON.parse(raw);
      if(!response || !Array.isArray(response.ingredients) || !response.ingredients.length)
        throw new Error('No se reconocieron ingredientes. Sacá otra foto más nítida.');
      if(response.ingredients.length>180)throw new Error('La foto contiene demasiados ingredientes.');
      const clean=v=>typeof v==='string'?v.slice(0,240):'';
      const notes=Array.isArray(response.warnings)?response.warnings.filter(x=>typeof x==='string').map(x=>x.slice(0,220)):[];
      const extracted=response.ingredients.map((i,index)=>{
        const value=typeof i.amount==='number'&&Number.isFinite(i.amount)&&i.amount>0?i.amount:'';
        const unit=L.UNITS.includes(i.unit)?i.unit:'otro';
        if(i.ambiguous || value==='' || unit==='otro')notes.push(`Ingrediente ${index+1}: ${clean(i.name)||'sin identificar'} — ${clean(i.note)||'cantidad o unidad por verificar'}`);
        return {name:clean(i.name),amount:value,unit,review:true};
      });
      const yieldValue=typeof response.yield==='number'&&Number.isFinite(response.yield)&&response.yield>0?response.yield:'';
      if(!yieldValue)notes.unshift('La foto no permite confirmar el rendimiento. Indicá cuántas unidades rinde la tanda.');
      state.editingId=null;state.aiDraft=true;state.aiYieldVerified=false;
      state.aiWarnings=notes.slice(0,26);
      state.draft={id:'',name:clean(response.name)||'Receta desde foto',category:clean(response.category)||'Otros',yield:yieldValue,
        yieldUnit:clean(response.yieldUnit)||'unidades',ingredients:extracted,
        instructions:typeof response.instructions==='string'?response.instructions.slice(0,12000):'',
        notes:([typeof response.notes==='string'?response.notes:'',...notes].filter(Boolean).join('\n')).slice(0,2500),demo:false};
      setPage('editor','scan');toast('Lectura terminada. Revisá todos los ingredientes.');
    }catch(err){state.scanBusy=false;setPage('scan');toast(err.message||'No se pudo interpretar la respuesta.');}
  };

  window.azBack=() => {
    if(state.modal){state.modal=null;render(false);return true;}
    if(state.page==='detail'){setPage(state.backTo==='quick'?'quick':'home');return true;}
    if(state.page==='editor'){setPage(state.aiDraft?'scan':(state.editingId?'detail':'home'));state.aiDraft=false;return true;}
    if(state.page==='ai-settings'){setPage('scan');return true;}
    if(state.page!=='home'){setPage('home');return true;}
    return false;
  };
  document.addEventListener('input',ev=>{
    if(ev.target?.id==='recipe-search'){
      state.search=ev.target.value;
      const list=document.getElementById('recipe-list');if(list)list.innerHTML=listHtml();
    } else if(ev.target?.id==='target-input'){updateCalculation();}
  });
  document.addEventListener('change',async ev=>{
    if(ev.target?.id==='import-file'){
      const file=ev.target.files?.[0]; if(!file)return;
      try {if(file.size>5*1024*1024)throw new Error('El respaldo supera 5 MB.');importBackup(await file.text());}
      catch(err){toast(err.message);}finally{ev.target.value='';}
    }
  });
  document.addEventListener('click', ev=>{
    const control=ev.target.closest('[data-action]');
    if(!control){if(ev.target?.id==='sheet-overlay'){state.modal=null;render(false);}return;}
    const action=control.dataset.action;
    switch(action){
      case 'home':setPage('home');break;
      case 'quick':state.checked=new Set();setPage('quick');break;
      case 'scan':setPage('scan');break;
      case 'ai-settings':setPage('ai-settings');break;
      case 'take-photo':case 'pick-photo':{
        if(!window.RecetasAndroid){toast('La captura con IA está disponible en la aplicación Android.');break;}
        state.hasGroqKey=window.RecetasAndroid.hasGroqKey();
        if(!state.hasGroqKey){setPage('ai-settings');toast('Configurá primero tu clave de Groq.');break;}
        window.RecetasAndroid.chooseRecipePhoto(action==='take-photo');break;
      }
      case 'retry-photo':{
        if(state.scanBusy)break;
        if(window.RecetasAndroid && window.RecetasAndroid.retryRecipePhoto)window.RecetasAndroid.retryRecipePhoto();
        else toast('Volvé a seleccionar la foto para reintentar.');
        break;
      }
      case 'save-groq-key':{
        const key=document.getElementById('groq-key-input')?.value?.trim()||'';
        if(!window.RecetasAndroid){toast('La configuración está disponible en Android.');break;}
        if(!key.startsWith('gsk_')){toast('Ingresá una clave válida de Groq (gsk_...).');break;}
        window.RecetasAndroid.saveGroqKey(key);document.getElementById('groq-key-input').value='';break;
      }
      case 'clear-groq-key':if(window.RecetasAndroid && confirm('¿Eliminar la clave guardada en el dispositivo?'))window.RecetasAndroid.clearGroqKey();break;
      case 'backup':setPage('backup');break;
      case 'new':openEditor();break;
      case 'back':window.azBack();break;
      case 'detail':openDetail(control.dataset.id,state.page);break;
      case 'edit':openEditor(state.selectedId);break;
      case 'save-recipe':saveDraft();break;
      case 'filter':state.filter=control.dataset.value;render(false);break;
      case 'add-ingredient':saveDraftFromForm();state.draft.ingredients.push({name:'',amount:'',unit:'g',review:false});render(false);break;
      case 'remove-ingredient':if(state.draft.ingredients.length<=1){toast('La receta necesita al menos un ingrediente.');break;}saveDraftFromForm();state.draft.ingredients.splice(Number(control.dataset.index),1);render(false);break;
      case 'decrement':case 'increment':{
        const input=document.getElementById('target-input');if(!input)return;
        const before=L.number(input.value),n=Number.isFinite(before)?before:1;
        input.value=Math.min(10000000,Math.max(1,n+(action==='increment'?1:-1)));updateCalculation();break;
      }
      case 'preset':{
        const r=state.page==='quick'?getRecipe(state.quickId):getRecipe(state.selectedId);
        const input=document.getElementById('target-input');if(!r||!input)return;
        input.value=Math.min(10000000,r.yield*Number(control.dataset.value));updateCalculation();break;
      }
      case 'check':{
        const index=Number(control.dataset.index);
        state.checked.has(index)?state.checked.delete(index):state.checked.add(index);
        const r=state.page==='quick'?getRecipe(state.quickId):getRecipe(state.selectedId);
        const target=normalizeTarget(r,state.page==='quick'?'quickTarget':'target');
        document.getElementById('ingredient-results').innerHTML=ingredientList(r,target);break;
      }
      case 'share':shareRecipe();break;
      case 'choose-quick':state.modal='quick-picker';render(false);break;
      case 'pick-quick':{
        const r=getRecipe(control.dataset.id);if(!r)return;
        state.quickId=r.id;state.quickTarget=r.yield;state.checked=new Set();state.modal=null;render();break;
      }
      case 'dismiss':state.modal=null;render(false);break;
      case 'delete':{
        const r=getRecipe(state.selectedId);if(!r)return;
        if(confirm(`¿Eliminar “${r.name}” de tu recetario?`)){state.recipes=state.recipes.filter(x=>x.id!==r.id);save();state.selectedId=null;state.quickId=null;setPage('home');toast('Receta eliminada.');}break;
      }
      case 'export':exportBackup();break;
      case 'import':if(window.RecetasAndroid)window.RecetasAndroid.importBackup();else document.getElementById('import-file').click();break;
      case 'reset':if(confirm('¿Eliminar TODAS las recetas guardadas en este dispositivo? Hacé un respaldo antes de continuar.')){
        if(confirm('Esta acción no se puede deshacer sin un respaldo. ¿Confirmás que querés borrar todo?')){
          state.recipes=[];state.quickId=null;state.selectedId=null;save();setPage('home');toast('Recetario vaciado.');
        }
      }break;
    }
  });
  render();
})();
