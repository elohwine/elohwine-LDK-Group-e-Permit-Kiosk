import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { markDurationMenuLoaded } from './kioskDurations.mjs';

async function kioskHarness() {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const requests = [];
  const events = [];
  let remote = {
    id: 'doc-1', kioskId: 'hardware-1', siteId: 'site-1', kioskName: 'Test',
    defaultDurationHours: 24, expireAtMidnight: false, staticQrDurationHours: 24,
    durationConfigRevision: 'a'.repeat(64),
    durationOptions: [{ code: 'guest', label: 'Guests', hours: 3 }, { code: 'resident', label: 'Residents', hours: 12 }],
  };
  let commands = [{ id: 'refresh-1', type: 'reload_config', payload: null }];
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    window: { location: { protocol: 'https:' }, dispatchEvent: (event) => events.push(event) },
    localStorage: storage, navigator: { onLine: true },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return { ok: true, json: async () => ({ kiosk: remote, commands }) };
    },
  });
  const exports = {
    'idb-keyval': { keys: async () => [], set() {}, get() {}, del() {}, update() {} },
    './crypto': { hmacSHA256Hex() {} },
    qrcode: { default: {} },
    '../kiosk.config.json': { default: {
      siteId: 'site-1', kioskId: 'hardware-1', kioskName: 'Test', defaultHours: 2,
      durationOptions: [{ hours: 2 }, { hours: 8 }],
    } },
    './kioskDurations.mjs': await import('./kioskDurations.mjs'),
  };
  const source = await fs.readFile(new URL('./permits.js', import.meta.url), 'utf8');
  const module = new vm.SourceTextModule(source, { context });
  await module.link((specifier) => {
    const values = exports[specifier];
    if (!values) throw new Error(`Unexpected dependency: ${specifier}`);
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return {
    api: module.namespace, storage, requests, events,
    update: (patch) => { remote = { ...remote, ...patch }; commands = []; },
  };
}

test('real heartbeat stores all choices, beats bundled config, refreshes UI and ACKs without recursive requests', async () => {
  const { api, storage, requests, events, update } = await kioskHarness();
  assert.equal((await api.getSettings()).defaultHours, 2);
  await Promise.all([api.sendHeartbeat(), api.sendHeartbeat()]);
  assert.equal(requests.filter((request) => request.url.includes('heartbeat')).length, 1);
  const settings = await api.getSettings();
  assert.equal(settings.defaultHours, 24);
  assert.deepEqual(Array.from(settings.durationOptions, (option) => option.hours), [3, 12]);
  assert.equal(settings.staticQrDurationHours, 24);
  assert.equal(requests.filter((request) => request.url.includes('ack-command')).length, 1);
  assert.ok(events.some((event) => event.type === 'kiosk:reload_config'));
  markDurationMenuLoaded(settings, storage);
  update({ durationConfigRevision: 'b'.repeat(64), durationOptions: [{ code: 'resident', label: 'Updated resident', hours: 6 }] });
  await api.sendHeartbeat();
  const sent = requests.filter((request) => request.url.includes('heartbeat')).at(-1).body.durationConfig;
  assert.equal(sent.appliedRevision, 'a'.repeat(64));
  assert.equal(sent.displayedRevision, 'a'.repeat(64));
  const changed = await api.getSettings();
  assert.deepEqual(Array.from(changed.durationOptions, (option) => option.hours), [6]);
  assert.equal(changed.durationOptions[0].label, 'Updated resident');
  assert.equal(changed.durationOptions[0].code, 'resident');
  assert.equal(changed.durationConfigRevision, 'b'.repeat(64));
  assert.equal(JSON.parse(storage.getItem('kiosk_duration_menu')).revision, 'a'.repeat(64), 'display confirmation waits for the UI');
  markDurationMenuLoaded(changed, storage);
  await api.sendHeartbeat();
  assert.equal(requests.filter((request) => request.url.includes('heartbeat')).at(-1).body.durationConfig.displayedRevision, 'b'.repeat(64));
});

test('bad configuration is explicit, preserves last good menu, and is reported on the next heartbeat', async () => {
  const { api, update, requests, events } = await kioskHarness();
  await api.sendHeartbeat();
  update({ durationOptions: [{ hours: -1 }] });
  await assert.rejects(api.sendHeartbeat(), /Invalid remote duration choice/);
  assert.deepEqual(Array.from((await api.getSettings()).durationOptions, (option) => option.hours), [3, 12]);
  assert.ok(events.some((event) => event.type === 'kiosk:duration_config_error'));
  await assert.rejects(api.sendHeartbeat(), /Invalid remote duration choice/);
  assert.match(requests.filter((request) => request.url.includes('heartbeat')).at(-1).body.durationConfig.error, /Invalid/);
});
