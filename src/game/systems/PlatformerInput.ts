import Phaser from 'phaser';
import { TEMPLE_CONFIG } from '../config/templeConfig';
import type { PlatformerControls } from '../../ui/PlatformerControls';

/** Локальный ввод платформера: прыжковый буфер и coyote time только в храме. */
export class PlatformerInput {
  private readonly keys: Record<'A' | 'D' | 'LEFT' | 'RIGHT' | 'UP' | 'SPACE', Phaser.Input.Keyboard.Key>;
  private coyoteLeft = 0;
  private jumpBufferLeft = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly touch: PlatformerControls | null) {
    this.keys = scene.input.keyboard!.addKeys('A,D,LEFT,RIGHT,UP,SPACE') as typeof this.keys;
  }

  step(body: Phaser.Physics.Arcade.Body, deltaMs: number): void {
    const grounded = body.blocked.down || body.touching.down;
    this.coyoteLeft = grounded ? TEMPLE_CONFIG.coyoteMs : Math.max(0, this.coyoteLeft - deltaMs);
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.keys.UP) || this.touch?.consumeJump()) this.jumpBufferLeft = TEMPLE_CONFIG.jumpBufferMs;
    else this.jumpBufferLeft = Math.max(0, this.jumpBufferLeft - deltaMs);
    const horizontal = (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) - (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0) + (this.touch?.getHorizontal() ?? 0);
    body.setVelocityX(Phaser.Math.Clamp(horizontal, -1, 1) * TEMPLE_CONFIG.player.speed);
    if (this.jumpBufferLeft > 0 && this.coyoteLeft > 0) {
      body.setVelocityY(-TEMPLE_CONFIG.player.jumpVelocity); this.coyoteLeft = 0; this.jumpBufferLeft = 0;
    }
  }

  destroy(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;
    for (const key of Object.values(this.keys)) keyboard.removeKey(key);
  }
}
