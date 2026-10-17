import { forgetInstall, makePing, sendPing, usageServerConfigured } from '../usage';

const url = 'https://abcd.supabase.co';
const key = 'x'.repeat(40);
const ping = makePing('00000000-0000-4000-8000-000000000001', 3);

describe('anonymous usage ping', () => {
  it('is inert without a real https server and key', () => {
    expect(usageServerConfigured('', '')).toBe(false);
    expect(usageServerConfigured('http://abcd.supabase.co', key)).toBe(false);
    expect(usageServerConfigured('https://evil.com/x?y', key)).toBe(false);
    expect(usageServerConfigured(url, key)).toBe(true);
  });

  it('sends only the install id, day, platform and version', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: true, status: 201 }));
    expect(await sendPing(ping, { url, key, fetchImpl })).toBe(true);
    const calls = fetchImpl.mock.calls as unknown as [string, { body: string; headers: Record<string, string> }][];
    const [to, init] = calls[0];
    expect(to).toBe(`${url}/rest/v1/retention_pings`);
    expect(Object.keys(JSON.parse(init.body)).sort()).toEqual(['app_version', 'day', 'install_id', 'platform']);
    expect(init.headers.apikey).toBe(key);
  });

  it('sends JWT anon keys as Bearer too, but never a publishable key', async () => {
    const seen: Record<string, string>[] = [];
    const fetchImpl = async (_u: string, init: { headers: Record<string, string> }) => (seen.push(init.headers), { ok: true, status: 201 });
    await sendPing(ping, { url, key: 'eyJ' + 'a'.repeat(40), fetchImpl });
    await sendPing(ping, { url, key: 'sb_publishable_' + 'a'.repeat(30), fetchImpl });
    expect(seen[0].Authorization).toMatch(/^Bearer eyJ/);
    expect(seen[1].Authorization).toBeUndefined();
    expect(seen[1].apikey).toMatch(/^sb_publishable_/);
  });

  it('treats "already recorded" as sent, and offline/errors as not sent', async () => {
    expect(await sendPing(ping, { url, key, fetchImpl: async () => ({ ok: false, status: 409 }) })).toBe(true);
    expect(await sendPing(ping, { url, key, fetchImpl: async () => ({ ok: false, status: 500 }) })).toBe(false);
    expect(await sendPing(ping, { url, key, fetchImpl: async () => Promise.reject(new Error('offline')) })).toBe(false);
    expect(await sendPing(ping, { url: '', key: '' })).toBe(false);
  });

  it('opt-out asks the server to delete everything for that id', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: true, status: 204 }));
    expect(await forgetInstall(ping.install_id, { url, key, fetchImpl })).toBe(true);
    const calls = fetchImpl.mock.calls as unknown as [string, { body: string }][];
    expect(calls[0][0]).toBe(`${url}/rest/v1/rpc/forget_install`);
    expect(JSON.parse(calls[0][1].body)).toEqual({ p_install_id: ping.install_id });
  });
});
