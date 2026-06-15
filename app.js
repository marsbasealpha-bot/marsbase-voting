/* ═══════════════════════════════════════════════════════
   VOTING TEMPLATE CREATOR — app.js
   Core features:
   - 4-slot 2x2 grid management
   - Drag & drop image loading
   - Click-to-browse file picker
   - Type label → Enter → fetch image via /api/search
   - Drop image → AI captions it via /api/caption
   - Emoji picker
   - Canvas-based export (composites all 4 slots)
   - Copy template text to clipboard
   ═══════════════════════════════════════════════════════ */

'use strict';

/* ── Constants ──────────────────────────────────────── */
/* Facebook's 7 official reactions */
const EMOJIS = ['👍','❤️','😆','😮','😢','😡','🥰'];

const DEFAULT_CONFIGS = [
  { emoji: '👍', label: 'Option 1' },
  { emoji: '❤️', label: 'Option 2' },
  { emoji: '😆', label: 'Option 3' },
  { emoji: '😮', label: 'Option 4' },
];

/* Export canvas dimensions */
const EXPORT = {
  cellW:   540,
  cellH:   480,
  labelH:  80,
  headerH: 130,
  footerH: 60,
  cols:    2,
  rows:    2,
};

/* ── State ──────────────────────────────────────────── */
const slots = [];     // Array of SlotState objects
let emojiModalTarget = null;   // Which slot is picking emoji

/* ── SlotState ─────────────────────────────────────── */
class SlotState {
  constructor(index) {
    this.index    = index;
    this.blobUrl  = null;   // Blob URL for canvas export (always set when image loaded)
    this.emoji    = DEFAULT_CONFIGS[index].emoji;
    this.label    = DEFAULT_CONFIGS[index].label;
    this.busy     = false;

    // DOM references (populated in buildSlot)
    this.card       = null;
    this.dropZone   = null;
    this.img        = null;
    this.overlay    = null;
    this.overlayTxt = null;
    this.statusBadge = null;
    this.emojiBtn   = null;
    this.labelInput = null;
  }

  hasImage() { return !!this.blobUrl; }

  setImage(blobUrl) {
    if (this.blobUrl && this.blobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.blobUrl);
    }
    this.blobUrl = blobUrl;
    this.img.src = blobUrl;
    this.img.style.display = 'block';
    this.dropZone.querySelector('.drop-placeholder').style.display = 'none';
    this.dropZone.classList.remove('empty');
    this.hideOverlay();
    this.clearStatus();
    checkAllFilled();
  }

  clear() {
    if (this.blobUrl && this.blobUrl.startsWith('blob:')) URL.revokeObjectURL(this.blobUrl);
    this.blobUrl = null;
    this.img.src = '';
    this.img.style.display = 'none';
    this.dropZone.querySelector('.drop-placeholder').style.display = '';
    this.dropZone.classList.add('empty');
    this.labelInput.value = DEFAULT_CONFIGS[this.index].label;
    this.label = DEFAULT_CONFIGS[this.index].label;
    this.hideOverlay();
    this.clearStatus();
    checkAllFilled();
  }

  showOverlay(text) {
    this.overlay.classList.add('visible');
    this.overlayTxt.textContent = text;
  }
  hideOverlay() { this.overlay.classList.remove('visible'); }

  setStatus(type, text) {
    this.statusBadge.className = `slot-status ${type}`;
    this.statusBadge.textContent = text;
    if (type) setTimeout(() => this.clearStatus(), 4000);
  }
  clearStatus() { this.statusBadge.className = 'slot-status'; }

  setEmoji(em) {
    this.emoji = em;
    this.emojiBtn.textContent = em;
  }

  setLabel(text) {
    this.label = text;
  }
}

