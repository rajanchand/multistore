/**
 * k6 smoke / capacity script for public storefront reads.
 *
 * Install: https://k6.io/docs/get-started/installation/
 * Run against local or VPS:
 *   k6 run -e BASE_URL=https://shop.zero-trust-security.org scripts/load/storefront-smoke.js
 *   k6 run -e BASE_URL=http://127.0.0.1:4000 -e VUS=50 -e DURATION=60s scripts/load/storefront-smoke.js
 *
 * Honest expectation on a 4 CPU / ~4GB VPS shared with other apps:
 *   - cached catalogue GETs: hundreds to low thousands concurrent browsers
 *   - NOT 10 lakh (1M) concurrent users; that requires multi-node cloud
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = (__ENV.BASE_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
const VUS = Number(__ENV.VUS || 40);
const DURATION = __ENV.DURATION || '45s';

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
  },
};

export default function () {
  const health = http.get(`${BASE}/api/v1/health`);
  check(health, { 'health 2xx': (r) => r.status >= 200 && r.status < 300 });

  const branches = http.get(`${BASE}/api/v1/storefront/branches`);
  check(branches, { 'branches 2xx': (r) => r.status >= 200 && r.status < 300 });

  let branchId = null;
  try {
    const list = branches.json();
    if (Array.isArray(list) && list[0]?.id) branchId = list[0].id;
  } catch (_) {
    /* ignore */
  }

  if (branchId) {
    const home = http.get(`${BASE}/api/v1/storefront/home?branchId=${branchId}`);
    check(home, { 'home 2xx': (r) => r.status >= 200 && r.status < 300 });

    const products = http.get(
      `${BASE}/api/v1/storefront/products?branchId=${branchId}&page=1&pageSize=24&sort=newest`,
    );
    check(products, { 'products 2xx': (r) => r.status >= 200 && r.status < 300 });
  }

  sleep(0.3);
}
