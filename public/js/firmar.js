const token = window.location.pathname.split('/firmar/')[1]?.trim();

function show(stateId) {
  ['state-loading','state-ready','state-success','state-already','state-invalid']
    .forEach(id => {
      document.getElementById(id).style.display = id === stateId ? 'block' : 'none';
    });
}

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' }) +
    ' a las ' + d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
}

async function init() {
  if (!token) { show('state-invalid'); return; }
  show('state-loading');

  try {
    const res  = await fetch(`/api/actas/status/${token}`);
    const data = await res.json();

    if (!data.valid) { show('state-invalid'); return; }

    if (data.uploaded) {
      document.getElementById('already-msg').textContent =
        `Ya recibimos tu acta firmada el ${formatDate(data.uploaded_at)}. Si hay un error, contacta a IT.`;
      show('state-already');
      return;
    }

    document.getElementById('entity-ref').textContent = data.entity_ref || '';
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
  let   selectedFile    = null;

  fileZone.addEventListener('click', () => fileInput.click());

  fileZone.addEventListener('dragover', e => { e.preventDefault(); fileZone.classList.add('drag-over'); });
  fileZone.addEventListener('dragleave', () => fileZone.classList.remove('drag-over'));
  fileZone.addEventListener('drop', e => {
    e.preventDefault();
    fileZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) setFile(fileInput.files[0]);
  });

  function setFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf','docx'].includes(ext)) {
      alert('Solo se aceptan archivos PDF o DOCX.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo supera el límite de 10 MB.');
      return;
    }
    selectedFile = file;
    fileNameDisplay.textContent = file.name;
    fileNameDisplay.style.display = 'block';
    btnUpload.disabled = false;
  }

  btnUpload.addEventListener('click', async () => {
    if (!selectedFile) return;
    btnUpload.disabled = true;
    btnUpload.textContent = 'Subiendo…';

    const fd = new FormData();
    fd.append('acta', selectedFile);

    try {
      const res  = await fetch(`/api/actas/upload/${token}`, { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Error al subir el archivo.');
        btnUpload.disabled = false;
        btnUpload.textContent = 'Subir acta firmada';
        return;
      }
      show('state-success');
    } catch {
      alert('Error de conexión. Intenta de nuevo.');
      btnUpload.disabled = false;
      btnUpload.textContent = 'Subir acta firmada';
    }
  });
}

init();
