"""Build a load-unpacked ZIP from the maintained extension sources."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
files = [
    'manifest.json', 'app.html', 'app.js', 'background.js', 'muse-bridge.js',
    'ai-bridge.js', 'ai-providers.js', 'batch-images.js', 'i18n.js', 'styles.css', 'README.md',
    'LICENSE', 'THIRD_PARTY_NOTICES.md',
]
directories = ['icons', 'licenses', 'vendor', 'templates', 'extension', 'data', 'docs']
output = root / 'downloads' / 'Workflow-extension.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, name)
    for directory in directories:
        for file in sorted((root / directory).rglob('*')):
            if file.is_file():
                archive.write(file, file.relative_to(root))
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert 'manifest.json' in archive.namelist()
print(f'Built {output.name}: {output.stat().st_size:,} bytes')
