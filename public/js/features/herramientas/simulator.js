import { showToast } from '../../ui/components.js';
import DataService from '../../core/api.js';

export function renderSimulator(container) {
  // Teléfono de prueba por defecto
  let phone = '573001234567';
  
  // Estructura de la vista del simulador
  container.innerHTML = `
    <div style="margin-bottom: 30px;">
      <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">Simulador de Chatbot WhatsApp</h2>
      <p style="color: var(--text-muted); font-size: 14px;">Prueba interactivamente el flujo conversacional y la creación automática de tickets.</p>
    </div>

    <div class="simulator-layout">
      <!-- Teléfono Virtual (Izquierda) -->
      <div>
        <div style="margin-bottom: 15px; display: flex; gap: 10px; align-items: center;">
          <label for="sim-phone" style="font-size: 11px; margin-bottom: 0;">Número Telefónico de Prueba:</label>
          <input type="text" id="sim-phone" value="${phone}" style="width: 160px; padding: 6px 12px; font-size: 13px; text-align: center; border-radius: 20px;" placeholder="Ej. 57300999999">
        </div>
        
        <div class="phone-mockup">
          <!-- Cabecera de WhatsApp -->
          <div class="wa-header">
            <div class="wa-avatar">🤖</div>
            <div class="wa-status-info">
              <span class="wa-name">Asistente IT</span>
              <span class="wa-status">en línea</span>
            </div>
            <div style="margin-left: auto; display: flex; gap: 14px; font-size: 16px; opacity: 0.8;">
              <span>📞</span>
              <span>📹</span>
              <span>⋮</span>
            </div>
          </div>

          <!-- Zona de burbujas del Chat -->
          <div class="wa-chat-area" id="wa-chat-container">
            <div class="wa-msg received">
              <div class="wa-msg-text">💡 *¡Hola! Bienvenido al canal de IT.* Escribe *Hola* para ver el menú principal de áreas de la empresa y resolver tu caso automáticamente.</div>
              <span class="wa-time">${getCurrentTime()}</span>
            </div>
          </div>

          <!-- Barra de Entrada de texto -->
          <form class="wa-input-area" id="wa-chat-form">
            <input type="text" class="wa-input" id="wa-chat-input" placeholder="Escribe un mensaje..." required autocomplete="off">
            <button type="submit" class="wa-send-btn" id="wa-send-button">➤</button>
          </form>
        </div>
      </div>

      <!-- Panel Instructivo (Derecha) -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <div class="card" style="padding: 24px 30px;">
          <div class="section-title">📖 Guía de Pruebas del Chatbot</div>
          <p style="font-size: 13.5px; color: var(--text-muted); line-height: 1.6; margin-top: 15px; margin-bottom: 15px;">
            Este simulador recrea de forma fidedigna lo que vería un empleado en su WhatsApp personal al interactuar con el número de la oficina de IT.
          </p>

          <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">👣 Pasos Recomendados:</h4>
          <ol style="margin-left: 20px; font-size: 13.5px; line-height: 1.7; display: flex; flex-direction: column; gap: 8px;">
            <li>Escribe <code style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; color: #667eea; font-weight: bold;">hola</code> en el chat virtual para iniciar el asistente de IT.</li>
            <li>Responde con el número de tu área (ej. <code style="font-weight:bold;">5</code> para Contabilidad).</li>
            <li>El bot te mostrará los problemas comunes de tu área. Elige un número (ej. <code style="font-weight:bold;">1</code>) para ver la solución sugerida.</li>
            <li>El bot te mostrará el instructivo paso a paso y te preguntará si pudiste resolver el problema.</li>
            <li>Si respondes <code style="font-weight:bold;">1</code> (Sí), el flujo finaliza y se registra una métrica positiva.</li>
            <li>Si respondes <code style="font-weight:bold;">2</code> (No) o <code style="font-weight:bold;">0</code> (Ninguno coincide), el bot te pedirá una descripción de tu problema. Escríbela y se **creará un Ticket real** en el Panel Web.</li>
          </ol>
        </div>

        <div class="card" style="padding: 24px 30px;">
          <div class="section-title">🛠️ Herramientas del Simulador</div>
          <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-top: 10px; margin-bottom: 20px;">
            Utiliza estas herramientas para reiniciar las sesiones y probar múltiples flujos de forma independiente.
          </p>
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <button class="btn btn-secondary" id="btn-clear-chat">🧹 Limpiar Pantalla</button>
            <button class="btn btn-danger" id="btn-reset-session">🔄 Reiniciar Sesión del Bot</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Obtener elementos de la UI
  const chatContainer = document.getElementById('wa-chat-container');
  const chatForm = document.getElementById('wa-chat-form');
  const chatInput = document.getElementById('wa-chat-input');
  const phoneInput = document.getElementById('sim-phone');

  // Actualizar número de teléfono en caliente
  phoneInput.addEventListener('change', (e) => {
    phone = e.target.value.replace(/\D/g, '');
    showToast(`Número de pruebas actualizado a: ${phone}`, 'info');
  });

  // Obtener hora actual en formato de 12 horas AM/PM
  function getCurrentTime() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
    hours = hours % 12;
    hours = hours ? hours : 12; // la hora '0' debería ser '12'
    return `${hours}:${minutes} ${ampm}`;
  }

  // Agregar una burbuja de mensaje a la pantalla
  function addMessageBubble(text, sender) {
    if (!chatContainer) return;
    
    // Parsear el texto para convertir negritas de markdown a HTML (ej: *texto* -> <strong>texto</strong>)
    let formattedText = text;
    // Negritas
    formattedText = formattedText.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    // Cursivas
    formattedText = formattedText.replace(/_(.*?)_/g, '<em>$1</em>');
    // Salto de línea
    formattedText = formattedText.replace(/\n/g, '<br>');

    const bubble = document.createElement('div');
    bubble.className = `wa-msg ${sender === 'user' ? 'sent' : 'received'}`;
    bubble.innerHTML = `
      <div class="wa-msg-text">${formattedText}</div>
      <span class="wa-time">${getCurrentTime()}</span>
    `;
    
    chatContainer.appendChild(bubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // Mostrar indicador de "escribiendo..."
  function showTypingIndicator() {
    if (!chatContainer) return null;
    
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'wa-typing-indicator';
    indicator.innerHTML = `
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    `;
    
    chatContainer.appendChild(indicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return indicator;
  }

  // === EVENTO: ENVIAR MENSAJE AL CHATBOT ===
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = chatInput.value;
    if (!msg.trim()) return;

    chatInput.value = '';
    
    // 1. Mostrar el mensaje del usuario de inmediato (derecha)
    addMessageBubble(msg, 'user');

    // 2. Mostrar indicador de escritura del bot
    const typingIndicator = showTypingIndicator();

    try {
      // 3. Simular latencia realista (800ms) para mejorar la UX del chatbot
      await new Promise(resolve => setTimeout(resolve, 800));

      const botResponse = await DataService.simulateBotMessage(
        phoneInput.value.replace(/\D/g, ''),
        msg
      );

      // Remover indicador
      if (typingIndicator) typingIndicator.remove();

      // 4. Mostrar respuesta del bot
      addMessageBubble(botResponse, 'bot');

    } catch (err) {
      console.error(err);
      if (typingIndicator) typingIndicator.remove();
      addMessageBubble('❌ Error: No se pudo establecer conexión con el servidor del chatbot.', 'bot');
    }
  });

  // Botón Limpiar Pantalla
  document.getElementById('btn-clear-chat').addEventListener('click', () => {
    chatContainer.innerHTML = `
      <div class="wa-msg received">
        <div class="wa-msg-text">Pantalla limpia. Escribe *Hola* para volver a ver el menú.</div>
        <span class="wa-time">${getCurrentTime()}</span>
      </div>
    `;
    showToast('Pantalla del chat limpiada localmente.', 'info');
  });

  // Botón Reiniciar Sesión en SQLite
  document.getElementById('btn-reset-session').addEventListener('click', async () => {
    try {
      await DataService.resetSimulation(phoneInput.value.replace(/\D/g, ''));
      chatContainer.innerHTML = `
        <div class="wa-msg received">
          <div class="wa-msg-text">🔄 *Sesión reiniciada correctamente.* Escribe *Hola* para comenzar desde cero de manera limpia.</div>
          <span class="wa-time">${getCurrentTime()}</span>
        </div>
      `;
      showToast('Conversación reseteada en el servidor.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Fallo al reiniciar la conversación en el servidor.', 'error');
    }
  });
}
