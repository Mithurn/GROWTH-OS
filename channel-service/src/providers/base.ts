import type { SendRequest } from '../types';

export interface ChannelProvider {
  send(request: SendRequest): Promise<string>; // returns providerMessageId
}
