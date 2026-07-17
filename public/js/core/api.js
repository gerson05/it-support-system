/**
 * data-service.js  — Slim orchestrator / Facade
 *
 * Centralizes all data access (online + offline).
 * Handles the fallback to mock layer if isOfflineMode is true or if API calls fail.
 */
import {
  initLocalStorageMock,
  mockGetAgents, mockGetTickets, mockGetTicketById,
  mockUpdateTicket, mockAddMessage, mockAddNote,
  mockGetMetrics, mockSimulateBot, mockResetSimulation,
} from '../utils/data-service-mock.js';

import { apiService } from './api-backup.js';

export const isOfflineMode =
  window.location.protocol === 'file:' || window.location.hostname === '';

if (isOfflineMode) {
  initLocalStorageMock();
}

export const DataService = {
  async getAgents() {
    if (!isOfflineMode) {
      try {
        return await apiService.getAgents();
      } catch (e) {
        console.warn('Fallo fetch de agentes, cayendo en mock.', e);
      }
    }
    return mockGetAgents();
  },

  async getTickets(filters = {}) {
    if (!isOfflineMode) {
      try {
        return await apiService.getTickets(filters);
      } catch (e) {
        console.warn('Fallo fetch de tickets, cayendo en mock.', e);
      }
    }
    return mockGetTickets(filters);
  },

  async getTicketById(id) {
    const numId = parseInt(id);
    if (!isOfflineMode) {
      try {
        return await apiService.getTicketById(numId);
      } catch (e) {
        console.warn('Fallo fetch del ticket, cayendo en mock.', e);
      }
    }
    return mockGetTicketById(numId);
  },

  async updateTicket(id, data) {
    const numId = parseInt(id);
    if (!isOfflineMode) {
      try {
        return await apiService.updateTicket(numId, data);
      } catch (e) {
        console.warn('Fallo PUT de ticket, cayendo en mock.', e);
      }
    }
    return mockUpdateTicket(numId, data, this.addMessage.bind(this));
  },

  async addMessage(ticketId, senderType, senderName, content) {
    const numTicketId = parseInt(ticketId);
    if (!isOfflineMode && senderType === 'agent') {
      try {
        return await apiService.addMessage(numTicketId, senderType, senderName, content);
      } catch (e) {
        console.warn('Fallo POST de mensaje, cayendo en mock.', e);
      }
    }
    return mockAddMessage(numTicketId, senderType, senderName, content);
  },

  async addInternalNote(ticketId, agentId, agentName, content) {
    const numTicketId = parseInt(ticketId);
    if (!isOfflineMode) {
      try {
        return await apiService.addInternalNote(numTicketId, agentId, agentName, content);
      } catch (e) {
        console.warn('Fallo POST de nota, cayendo en mock.', e);
      }
    }
    return mockAddNote(numTicketId, agentId, agentName, content);
  },

  async getMetrics() {
    if (!isOfflineMode) {
      try {
        return await apiService.getMetrics();
      } catch (e) {
        console.warn('Fallo fetch de métricas, cayendo en mock.', e);
      }
    }
    return mockGetMetrics();
  },

  async simulateBotMessage(phone, message) {
    if (!isOfflineMode) {
      try {
        return await apiService.simulateBotMessage(phone, message);
      } catch (e) {
        console.warn('Fallo simulador, cayendo en mock.', e);
      }
    }
    return mockSimulateBot(phone, message, this.addMessage.bind(this));
  },

  async resetSimulation(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    if (!isOfflineMode) {
      try {
        return await apiService.resetSimulation(cleanPhone);
      } catch (e) {
        console.warn('Fallo reset del bot, cayendo en mock.', e);
      }
    }
    return mockResetSimulation(cleanPhone);
  },

  /* ── Online-only: sin fallback offline ──────────────────────────────── */

  async analyzeTicket(problema, ticketId) {
    return apiService.analyzeTicket(problema, ticketId);
  },

  async getOnlineAgents() {
    return apiService.getOnlineAgents();
  },

  async executeRemoteCommand(agentId, commands) {
    return apiService.executeRemoteCommand(agentId, commands);
  },

  async getCommandStatus(agentId, cmdId) {
    return apiService.getCommandStatus(agentId, cmdId);
  },
};

export default DataService;
