import { stringifyUnsignedHeartbeatPayload } from './heartbeat-utils';

describe(stringifyUnsignedHeartbeatPayload.name, () => {
  it('sorts the keys alphabetically', () => {
    expect(
      stringifyUnsignedHeartbeatPayload({
        airnode: '0xbF3137b0a7574563a23a8fC8badC6537F98197CC',
        stage: 'test',
        nodeVersion: '0.1.0',
        currentTimestamp: '1674172803',
        deploymentTimestamp: '1674172800',
        configHash: '0x0a36630da26fa987561ff8b692f2015a6fe632bdabcf3dcdd010ccc8262f4a3a',
      })
    ).toBe(
      '{"airnode":"0xbF3137b0a7574563a23a8fC8badC6537F98197CC","configHash":"0x0a36630da26fa987561ff8b692f2015a6fe632bdabcf3dcdd010ccc8262f4a3a","currentTimestamp":"1674172803","deploymentTimestamp":"1674172800","nodeVersion":"0.1.0","stage":"test"}'
    );
  });
});