/* ── Build UI ────────────────────────────────────────── */
function buildSlot(index) {
  const state = new SlotState(index);
  const cfg   = DEFAULT_CONFIGS[index];

  /* Card */
  const card = document.createElement('div');
  card.className = 'slot-card';
  card.id = `slot-${index}`;

  /* Drop Zone */
  const dropZone = document.createElement('div');
  dropZone.className = 'drop-zone empty';
  dropZone.setAttribute('tabindex', '0');
  dropZone.setAttribute('role', 'button');
  dropZone.setAttribute('aria-label', `Slot ${index + 1}: click or drop image here`);

  /* Placeholder */
  const placeholder = document.createElement('div');
  placeholder.className = 'drop-placeholder';
  placeholder.innerHTML = `
    <span class="drop-icon">📂</span>
    <div class="drop-title">Drag &amp; drop an image</div>
    <div class="drop-hint">or click to browse<br/>or type a name below &amp; press Enter</div>
  `;

  /* Image */
  const img = document.createElement('img');
  img.className = 'slot-img';
  img.alt = `Slot ${index + 1} image`;

  /* Loading overlay */
  const overlay = document.createElement('div');
  overlay.className = 'slot-overlay';
  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  const overlayTxt = document.createElement('div');
  overlayTxt.className = 'overlay-text';

  overlay.append(spinner, overlayTxt);

  /* Status badge */
  const statusBadge = document.createElement('div');
  statusBadge.className = 'slot-status';

  dropZone.append(placeholder, img, overlay, statusBadge);

  /* ── Label bar (doubles as search field) ── */
  const bar = document.createElement('div');
  bar.className = 'slot-label-bar';

  const emojiBtn = document.createElement('button');
  emojiBtn.className = 'emoji-btn';
  emojiBtn.textContent = cfg.emoji;
  emojiBtn.title = 'Change reaction emoji';
  emojiBtn.setAttribute('aria-label', 'Change emoji');

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.className = 'label-input';
  labelInput.placeholder = 'Type a word…';
  labelInput.value = '';
  labelInput.maxLength = 40;
  labelInput.setAttribute('aria-label', `Label / image search for slot ${index + 1}`);

  const searchBtn = document.createElement('button');
  searchBtn.className = 'label-search-btn';
  searchBtn.type = 'button';
  searchBtn.textContent = '🔍';
  searchBtn.title = 'Search for image';
  searchBtn.setAttribute('aria-label', 'Search image');

  bar.append(emojiBtn, labelInput, searchBtn);
  card.append(dropZone, bar);

  /* Store refs */
  state.card        = card;
  state.dropZone    = dropZone;
  state.img         = img;
  state.overlay     = overlay;
  state.overlayTxt  = overlayTxt;
  state.statusBadge = statusBadge;
  state.emojiBtn    = emojiBtn;
  state.labelInput  = labelInput;
  state.searchBtn   = searchBtn;

  /* ── Event Wiring ── */

  /* Shared search helper */
  function runSearch() {
    const q = labelInput.value.trim();
    if (!q) return;
    state.setLabel(q);
    fetchImage(state, q);
  }

  /* Search button click */
  searchBtn.addEventListener('click', e => { e.stopPropagation(); runSearch(); });

  /* Enter key in label input → also triggers search */
  labelInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); runSearch(); }
  });
  labelInput.addEventListener('change', () => state.setLabel(labelInput.value.trim()));
  /* Stop label bar clicks from bubbling to drop zone */
  bar.addEventListener('click', e => e.stopPropagation());

  /* Click drop zone → file picker */
  dropZone.addEventListener('click', () => triggerFilePicker(state));
  dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') triggerFilePicker(state); });

  /* Drag & drop on drop zone */
  dropZone.addEventListener('dragenter', e => { e.preventDefault(); card.classList.add('drag-over'); });
  dropZone.addEventListener('dragover',  e => { e.preventDefault(); });
  dropZone.addEventListener('dragleave', e => {
    if (!card.contains(e.relatedTarget)) card.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    card.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadFile(state, file);
  });

  /* Also allow drop on the whole card */
  card.addEventListener('dragenter', e => { e.preventDefault(); card.classList.add('drag-over'); });
  card.addEventListener('dragover',  e => { e.preventDefault(); });
  card.addEventListener('dragleave', e => {
    if (!card.contains(e.relatedTarget)) card.classList.remove('drag-over');
  });
  card.addEventListener('drop', e => {
    e.preventDefault();
    card.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadFile(state, file);
  });

  /* Emoji button */
  emojiBtn.addEventListener('click', e => {
    e.stopPropagation();
    openEmojiModal(state);
  });

  slots.push(state);
  return card;
}

function buildGrid() {
  const container = document.getElementById('grid-container');
  for (let i = 0; i < 4; i++) {
    container.appendChild(buildSlot(i));
  }
}

/* ── File Picker ─────────────────────────────────────── */
function triggerFilePicker(state) {
  if (state.busy) return;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', () => {
    if (input.files[0]) loadFile(state, input.files[0]);
    document.body.removeChild(input);
  });
  input.click();
}

/* ── Load File ─────────────────────────────────────────── */
function loadFile(state, file) {
  if (state.busy) return;
  const blobUrl = URL.createObjectURL(file);
  state.setImage(blobUrl);
  setStatus(`✅ Image loaded into slot ${state.index + 1}`);

  // Only auto-caption if label is still default
  const defaultLabel = DEFAULT_CONFIGS[state.index].label;
  if (state.labelInput.value.trim() === defaultLabel || state.labelInput.value.trim() === '') {
    captionImage(state, file);
  }
}

