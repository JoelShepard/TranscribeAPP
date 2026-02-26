use std::sync::Mutex;

#[cfg(desktop)]
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use std::{io::Cursor, sync::Arc};

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use cpal::{
    traits::{DeviceTrait, HostTrait, StreamTrait},
    SampleFormat, Stream, SupportedStreamConfig,
};

#[cfg(not(any(target_os = "android", target_os = "ios")))]
struct NativeRecorder {
    stop_tx: std::sync::mpsc::Sender<()>,
    worker: Option<std::thread::JoinHandle<()>>,
    samples: Arc<Mutex<Vec<f32>>>,
    sample_rate: u32,
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[derive(Default)]
struct RecorderState {
    recorder: Mutex<Option<NativeRecorder>>,
}

#[cfg(any(target_os = "android", target_os = "ios"))]
#[derive(Default)]
struct RecorderState;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn push_f32_samples(data: &[f32], channels: usize, samples: &Arc<Mutex<Vec<f32>>>) {
    if channels == 0 || data.is_empty() {
        return;
    }

    let mut captured = match samples.lock() {
        Ok(guard) => guard,
        Err(err) => {
            log::error!("[NativeRecorder] Failed to lock sample buffer: {err}");
            return;
        }
    };

    for frame in data.chunks(channels) {
        let frame_sum: f32 = frame.iter().copied().sum();
        captured.push(frame_sum / frame.len() as f32);
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn push_i16_samples(data: &[i16], channels: usize, samples: &Arc<Mutex<Vec<f32>>>) {
    if channels == 0 || data.is_empty() {
        return;
    }

    let mut captured = match samples.lock() {
        Ok(guard) => guard,
        Err(err) => {
            log::error!("[NativeRecorder] Failed to lock sample buffer: {err}");
            return;
        }
    };

    for frame in data.chunks(channels) {
        let frame_sum: f32 = frame
            .iter()
            .map(|sample| (*sample as f32) / (i16::MAX as f32))
            .sum();
        captured.push(frame_sum / frame.len() as f32);
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn push_u16_samples(data: &[u16], channels: usize, samples: &Arc<Mutex<Vec<f32>>>) {
    if channels == 0 || data.is_empty() {
        return;
    }

    let mut captured = match samples.lock() {
        Ok(guard) => guard,
        Err(err) => {
            log::error!("[NativeRecorder] Failed to lock sample buffer: {err}");
            return;
        }
    };

    for frame in data.chunks(channels) {
        let frame_sum: f32 = frame
            .iter()
            .map(|sample| ((*sample as f32) / (u16::MAX as f32)) * 2.0 - 1.0)
            .sum();
        captured.push(frame_sum / frame.len() as f32);
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn build_native_input_stream(
    device: &cpal::Device,
    config: &SupportedStreamConfig,
    samples: Arc<Mutex<Vec<f32>>>,
) -> Result<Stream, String> {
    let stream_config = config.config();
    let channels = usize::from(stream_config.channels.max(1));

    match config.sample_format() {
        SampleFormat::F32 => {
            let callback_samples = Arc::clone(&samples);
            device
                .build_input_stream(
                    &stream_config,
                    move |data: &[f32], _| {
                        push_f32_samples(data, channels, &callback_samples);
                    },
                    |err| {
                        log::error!("[NativeRecorder] Input stream error: {err}");
                    },
                    None,
                )
                .map_err(|err| format!("Unable to create f32 input stream: {err}"))
        }
        SampleFormat::I16 => {
            let callback_samples = Arc::clone(&samples);
            device
                .build_input_stream(
                    &stream_config,
                    move |data: &[i16], _| {
                        push_i16_samples(data, channels, &callback_samples);
                    },
                    |err| {
                        log::error!("[NativeRecorder] Input stream error: {err}");
                    },
                    None,
                )
                .map_err(|err| format!("Unable to create i16 input stream: {err}"))
        }
        SampleFormat::U16 => {
            let callback_samples = Arc::clone(&samples);
            device
                .build_input_stream(
                    &stream_config,
                    move |data: &[u16], _| {
                        push_u16_samples(data, channels, &callback_samples);
                    },
                    |err| {
                        log::error!("[NativeRecorder] Input stream error: {err}");
                    },
                    None,
                )
                .map_err(|err| format!("Unable to create u16 input stream: {err}"))
        }
        sample_format => Err(format!("Unsupported audio input format: {sample_format:?}")),
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn encode_wav_bytes(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>, String> {
    let wav_spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut output = Cursor::new(Vec::<u8>::new());
    let mut writer = hound::WavWriter::new(&mut output, wav_spec)
        .map_err(|err| format!("Failed to initialize WAV writer: {err}"))?;

    for sample in samples {
        let clamped = sample.clamp(-1.0, 1.0);
        let quantized = (clamped * (i16::MAX as f32)) as i16;
        writer
            .write_sample(quantized)
            .map_err(|err| format!("Failed while writing WAV samples: {err}"))?;
    }

    writer
        .finalize()
        .map_err(|err| format!("Failed to finalize WAV audio: {err}"))?;

    Ok(output.into_inner())
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
fn start_native_recording(state: tauri::State<'_, RecorderState>) -> Result<(), String> {
    let mut recorder = state
        .inner()
        .recorder
        .lock()
        .map_err(|_| "Failed to lock native recorder state.".to_string())?;

    if recorder.is_some() {
        return Err("A native recording session is already running.".to_string());
    }

    let samples = Arc::new(Mutex::new(Vec::<f32>::new()));
    let (stop_tx, stop_rx) = std::sync::mpsc::channel::<()>();
    let (ready_tx, ready_rx) = std::sync::mpsc::channel::<Result<u32, String>>();

    let worker_samples = Arc::clone(&samples);
    let worker = std::thread::spawn(move || {
        let setup_result = (|| -> Result<(Stream, u32), String> {
            let host = cpal::default_host();
            let device = host
                .default_input_device()
                .ok_or_else(|| "No audio input device found.".to_string())?;

            let supported_config = device
                .default_input_config()
                .map_err(|err| format!("Failed to read default input config: {err}"))?;

            let sample_rate = supported_config.sample_rate().0;
            let stream = build_native_input_stream(&device, &supported_config, worker_samples)?;

            stream
                .play()
                .map_err(|err| format!("Failed to start input stream: {err}"))?;

            Ok((stream, sample_rate))
        })();

        match setup_result {
            Ok((stream, sample_rate)) => {
                let _ = ready_tx.send(Ok(sample_rate));

                if stop_rx.recv().is_err() {
                    log::warn!("[NativeRecorder] Stop signal channel closed unexpectedly.");
                }

                drop(stream);
            }
            Err(err) => {
                let _ = ready_tx.send(Err(err));
            }
        }
    });

    let sample_rate = ready_rx
        .recv()
        .map_err(|_| "Native recorder thread failed to initialize.".to_string())??;

    log::info!(
        "[NativeRecorder] Recording started with sample rate {} Hz",
        sample_rate
    );

    *recorder = Some(NativeRecorder {
        stop_tx,
        worker: Some(worker),
        samples,
        sample_rate,
    });

    Ok(())
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
fn stop_native_recording(state: tauri::State<'_, RecorderState>) -> Result<Vec<u8>, String> {
    let mut recorder = state
        .inner()
        .recorder
        .lock()
        .map_err(|_| "Failed to lock native recorder state.".to_string())?;

    let mut native_recorder = recorder
        .take()
        .ok_or_else(|| "No native recording session is running.".to_string())?;

    drop(recorder);

    native_recorder
        .stop_tx
        .send(())
        .map_err(|_| "Failed to signal native recorder thread to stop.".to_string())?;

    if let Some(worker) = native_recorder.worker.take() {
        worker
            .join()
            .map_err(|_| "Native recorder thread panicked.".to_string())?;
    }

    let captured_samples = native_recorder
        .samples
        .lock()
        .map_err(|_| "Failed to lock native sample buffer.".to_string())?
        .clone();

    if captured_samples.is_empty() {
        return Err("No audio was captured. Please try again.".to_string());
    }

    log::info!(
        "[NativeRecorder] Recording stopped. Captured {} mono samples",
        captured_samples.len()
    );

    encode_wav_bytes(&captured_samples, native_recorder.sample_rate)
}

#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
fn start_native_recording(_state: tauri::State<'_, RecorderState>) -> Result<(), String> {
    Err("Native recording is not available on this platform.".to_string())
}

#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
fn stop_native_recording(_state: tauri::State<'_, RecorderState>) -> Result<Vec<u8>, String> {
    Err("Native recording is not available on this platform.".to_string())
}

#[cfg(desktop)]
fn toggle_main_window(app_handle: &tauri::AppHandle) {
    let Some(window) = app_handle.get_webview_window("main") else {
        log::warn!("[Tray] Main window not found while toggling visibility");
        return;
    };

    match window.is_visible() {
        Ok(true) => {
            if let Err(err) = window.hide() {
                log::error!("[Tray] Failed to hide window: {err}");
            }
        }
        Ok(false) => {
            if let Err(err) = window.show() {
                log::error!("[Tray] Failed to show window: {err}");
                return;
            }

            if let Err(err) = window.set_focus() {
                log::warn!("[Tray] Failed to focus window: {err}");
            }
        }
        Err(err) => {
            log::error!("[Tray] Failed to read window visibility: {err}");
        }
    }
}

/// Makes an HTTP request to the DeepL API from the Rust side.
/// This bypasses the WebKit2GTK CORS restrictions that block DeepL in the
/// Tauri webview (DeepL does not send Access-Control-Allow-Origin headers).
#[tauri::command]
async fn deepl_request(
    url: String,
    method: String,
    headers: std::collections::HashMap<String, String>,
    body: Option<String>,
) -> Result<serde_json::Value, String> {
    use reqwest::header::{HeaderMap, HeaderName, HeaderValue};

    let client = reqwest::Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| format!("[deepl_request] Failed to build HTTP client: {e}"))?;

    let mut header_map = HeaderMap::new();
    for (k, v) in &headers {
        let name = HeaderName::from_bytes(k.as_bytes())
            .map_err(|e| format!("[deepl_request] Invalid header name '{k}': {e}"))?;
        let value = HeaderValue::from_str(v)
            .map_err(|e| format!("[deepl_request] Invalid header value for '{k}': {e}"))?;
        header_map.insert(name, value);
    }

    let req_builder = match method.to_uppercase().as_str() {
        "GET" => client.get(&url).headers(header_map),
        "POST" => {
            let mut b = client.post(&url).headers(header_map);
            if let Some(body_str) = body {
                b = b.body(body_str);
            }
            b
        }
        other => {
            return Err(format!(
                "[deepl_request] Unsupported HTTP method: {other}"
            ))
        }
    };

    let resp = req_builder
        .send()
        .await
        .map_err(|e| format!("[deepl_request] Request failed: {e}"))?;

    let status = resp.status().as_u16();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("[deepl_request] Failed to read response body: {e}"))?;

    Ok(serde_json::json!({ "status": status, "body": text }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RecorderState::default())
        .invoke_handler(tauri::generate_handler![
            start_native_recording,
            stop_native_recording,
            deepl_request
        ])
        .setup(|app| {
            let log_level = if cfg!(debug_assertions) {
                log::LevelFilter::Debug
            } else {
                log::LevelFilter::Info
            };

            #[cfg(desktop)]
            if let Err(err) = app.handle().remove_menu() {
                log::warn!("[AppSetup] Failed to remove native window menu: {err}");
            }

            #[cfg(desktop)]
            {
                let toggle_item = MenuItemBuilder::with_id("toggle-window", "Show/Hide")
                    .build(app)
                    .map_err(|err| {
                        log::error!("[Tray] Failed to build toggle menu item: {err}");
                        err
                    })?;

                let quit_item = MenuItemBuilder::with_id("quit-app", "Quit")
                    .build(app)
                    .map_err(|err| {
                        log::error!("[Tray] Failed to build quit menu item: {err}");
                        err
                    })?;

                let tray_menu = MenuBuilder::new(app)
                    .items(&[&toggle_item, &quit_item])
                    .build()
                    .map_err(|err| {
                        log::error!("[Tray] Failed to build tray menu: {err}");
                        err
                    })?;

                TrayIconBuilder::with_id("main-tray")
                    .menu(&tray_menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app_handle, event| match event.id.as_ref() {
                        "toggle-window" => toggle_main_window(app_handle),
                        "quit-app" => app_handle.exit(0),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            toggle_main_window(tray.app_handle());
                        }
                    })
                    .build(app)
                    .map_err(|err| {
                        log::error!("[Tray] Failed to create system tray icon: {err}");
                        err
                    })?;
            }

            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log_level)
                    .max_file_size(2_000_000)
                    .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(5))
                    .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                    .targets([
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                            file_name: Some("transcribejs".to_string()),
                        }),
                    ])
                    .build(),
            )?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
