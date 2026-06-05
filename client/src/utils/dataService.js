import fetchJson from './fetchJson';

const DataService = {
  async getAgents() {
    return await fetchJson('/api/agents');
  },
  async getSedes() {
    return await fetchJson('/api/sedes');
  },
};

export default DataService;
