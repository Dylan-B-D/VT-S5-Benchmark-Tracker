import { useEffect, useState } from "react";
import {
  Table,
  Text,
  Stack,
  Tabs,
  Tooltip,
  Divider,
  Badge,
  ActionIcon,
  Switch,
} from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { useHotkeys } from "@mantine/hooks";
import {
  BenchmarkData,
  BenchmarkState,
  Category,
  CATEGORY_COLORS,
  Difficulty,
  ENERGY_INCREMENT,
  RANK_COLORS,
  StatsResult,
  Subcategory,
  SUBCATEGORY_COLORS,
} from "./models";
import {
  calculateHarmonicMean,
  calculateOverallRank,
  calculateStartingEnergy,
  calculateSubcategoryEnergy,
  formatDate,
  getContrastColor,
  isRankComplete,
  lightenColor,
} from "./utils";
import { IoMdRefreshCircle } from "react-icons/io";

export default function App() {
  const [showSimplifiedNames, setShowSimplifiedNames] = useState(false);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(
    null
  );
  const [scores, setScores] = useState<BenchmarkState>({});
  const [difficultyRanks, setDifficultyRanks] = useState<{
    [key: string]: string[];
  }>({});

  const calculateOverallRankForTab = (difficulty: Difficulty): number => {
    const startingEnergy = calculateStartingEnergy(difficulty, difficultyRanks);

    const subcategoryEnergies: number[] = [];
    if (!benchmarkData) return 0;

    const totalSubcategories = Object.keys(benchmarkData[difficulty]).reduce(
      (acc, category) =>
        acc + Object.keys(benchmarkData[difficulty][category]).length,
      0
    );

    Object.entries(benchmarkData[difficulty]).forEach(([, subcategories]) => {
      Object.entries(subcategories).forEach(([, scenarios]) => {
        const energy = calculateSubcategoryEnergy(
          scenarios,
          scores,
          startingEnergy
        );
        subcategoryEnergies.push(energy);
      });
    });

    return calculateHarmonicMean(subcategoryEnergies, totalSubcategories);
  };

  const simplifyScenarioName = (name: string): string => {
    if (!showSimplifiedNames) return name;

    // Strip "VT " from the start and " Difficulty S5" from the end
    return name.replace(/^VT\s/, "").replace(/\s\w+\sS5$/, "");
  };

  useEffect(() => {
    const savedState = localStorage.getItem("simplifiedNames");
    if (savedState !== null) {
      setShowSimplifiedNames(savedState === "true");
    }
  }, []);

  const toggleSimplifiedNames = (checked: boolean) => {
    setShowSimplifiedNames(checked);
    localStorage.setItem("simplifiedNames", checked.toString());
  };

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

  useHotkeys([["r", refreshScores]]);

  const usePersistedTab = () => {
    const [activeTab, setActiveTab] = useState<string>("Novice");

    // Load the persisted tab state from localStorage on mount
    useEffect(() => {
      const savedTab = localStorage.getItem("activeTab");
      if (savedTab) {
        setActiveTab(savedTab);
      }
    }, []);

    // Update the tab state and persist it to localStorage
    const updateTab = (newTab: string) => {
      setActiveTab(newTab);
      localStorage.setItem("activeTab", newTab);
    };

    return [activeTab, updateTab] as const;
  };

  const [activeTab, setActiveTab] = usePersistedTab();

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
      <div className="flex justify-center">
        <Badge
          color={backgroundColor}
          variant="light"
          size="lg"
          className="flex items-center gap-2"
        >
          <span>{overallRank}</span>
          {rankComplete && overallRank !== "Unranked" && <span> Complete</span>}
          <span className="ml-2 text-base">{overallEnergy.toFixed(1)}</span>
        </Badge>
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
        const energy = calculateSubcategoryEnergy(
          scenarios,
          scores,
          startingEnergy
        );
        subcategoryEnergies.push(energy);
      });
    });

    const overallEnergy = calculateHarmonicMean(
      subcategoryEnergies,
      totalSubcategories
    );

    return (
      <div className="overflow-x-auto">
        <Table withTableBorder withColumnBorders className="min-w-full">
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
                    ({(startingEnergy + i * ENERGY_INCREMENT).toLocaleString()}{" "}
                    Energy)
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

                        // Calculate the subcategory energy
                        const subcategoryEnergy = calculateSubcategoryEnergy(
                          scenarios,
                          scores,
                          startingEnergy
                        );

                        const subcategoryRank = calculateOverallRank(
                          subcategoryEnergy,
                          difficulty,
                          difficultyRanks
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
                                <span>{simplifyScenarioName(scenario)}</span>
                              </Tooltip>
                            </Table.Td>
                            {/* High Score Column */}
                            <Table.Td
                              className="w-32 text-center"
                              style={{
                                backgroundColor:
                                  scoreRank === "Unranked"
                                    ? "none"
                                    : RANK_COLORS[
                                        scoreRank as keyof typeof RANK_COLORS
                                      ],
                                color:
                                  scoreRank === "Unranked"
                                    ? "#FFFFFF"
                                    : getContrastColor(
                                        RANK_COLORS[
                                          scoreRank as keyof typeof RANK_COLORS
                                        ]
                                      ),
                              }}
                            >
                              {scoreData
                                ? parseFloat(scoreData.highScore.toFixed(2))
                                    .toString()
                                    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                                : "-"}
                            </Table.Td>
                            {/* Progress Column */}
                            <Table.Td className="w-32 text-center p-0 m-0">
                              <div
                                style={{
                                  height: "36px",
                                  width: "100%",
                                  backgroundColor: lightenColor(
                                    nextRankColor,
                                    0.75
                                  ),
                                  position: "relative",
                                  borderRadius: "0px",
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
                                  backgroundColor:
                                    subcategoryRank === "Unranked"
                                      ? "none"
                                      : lightenColor(
                                          RANK_COLORS[
                                            subcategoryRank as keyof typeof RANK_COLORS
                                          ] || "#FFFFFF",
                                          0.5
                                        ),
                                  color:
                                    subcategoryRank === "Unranked"
                                      ? "#FFFFFF"
                                      : getContrastColor(
                                          lightenColor(
                                            RANK_COLORS[
                                              subcategoryRank as keyof typeof RANK_COLORS
                                            ] || "#FFFFFF",
                                            0.5
                                          )
                                        ),
                                }}
                              >
                                {Math.floor(subcategoryEnergy).toLocaleString()}
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
      </div>
    );
  };

  return (
    <Stack className="p-4">
      <div className="flex justify-between items-center">
        {/* Render Overall Rank */}
        <div>
          {renderOverallRank(
            activeTab as Difficulty,
            calculateOverallRankForTab(activeTab as Difficulty)
          )}
        </div>
        {/* Refresh Button */}
        <Tooltip label="Refresh (R)" withArrow>
          <ActionIcon
            onClick={refreshScores}
            variant="light"
            color="blue"
            radius="xl"
            size="lg"
          >
            <IoMdRefreshCircle size={28} />
          </ActionIcon>
        </Tooltip>
        <Switch
          label={"Simplify Names"}
          checked={showSimplifiedNames}
          onChange={(e) => toggleSimplifiedNames(e.currentTarget.checked)}
        />
      </div>

      <Divider my="0" />

      {/* Render Tabs */}
      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value as string)}
      >
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
    </Stack>
  );
}
