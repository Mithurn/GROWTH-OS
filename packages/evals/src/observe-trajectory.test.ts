import { describe, it, expect } from 'vitest';
import { OBSERVE_SCRIPT_TOOLS } from '@growthos/agent-core';
import fixture from './observe-trajectory.json';

describe('golden observe trajectory', () => {
  it('locks the scripted observe tool sequence as an eval fixture', () => {
    expect(fixture.tools).toEqual([...OBSERVE_SCRIPT_TOOLS]);
  });
});
