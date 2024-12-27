import { useEffect, useState } from "react";
import {
  Table,
  Text,
  Title,
  Stack,
  Tabs,
  Tooltip,
  Divider,
  Button,
} from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { useHotkeys } from "@mantine/hooks";

interface Threshold {
  [key: string]: number;
}

interface Scenario {
  [key: string]: Threshold;
}

interface Subcategory {
  [key: string]: Scenario;
}

interface Category {
  [key: string]: Subcategory;
}

interface BenchmarkData {
  Novice: Category;
  Intermediate: Category;
  Advanced: Category;
}

type Difficulty = "Novice" | "Intermediate" | "Advanced";
type ScoreData = {
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

interface StatsResult {
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

interface BenchmarkState {
  [key: string]: ScoreData;
}

const RANK_COLORS = {
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

const CATEGORY_COLORS: { [key: string]: string } = {
  Clicking: "#FFB3B3", // Red
  Tracking: "#B3D9FF", // Blue
  Switching: "#D9B3FF", // Purple
};

const SUBCATEGORY_COLORS: { [key: string]: string } = {
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

const ENERGY_BASE = 100; // Base energy for the first rank
const ENERGY_INCREMENT = 100; // Increment per rank

export default function App() {
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(
    null
  );
  const [scores, setScores] = useState<BenchmarkState>({});
  const [difficultyRanks, setDifficultyRanks] = useState<{
    [key: string]: string[];
  }>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch benchmark data from gist
        const response = await fetch(
          "https://gist.githubusercontent.com/Dylan-B-D/b21d485c5ab44e85c78d161ae1c68d6e/raw"
        );
        const data = await response.json();
        setBenchmarkData(data);

        // Extract all unique scenario names from benchmark data
        const allScenarios = new Set<string>();
        Object.values(data).forEach((categories) => {
          Object.values(categories as Category).forEach((subcategories) => {
            Object.values(subcategories as Subcategory).forEach((scenarios) => {
              Object.keys(scenarios).forEach((scenarioName) =>
                allScenarios.add(scenarioName)
              );
            });
          });
        });

        // Extract difficulty ranks
        const ranks = Object.keys(data).reduce((acc, difficulty) => {
          const categories = data[difficulty as keyof typeof data];
          const allRanks = new Set<string>();

          Object.values(categories).forEach((subcategories) => {
            Object.values(subcategories as Subcategory).forEach((scenarios) => {
              Object.values(scenarios).forEach((thresholds) => {
                Object.keys(thresholds).forEach((rank) => allRanks.add(rank));
              });
            });
          });

          acc[difficulty] = Array.from(allRanks);
          return acc;
        }, {} as { [key: string]: string[] });

        setDifficultyRanks(ranks);

        // Fetch scores using Rust command
        await fetchScores(Array.from(allScenarios));
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  const fetchScores = async (scenarios: string[]) => {
    try {
      const rustResponse: { stats: StatsResult[] } = await invoke("get_stats", {
        scenarios,
      });

      // Create initial state with all scenarios
      const initialScores = scenarios.reduce((acc, scenario) => {
        acc[scenario] = {
          rank: "Unranked",
          progress: 0,
          energy: 0,
          highScore: 0,
          kills: 0,
          hits: 0,
          misses: 0,
          fov: 0,
          fov_scale: "",
          resolution: "",
          avg_fps: 0,
          sens_cm: null,
          date: "",
        };
        return acc;
      }, {} as BenchmarkState);

      // Update with actual scores
      rustResponse.stats.forEach((stat) => {
        initialScores[stat.scenario_name] = {
          rank: "0",
          progress: 0,
          energy: 0,
          highScore: stat.score,
          kills: stat.kills,
          hits: stat.hits,
          misses: stat.misses,
          fov: stat.fov,
          fov_scale: stat.fov_scale,
          resolution: stat.resolution,
          avg_fps: stat.avg_fps,
          sens_cm: stat.sens_cm,
          date: stat.date,
        };
      });

      setScores(initialScores);
    } catch (error) {
      console.error("Error fetching scores:", error);
    }
  };

  const refreshScores = async () => {
    await fetchScores(Object.keys(scores));
  };

  useHotkeys([['r', refreshScores]]);

  if (!benchmarkData) return <Text>Loading...</Text>;

  const renderOverallRank = (difficulty: Difficulty, overallEnergy: number) => {
    const overallRank = calculateOverallRank(
      overallEnergy,
      difficulty,
      difficultyRanks
    );
    const rankComplete = isRankComplete(
      scores,
      benchmarkData,
      difficulty,
      overallRank
    );
    const backgroundColor =
      RANK_COLORS[overallRank as keyof typeof RANK_COLORS] || "#FFFFFF";

    return (
      <div className="flex justify-center mt-4">
        <div className="flex flex-col items-center gap-2">
          <div
            className="px-6 py-3 rounded-md font-bold text-lg"
            style={{
              backgroundColor,
              color: getContrastColor(backgroundColor),
            }}
          >
            {overallRank}{" "}
            {rankComplete && overallRank !== "Unranked" ? "Complete" : ""}
          </div>
          <div className="text-sm font-bold">
            Overall Energy:{" "}
            <span className="font-normal">
              {parseFloat(overallEnergy.toFixed(1)).toString()}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderTable = (difficulty: Difficulty) => {
    const startingEnergy = calculateStartingEnergy(difficulty, difficultyRanks);

    // Calculate overall energy for the difficulty
    const subcategoryEnergies: number[] = [];
    const totalSubcategories = Object.keys(benchmarkData[difficulty]).reduce(
      (acc, category) =>
        acc + Object.keys(benchmarkData[difficulty][category]).length,
      0
    );

    Object.entries(benchmarkData[difficulty]).forEach(([, subcategories]) => {
      Object.entries(subcategories).forEach(([, scenarios]) => {
        let maxEnergy = 0;

        Object.entries(scenarios).forEach(([scenario, thresholds]) => {
          const scoreData = scores[scenario];
          if (scoreData && thresholds) {
            const rankThresholds = Object.entries(thresholds)
              .sort(([, a], [, b]) => a - b)
              .map(([rank, threshold]) => ({ rank, threshold }));

            if (scoreData.highScore < rankThresholds[0].threshold) {
              const lowestRankEnergy = startingEnergy + 0 * ENERGY_INCREMENT;
              const progress =
                scoreData.highScore / rankThresholds[0].threshold;
              maxEnergy = Math.max(maxEnergy, lowestRankEnergy * progress);
            } else {
              const highestRank = rankThresholds[rankThresholds.length - 1];
              const secondHighestRank =
                rankThresholds[rankThresholds.length - 2];
              const fakeRankThreshold =
                highestRank.threshold +
                (highestRank.threshold - secondHighestRank.threshold);
              const fakeRankEnergy =
                startingEnergy +
                (rankThresholds.length - 1) * ENERGY_INCREMENT +
                100;
              rankThresholds.push({
                rank: "Fake",
                threshold: fakeRankThreshold,
              });

              for (let i = 0; i < rankThresholds.length; i++) {
                const current = rankThresholds[i];
                const next = rankThresholds[i + 1];

                if (scoreData.highScore >= current.threshold) {
                  if (next && scoreData.highScore < next.threshold) {
                    const progress =
                      (scoreData.highScore - current.threshold) /
                      (next.threshold - current.threshold);
                    const energy =
                      startingEnergy +
                      i * ENERGY_INCREMENT +
                      progress * ENERGY_INCREMENT;
                    maxEnergy = Math.max(maxEnergy, energy);
                    break;
                  } else if (!next) {
                    maxEnergy = Math.max(maxEnergy, fakeRankEnergy);
                  }
                }
              }
            }
          }
        });

        subcategoryEnergies.push(maxEnergy);
      });
    });

    const overallEnergy = calculateHarmonicMean(
      subcategoryEnergies,
      totalSubcategories
    );

    const calculateSubcategoryEnergy = (
      scenarios: { [key: string]: Threshold },
      scores: BenchmarkState,
      startingEnergy: number
    ): number => {
      let maxEnergy = 0;

      Object.entries(scenarios).forEach(([scenario, thresholds]) => {
        const scoreData = scores[scenario];
        if (!scoreData || !thresholds) return;

        const rankThresholds = Object.entries(thresholds)
          .sort(([, a], [, b]) => a - b)
          .map(([rank, threshold]) => ({ rank, threshold }));

        if (scoreData.highScore < rankThresholds[0].threshold) {
          const progress = scoreData.highScore / rankThresholds[0].threshold;
          maxEnergy = Math.max(maxEnergy, startingEnergy * progress);
          return;
        }

        // Add fake rank for overachievement
        const highestRank = rankThresholds[rankThresholds.length - 1];
        const secondHighestRank = rankThresholds[rankThresholds.length - 2];
        const fakeRankThreshold =
          highestRank.threshold +
          (highestRank.threshold - secondHighestRank.threshold);

        rankThresholds.push({
          rank: "Fake",
          threshold: fakeRankThreshold,
        });

        for (let i = 0; i < rankThresholds.length; i++) {
          const current = rankThresholds[i];
          const next = rankThresholds[i + 1];

          if (scoreData.highScore >= current.threshold) {
            if (next && scoreData.highScore < next.threshold) {
              const progress =
                (scoreData.highScore - current.threshold) /
                (next.threshold - current.threshold);
              const energy =
                startingEnergy +
                i * ENERGY_INCREMENT +
                progress * ENERGY_INCREMENT;
              maxEnergy = Math.max(maxEnergy, energy);
              break;
            } else if (!next) {
              const fakeRankEnergy =
                startingEnergy + (rankThresholds.length - 1) * ENERGY_INCREMENT;
              maxEnergy = Math.max(maxEnergy, fakeRankEnergy);
            }
          }
        }
      });

      return maxEnergy;
    };

    return (
      <div className="overflow-x-auto">
        <Table striped withTableBorder withColumnBorders className="min-w-full">
          <Table.Thead>
            <Table.Tr>
              <Table.Th className="w-24" rowSpan={2}>
                Category
              </Table.Th>
              <Table.Th className="w-24" rowSpan={2}>
                Subcategory
              </Table.Th>
              <Table.Th className="w-64">Scenario</Table.Th>
              <Table.Th className="w-32">High Score</Table.Th>
              <Table.Th className="w-32">Progress</Table.Th>
              <Table.Th className="w-32">
                Energy
                <br />
                <span style={{ fontSize: "0.8em", fontWeight: "normal" }}>
                  Overall: {parseFloat(overallEnergy.toFixed(1)).toString()}
                </span>
              </Table.Th>
              {difficultyRanks[difficulty].map((rank, i) => (
                <Table.Th
                  key={rank}
                  className="w-32"
                  style={{
                    backgroundColor:
                      RANK_COLORS[rank as keyof typeof RANK_COLORS],
                    color: getContrastColor(
                      RANK_COLORS[rank as keyof typeof RANK_COLORS]
                    ),
                  }}
                >
                  {rank}
                  <br />
                  <span style={{ fontSize: "0.8em", fontWeight: "normal" }}>
                    ({startingEnergy + i * ENERGY_INCREMENT} Energy)
                  </span>
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {Object.entries(benchmarkData[difficulty]).map(
              ([category, subcategories]) =>
                Object.entries(subcategories).map(
                  ([subcategory, scenarios], subIdx) => {
                    // Calculate the maximum energy for the subcategory
                    let maxEnergy = 0;

                    Object.entries(scenarios).forEach(
                      ([scenario, thresholds]) => {
                        const scoreData = scores[scenario];
                        if (scoreData && thresholds) {
                          // Add fake rank for energy calculation
                          const rankThresholds = Object.entries(thresholds)
                            .sort(([, a], [, b]) => a - b)
                            .map(([rank, threshold]) => ({ rank, threshold }));

                          const highestRank =
                            rankThresholds[rankThresholds.length - 1];
                          const secondHighestRank =
                            rankThresholds[rankThresholds.length - 2];

                          const fakeRankThreshold =
                            highestRank.threshold +
                            (highestRank.threshold -
                              secondHighestRank.threshold);
                          const fakeRankEnergy =
                            startingEnergy +
                            (rankThresholds.length - 1) * ENERGY_INCREMENT +
                            100;

                          rankThresholds.push({
                            rank: "Fake",
                            threshold: fakeRankThreshold,
                          });

                          // Calculate energy based on progress
                          for (let i = 0; i < rankThresholds.length; i++) {
                            const current = rankThresholds[i];
                            const next = rankThresholds[i + 1];

                            if (scoreData.highScore < current.threshold) {
                              maxEnergy = Math.max(maxEnergy, 0); // Below the first rank
                              break;
                            } else if (
                              next &&
                              scoreData.highScore < next.threshold
                            ) {
                              // Between current and next rank
                              const progress =
                                (scoreData.highScore - current.threshold) /
                                (next.threshold - current.threshold);
                              const energy =
                                startingEnergy +
                                i * ENERGY_INCREMENT +
                                progress * ENERGY_INCREMENT;
                              maxEnergy = Math.max(maxEnergy, energy);
                              break;
                            } else if (!next) {
                              // At or above the highest rank
                              maxEnergy = Math.max(maxEnergy, fakeRankEnergy);
                            }
                          }
                        }
                      }
                    );

                    return Object.entries(scenarios).map(
                      ([scenario, thresholds], scenIdx) => {
                        const scoreData = scores[scenario];
                        const subcategoryColor =
                          SUBCATEGORY_COLORS[subcategory] || "#FFFFFF";
                        const scenarioColor = lightenColor(
                          subcategoryColor,
                          0.5
                        );

                        // Determine progress for this scenario

                        let progress = 0;
                        let nextRankColor = "#FFFFFF";

                        if (scoreData && thresholds) {
                          const rankThresholds = Object.entries(
                            thresholds
                          ).sort(([, a], [, b]) => a - b);

                          // Handle unranked case
                          if (scoreData.highScore < rankThresholds[0][1]) {
                            progress =
                              (scoreData.highScore / rankThresholds[0][1]) *
                              100;
                            nextRankColor =
                              RANK_COLORS[
                                rankThresholds[0][0] as keyof typeof RANK_COLORS
                              ];
                          } else {
                            // Find current rank
                            let currentRankIndex = -1;
                            for (let i = 0; i < rankThresholds.length; i++) {
                              if (scoreData.highScore >= rankThresholds[i][1]) {
                                currentRankIndex = i;
                              }
                            }

                            if (currentRankIndex < rankThresholds.length - 1) {
                              const [_currentRank, currentThreshold] =
                                rankThresholds[currentRankIndex];
                              const [nextRank, nextThreshold] =
                                rankThresholds[currentRankIndex + 1];

                              progress =
                                ((scoreData.highScore - currentThreshold) /
                                  (nextThreshold - currentThreshold)) *
                                100;
                              nextRankColor =
                                RANK_COLORS[
                                  nextRank as keyof typeof RANK_COLORS
                                ];
                            } else {
                              progress = 100;
                              nextRankColor =
                                RANK_COLORS[
                                  rankThresholds[
                                    currentRankIndex
                                  ][0] as keyof typeof RANK_COLORS
                                ];
                            }
                          }
                        }

                        // Determine the rank of the high score
                        let scoreRank = "Unranked";
                        if (scoreData) {
                          for (const [rank, threshold] of Object.entries(
                            thresholds
                          )) {
                            if (scoreData.highScore >= threshold) {
                              scoreRank = rank;
                            }
                          }
                        }

                        const tooltipContent = (
                          <div>
                            <div>
                              <strong>Kills:</strong> {scoreData?.kills || "-"}
                            </div>
                            <div>
                              <strong>Accuracy:</strong>{" "}
                              {scoreData
                                ? `${(
                                    (scoreData.hits /
                                      (scoreData.hits + scoreData.misses)) *
                                    100
                                  ).toFixed(2)}%`
                                : "-"}
                            </div>
                            <Divider my="xs" />
                            <div>
                              <strong>Sensitivity:</strong>{" "}
                              {scoreData?.sens_cm
                                ? scoreData.sens_cm[0] === scoreData.sens_cm[1]
                                  ? `${scoreData.sens_cm[0].toFixed(2)} cm`
                                  : `${scoreData.sens_cm[0].toFixed(
                                      2
                                    )} (H) / ${scoreData.sens_cm[1].toFixed(
                                      2
                                    )} (V)`
                                : "-"}
                            </div>
                            <div>
                              <strong>FOV:</strong>{" "}
                              {scoreData?.fov.toFixed(2) || "-"} (
                              {scoreData?.fov_scale || "-"})
                            </div>
                            <div>
                              <strong>Resolution:</strong>{" "}
                              {scoreData?.resolution || "-"}
                            </div>
                            <div>
                              <strong>Avg FPS:</strong>{" "}
                              {scoreData?.avg_fps.toFixed(2) || "-"}
                            </div>
                            <Divider my="xs" />
                            <div>
                              <strong>Date:</strong>{" "}
                              {scoreData?.date
                                ? formatDate(scoreData.date)
                                : "-"}
                            </div>
                          </div>
                        );

                        return (
                          <Table.Tr
                            key={`${category}-${subcategory}-${scenario}`}
                          >
                            {scenIdx === 0 && subIdx === 0 && (
                              <Table.Td
                                rowSpan={Object.values(subcategories).reduce(
                                  (acc, curr) => acc + Object.keys(curr).length,
                                  0
                                )}
                                style={{
                                  backgroundColor:
                                    CATEGORY_COLORS[category] || "#FFFFFF",
                                  color: getContrastColor(
                                    CATEGORY_COLORS[category] || "#FFFFFF"
                                  ),
                                }}
                                className="font-bold text-center"
                              >
                                {category}
                              </Table.Td>
                            )}
                            {scenIdx === 0 && (
                              <Table.Td
                                rowSpan={Object.keys(scenarios).length}
                                style={{
                                  backgroundColor: subcategoryColor,
                                  color: getContrastColor(subcategoryColor),
                                }}
                                className="font-semibold text-center"
                              >
                                {subcategory}
                              </Table.Td>
                            )}
                            <Table.Td
                              style={{
                                backgroundColor: scenarioColor,
                                color: getContrastColor(scenarioColor),
                              }}
                              className="font-medium"
                            >
                              <Tooltip label={tooltipContent} withArrow>
                                <span>{scenario}</span>
                              </Tooltip>
                            </Table.Td>
                            {/* High Score Column */}
                            <Table.Td
                              className="w-32 text-center"
                              style={{
                                backgroundColor:
                                  scoreRank !== "Unranked"
                                    ? RANK_COLORS[
                                        scoreRank as keyof typeof RANK_COLORS
                                      ]
                                    : "#FFFFFF",
                                color:
                                  scoreRank !== "Unranked"
                                    ? getContrastColor(
                                        RANK_COLORS[
                                          scoreRank as keyof typeof RANK_COLORS
                                        ]
                                      )
                                    : "#000",
                              }}
                            >
                              {scoreData
                                ? parseFloat(scoreData.highScore.toFixed(2))
                                    .toString()
                                    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                                : "-"}
                            </Table.Td>
                            {/* Progress Column */}
                            <Table.Td className="w-32 text-center">
                              <div
                                style={{
                                  height: "20px",
                                  width: "100%",
                                  backgroundColor: lightenColor(
                                    nextRankColor,
                                    0.75
                                  ),
                                  position: "relative",
                                  borderRadius: "5px",
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    height: "100%",
                                    width: `${progress}%`,
                                    backgroundColor: nextRankColor,
                                  }}
                                ></div>
                              </div>
                            </Table.Td>
                            {/* Energy Column */}
                            {scenIdx === 0 && (
                              <Table.Td
                                rowSpan={Object.keys(scenarios).length}
                                className="w-32 text-center"
                                style={{
                                  backgroundColor: lightenColor(
                                    RANK_COLORS[
                                      scoreRank as keyof typeof RANK_COLORS
                                    ] || "#FFFFFF",
                                    0.5
                                  ),
                                  color: getContrastColor(
                                    lightenColor(
                                      RANK_COLORS[
                                        scoreRank as keyof typeof RANK_COLORS
                                      ] || "#FFFFFF",
                                      0.5
                                    )
                                  ),
                                }}
                              >
                                {Math.floor(
                                  calculateSubcategoryEnergy(
                                    scenarios,
                                    scores,
                                    startingEnergy
                                  )
                                ).toLocaleString()}
                              </Table.Td>
                            )}
                            {/* Rank Threshold Columns */}
                            {difficultyRanks[difficulty].map((rank) => (
                              <Table.Td
                                key={rank}
                                className="w-32 text-center"
                                style={{
                                  backgroundColor: lightenColor(
                                    RANK_COLORS[
                                      rank as keyof typeof RANK_COLORS
                                    ],
                                    0.5
                                  ),
                                  color: getContrastColor(
                                    lightenColor(
                                      RANK_COLORS[
                                        rank as keyof typeof RANK_COLORS
                                      ],
                                      0.5
                                    )
                                  ),
                                }}
                              >
                                {thresholds[rank]
                                  ? thresholds[rank].toLocaleString()
                                  : "-"}
                              </Table.Td>
                            ))}
                          </Table.Tr>
                        );
                      }
                    );
                  }
                )
            )}
          </Table.Tbody>
        </Table>
        {renderOverallRank(difficulty, overallEnergy)}
      </div>
    );
  };

  return (
    <Stack className="p-4">
      <Title order={2}>VT Benchmark Tracker</Title>

      <Tabs defaultValue="Novice">
        <Tabs.List>
          {Object.keys(difficultyRanks).map((difficulty) => (
            <Tabs.Tab key={difficulty} value={difficulty}>
              {difficulty}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {Object.keys(difficultyRanks).map((difficulty) => (
          <Tabs.Panel key={difficulty} value={difficulty}>
            {renderTable(difficulty as Difficulty)}
          </Tabs.Panel>
        ))}
      </Tabs>
      <div className="flex justify-center mb-4">
        <Button
          onClick={refreshScores}
          variant="outline"
          color="blue"
          radius="md"
          size="md"
        >
          Refresh Scores [R]
        </Button>
      </div>
    </Stack>
  );
}

const lightenColor = (color: string, percent: number) => {
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

const getContrastColor = (color: string) => {
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

// Helper function to calculate starting energy for each difficulty
const calculateStartingEnergy = (
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

const calculateHarmonicMean = (values: number[], expectedCount: number) => {
  if (values.length !== expectedCount || values.some((v) => v === 0)) return 0;
  const reciprocalSum = values.reduce((sum, value) => sum + 1 / value, 0);
  return values.length / reciprocalSum;
};

const calculateOverallRank = (
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

const isRankComplete = (
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

// Format tooltip content
const formatDate = (dateString: string) => {
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
