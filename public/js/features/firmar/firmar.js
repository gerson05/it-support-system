const token = window.location.pathname.split('/firmar/')[1]?.trim();

function show(stateId) {
  ['state-loading','state-ready','state-success','state-already','state-invalid']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = id === stateId ? '' : 'none';
    });
}

function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' }) +
    ' a las ' + new Date(str).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
}

function setAlreadyMessage(data) {
  const signer = data.signed_by
    ? `${data.signed_by}${data.signed_role ? ` (${data.signed_role})` : ''}`
    : 'el destinatario';
  document.getElementById('already-msg').textContent =
    `Ya recibimos el acta firmada por ${signer} el ${formatDate(data.uploaded_at)}. Si hay un error, contacta a IT.`;
}

async function init() {
  if (!token) { show('state-invalid'); return; }
  show('state-loading');
  try {
    const res  = await fetch(`/api/actas/status/${token}`);
    const data = await res.json();
    if (!data.valid) { show('state-invalid'); return; }
    if (data.uploaded) {
      setAlreadyMessage(data);
      show('state-already');
      return;
    }
    document.getElementById('entity-ref').textContent =
      data.entity_ref ? `Despacho: ${data.entity_ref}` : '';
    show('state-ready');
    setupUpload();
  } catch {
    show('state-invalid');
  }
}

function setupUpload() {
  const fileInput       = document.getElementById('file-input');
  const fileZone        = document.getElementById('file-zone');
  const fileNameDisplay = document.getElementById('file-name-display');
  const btnUpload       = document.getElementById('btn-upload');
  const signedByInput   = document.getElementById('signed-by-input');
  const signedRoleInput = document.getElementById('signed-role-input');
  const uploadArea      = document.getElementById('file-upload-area');
  const nameRequired    = document.getElementById('name-required-notice');
  const nameOk          = document.getElementById('name-ok-notice');
  const nameOkText      = document.getElementById('name-ok-text');
  let   selectedFile    = null;

  function updateNameState() {
    const name = signedByInput.value.trim();
    const hasName = name.length > 0;
    uploadArea.classList.toggle('upload-locked', !hasName);
    nameRequired.style.display = hasName ? 'none' : '';
    nameOk.style.display       = hasName ? 'flex' : 'none';
    if (hasName) nameOkText.textContent = `Firmando como: ${name}`;
    if (!hasName) { selectedFile = null; fileNameDisplay.style.display = 'none'; btnUpload.disabled = true; }
  }

  signedByInput.addEventListener('input', updateNameState);
  updateNameState();

  fileZone.addEventListener('click', () => { if (!signedByInput.value.trim()) { signedByInput.focus(); return; } fileInput.click(); });
  fileZone.addEventListener('dragover', e => { e.preventDefault(); fileZone.classList.add('drag-over'); });
  fileZone.addEventListener('dragleave', () => fileZone.classList.remove('drag-over'));
  fileZone.addEventListener('drop', e => {
    e.preventDefault();
    fileZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });

  function setFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf','docx'].includes(ext)) { alert('Solo se aceptan archivos PDF o DOCX.'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('El archivo supera el límite de 10 MB.'); return; }
    selectedFile = file;
    fileNameDisplay.textContent = file.name;
    fileNameDisplay.style.display = 'block';
    btnUpload.disabled = false;
  }

  btnUpload.addEventListener('click', async () => {
    if (!selectedFile) return;
    const name = signedByInput.value.trim();
    if (!name) { signedByInput.focus(); return; }
    btnUpload.disabled = true;
    btnUpload.textContent = 'Subiendo…';

    const fd = new FormData();
    fd.append('acta', selectedFile);
    fd.append('signed_by', name);
    fd.append('signed_role', signedRoleInput.value.trim());

    try {
      const res  = await fetch(`/api/actas/upload/${token}`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Error al subir el archivo.'); btnUpload.disabled = false; btnUpload.textContent = 'Subir acta firmada'; return; }
      show('state-success');
    } catch {
      alert('Error de conexión. Intenta de nuevo.');
      btnUpload.disabled = false;
      btnUpload.textContent = 'Subir acta firmada';
    }
  });
}

init();
