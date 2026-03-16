import { Transform, TransformCallback } from 'node:stream';

export class PCMSilencePadder extends Transform {
  private lastPacketTime = 0;
  private commandStartTime: number;
  private isFirstPacket = true;
  // 48kHz, 2-channel, 16-bit, 20ms = 3840 bytes per frame
  private readonly BYTES_PER_FRAME = 3840; 

  constructor(commandStartTime: number) {
    super();
    this.commandStartTime = commandStartTime;
  }

  _transform(chunk: Buffer, encoding: string, callback: TransformCallback) {
    const now = Date.now();

    // Initial Silence Padding
    if (this.isFirstPacket) {
      const initialDelayMs = now - this.commandStartTime;
      const missingInitialFrames = Math.floor(initialDelayMs / 20);
      
      if (missingInitialFrames > 0) {
        this.push(Buffer.alloc(missingInitialFrames * this.BYTES_PER_FRAME, 0));
      }
      
      this.isFirstPacket = false;
      this.lastPacketTime = now;
      this.push(chunk);
      return callback();
    }

    // Mid-Stream Silence Padding
    const delta = now - this.lastPacketTime;
    const missingFrames = Math.floor(delta / 20) - 1;
    
    if (missingFrames > 0) {
      this.push(Buffer.alloc(missingFrames * this.BYTES_PER_FRAME, 0));
    }

    this.lastPacketTime = now;
    this.push(chunk);
    callback();
  }
}