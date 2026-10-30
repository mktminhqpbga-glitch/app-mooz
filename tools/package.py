"""Build only the Chrome companion; the desktop app owns the workspace UI."""
import argparse
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
files = ['ai-sites.js','manifest.json','chrome-remote-protocol.js','chrome-remote-diagnostics.js','chrome-relay-channel.js','background.js','ai-activity.js','composer-controls.js','ai-bridge.js','muse-bridge.js','muse-support.js','result-picker.js','desktop/ai-activity-worker.js','desktop/chrome-relay-worker.js','desktop/connect.html','desktop/connect.js','desktop/connect.css','LICENSE']
directories = ['icons']
parser=argparse.ArgumentParser()
parser.add_argument('--output',type=Path,default=root/'downloads'/'Workflow-extension.zip')
output=parser.parse_args().output
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, name)
    for directory in directories:
        for file in sorted((root / directory).rglob('*')):
            if file.is_file() and not any(part in ('.venv', '__pycache__') for part in file.parts) and file.suffix != '.pyc':
                archive.write(file, file.relative_to(root))
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert 'manifest.json' in archive.namelist()
print(f'Built {output.name}: {output.stat().st_size:,} bytes')
