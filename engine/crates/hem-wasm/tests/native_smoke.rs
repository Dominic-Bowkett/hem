use std::io::{Cursor, Write};
use std::sync::{Arc, Mutex};

use hem::output::Output;
use hem::{run_project, ProjectFlags};

const DEMO_INPUT: &str =
    include_str!("../../../../web/public/examples/demo_24hrs_august.json");
const MID_TERRACE_INPUT: &str =
    include_str!("../../../../web/public/examples/mid_terrace_post_1990.json");

fn run_and_check(label: &str, input: &str, required_columns: &[&str]) {
    let capture = CaptureOutput::default();
    let flags = ProjectFlags::empty();
    let response = run_project(
        Cursor::new(input.as_bytes().to_vec()),
        &capture,
        None,
        None,
        &flags,
    )
    .unwrap_or_else(|e| panic!("{label}: HEM run should not error: {e:?}"));

    assert!(
        response.is_none(),
        "{label}: Passthrough wrapper should not populate HemResponse; \
         if upstream changes this, decide whether to surface it via the wasm wrapper."
    );

    let files = capture.into_files();
    let results = files
        .iter()
        .find(|(name, _)| name == "results.csv")
        .map(|(_, bytes)| bytes.clone())
        .unwrap_or_else(|| panic!("{label}: engine must write a results.csv"));

    let newline = results.iter().position(|&b| b == b'\n').unwrap_or(results.len());
    let header = String::from_utf8_lossy(&results[..newline]);
    for column in required_columns {
        assert!(
            header.contains(column),
            "{label}: results.csv header missing column {column:?}; got:\n{header}"
        );
    }
}

#[test]
fn engine_runs_demo_input() {
    run_and_check(
        "demo",
        DEMO_INPUT,
        &[
            "Timestep",
            "DHW: demand volume",
            "zone 1: space heat demand",
            "main: energy output",
        ],
    );
}

#[test]
fn engine_runs_mid_terrace_template() {
    run_and_check(
        "mid_terrace",
        MID_TERRACE_INPUT,
        &[
            "Timestep",
            "DHW: demand volume",
            "zone 1: space heat demand",
            "main: energy output",
            "mains gas: boiler_water_heating",
            "mains gas: boiler_space_heating: main",
        ],
    );
}

#[derive(Debug, Default)]
struct CaptureOutput {
    files: Arc<Mutex<Vec<(String, Vec<u8>)>>>,
}

impl CaptureOutput {
    fn into_files(self) -> Vec<(String, Vec<u8>)> {
        Arc::try_unwrap(self.files)
            .map(|m| m.into_inner().unwrap())
            .unwrap_or_else(|arc| arc.lock().unwrap().clone())
    }
}

impl Output for &CaptureOutput {
    fn writer_for_location_key(
        &self,
        location_key: &str,
        file_extension: &str,
    ) -> anyhow::Result<impl Write> {
        Ok(CaptureWriter {
            files: self.files.clone(),
            name: format!("{location_key}.{file_extension}"),
            buf: Vec::new(),
        })
    }
}

struct CaptureWriter {
    files: Arc<Mutex<Vec<(String, Vec<u8>)>>>,
    name: String,
    buf: Vec<u8>,
}

impl Write for CaptureWriter {
    fn write(&mut self, b: &[u8]) -> std::io::Result<usize> {
        self.buf.extend_from_slice(b);
        Ok(b.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl Drop for CaptureWriter {
    fn drop(&mut self) {
        if let Ok(mut files) = self.files.lock() {
            files.push((std::mem::take(&mut self.name), std::mem::take(&mut self.buf)));
        }
    }
}