/* ── API: Fetch Image from Search ────────────────────── */
async function fetchImage(state, query) {
  if (state.busy) return;
  state.busy = true;
  state.showOverlay(`Searching for "${query}"…`);
  setStatus(`🔍 Searching image for "${query}"…`);

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Search failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const { url } = await res.json();

    // Proxy the image through our CORS proxy so canvas can draw it
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    const imgRes = await fetch(proxyUrl);
    if (!imgRes.ok) throw new Error('Could not download image');
    const blob = await imgRes.blob();
    const blobUrl = URL.createObjectURL(blob);
    state.setImage(blobUrl);
    state.setStatus('success', '✓ Image found');
    setStatus(`✅ Image fetched for "${query}"`);

  } catch (err) {
    state.hideOverlay();
    state.setStatus('error', '✗ Not found');
    setStatus(`❌ Image search failed: ${err.message}`);
    console.error('[search]', err);
  } finally {
    state.busy = false;
  }
}

/* ── API: Caption Image via CF Workers AI ────────────── */
async function captionImage(state, file) {
  // Read file as base64
  state.showOverlay('AI identifying image…');
  setStatus('🤖 Running AI image recognition…');

  try {
    const base64 = await fileToBase64(file);
    const res = await fetch('/api/caption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mimeType: file.type }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const { description } = await res.json();
    if (description) {
      const cleaned = cleanCaption(description);
      state.labelInput.value = cleaned;
      state.setLabel(cleaned);
      state.setStatus('success', '✓ AI labelled');
      setStatus(`🤖 AI identified: "${cleaned}"`);
    }
  } catch (err) {
    // Silently fail — AI is optional enhancement
    console.warn('[caption]', err.message);
    setStatus('ℹ️ AI captioning unavailable — type a label manually');
  } finally {
    state.hideOverlay();
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function cleanCaption(raw) {
  // Extract the most useful 1-4 words from a caption sentence
  const stopWords = new Set(['a','an','the','this','is','of','with','on','in','and','at','for','to','it','by','are']);
  const words = raw.replace(/[^a-zA-Z0-9 ]/g, '').trim().split(/\s+/);
  const clean = words.filter(w => !stopWords.has(w.toLowerCase())).slice(0, 4);
  return clean.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || raw.substring(0, 30);
}

/* ── Emoji Picker ────────────────────────────────────── */
function buildEmojiPicker() {
  const grid = document.getElementById('emoji-grid');
  EMOJIS.forEach(em => {
    const btn = document.createElement('button');
    btn.className = 'emoji-option';
    btn.textContent = em;
    btn.title = em;
    btn.addEventListener('click', () => {
      if (emojiModalTarget) emojiModalTarget.setEmoji(em);
      closeEmojiModal();
    });
    grid.appendChild(btn);
  });

  document.getElementById('emoji-modal-close').addEventListener('click', closeEmojiModal);
  document.getElementById('emoji-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('emoji-modal')) closeEmojiModal();
  });
}

function openEmojiModal(state) {
  emojiModalTarget = state;
  document.getElementById('emoji-modal').removeAttribute('hidden');
}

function closeEmojiModal() {
  document.getElementById('emoji-modal').setAttribute('hidden', '');
  emojiModalTarget = null;
}

/* ── Global Actions ──────────────────────────────────── */
function clearAll() {
  if (!confirm('Clear all 4 slots?')) return;
  slots.forEach(s => s.clear());
  setStatus('🗑️ All slots cleared');
}

function shuffleEmojis() {
  const shuffled = [...EMOJIS].sort(() => Math.random() - 0.5).slice(0, 4);
  slots.forEach((s, i) => s.setEmoji(shuffled[i]));
}

function copyTemplateText() {
  const title    = document.getElementById('inp-title').value;
  const subtitle = document.getElementById('inp-subtitle').value;
  const lines    = [title, subtitle, ''];
  slots.forEach(s => lines.push(`${s.emoji} — ${s.labelInput.value.trim() || `Option ${s.index + 1}`}`));
  lines.push('', 'Drop a comment explaining your choice! 👇');
  navigator.clipboard.writeText(lines.join('\n'))
    .then(() => { setStatus('📋 Template text copied to clipboard!'); })
    .catch(() => { setStatus('❌ Clipboard copy failed — try manually'); });
}

/* ── Canvas Export ───────────────────────────────────── */
async function exportImage() {
  const missing = slots.filter(s => !s.hasImage()).map(s => s.index + 1);
  if (missing.length > 0) {
    alert(`Slot${missing.length > 1 ? 's' : ''} ${missing.join(', ')} still need${missing.length === 1 ? 's' : ''} an image.`);
    return;
  }

  const modal      = document.getElementById('export-modal');
  const statusText = document.getElementById('export-status-text');
  modal.removeAttribute('hidden');

  try {
    const { cellW, cellH, labelH, headerH, footerH, cols, rows } = EXPORT;
    const W = cellW * cols;
    const H = headerH + (cellH + labelH) * rows + footerH;

    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    /* ── Background ── */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    /* ── Header ── */
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, headerH);

    const title    = document.getElementById('inp-title').value;
    const subtitle = document.getElementById('inp-subtitle').value;

    ctx.textAlign = 'center';

    ctx.fillStyle = '#eaeaea';
    ctx.font = 'bold 46px Inter, Arial, sans-serif';
    ctx.fillText(title, W / 2, 62);

    ctx.fillStyle = '#8892a4';
    ctx.font = '22px Inter, Arial, sans-serif';
    ctx.fillText(subtitle, W / 2, 104);

    /* ── Grid cells ── */
    for (let i = 0; i < 4; i++) {
      statusText.textContent = `Compositing slot ${i + 1} of 4…`;

      const state = slots[i];
      const col   = i % cols;
      const row   = Math.floor(i / cols);
      const x     = col * cellW;
      const y     = headerH + row * (cellH + labelH);

      /* Draw image */
      const bitmapImg = await loadImageElement(state.blobUrl);
      ctx.drawImage(bitmapImg, x, y, cellW, cellH);

      /* Object name overlay — rendered ON the photo */
      const defaultLabel = DEFAULT_CONFIGS[i].label;
      const rawLabel     = state.labelInput.value.trim();
      const objectName   = (rawLabel && rawLabel !== defaultLabel) ? rawLabel : `Option ${i + 1}`;

      const overlayH = 100;
      const overlayY = y + cellH - overlayH;

      /* Semi-transparent dark gradient band */
      const grad = ctx.createLinearGradient(0, overlayY, 0, y + cellH);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.78)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, overlayY, cellW, overlayH);

      /* Object name — large, black-stroked, white-filled (outlined text), centred */
      ctx.font = 'bold 48px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 0;
      // Black outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.strokeText(objectName, x + cellW / 2, y + cellH - 18);
      // White fill
      ctx.fillStyle = '#ffffff';
      ctx.fillText(objectName, x + cellW / 2, y + cellH - 18);

      /* Label strip below image — emoji only, centred */
      const lyTop = y + cellH;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, lyTop, cellW, labelH);

      /* Grid border */
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'miter';
      ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH + labelH - 2);

      /* Emoji — centred in strip */
      const emoji = state.emoji;
      ctx.font = '42px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#333333';
      ctx.fillText(emoji, x + cellW / 2, lyTop + 54);
    }

    /* ── Footer ── */
    const footY = headerH + rows * (cellH + labelH);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, footY, W, footerH);

    ctx.fillStyle = '#8892a4';
    ctx.font = '20px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Drop a comment explaining your choice! 👇', W / 2, footY + 36);

    /* ── Download ── */
    statusText.textContent = 'Saving…';
    await new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Canvas export produced no data')); return; }
        const a    = document.createElement('a');
        const url  = URL.createObjectURL(blob);
        a.href     = url;
        a.download = 'voting-template.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus('✅ Image exported! Check your Downloads folder.');
        resolve();
      }, 'image/jpeg', 0.95);
    });

  } catch (err) {
    console.error('[export]', err);
    setStatus(`❌ Export failed: ${err.message}`);
  } finally {
    modal.setAttribute('hidden', '');
  }
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img    = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src     = src;
  });
}

/* ── Status bar helper ───────────────────────────────── */
function setStatus(msg) {
  document.getElementById('status-text').textContent = msg;
}

/* ── All-filled check ────────────────────────────────── */
function checkAllFilled() {
  const hint = document.getElementById('preview-hint');
  if (slots.every(s => s.hasImage())) {
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
  }
}

/* ── Init ────────────────────────────────────────────── */
function init() {
  buildGrid();
  buildEmojiPicker();

  document.getElementById('btn-clear-all').addEventListener('click', clearAll);
  document.getElementById('btn-shuffle').addEventListener('click', shuffleEmojis);
  document.getElementById('btn-copy-text').addEventListener('click', copyTemplateText);
  document.getElementById('btn-export').addEventListener('click', exportImage);

  // ESC closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeEmojiModal();
  });
}

document.addEventListener('DOMContentLoaded', init);
