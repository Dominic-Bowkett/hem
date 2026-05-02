use std::io::{Cursor, Write};
use std::sync::{Arc, Mutex};

use hem::output::Output;
use hem::{run_project, ProjectFlags};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn hem_version() -> String {
    hem::HEM_VERSION.to_string()
}

#[wasm_bindgen]
pub fn run(input_json: &str) -> Result<String, JsError> {
    let input = Cursor::new(input_json.as_bytes().to_vec());
    let output = MemOutput::default();
    let flags = ProjectFlags::empty();

    let response = run_project(input, &output, None, None, &flags)
        .map_err(|e| JsError::new(&format!("HEM run failed: {e:?}")))?;

    let payload = serde_json::json!({
        "hem_version": hem::HEM_VERSION,
        "response": response,
        "files": output.into_files(),
    });

    serde_json::to_string(&payload).map_err(|e| JsError::new(&e.to_string()))
}

#[derive(Debug, Default, Clone)]
struct MemOutput {
    files: Arc<Mutex<Vec<MemFile>>>,
}

#[derive(Debug)]
struct MemFile {
    key: String,
    extension: String,
    bytes: Vec<u8>,
}

impl MemOutput {
    fn into_files(self) -> serde_json::Value {
        let files = self.files.lock().unwrap();
        let mut out = serde_json::Map::new();
        for f in files.iter() {
            let name = format!("{}.{}", f.key, f.extension);
            let s = String::from_utf8_lossy(&f.bytes).to_string();
            out.insert(name, serde_json::Value::String(s));
        }
        serde_json::Value::Object(out)
    }
}

impl Output for &MemOutput {
    fn writer_for_location_key(
        &self,
        location_key: &str,
        file_extension: &str,
    ) -> anyhow::Result<impl Write> {
        Ok(MemWriter {
            files: self.files.clone(),
            key: location_key.to_string(),
            extension: file_extension.to_string(),
            buf: Vec::new(),
        })
    }
}

struct MemWriter {
    files: Arc<Mutex<Vec<MemFile>>>,
    key: String,
    extension: String,
    buf: Vec<u8>,
}

impl Write for MemWriter {
    fn write(&mut self, b: &[u8]) -> std::io::Result<usize> {
        self.buf.extend_from_slice(b);
        Ok(b.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl Drop for MemWriter {
    fn drop(&mut self) {
        if let Ok(mut files) = self.files.lock() {
            files.push(MemFile {
                key: std::mem::take(&mut self.key),
                extension: std::mem::take(&mut self.extension),
                bytes: std::mem::take(&mut self.buf),
            });
        }
    }
}
