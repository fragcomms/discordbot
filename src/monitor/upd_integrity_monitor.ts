import * as crypto from 'node:crypto';

interface PacketInfo {
  sequenceNum: number;
  timestamp: number;
  size: number;
  checksum: string;
  payloadHash: string;
}

/**
 * Tracks UDP packet integrity locally (sequence, checksum) and logs to console.
 * This does not write any files.
 */
export class UDPIntegrityMonitor {
  private packetLog: Map<number, PacketInfo> = new Map();
  private lostPackets: number[] = [];
  private corruptedPackets: number[] = [];
  private sequenceCounter = 0;

  private log(msg: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
    const ts = new Date().toISOString();
    console.log(`[${ts}] [${level}] ${msg}`);
  }

  private calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /** Wrap payload with header + checksum so it can be sent/verified if needed. */
  public createMonitoredPacket(payload: Buffer): Buffer {
    const sequence = this.sequenceCounter;
    const timestamp = Date.now();
    const size = payload.length;
    const checksum = this.calculateChecksum(payload);

    const header = Buffer.alloc(14);
    header.writeUInt32BE(sequence, 0);
    header.writeBigUInt64BE(BigInt(timestamp), 4);
    header.writeUInt16BE(size, 12);

    const monitoredPacket = Buffer.concat([header, payload, Buffer.from(checksum, 'utf-8')]);

    this.packetLog.set(sequence, {
      sequenceNum: sequence,
      timestamp,
      size,
      checksum,
      payloadHash: this.calculateChecksum(payload),
    });

    this.sequenceCounter++;
    return monitoredPacket;
  }

  /** Basic integrity check for a monitored packet (header + checksum). */
  public verifyPacket(receivedPacket: Buffer): [boolean, Buffer, string] {
    try {
      const headerSize = 14;
      const header = receivedPacket.subarray(0, headerSize);

      const sequence = header.readUInt32BE(0);
      const size = header.readUInt16BE(12);
      const payload = receivedPacket.subarray(headerSize, headerSize + size);
      const receivedChecksum = receivedPacket.subarray(headerSize + size).toString('utf-8');

      const calculatedChecksum = this.calculateChecksum(payload);

      if (receivedChecksum !== calculatedChecksum) {
        const msg = `Checksum mismatch for packet ${sequence}`;
        this.corruptedPackets.push(sequence);
        this.log(msg, 'WARN');
        return [false, payload, msg];
      }

      // Detect gaps based on sequence numbers seen so far
      if (this.packetLog.size > 0) {
        const expected = Math.max(...this.packetLog.keys()) + 1;
        if (sequence !== expected) {
          const lost: number[] = [];
          for (let i = expected; i < sequence; i++) lost.push(i);
          if (lost.length) {
            this.lostPackets.push(...lost);
            this.log(`Lost packets detected: ${lost.join(', ')}`, 'WARN');
          }
        }
      }

      this.log(`Packet ${sequence} verified successfully`);
      return [true, payload, 'OK'];
    } catch (err) {
      const msg = `Error verifying packet: ${err instanceof Error ? err.message : String(err)}`;
      this.log(msg, 'ERROR');
      return [false, Buffer.alloc(0), msg];
    }
  }

  public getStatistics() {
    const total = this.sequenceCounter;
    const lost = new Set(this.lostPackets).size;
    const corrupted = new Set(this.corruptedPackets).size;
    const successRate = total > 0 ? ((total - lost - corrupted) / total) * 100 : 0;

    return { totalPackets: total, lostPackets: lost, corruptedPackets: corrupted, successRate };
  }

  public logStats() {
    const s = this.getStatistics();
    this.log(
      `UDP Stats - Total: ${s.totalPackets} | Lost: ${s.lostPackets} | Corrupted: ${s.corruptedPackets} | Success: ${s.successRate.toFixed(2)}%`
    );
  }

  public resetLogs() {
    this.packetLog.clear();
    this.lostPackets = [];
    this.corruptedPackets = [];
    this.sequenceCounter = 0;
    this.log('Monitor reset');
  }
}