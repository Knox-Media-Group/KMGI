"""
KMGI Radio Automation - Windows Service

Runs the KMGI web dashboard and file watcher as a Windows service.
"""

import os
import sys
import time
import logging
import threading
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import win32serviceutil
    import win32service
    import win32event
    import servicemanager
    PYWIN32_AVAILABLE = True
except ImportError:
    PYWIN32_AVAILABLE = False
    print("pywin32 not installed. Install with: pip install pywin32")

import yaml

from src.database.db import DatabaseManager
from src.watcher.nurpe_watcher import NurpeWatcher
from src.rules.rules_engine import RulesEngine
from src.audit.rotation_audit import RotationAuditor


def load_config():
    """Load configuration"""
    config_path = Path(__file__).parent.parent / 'config' / 'config.yaml'
    if config_path.exists():
        with open(config_path) as f:
            return yaml.safe_load(f)
    return {}


class KMGIService(win32serviceutil.ServiceFramework):
    """Windows Service for KMGI Radio Automation"""

    _svc_name_ = "KMGIRadioAutomation"
    _svc_display_name_ = "KMGI Radio Automation"
    _svc_description_ = "Radio music automation with OP-X integration. Monitors downloads, categorizes music, and syncs with OP-X."

    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.stop_event = win32event.CreateEvent(None, 0, 0, None)
        self.running = True

        # Setup logging
        log_path = Path(__file__).parent.parent / 'logs' / 'service.log'
        log_path.parent.mkdir(parents=True, exist_ok=True)

        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(str(log_path)),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger('KMGIService')

    def SvcStop(self):
        """Stop the service"""
        self.logger.info('Service stop requested')
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.stop_event)
        self.running = False

    def SvcDoRun(self):
        """Main service entry point"""
        self.logger.info('Service starting')
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STARTED,
            (self._svc_name_, '')
        )

        try:
            self.main()
        except Exception as e:
            self.logger.error(f'Service error: {e}', exc_info=True)
            servicemanager.LogErrorMsg(f'KMGI Service Error: {e}')

    def main(self):
        """Main service loop"""
        config = load_config()

        # Initialize database
        db_path = config.get('paths', {}).get('app_database', 'data/kmgi.db')
        db = DatabaseManager(db_path)
        db.init_db()
        self.logger.info(f'Database initialized: {db_path}')

        # Initialize file watcher
        watcher = NurpeWatcher(config, db)

        def on_processed(file_path, result):
            self.logger.info(f"Processed: {Path(file_path).name}")

        def on_error(file_path, error):
            self.logger.error(f"Error processing {Path(file_path).name}: {error}")

        watcher.on_file_processed = on_processed
        watcher.on_file_error = on_error

        # Start watcher
        watcher.start()
        self.logger.info(f'File watcher started: {watcher.watch_path}')

        # Start web server in background thread
        web_thread = threading.Thread(target=self._run_web_server, args=(config,), daemon=True)
        web_thread.start()
        self.logger.info('Web dashboard started')

        # Main loop
        while self.running:
            # Check for stop event
            result = win32event.WaitForSingleObject(self.stop_event, 5000)
            if result == win32event.WAIT_OBJECT_0:
                break

        # Cleanup
        watcher.stop()
        self.logger.info('Service stopped')

    def _run_web_server(self, config):
        """Run Flask web server"""
        from src.web.app import create_app

        app = create_app(config)
        host = config.get('web', {}).get('host', '0.0.0.0')
        port = config.get('web', {}).get('port', 5000)

        # Use waitress for production
        try:
            from waitress import serve
            serve(app, host=host, port=port, threads=4)
        except ImportError:
            # Fallback to Flask dev server
            app.run(host=host, port=port, debug=False, use_reloader=False)


def install_service():
    """Install the Windows service"""
    if not PYWIN32_AVAILABLE:
        print("Error: pywin32 is required. Install with: pip install pywin32")
        return

    # Install service
    win32serviceutil.InstallService(
        KMGIService._svc_reg_class_,
        KMGIService._svc_name_,
        KMGIService._svc_display_name_,
        startType=win32service.SERVICE_AUTO_START,
        description=KMGIService._svc_description_
    )
    print(f"Service '{KMGIService._svc_display_name_}' installed successfully")


def remove_service():
    """Remove the Windows service"""
    if not PYWIN32_AVAILABLE:
        print("Error: pywin32 is required")
        return

    win32serviceutil.RemoveService(KMGIService._svc_name_)
    print(f"Service '{KMGIService._svc_display_name_}' removed")


if __name__ == '__main__':
    if not PYWIN32_AVAILABLE:
        print("Error: pywin32 is required for Windows service support")
        print("Install with: pip install pywin32")
        sys.exit(1)

    if len(sys.argv) == 1:
        # Running as service
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(KMGIService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        # Command line handling
        win32serviceutil.HandleCommandLine(KMGIService)
