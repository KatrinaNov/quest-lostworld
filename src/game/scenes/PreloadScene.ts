import Phaser from 'phaser';
import { createRng, PALETTE } from '../config/worldConfig';
import { SCENE_KEYS } from './BootScene';

export const TEXTURES = {
  grass: 'grass',
  glow: 'glow',
  portalRing: 'portal-ring',
  portalRing2: 'portal-ring-2',
  portalCore: 'portal-core',
  treeA: 'tree-a',
  treeB: 'tree-b',
  pine: 'pine',
  pillar: 'pillar',
  pillarBroken: 'pillar-broken',
  rubble: 'rubble',
  wall: 'wall',
  runeStone: 'rune-stone',
  bush: 'bush',
} as const;

type Draw = (g: Phaser.GameObjects.Graphics) => void;

/**
 * Загрузка ресурсов. Сейчас вся графика рисуется программно (Phaser Graphics / Canvas),
 * поэтому внешних файлов нет. Позже сюда добавятся this.load.image(...) для настоящих спрайтов
 * из public/assets/.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.preload);
  }

  create(): void {
    this.createGrass();
    this.createGlow();
    this.createPortal();
    this.createTrees();
    this.createRuins();
    this.createBush();
    this.scene.start(SCENE_KEYS.world);
  }

  private makeTexture(key: string, width: number, height: number, draw: Draw): void {
    if (this.textures.exists(key)) return;
    const g = this.newGraphics();
    draw(g);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  private newGraphics(): Phaser.GameObjects.Graphics {
    return this.add.graphics({ x: 0, y: 0 });
  }

  private canvas(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): void {
    if (this.textures.exists(key)) return;
    const texture = this.textures.createCanvas(key, size, size);
    if (!texture) return;
    draw(texture.getContext(), size);
    texture.refresh();
  }

  // --------------------------------------------------------------- земля

  private createGrass(): void {
    const size = 256;
    const rng = createRng(77);
    this.makeTexture(TEXTURES.grass, size, size, (g) => {
      g.fillStyle(PALETTE.grassBase, 1);
      g.fillRect(0, 0, size, size);

      // мягкие пятна разных оттенков (с зацикливанием по краям для бесшовности)
      for (let i = 0; i < 46; i += 1) {
        const x = rng() * size;
        const y = rng() * size;
        const r = 14 + rng() * 34;
        g.fillStyle(rng() > 0.5 ? PALETTE.grassLight : PALETTE.grassDark, 0.16 + rng() * 0.14);
        for (const dx of [-size, 0, size]) {
          for (const dy of [-size, 0, size]) {
            g.fillCircle(x + dx, y + dy, r);
          }
        }
      }

      // травинки
      for (let i = 0; i < 130; i += 1) {
        const x = rng() * size;
        const y = rng() * size;
        g.lineStyle(2, rng() > 0.5 ? 0x4c8a58 : 0x1f4429, 0.55);
        g.lineBetween(x, y, x + (rng() - 0.5) * 6, y - 4 - rng() * 5);
      }
    });
  }

  private createGlow(): void {
    this.canvas(TEXTURES.glow, 256, (ctx, s) => {
      const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      grad.addColorStop(0.6, 'rgba(255,255,255,0.14)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, s, s);
    });
  }

  // --------------------------------------------------------------- портал

  private createPortal(): void {
    // внешнее кольцо с рунами
    this.makeTexture(TEXTURES.portalRing, 240, 240, (g) => {
      const c = 120;
      g.lineStyle(10, PALETTE.stoneMid, 1);
      g.strokeCircle(c, c, 100);
      g.lineStyle(4, PALETTE.glowCyan, 0.9);
      g.strokeCircle(c, c, 92);
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        const x = c + Math.cos(a) * 108;
        const y = c + Math.sin(a) * 108;
        g.fillStyle(i % 3 === 0 ? PALETTE.glowGold : PALETTE.stoneLight, 1);
        g.fillCircle(x, y, i % 3 === 0 ? 7 : 4.5);
        g.lineStyle(3, PALETTE.glowViolet, 0.85);
        g.lineBetween(c + Math.cos(a) * 80, c + Math.sin(a) * 80, c + Math.cos(a) * 88, c + Math.sin(a) * 88);
      }
    });

    // внутреннее кольцо
    this.makeTexture(TEXTURES.portalRing2, 240, 240, (g) => {
      const c = 120;
      g.lineStyle(3, PALETTE.glowViolet, 0.95);
      for (let i = 0; i < 6; i += 1) {
        const a0 = (i / 6) * Math.PI * 2;
        g.beginPath();
        g.arc(c, c, 68, a0, a0 + 0.7);
        g.strokePath();
      }
      g.lineStyle(2, PALETTE.glowCyan, 0.8);
      for (let i = 0; i < 4; i += 1) {
        const a0 = (i / 4) * Math.PI * 2 + 0.4;
        g.beginPath();
        g.arc(c, c, 54, a0, a0 + 0.9);
        g.strokePath();
      }
    });

    // светящееся ядро
    this.canvas(TEXTURES.portalCore, 256, (ctx, s) => {
      const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.3, 'rgba(110,231,255,0.85)');
      grad.addColorStop(0.65, 'rgba(140,100,255,0.55)');
      grad.addColorStop(1, 'rgba(110,60,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, s, s);
    });
  }

  // --------------------------------------------------------------- деревья

  private createTrees(): void {
    const tree = (key: string, dark: number, mid: number, light: number, high: number): void => {
      this.makeTexture(key, 150, 180, (g) => {
        g.fillStyle(0x000000, 0.28);
        g.fillEllipse(75, 158, 78, 26);
        g.fillStyle(0x5a3b24, 1);
        g.fillRect(66, 104, 18, 56);
        g.fillStyle(0x3f2918, 1);
        g.fillRect(74, 104, 10, 56);
        g.fillStyle(dark, 1);
        g.fillCircle(75, 74, 52);
        g.fillCircle(46, 92, 36);
        g.fillCircle(104, 92, 36);
        g.fillStyle(mid, 1);
        g.fillCircle(72, 66, 44);
        g.fillCircle(50, 86, 28);
        g.fillCircle(100, 84, 28);
        g.fillStyle(light, 1);
        g.fillCircle(66, 56, 32);
        g.fillCircle(92, 72, 18);
        g.fillStyle(high, 0.9);
        g.fillCircle(58, 46, 17);
      });
    };
    tree(TEXTURES.treeA, 0x1b4d30, 0x276b3d, 0x34874c, 0x56a965);
    tree(TEXTURES.treeB, 0x1a4a45, 0x23665c, 0x2f8274, 0x4fa592);

    // ель
    this.makeTexture(TEXTURES.pine, 120, 190, (g) => {
      g.fillStyle(0x000000, 0.28);
      g.fillEllipse(60, 170, 60, 22);
      g.fillStyle(0x4a3220, 1);
      g.fillRect(53, 128, 14, 44);
      const layers: Array<[number, number, number, number]> = [
        [100, 100, 18, 0x1b4a33],
        [72, 84, 52, 0x23603f],
        [44, 66, 86, 0x2d7649],
      ];
      for (const [halfW, baseY, topY, color] of layers) {
        g.fillStyle(color, 1);
        g.fillTriangle(60 - halfW * 0.5 - 6, baseY + 34, 60 + halfW * 0.5 + 6, baseY + 34, 60, topY);
      }
      g.fillStyle(0x4aa062, 0.85);
      g.fillTriangle(60, 22, 48, 56, 60, 52);
    });
  }

  // --------------------------------------------------------------- руины

  private createRuins(): void {
    const crack = (g: Phaser.GameObjects.Graphics, x: number, y: number): void => {
      g.lineStyle(2, 0x2f353c, 0.9);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 5, y + 9);
      g.lineTo(x - 2, y + 18);
      g.lineTo(x + 4, y + 28);
      g.strokePath();
    };

    // колонна
    this.makeTexture(TEXTURES.pillar, 70, 130, (g) => {
      g.fillStyle(0x000000, 0.28);
      g.fillEllipse(35, 112, 54, 20);
      g.fillStyle(PALETTE.stoneDark, 1);
      g.fillRect(10, 96, 50, 16); // основание
      g.fillStyle(PALETTE.stoneMid, 1);
      g.fillRect(16, 22, 38, 76); // ствол
      g.fillStyle(PALETTE.stoneLight, 1);
      g.fillRect(16, 22, 12, 76);
      g.fillStyle(PALETTE.stoneDark, 1);
      g.fillRect(8, 8, 54, 16); // капитель
      g.fillStyle(PALETTE.stoneMid, 1);
      g.fillRect(8, 8, 54, 7);
      g.fillStyle(PALETTE.moss, 0.8);
      g.fillCircle(24, 100, 8);
      g.fillCircle(46, 44, 6);
      crack(g, 38, 40);
    });

    // сломанная колонна
    this.makeTexture(TEXTURES.pillarBroken, 70, 100, (g) => {
      g.fillStyle(0x000000, 0.28);
      g.fillEllipse(35, 84, 54, 20);
      g.fillStyle(PALETTE.stoneDark, 1);
      g.fillRect(10, 68, 50, 16);
      g.fillStyle(PALETTE.stoneMid, 1);
      g.fillPoints(
        [
          new Phaser.Geom.Point(16, 68),
          new Phaser.Geom.Point(16, 34),
          new Phaser.Geom.Point(26, 28),
          new Phaser.Geom.Point(36, 38),
          new Phaser.Geom.Point(46, 24),
          new Phaser.Geom.Point(54, 36),
          new Phaser.Geom.Point(54, 68),
        ],
        true,
      );
      g.fillStyle(PALETTE.stoneLight, 1);
      g.fillRect(16, 38, 11, 30);
      g.fillStyle(PALETTE.moss, 0.85);
      g.fillCircle(22, 72, 9);
      g.fillCircle(50, 62, 6);
      crack(g, 38, 40);
    });

    // обломки
    this.makeTexture(TEXTURES.rubble, 80, 44, (g) => {
      g.fillStyle(0x000000, 0.25);
      g.fillEllipse(40, 34, 70, 16);
      const blocks: Array<[number, number, number, number, number]> = [
        [6, 16, 28, 20, PALETTE.stoneMid],
        [32, 10, 26, 22, PALETTE.stoneLight],
        [52, 20, 22, 16, PALETTE.stoneDark],
      ];
      for (const [x, y, w, h, c] of blocks) {
        g.fillStyle(c, 1);
        g.fillRoundedRect(x, y, w, h, 4);
      }
      g.fillStyle(PALETTE.moss, 0.8);
      g.fillCircle(20, 18, 5);
    });

    // участок стены
    this.makeTexture(TEXTURES.wall, 190, 90, (g) => {
      g.fillStyle(0x000000, 0.27);
      g.fillEllipse(95, 78, 176, 22);
      g.fillStyle(PALETTE.stoneDark, 1);
      g.fillRoundedRect(4, 22, 182, 52, 6);
      g.fillStyle(PALETTE.stoneMid, 1);
      g.fillRoundedRect(4, 22, 182, 38, 6);
      g.lineStyle(2, PALETTE.stoneDark, 0.9);
      for (let row = 0; row < 2; row += 1) {
        const y = 22 + row * 19;
        g.lineBetween(4, y + 19, 186, y + 19);
        for (let x = 4 + (row % 2) * 22; x < 186; x += 44) {
          g.lineBetween(x, y, x, y + 19);
        }
      }
      // выщербленный верх
      g.fillStyle(0x2d5a3a, 1);
      g.fillTriangle(70, 22, 92, 22, 80, 10);
      g.fillTriangle(138, 22, 156, 22, 146, 12);
      g.fillStyle(PALETTE.moss, 0.9);
      g.fillCircle(30, 28, 9);
      g.fillCircle(110, 62, 8);
      g.fillCircle(166, 30, 7);
    });

    // рунический камень
    this.makeTexture(TEXTURES.runeStone, 70, 110, (g) => {
      g.fillStyle(0x000000, 0.28);
      g.fillEllipse(35, 96, 56, 18);
      g.fillStyle(PALETTE.stoneDark, 1);
      g.fillRoundedRect(10, 12, 50, 82, { tl: 24, tr: 24, bl: 6, br: 6 });
      g.fillStyle(PALETTE.stoneMid, 1);
      g.fillRoundedRect(10, 12, 38, 80, { tl: 24, tr: 12, bl: 6, br: 2 });
      g.lineStyle(3, PALETTE.glowCyan, 1);
      g.lineBetween(35, 34, 35, 66);
      g.lineBetween(26, 44, 35, 34);
      g.lineBetween(44, 44, 35, 34);
      g.lineBetween(27, 58, 43, 52);
      g.lineStyle(7, PALETTE.glowCyan, 0.22);
      g.lineBetween(35, 34, 35, 66);
      g.fillStyle(PALETTE.moss, 0.85);
      g.fillCircle(18, 84, 8);
    });
  }

  private createBush(): void {
    this.makeTexture(TEXTURES.bush, 64, 48, (g) => {
      g.fillStyle(0x000000, 0.22);
      g.fillEllipse(32, 40, 54, 14);
      g.fillStyle(0x1f5a35, 1);
      g.fillCircle(20, 28, 16);
      g.fillCircle(44, 28, 16);
      g.fillStyle(0x2f7d46, 1);
      g.fillCircle(32, 22, 18);
      g.fillStyle(0x4aa062, 0.9);
      g.fillCircle(26, 16, 8);
      g.fillStyle(0xff8fb1, 1);
      g.fillCircle(38, 24, 3);
      g.fillCircle(22, 28, 3);
    });
  }
}
