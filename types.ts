export enum Stage {
  IDEA,
  INSPIRATION,
  FINETUNING,
  SCRIPT_SELECT,
  GENERATING_VIDEO,
  RESULT,
}

export interface InspirationFile {
  base64: string;
  mimeType: string;
  name: string;
  description: string;
  previewUrl: string;
}

export interface UserInput {
  idea: string;
  inspirationImages: InspirationFile[];
  inspirationVideos: InspirationFile[];
  inspirationAudio: InspirationFile | null;
  duration: string;
  mood: string;
  aspectRatio: string;
  audience: string;
}

export interface Script {
  title: string;
  logline: string;
  fullScript: string;
}
