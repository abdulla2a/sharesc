export interface User {
  id: string;
  name: string;
}

export interface PeerData {
  peerId: string;
  stream: MediaStream | null;
  isSharing: boolean;
}
