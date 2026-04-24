import { Transform, TransformCallback } from "node:stream";

export class PCMSilencePadder extends Transform {
  private commandStartTime: number;
  private bytesPushed = 0;

  // 48kHz, 2-channel, 16-bit, 20ms = 3840 bytes per frame
  private readonly BYTES_PER_FRAME = 1920;
  private readonly FRAME_DURATION_MS = 20;
  private readonly BYTES_PER_MS = this.BYTES_PER_FRAME / this.FRAME_DURATION_MS; // 192 bytes per ms

  private readonly SILENCE_TEMPLATE = Buffer.alloc(192000, 0);

  constructor(commandStartTime: number) {
    super();
    this.commandStartTime = commandStartTime;
  }

  private pushMissingSilence(targetTimeMs: number) {
    const elapsedMs = targetTimeMs - this.commandStartTime;
    const expectedBytes = Math.floor(elapsedMs * this.BYTES_PER_MS);
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
  }

  _transform(chunk: Buffer, encoding: string, callback: TransformCallback) {
    // 1. Pad up to the current moment before pushing new audio
    this.pushMissingSilence(performance.now());

    // 2. Push the actual audio chunk
    this.push(chunk);
    this.bytesPushed += chunk.length;

    callback();
  }

  _flush(callback: TransformCallback) {
    // 1. When the /stop-recording command ends this stream, pad EXACTLY to this current millisecond
    this.pushMissingSilence(performance.now());
    
    // 2. Close out
    callback();
  }
}
