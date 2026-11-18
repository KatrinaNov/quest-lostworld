/** Wall center lines traced in the original 1199×1312 PNG coordinate system.
 * Each row is [fixed coordinate, start, end, ...]. End coordinates are exclusive.
 * Only the maze is traced. The paper legend, captions and illustration are outside its geometry.
 */
type WallSpans = readonly [number, ...number[]];

const HORIZONTAL: readonly WallSpans[] = [
  [218, 125, 1130],
  [269, 125, 419, 526, 789, 855, 939],
  [326, 126, 363, 583, 940],
  [366, 467, 540],
  [380, 239, 363, 639, 759, 860, 998],
  [424, 175, 419, 467, 597],
  [427, 926, 1066],
  [473, 175, 419],
  [475, 527, 652, 798, 874, 996, 1130],
  [517, 175, 249],
  [521, 745, 1066],
  [525, 584, 652],
  [567, 124, 250],
  [568, 692, 765],
  [569, 923, 1066],
  [613, 130, 257, 405, 541, 585, 705],
  [626, 860, 1068],
  [661, 244, 305, 691, 819],
  [663, 350, 649],
  [706, 183, 585, 636, 874],
  [713, 1054, 1131],
  [753, 526, 650, 698, 766],
  [755, 991, 1079],
  [758, 234, 486],
  [768, 879, 948],
  [803, 472, 540],
  [805, 939, 1005],
  [808, 1051, 1131],
  [811, 299, 419],
  [854, 130, 260, 525, 598],
  [857, 698, 822, 997, 1065],
  [891, 638, 822],
  [900, 65, 198, 352, 539, 939, 1066],
  [934, 808, 893],
  [938, 426, 769],
  [945, 982, 1066],
  [948, 300, 366],
  [988, 193, 317, 809, 996, 1046, 1131],
  [989, 353, 526],
  [1032, 985, 1061],
  [1033, 132, 208, 811, 927],
  [1038, 303, 422],
  [1084, 65, 1012],
];

const VERTICAL: readonly WallSpans[] = [
  [70, 214, 1091],
  [130, 383, 574],
  [137, 606, 861, 955, 1040],
  [182, 319, 431, 466, 524],
  [189, 660, 807],
  [191, 893, 942],
  [200, 981, 1040],
  [241, 752, 807],
  [250, 606, 668],
  [253, 847, 995],
  [254, 1031, 1090],
  [297, 465, 668],
  [306, 804, 955],
  [310, 981, 1045],
  [356, 319, 388, 517, 712],
  [358, 858, 908],
  [360, 941, 997],
  [412, 261, 621, 805, 908],
  [474, 211, 372, 417, 565],
  [476, 1031, 1091],
  [479, 752, 845],
  [519, 982, 1033],
  [533, 262, 372, 469, 621, 747, 810, 847, 908],
  [590, 320, 431],
  [591, 518, 620, 803, 944],
  [643, 656, 714, 746, 897],
  [645, 373, 482, 518, 570],
  [698, 417, 575, 606, 668],
  [704, 747, 864],
  [752, 372, 528],
  [758, 562, 615],
  [759, 747, 806],
  [762, 932, 1033],
  [805, 321, 483],
  [812, 514, 668],
  [815, 700, 864, 885, 942],
  [867, 372, 482, 571, 713],
  [886, 762, 942],
  [920, 982, 1040],
  [932, 262, 334],
  [933, 420, 528],
  [940, 619, 775],
  [946, 798, 908],
  [989, 938, 996],
  [991, 211, 385],
  [998, 666, 812],
  [1053, 982, 1037],
  [1057, 801, 864],
  [1058, 270, 434, 894, 952],
  [1059, 514, 575],
  [1060, 619, 720],
  [1123, 211, 997],
];

export const MAZE_HAZARDS = {
  skeletons: [[344, 296], [558, 395], [730, 631], [104, 722], [951, 959]],
  bushes: [[260, 357], [819, 305], [401, 735], [880, 737], [765, 829], [134, 935], [418, 967]],
  pool: { x: 653, y: 1012, width: 162, height: 94 },
} as const;

export interface MazeRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const MAZE_ORIGIN = { x: 40, y: 10 };
export const MAZE_SCALE = 2;

export function mazePoint(x: number, y: number): { x: number; y: number } {
  return { x: (x - MAZE_ORIGIN.x) * MAZE_SCALE, y: (y - MAZE_ORIGIN.y) * MAZE_SCALE };
}

function wallRects(spans: readonly WallSpans[], vertical: boolean): MazeRect[] {
  const walls: MazeRect[] = [];
  for (const [fixed, ...ends] of spans) {
    for (let i = 0; i < ends.length; i += 2) {
      const start = ends[i];
      const end = ends[i + 1];
      const a = vertical ? mazePoint(fixed - 7, start) : mazePoint(start, fixed - 7);
      const b = vertical ? mazePoint(fixed + 7, end) : mazePoint(end, fixed + 7);
      walls.push({ left: a.x, top: a.y, right: b.x, bottom: b.y });
    }
  }
  return walls;
}

export const MAZE_WALLS = [...wallRects(HORIZONTAL, false), ...wallRects(VERTICAL, true)];
