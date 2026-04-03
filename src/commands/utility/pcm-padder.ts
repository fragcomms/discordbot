import { Transform, TransformCallback } from "node:stream";

export class PCMSilencePadder extends Transform {
  private commandStartTime: number;
  private framesProcessed = 0;
  
  // 48kHz, 2-channel, 16-bit, 20ms = 3840 bytes per frame
  private readonly BYTES_PER_FRAME = 3840;
  private readonly FRAME_DURATION_MS = 20;

  constructor(commandStartTime: number) {
    super();
    this.commandStartTime = commandStartTime;
  }

  _transform(chunk: Buffer, encoding: string, callback: TransformCallback) {
    const now = Date.now();
    const elapsedMs = now - this.commandStartTime;

    // Based on total time elapsed, how many frames SHOULD we have processed?
    const expectedFrames = Math.floor(elapsedMs / this.FRAME_DURATION_MS);

    // Are we behind the timeline?
    const missingFrames = expectedFrames - this.framesProcessed;

    if (missingFrames > 0) {
      // Pad only the exact number of frames we are missing overall
      this.push(Buffer.alloc(missingFrames * this.BYTES_PER_FRAME, 0));
      this.framesProcessed += missingFrames;
    }

    // Push the actual received chunk
    this.push(chunk);

    // Update our processed frame counter based on the actual chunk size.
    // Using chunk.length ensures accuracy even if a chunk arrives 
    // smaller or larger than exactly 3840 bytes.
    const framesInChunk = chunk.length / this.BYTES_PER_FRAME;
    this.framesProcessed += framesInChunk;

    callback();
  }
}