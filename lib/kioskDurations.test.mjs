import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRemoteDurations, durationChoice, remoteDurationSettings } from './kioskDurations.mjs';

const remote = {
  id: 'kiosk-1', siteId: 'site-1', kioskName: 'Test',
  defaultDurationHours: 24, expireAtMidnight: false, staticQrDurationHours: 24,
  durationOptions: [{ code: 'guest', label: 'Guest', hours: 2 }, { code: 'day', label: 'Day', hours: 24 }],
};

test('heartbeat settings override bundled hours and the entire menu', () => {
  const result = applyRemoteDurations({
    siteId: 'site-1', kioskId: 'kiosk-1', kioskName: 'Test', defaultHours: 2,
    durationOptions: [{ hours: 2 }, { hours: 8 }],
    remoteDurationConfig: remoteDurationSettings(remote),
  });
  assert.equal(result.defaultHours, 24);
  assert.equal(result.staticQrDurationHours, 24);
  assert.deepEqual(result.durationOptions, remote.durationOptions);
});

test('remote settings cannot leak across sites or kiosks', () => {
  const settings = { siteId: 'other', kioskName: 'Test', remoteDurationConfig: remoteDurationSettings(remote) };
  assert.equal(applyRemoteDurations(settings), settings);
  assert.equal(applyRemoteDurations({ ...settings, siteId: 'site-1', kioskName: 'Different' }).defaultHours, undefined);
});

test('matching document identity allows configured kiosk-name aliases', () => {
  const result = applyRemoteDurations({ siteId: 'site-1', kioskId: 'kiosk-1', kioskName: 'Alias', remoteDurationConfig: remoteDurationSettings(remote) });
  assert.equal(result.defaultHours, 24);
});

test('cleared overrides and empty menus are applied, older heartbeats leave settings alone', () => {
  const result = remoteDurationSettings({ ...remote, staticQrDurationHours: null, durationOptions: [] });
  assert.equal(result.staticQrDurationHours, null);
  assert.deepEqual(result.durationOptions, []);
  assert.equal(remoteDurationSettings({ id: 'old-server' }), null);
});

test('invalid remote settings surface an error', () => {
  assert.throws(() => remoteDurationSettings({ ...remote, durationOptions: [{ hours: -1 }] }), /Invalid/);
  assert.throws(() => remoteDurationSettings({ ...remote, defaultDurationHours: '2' }), /Invalid/);
});

test('fixed and indefinite choices retain their meaning', () => {
  assert.equal(durationChoice({ hours: 24 }).hours, 24);
  assert.equal(durationChoice({ hours: null }).indefinite, true);
  assert.equal(durationChoice({ hours: null, permitType: 'permanent' }).hours, null);
});

for (const [name, start, end] of [
  ['winter', '2026-01-10T12:00:00Z', '2026-01-10T23:59:59Z'],
  ['summer', '2026-07-10T12:00:00Z', '2026-07-10T22:59:59Z'],
  ['spring transition', '2026-03-29T00:00:00Z', '2026-03-29T22:59:59Z'],
  ['autumn transition', '2026-10-25T00:00:00Z', '2026-10-25T23:59:59Z'],
]) {
  test(`midnight is temporary and uses UK end-of-day: ${name}`, () => {
    const now = new Date(start);
    const choice = durationChoice({ hours: null, expiryMode: 'midnight' }, now);
    assert.equal(choice.indefinite, false);
    assert.equal(new Date(now.getTime() + choice.hours * 3600000).toISOString(), new Date(end).toISOString());
  });
}
