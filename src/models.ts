export interface Threshold {
  [key: string]: number;
}

export interface Scenario {
  [key: string]: Threshold;
}

export interface Subcategory {
  [key: string]: Scenario;
}

export interface Category {
  [key: string]: Subcategory;
}

export interface BenchmarkData {
  Novice: Category;
  Intermediate: Category;
  Advanced: Category;
}

export type Difficulty = "Novice" | "Intermediate" | "Advanced";
export type ScoreData = {
  rank: string;
  progress: number;
  energy: number;
  highScore: number;
  kills: number;
  hits: number;
  misses: number;
  fov: number;
  fov_scale: string;
  resolution: string;
  avg_fps: number;
  sens_cm: [number, number] | null;
  date: string;
};

export interface StatsResult {
  scenario_name: string;
  score: number;
  kills: number;
  hits: number;
  misses: number;
  sens_cm: [number, number] | null;
  fov: number;
  fov_scale: string;
  resolution: string;
  avg_fps: number;
  date: string;
}

export interface BenchmarkState {
  [key: string]: ScoreData;
}

export const RANK_COLORS = {
  // General
  Unranked: "#E3F2FD",
  // Novice ranks
  Iron: "#787878",
  Bronze: "#CD7F32",
  Silver: "#C0C0C0",
  Gold: "#FFD700",
  // Intermediate ranks
  Platinum: "#00CED1",
  Diamond: "#B9F2FF",
  Jade: "#00A86B",
  Master: "#FF69B4",
  // Advanced ranks
  Grandmaster: "#FFD700",
  Nova: "#9C27B0",
  Astra: "#E91E63",
  Celestial: "#424242",
};

export const CATEGORY_COLORS: { [key: string]: string } = {
  Clicking: "#FFB3B3", // Red
  Tracking: "#B3D9FF", // Blue
  Switching: "#D9B3FF", // Purple
};

export const SUBCATEGORY_COLORS: { [key: string]: string } = {
  Dynamic: "#FFE5B4", // Light Yellow
  Static: "#FFC0C0", // Light Red
  Linear: "#FFD9C0", // Light Peach
  Precise: "#C0E5FF", // Light Cyan
  Reactive: "#B4FFFF", // Aqua
  Control: "#D9F3FF", // Light Blue
  Speed: "#E5CFFF", // Light Lavender
  Evasive: "#EBD9FF", // Light Purple
  Stability: "#F5E5FF", // Light Pinkish Purple
};

export const ENERGY_BASE = 100; // Base energy for the first rank
export const ENERGY_INCREMENT = 100; // Increment per rank
