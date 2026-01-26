"""
KMGI Radio Automation - Windows GUI Launcher

A simple launcher window for managing KMGI on Windows.
Double-click this file to open.
"""

import os
import sys
import subprocess
import threading
import webbrowser
from pathlib import Path

# Check for tkinter
try:
    import tkinter as tk
    from tkinter import ttk, messagebox, filedialog
except ImportError:
    print("tkinter not available")
    sys.exit(1)

# Get script directory
SCRIPT_DIR = Path(__file__).parent
VENV_PYTHON = SCRIPT_DIR / "venv" / "Scripts" / "python.exe"


class KMGILauncher:
    def __init__(self, root):
        self.root = root
        self.root.title("KMGI Radio Automation")
        self.root.geometry("500x400")
        self.root.resizable(False, False)

        # State
        self.web_process = None
        self.watcher_process = None

        # Create UI
        self.create_widgets()

        # Check status on start
        self.update_status()

    def create_widgets(self):
        # Title
        title = tk.Label(self.root, text="KMGI Radio Automation", font=("Arial", 16, "bold"))
        title.pack(pady=20)

        # Status frame
        status_frame = ttk.LabelFrame(self.root, text="Status", padding=10)
        status_frame.pack(fill="x", padx=20, pady=10)

        self.web_status = tk.Label(status_frame, text="Web Dashboard: Stopped", fg="red")
        self.web_status.pack(anchor="w")

        self.watcher_status = tk.Label(status_frame, text="File Watcher: Stopped", fg="red")
        self.watcher_status.pack(anchor="w")

        # Buttons frame
        btn_frame = ttk.Frame(self.root, padding=10)
        btn_frame.pack(fill="x", padx=20)

        # Web Dashboard buttons
        web_frame = ttk.LabelFrame(btn_frame, text="Web Dashboard", padding=10)
        web_frame.pack(fill="x", pady=5)

        self.start_web_btn = ttk.Button(web_frame, text="Start Dashboard", command=self.start_web)
        self.start_web_btn.pack(side="left", padx=5)

        self.stop_web_btn = ttk.Button(web_frame, text="Stop Dashboard", command=self.stop_web, state="disabled")
        self.stop_web_btn.pack(side="left", padx=5)

        self.open_web_btn = ttk.Button(web_frame, text="Open in Browser", command=self.open_browser)
        self.open_web_btn.pack(side="left", padx=5)

        # Watcher buttons
        watcher_frame = ttk.LabelFrame(btn_frame, text="File Watcher", padding=10)
        watcher_frame.pack(fill="x", pady=5)

        self.start_watcher_btn = ttk.Button(watcher_frame, text="Start Watcher", command=self.start_watcher)
        self.start_watcher_btn.pack(side="left", padx=5)

        self.stop_watcher_btn = ttk.Button(watcher_frame, text="Stop Watcher", command=self.stop_watcher, state="disabled")
        self.stop_watcher_btn.pack(side="left", padx=5)

        # Tools frame
        tools_frame = ttk.LabelFrame(btn_frame, text="Tools", padding=10)
        tools_frame.pack(fill="x", pady=5)

        ttk.Button(tools_frame, text="Scan Library", command=self.scan_library).pack(side="left", padx=5)
        ttk.Button(tools_frame, text="Generate Audit", command=self.generate_audit).pack(side="left", padx=5)
        ttk.Button(tools_frame, text="Sync to OP-X", command=self.sync_opx).pack(side="left", padx=5)

        # Config button
        ttk.Button(btn_frame, text="Open Config Folder", command=self.open_config).pack(pady=10)

        # Log area
        log_frame = ttk.LabelFrame(self.root, text="Log", padding=10)
        log_frame.pack(fill="both", expand=True, padx=20, pady=10)

        self.log_text = tk.Text(log_frame, height=6, state="disabled", bg="#1a1d21", fg="#e9ecef")
        self.log_text.pack(fill="both", expand=True)

    def log(self, message):
        self.log_text.config(state="normal")
        self.log_text.insert("end", f"{message}\n")
        self.log_text.see("end")
        self.log_text.config(state="disabled")

    def update_status(self):
        # Check web dashboard
        if self.web_process and self.web_process.poll() is None:
            self.web_status.config(text="Web Dashboard: Running on port 5000", fg="green")
            self.start_web_btn.config(state="disabled")
            self.stop_web_btn.config(state="normal")
        else:
            self.web_status.config(text="Web Dashboard: Stopped", fg="red")
            self.start_web_btn.config(state="normal")
            self.stop_web_btn.config(state="disabled")

        # Check watcher
        if self.watcher_process and self.watcher_process.poll() is None:
            self.watcher_status.config(text="File Watcher: Running", fg="green")
            self.start_watcher_btn.config(state="disabled")
            self.stop_watcher_btn.config(state="normal")
        else:
            self.watcher_status.config(text="File Watcher: Stopped", fg="red")
            self.start_watcher_btn.config(state="normal")
            self.stop_watcher_btn.config(state="disabled")

        # Schedule next update
        self.root.after(2000, self.update_status)

    def get_python(self):
        if VENV_PYTHON.exists():
            return str(VENV_PYTHON)
        return sys.executable

    def start_web(self):
        self.log("Starting web dashboard...")
        python = self.get_python()
        self.web_process = subprocess.Popen(
            [python, "-m", "src.main", "web", "--port", "5000"],
            cwd=str(SCRIPT_DIR),
            creationflags=subprocess.CREATE_NO_WINDOW
        )
        self.log("Web dashboard started on http://localhost:5000")

    def stop_web(self):
        if self.web_process:
            self.web_process.terminate()
            self.web_process = None
            self.log("Web dashboard stopped")

    def open_browser(self):
        webbrowser.open("http://localhost:5000")

    def start_watcher(self):
        self.log("Starting file watcher...")
        python = self.get_python()
        self.watcher_process = subprocess.Popen(
            [python, "-m", "src.main", "watch"],
            cwd=str(SCRIPT_DIR),
            creationflags=subprocess.CREATE_NO_WINDOW
        )
        self.log("File watcher started")

    def stop_watcher(self):
        if self.watcher_process:
            self.watcher_process.terminate()
            self.watcher_process = None
            self.log("File watcher stopped")

    def scan_library(self):
        def run_scan():
            self.log("Scanning library...")
            python = self.get_python()
            result = subprocess.run(
                [python, "-m", "src.main", "scan"],
                cwd=str(SCRIPT_DIR),
                capture_output=True,
                text=True
            )
            self.log("Scan complete")

        threading.Thread(target=run_scan, daemon=True).start()

    def generate_audit(self):
        def run_audit():
            self.log("Generating audit report...")
            python = self.get_python()
            result = subprocess.run(
                [python, "-m", "src.main", "audit", "--week"],
                cwd=str(SCRIPT_DIR),
                capture_output=True,
                text=True
            )
            self.log("Audit report generated - check reports folder")

        threading.Thread(target=run_audit, daemon=True).start()

    def sync_opx(self):
        def run_sync():
            self.log("Syncing to OP-X...")
            python = self.get_python()
            result = subprocess.run(
                [python, "-m", "src.main", "sync", "--to-opx"],
                cwd=str(SCRIPT_DIR),
                capture_output=True,
                text=True
            )
            self.log("OP-X sync complete")

        threading.Thread(target=run_sync, daemon=True).start()

    def open_config(self):
        config_path = SCRIPT_DIR / "config"
        os.startfile(str(config_path))

    def on_close(self):
        # Stop processes on exit
        if self.web_process:
            self.web_process.terminate()
        if self.watcher_process:
            self.watcher_process.terminate()
        self.root.destroy()


def main():
    root = tk.Tk()
    app = KMGILauncher(root)
    root.protocol("WM_DELETE_WINDOW", app.on_close)
    root.mainloop()


if __name__ == "__main__":
    main()
