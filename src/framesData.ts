export interface FrameInfo {
  index: number;
  sequence: string;
  archive: string;
  filename: string;
  path: string;
  width: number;
  height: number;
}

export interface SequenceInfo {
  id: string;
  name: string;
  archive: string;
  order: number;
  rawFrameCount: number;
  includedFrameCount: number;
  firstFile: string;
  lastFile: string;
}

// Generate the frame array dynamically based on our verified audit:
// Sequence 1: frames 001 to 269 (all 269 frames)
// Sequence 2: frames 002 to 118 (117 frames, frame 001 deduplicated)
// Sequence 3: frames 002 to 179 (178 frames, frame 001 deduplicated)
// Total unique frames = 564

const pad3 = (num: number) => num.toString().padStart(3, '0');

export const TOTAL_FRAMES = 564;
export const ORIGINAL_WIDTH = 1920;
export const ORIGINAL_HEIGHT = 1080;
export const ORIGINAL_ASPECT_RATIO = ORIGINAL_WIDTH / ORIGINAL_HEIGHT;

export const SEQUENCES: SequenceInfo[] = [
  {
    id: "sequence-01",
    name: "Sequence 1",
    archive: "first phase.zip",
    order: 1,
    rawFrameCount: 269,
    includedFrameCount: 269,
    firstFile: "ezgif-frame-001.jpg",
    lastFile: "ezgif-frame-269.jpg"
  },
  {
    id: "sequence-02",
    name: "Sequence 2",
    archive: "second phase.zip",
    order: 2,
    rawFrameCount: 118,
    includedFrameCount: 117,
    firstFile: "ezgif-frame-001.jpg",
    lastFile: "ezgif-frame-118.jpg"
  },
  {
    id: "sequence-03",
    name: "Sequence 3",
    archive: "third phase.zip",
    order: 3,
    rawFrameCount: 179,
    includedFrameCount: 178,
    firstFile: "ezgif-frame-001.jpg",
    lastFile: "ezgif-frame-179.jpg"
  }
];

export const FRAMES: FrameInfo[] = [];

let globalIndex = 0;

// Sequence 1 (1..269)
for (let i = 1; i <= 269; i++) {
  const filename = `ezgif-frame-${pad3(i)}.jpg`;
  FRAMES.push({
    index: globalIndex++,
    sequence: "sequence-01",
    archive: "first phase.zip",
    filename,
    path: `/frames/sequence-01/${filename}`,
    width: ORIGINAL_WIDTH,
    height: ORIGINAL_HEIGHT
  });
}

// Sequence 2 (2..118, skipping boundary 001)
for (let i = 2; i <= 118; i++) {
  const filename = `ezgif-frame-${pad3(i)}.jpg`;
  FRAMES.push({
    index: globalIndex++,
    sequence: "sequence-02",
    archive: "second phase.zip",
    filename,
    path: `/frames/sequence-02/${filename}`,
    width: ORIGINAL_WIDTH,
    height: ORIGINAL_HEIGHT
  });
}

// Sequence 3 (2..179, skipping boundary 001)
for (let i = 2; i <= 179; i++) {
  const filename = `ezgif-frame-${pad3(i)}.jpg`;
  FRAMES.push({
    index: globalIndex++,
    sequence: "sequence-03",
    archive: "third phase.zip",
    filename,
    path: `/frames/sequence-03/${filename}`,
    width: ORIGINAL_WIDTH,
    height: ORIGINAL_HEIGHT
  });
}
