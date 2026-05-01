import { Transform, TransformCallback } from "node:stream";

export class PCMSilencePadder extends Transform {
  private commandStartTime: number;
  private bytesPushed = 0;

  // 48kHz, 1-channel, 16-bit, 20ms = 1920 bytes per frame
  private readonly BYTES_PER_FRAME = 1920;
  private readonly FRAME_DURATION_MS = 20;
  private readonly BYTES_PER_MS = this.BYTES_PER_FRAME / this.FRAME_DURATION_MS; // 192 bytes per ms

  private readonly SILENCE_TEMPLATE = Buffer.alloc(192000, 0);

  constructor(commandStartTime: number) {
    super();
    this.commandStartTime = commandStartTime;
  }

  private async pushMissingSilence(targetTimeMs: number) {
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
          
          const canKeepPushing = this.push(this.SILENCE_TEMPLATE.subarray(0, writeSize));
          remainingPadding -= writeSize;

          if (!canKeepPushing && remainingPadding > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, 10));
          }
        }

        this.bytesPushed += totalPaddingSize;
      }
    }
  }

  async _transform(chunk: Buffer, encoding: string, callback: TransformCallback) {
    try {
      await this.pushMissingSilence(performance.now());

      this.push(chunk);
      this.bytesPushed += chunk.length;

      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  async _flush(callback: TransformCallback) {
    try {
      await this.pushMissingSilence(performance.now());
      
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }
}
