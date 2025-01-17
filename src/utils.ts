import {
  Difficulty,
  ENERGY_INCREMENT,
  ENERGY_BASE,
  BenchmarkState,
  BenchmarkData,
  Threshold,
} from "./models";

/**
 * Lightens a given hex color by a specified percentage.
 *
 * @param {string} color - The hex color code to be lightened (e.g., "#ff0000").
 * @param {number} percent - The percentage by which to lighten the color (0 to 1).
 * @returns {string} - The lightened hex color code.
 *
 * @example
 * ```typescript
 * lightenColor("#ff0000", 0.2); // Returns a lighter shade of red
 * ```
 */
export const lightenColor = (color: string, percent: number) => {
  const num = parseInt(color.replace("#", ""), 16);
  const r = Math.round(
    ((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * percent
  );
  const g = Math.round(
    ((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * percent
  );
  const b = Math.round((num & 0xff) + (255 - (num & 0xff)) * percent);
  // Ensure output is always a valid hex format
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};


/**
 * Gets the contrast color (either black or white) based on 
 * the luminance of the input color.
 * 
 * @param {string} color - The hex or RGB color code to be analyzed.
 * @returns {string} - The contrast color (either "#000" or "#FFF").
 * 
 * @example
 * ```typescript
 * getContrastColor("#ff0000"); // Returns "#FFF" for a red color
 * ```
 */
export const getContrastColor = (color: string) => {
  let r, g, b;

  if (color.startsWith("#")) {
    const num = parseInt(color.replace("#", ""), 16);
    r = (num >> 16) & 0xff;
    g = (num >> 8) & 0xff;
    b = num & 0xff;
  } else if (color.startsWith("rgb")) {
    const rgb = color.match(/\d+/g)?.map(Number).slice(0, 3); // Extract RGB components
    if (rgb) [r, g, b] = rgb;
  }

  if (r === undefined || g === undefined || b === undefined) {
    return "#000"; // Fallback to black if parsing fails
  }

  const brightness = (r * 299 + g * 587 + b * 114) / 1000; // Relative luminance formula
  return brightness > 186 ? "#000" : "#FFF"; // Black for light backgrounds, White for dark
};

/**
 * Helper function to calculate the strarting energy for a given difficulty.
 * 
 * @param {Difficulty} difficulty - The difficulty level for which to calculate the starting energy.
 * @param {Object} difficultyRanks - The object containing the rank thresholds for each difficulty.
 * @returns {number} - The starting energy for the given difficulty.
 * 
 * @example
 * ```typescript
 * calculateStartingEnergy("Novice", difficultyRanks); // Returns the starting energy for the Novice difficulty
 * ```
 */
export const calculateStartingEnergy = (
  difficulty: Difficulty,
  difficultyRanks: { [key: string]: string[] }
) => {
  const difficulties = ["Novice", "Intermediate", "Advanced"] as Difficulty[];
  const difficultyIndex = difficulties.indexOf(difficulty);

  // Calculate cumulative energy from previous difficulties
  let startingEnergy = 0;
  for (let i = 0; i < difficultyIndex; i++) {
    const numRanks = difficultyRanks[difficulties[i]]?.length || 0;
    startingEnergy += numRanks * ENERGY_INCREMENT;
  }

  // Add base energy to the starting point
  return startingEnergy + ENERGY_BASE;
};

/**
 * Calculates the harmonic mean of an array of values.
 * 
 * @param {number[]} values - The array of values for which to calculate the harmonic mean.
 * @param {number} expectedCount - The expected number of values in the array.
 * @returns {number} - The harmonic mean of the input values.
 * 
 * @example
 * ```typescript
 * calculateHarmonicMean([1, 2, 3, 4], 4); // Returns the harmonic mean of the input values
 * ```
 */
export const calculateHarmonicMean = (
  values: number[],
  expectedCount: number
) => {
  if (values.length !== expectedCount || values.some((v) => v === 0)) return 0;
  const reciprocalSum = values.reduce((sum, value) => sum + 1 / value, 0);
  return values.length / reciprocalSum;
};

/**
 * Calculates the overall rank for a given energy value,
 * difficulty, and rank thresholds.
 * 
 * @param {number} energy - The energy value to be ranked.
 * @param {Difficulty} difficulty - The difficulty level for which to calculate the rank.
 * @param {Object} difficultyRanks - The object containing the rank thresholds for each difficulty.
 * @returns {string} - The overall rank for the given energy value.
 * 
 * @example
 * ```typescript
 * calculateOverallRank(100, "Novice", difficultyRanks); // Returns the overall rank for the given energy value
 * ```
 */
export const calculateOverallRank = (
  energy: number,
  difficulty: Difficulty,
  difficultyRanks: { [key: string]: string[] }
) => {
  const ranks = difficultyRanks[difficulty];
  const startingEnergy = calculateStartingEnergy(difficulty, difficultyRanks);

  for (let i = ranks.length - 1; i >= 0; i--) {
    const rankEnergy = startingEnergy + i * ENERGY_INCREMENT;
    if (energy >= rankEnergy) {
      return ranks[i];
    }
  }
  return "Unranked";
};

/**
 * Checks if a given rank is complete based on the benchmark
 * scores and rank thresholds.
 * 
 * @param {BenchmarkState} scores - The benchmark scores for the user.
 * @param {BenchmarkData} benchmarkData - The benchmark data containing rank thresholds.
 * @param {Difficulty} difficulty - The difficulty level for which to check rank completion.
 * @param {string} rank - The rank to check for completion.
 * @returns {boolean} - True if all scenarios for the rank are complete, false otherwise.
 * 
 * @example
 * ```typescript
 * isRankComplete(scores, benchmarkData, "Novice", "Bronze"); // Returns true if all scenarios for the Bronze rank are complete
 * ```
 */
export const isRankComplete = (
  scores: BenchmarkState,
  benchmarkData: BenchmarkData,
  difficulty: Difficulty,
  rank: string
) => {
  let allScenariosComplete = true;

  Object.values(benchmarkData[difficulty]).forEach((categories) => {
    Object.values(categories).forEach((scenarios) => {
      Object.entries(scenarios).forEach(([scenario, thresholds]) => {
        const scoreData = scores[scenario];
        if (scoreData && thresholds[rank]) {
          if (scoreData.highScore < thresholds[rank]) {
            allScenariosComplete = false;
          }
        }
      });
    });
  });

  return allScenariosComplete;
};

/**
 * Helper function to format a date string into a human-readable format.
 * 
 * @param {string} dateString - The date string to be formatted.
 * @returns {string} - The formatted date string.
 * 
 * @example
 * ```typescript
 * formatDate("2021-10-01T12:00:00"); // Returns a human-readable date format
 * ```
 */
export const formatDate = (dateString: string) => {
  if (!dateString) return "-";
  const [datePart, timePart] = dateString.split("-");
  const [year, month, day] = datePart.split(".");
  const [hour, minute, second] = timePart.split(".");
  const date = new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  );
  return date.toLocaleString();
};

/**
 * Helper function to calculate the energy
 * for a given scenario based on the score and rank thresholds.
 * 
 * @param {number} score - The score value for the scenario.
 * @param {Threshold} thresholds - The rank thresholds for the scenario.
 * @param {number} startingEnergy - The starting energy value for the difficulty.
 * @returns {number} - The energy value for the scenario.
 * 
 * @example
 * ```typescript
 * calculateScenarioEnergy(100, { Bronze: 50, Silver: 75, Gold: 100 }, 100); // Returns the energy value for the scenario
 * ```
 */
export const calculateScenarioEnergy = (
  score: number,
  thresholds: Threshold,
  startingEnergy: number
): number => {
  const rankThresholds = Object.entries(thresholds)
    .sort(([, a], [, b]) => a - b)
    .map(([rank, threshold]) => ({ rank, threshold }));

  // Calculate fake lower rank threshold
  const lowestRank = rankThresholds[0];
  const secondLowestRank = rankThresholds[1];
  const fakeLowerThreshold =
    lowestRank.threshold - (secondLowestRank.threshold - lowestRank.threshold);

  // Calculate fake upper rank threshold
  const highestRank = rankThresholds[rankThresholds.length - 1];
  const secondHighestRank = rankThresholds[rankThresholds.length - 2];
  const fakeUpperThreshold =
    highestRank.threshold +
    (highestRank.threshold - secondHighestRank.threshold);

  // Handle score below fake lower threshold
  if (score < fakeLowerThreshold) {
    return (score / fakeLowerThreshold) * (startingEnergy - ENERGY_INCREMENT);
  }

  // Handle score between fake lower threshold and lowest real threshold
  if (score < rankThresholds[0].threshold) {
    const progress =
      (score - fakeLowerThreshold) /
      (lowestRank.threshold - fakeLowerThreshold);
    return startingEnergy - ENERGY_INCREMENT + progress * ENERGY_INCREMENT;
  }

  // Add fake ranks to the thresholds array
  const extendedThresholds = [
    { rank: "FakeLower", threshold: fakeLowerThreshold },
    ...rankThresholds,
    { rank: "FakeUpper", threshold: fakeUpperThreshold },
  ];

  // Find appropriate threshold range and calculate energy
  for (let i = 1; i < extendedThresholds.length; i++) {
    const current = extendedThresholds[i];
    const previous = extendedThresholds[i - 1];

    if (score >= previous.threshold && score < current.threshold) {
      const progress =
        (score - previous.threshold) / (current.threshold - previous.threshold);
      return (
        startingEnergy +
        (i - 2) * ENERGY_INCREMENT +
        progress * ENERGY_INCREMENT
      );
    }
  }

  // Score is above the highest threshold
  return (
    startingEnergy +
    (rankThresholds.length - 1) * ENERGY_INCREMENT +
    ENERGY_INCREMENT
  );
};

/**
 * Helper function to calculate the energy for a given subcategory
 * based on the benchmark scores and rank thresholds.
 * 
 * @param {Object} scenarios - The scenarios for the subcategory.
 * @param {BenchmarkState} scores - The benchmark scores for the user.
 * @param {number} startingEnergy - The starting energy value for the difficulty.
 * @returns {number} - The energy value for the subcategory.
 * 
 * @example
 * ```typescript
 * calculateSubcategoryEnergy(subcategory, scores, 100); // Returns the energy value for the subcategory
 * ```
 */
export const calculateSubcategoryEnergy = (
  scenarios: { [key: string]: Threshold },
  scores: BenchmarkState,
  startingEnergy: number
): number => {
  let maxEnergy = 0;

  Object.entries(scenarios).forEach(([scenario, thresholds]) => {
    const scoreData = scores[scenario];
    if (scoreData && thresholds) {
      const energy = calculateScenarioEnergy(
        scoreData.highScore,
        thresholds,
        startingEnergy
      );
      maxEnergy = Math.max(maxEnergy, energy);
    }
  });

  return maxEnergy;
};

/**
 * Gets the highest rank achieved for a given subcategory
 * based on the benchmark scores and rank thresholds.
 * 
 * @param {Object} scenarios - The scenarios for the subcategory.
 * @param {BenchmarkState} scores - The benchmark scores for the user.
 * @returns {string} - The highest rank achieved for the subcategory.
 * 
 * @example
 * ```typescript
 * getHighestSubcategoryRank(subcategory, scores); // Returns the highest rank achieved for the subcategory
 * ```
 */
export const getHighestScenarioRank = (
  scenarios: { [key: string]: Threshold },
  scores: BenchmarkState
) => {
  let highestRank = "Unranked";
  let highestThresholdMet = -Infinity;

  Object.entries(scenarios).forEach(([scenario, thresholds]) => {
    const scoreData = scores[scenario];
    if (scoreData) {
      // Find the highest rank achieved for this scenario
      for (const [rank, threshold] of Object.entries(thresholds)) {
        if (
          scoreData.highScore >= threshold &&
          threshold > highestThresholdMet
        ) {
          highestRank = rank;
          highestThresholdMet = threshold;
        }
      }
    }
  });

  return highestRank;
};
