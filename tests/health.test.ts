import axios from 'axios';

const services = [
  { name: 'vmstorage', url: 'http://localhost:8482/health' },
  { name: 'vminsert', url: 'http://localhost:8480/health' },
  { name: 'vmselect', url: 'http://localhost:8481/health' },
  { name: 'vmagent', url: 'http://localhost:8429/health' },
];

// sanity check that the stack came up correctly before the pipeline tests run
describe('cluster health', () => {
  for (const { name, url } of services) {
    it(`${name} is healthy`, async () => {
      const response = await axios.get(url);
      expect(response.status).toBe(200);
    });
  }
});
