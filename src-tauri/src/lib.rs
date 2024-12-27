use std::path::PathBuf;
use tauri_plugin_window_state::WindowExt;
use winreg::enums::*;
use winreg::RegKey;
use std::fs;
use serde::Serialize;
use std::collections::HashMap;
use tauri::Manager;
use tauri_plugin_window_state::AppHandleExt;

#[derive(Debug, Serialize, Clone)]
struct StatsResult {
    scenario_name: String,
    score: f64,
    kills: i32,
    hits: i32,
    misses: i32,
    fov_scale: String,
    fov: f64,
    resolution: String,
    avg_fps: f64,
    sens_cm: Option<(f64, f64)>,  // (horiz, vert) if using cm/360
    date: String
}

#[derive(Debug, Serialize)]
struct PathResult {
    stats_path: String,
    exists: bool,
    stats: Vec<StatsResult>
}

fn parse_csv_file(path: &PathBuf) -> Option<StatsResult> {
    let content = fs::read_to_string(path).ok()?;
    let lines = content.lines();

    let filename = path.file_name()?.to_str()?;
    let parts: Vec<&str> = filename.split(" - ").collect();
    let scenario_name = parts.first()?.to_string();
    let date_part = parts.get(2)?;
    let date = date_part.replace(" Stats.csv", "");

    let mut score = 0.0;
    let mut kills = 0;
    let mut hits = 0;
    let mut misses = 0;
    let mut fov_scale = String::new();
    let mut fov = 0.0;
    let mut resolution = String::new();
    let mut avg_fps = 0.0;
    let mut sens_scale = String::new();
    let mut horiz_sens = 0.0;
    let mut vert_sens = 0.0;

    for line in lines {
        let parts: Vec<&str> = line.split(':').collect();
        if parts.len() != 2 { continue; }

        let key = parts[0].trim();
        let value = parts[1].trim();

        match key {
            "Score" => score = value.trim_start_matches(',').parse().unwrap_or(0.0),
            "Kills" => kills = value.trim_start_matches(',').parse().unwrap_or(0),
            "Hit Count" => hits = value.trim_start_matches(',').parse().unwrap_or(0),
            "Miss Count" => misses = value.trim_start_matches(',').parse().unwrap_or(0),
            "FOVScale" => fov_scale = value.trim_start_matches(',').to_string(),
            "FOV" => fov = value.trim_start_matches(',').parse().unwrap_or(0.0),
            "Resolution" => resolution = value.trim_start_matches(',').to_string(),
            "Avg FPS" => avg_fps = value.trim_start_matches(',').parse().unwrap_or(0.0),
            "Sens Scale" => sens_scale = value.trim_start_matches(',').to_string(),
            "Horiz Sens" => horiz_sens = value.trim_start_matches(',').parse().unwrap_or(0.0),
            "Vert Sens" => vert_sens = value.trim_start_matches(',').parse().unwrap_or(0.0),
            _ => {}
        }
    }

    let sens_cm = if sens_scale == "cm/360" {
        Some((horiz_sens, vert_sens))
    } else {
        None
    };

    Some(StatsResult {
        scenario_name,
        score,
        kills,
        hits,
        misses,
        fov_scale,
        fov,
        resolution,
        avg_fps,
        sens_cm,
        date
    })
}

fn get_steam_library_paths(install_path: &str) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let library_file = PathBuf::from(install_path)
        .join("steamapps")
        .join("libraryfolders.vdf");

    if let Ok(content) = fs::read_to_string(&library_file) {
        for line in content.lines() {
            if let Some(path) = line.split('"').nth(3) {
                let library_path = PathBuf::from(path).join("steamapps");
                paths.push(library_path);
            }
        }
    }

    // Add the default library path as well
    paths.push(PathBuf::from(install_path).join("steamapps"));

    paths
}


