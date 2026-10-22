"""Build a load-unpacked ZIP from the maintained extension sources."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
files = [
    'manifest.json', 'app.html', 'app.js', 'background.js', 'muse-bridge.js', 'muse-support.js',
    'ai-bridge.js', 'result-picker.js', 'composer-controls.js', 'ai-providers.js', 'workflow-tools.js', 'workflow-runtime.js', 'media-studio.js', 'media-library.js', 'story-workflow.js', 'compact-toolbar.js', 'batch-images.js', 'i18n.js', 'styles.css', 'README.md',
    'LICENSE', 'THIRD_PARTY_NOTICES.md',
]
directories = ['icons', 'licenses', 'vendor', 'templates', 'extension', 'data', 'docs', 'tools/media-helper']
output = root / 'downloads' / 'Workflow-extension.zip'
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
