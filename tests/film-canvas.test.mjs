import test from 'node:test';
import assert from 'node:assert/strict';
import '../film-canvas.js';

const script = `TÊN PHIM: Hành trình
NHÂN VẬT: Lan, 30 tuổi, áo khoác nâu
BỐI CẢNH: Làng quê buổi sáng
HỒI 1: Lên đường
CẢNH 1 (0:00–0:06): Bước ra cửa
Prompt ảnh: Lan đứng trước cửa nhà gỗ, nắng sớm.
Prompt video: Lan bước chậm ra ngoài; máy quay theo nhẹ.
Audio: Chim hót.
CẢNH 2 (0:06–0:12): Con đường
Prompt ảnh: Lan trên đường làng.
Prompt video: Lan tiếp tục bước đi.
`;

test('parse master script into film, character, style, scene and shot nodes', () => {
  const project = WorkflowFilmCanvas.parseMasterScript(script);
  assert.equal(project.title, 'Hành trình');
  assert.equal(project.nodes.filter((n) => n.kind === 'scene').length, 2);
  assert.equal(project.nodes.filter((n) => n.kind === 'shot').length, 2);
  assert.equal(project.nodes.filter((n) => n.kind === 'character').length, 1);
  assert.ok(WorkflowFilmCanvas.validate(project));
});

test('shot prompts reuse character and style so shots stay consistent', () => {
  const project = WorkflowFilmCanvas.parseMasterScript(script);
  const shots = WorkflowFilmCanvas.toShotPrompts(project);
  assert.equal(shots.length, 2);
  assert.match(shots[0].videoPrompt, /áo khoác nâu/);
  assert.match(shots[0].videoPrompt, /Làng quê buổi sáng/);
  assert.match(shots[0].videoPrompt, /bước chậm ra ngoài/);
  assert.equal(shots[0].duration, 5);
});

test('auto layout puts shots in a later column than their scenes', () => {
  const project = WorkflowFilmCanvas.parseMasterScript(script);
  WorkflowFilmCanvas.autoLayout(project);
  for (const shot of project.nodes.filter((n) => n.kind === 'shot')) {
    const scene = project.nodes.find((n) => n.id === project.edges.find((e) => e.target === shot.id && project.nodes.find((x) => x.id === e.source)?.kind === 'scene')?.source);
    assert.ok(scene && shot.x > scene.x);
  }
});

test('export and import round-trip, and invalid graphs are rejected', () => {
  const project = WorkflowFilmCanvas.parseMasterScript(script);
  const restored = WorkflowFilmCanvas.importJSON(WorkflowFilmCanvas.exportJSON(project));
  assert.equal(restored.nodes.length, project.nodes.length);
  assert.equal(restored.title, 'Hành trình');
  assert.throws(() => WorkflowFilmCanvas.importJSON('{"version":1,"title":"x","nodes":[],"edges":[]}'));
  assert.throws(() => WorkflowFilmCanvas.parseMasterScript('Không có cảnh nào ở đây'));
  const bad = WorkflowFilmCanvas.newProject('Bad');
  const scene = WorkflowFilmCanvas.addNode(bad, 'scene', 'S');
  const shot = WorkflowFilmCanvas.addNode(bad, 'shot', 'Shot', { duration: 5 });
  WorkflowFilmCanvas.link(bad, scene.id, shot.id);
  WorkflowFilmCanvas.link(bad, shot.id, scene.id);
  assert.throws(() => WorkflowFilmCanvas.validate(bad));
});

test('shot without a scene and bad duration are rejected', () => {
  const project = WorkflowFilmCanvas.newProject('Test');
  WorkflowFilmCanvas.addNode(project, 'shot', 'Mồ côi', { duration: 5 });
  assert.throws(() => WorkflowFilmCanvas.validate(project));
  assert.throws(() => WorkflowFilmCanvas.addNode(project, 'shot', 'Sai', { duration: 999 }));
});