#[tauri::command]
fn get_stats(scenarios: Vec<String>) -> Result<PathResult, String> {
    #[cfg(target_os = "windows")]
    {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let steam_key = hklm
            .open_subkey(r"SOFTWARE\WOW6432Node\Valve\Steam")
            .or_else(|_| hklm.open_subkey(r"SOFTWARE\Valve\Steam"))
            .map_err(|e| format!("Failed to find Steam registry key: {}", e))?;

        let install_path: String = steam_key
            .get_value("InstallPath")
            .map_err(|e| format!("Failed to get Steam install path: {}", e))?;

        let library_paths = get_steam_library_paths(&install_path);

        // Temp fallback path for testing
        let fallback_path = PathBuf::from(r"S:\SteamLibrary\steamapps\common\FPSAimTrainer\FPSAimTrainer\stats");
        let mut all_paths = library_paths.clone();
        all_paths.push(fallback_path);

        for library_path in library_paths {
            let stats_path = library_path.join("common/FPSAimTrainer/FPSAimTrainer/stats");

            if stats_path.exists() {
                let mut stats = Vec::new();
                let mut scenario_highscores: HashMap<String, StatsResult> = HashMap::new();

                if let Ok(entries) = fs::read_dir(&stats_path) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.extension().and_then(|s| s.to_str()) == Some("csv") {
                            if let Some(filename) = path.file_name().and_then(|s| s.to_str()) {
                                if scenarios.iter().any(|scenario| filename.starts_with(scenario)) {
                                    if let Some(stat) = parse_csv_file(&path) {
                                        let entry = scenario_highscores.entry(stat.scenario_name.clone()).or_insert(stat.clone());
                                        if stat.score > entry.score {
                                            *entry = stat;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                for (_, stat) in scenario_highscores {
                    stats.push(stat);
                }

                return Ok(PathResult {
                    stats_path: stats_path.to_string_lossy().into_owned(),
                    exists: true,
                    stats
                });
            }
        }

        Ok(PathResult {
            stats_path: "No stats path found".into(),
            exists: false,
            stats: Vec::new()
        })
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|_| "Could not find HOME directory")?;
        let steam_paths = vec![
            format!("{}/.local/share/Steam", home),
            format!("{}/.steam/steam", home),
        ];

        for base_path in steam_paths {
            let mut stats_path = PathBuf::from(&base_path);
            stats_path.push("steamapps/common/FPSAimTrainer/FPSAimTrainer/stats");

            if stats_path.exists() {
                let mut stats = Vec::new();
                let mut scenario_highscores: HashMap<String, StatsResult> = HashMap::new();

                if let Ok(entries) = fs::read_dir(&stats_path) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.extension().and_then(|s| s.to_str()) == Some("csv") {
                            if let Some(filename) = path.file_name().and_then(|s| s.to_str()) {
                                if scenarios.iter().any(|scenario| filename.starts_with(scenario)) {
                                    if let Some(stat) = parse_csv_file(&path) {
                                        let entry = scenario_highscores.entry(stat.scenario_name.clone()).or_insert(stat.clone());
                                        if stat.score > entry.score {
                                            *entry = stat;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                for (_, stat) in scenario_highscores {
                    stats.push(stat);
                }

                return Ok(PathResult {
                    stats_path: stats_path.to_string_lossy().into_owned(),
                    exists: true,
                    stats
                });
            }
        }

        Ok(PathResult {
            stats_path: format!("{}/.steam/steam/steamapps/common/FPSAimTrainer/FPSAimTrainer/stats", home),
            exists: false,
            stats: Vec::new()
        })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build()) 
        .plugin(tauri_plugin_opener::init()) 
        .invoke_handler(tauri::generate_handler![get_stats])
        .setup(|app| {
            // Restore window state for the main window at startup
            if let Some(window) = app.get_webview_window("main") {
                use tauri_plugin_window_state::StateFlags;
                window.restore_state(StateFlags::all()).unwrap_or_else(|err| {
                    println!("Failed to restore main window state: {}", err);
                });
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                use tauri_plugin_window_state::StateFlags;

                // Save window state before closing
                let app_handle = window.app_handle();
                app_handle.save_window_state(StateFlags::all()).unwrap_or_else(|err| {
                    println!("Failed to save window state: {}", err);
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
