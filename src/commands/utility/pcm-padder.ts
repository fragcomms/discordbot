import { Transform, TransformCallback } from "node:stream";

export class PCMSilencePadder extends Transform {
  private commandStartTime: number;
  private bytesPushed = 0;

  // 48kHz, 2-channel, 16-bit, 20ms = 3840 bytes per frame
  private readonly BYTES_PER_FRAME = 3840;
  private readonly FRAME_DURATION_MS = 20;
  private readonly BYTES_PER_MS = this.BYTES_PER_FRAME / this.FRAME_DURATION_MS; // 192 bytes per ms

  private readonly SILENCE_TEMPLATE = Buffer.alloc(192000, 0);

  constructor(commandStartTime: number) {
    super();
    this.commandStartTime = commandStartTime;
  }

  _transform(chunk: Buffer, encoding: string, callback: TransformCallback) {
    const now = performance.now();
    const elapsedMs = now - this.commandStartTime;

    // Based on total time elapsed, how many frames SHOULD we have processed?
    const expectedBytes = Math.floor(elapsedMs * this.BYTES_PER_MS);

    // Are we behind the timeline?
    const missingBytes = expectedBytes - this.bytesPushed;

    if (missingBytes > 0) {
      const missingFrames = Math.floor(missingBytes / this.BYTES_PER_FRAME);

      if (missingFrames > 0) {
        const totalPaddingSize = missingFrames * this.BYTES_PER_FRAME;
        let remainingPadding = totalPaddingSize;

        while (remainingPadding > 0) {
          const writeSize = Math.min(remainingPadding, this.SILENCE_TEMPLATE.length);
          this.push(this.SILENCE_TEMPLATE.subarray(0, writeSize));
          remainingPadding -= writeSize;
        }

        this.bytesPushed += totalPaddingSize;
      }
    }

    // Push the actual received chunk
    this.push(chunk);
    this.bytesPushed += chunk.length;

    callback();
  }
}
