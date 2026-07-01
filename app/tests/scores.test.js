'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const ScoreStore = require('../src/scores');

describe('ScoreStore (logique métier)', () => {
  let store;
  beforeEach(() => {
    store = new ScoreStore();
  });

  test('ajoute et trie les scores par ordre décroissant', () => {
    store.add({ player: 'a', score: 10 });
    store.add({ player: 'b', score: 50 });
    store.add({ player: 'c', score: 30 });
    expect(store.list().map((s) => s.score)).toEqual([50, 30, 10]);
  });

  test('rejette un pseudo vide', () => {
    expect(() => store.add({ player: '  ', score: 10 })).toThrow('player is required');
  });

  test('rejette un score négatif ou non entier', () => {
    expect(() => store.add({ player: 'x', score: -1 })).toThrow();
    expect(() => store.add({ player: 'x', score: 1.5 })).toThrow();
  });

  test('supprime un score existant', () => {
    const e = store.add({ player: 'x', score: 10 });
    expect(store.remove(e.id)).toBe(true);
    expect(store.list()).toHaveLength(0);
  });

  test('remove renvoie false si id inconnu', () => {
    expect(store.remove(999)).toBe(false);
  });
});

describe('API REST /api/scores', () => {
  let app;
  beforeEach(() => {
    app = createApp(new ScoreStore());
  });

  test('GET /healthz -> 200', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api/version -> version + color', async () => {
    const res = await request(app).get('/api/version');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('color');
  });

  test('GET /api/scores -> liste vide au départ', async () => {
    const res = await request(app).get('/api/scores');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('POST /api/scores -> 201 puis présent dans la liste', async () => {
    const post = await request(app)
      .post('/api/scores')
      .send({ player: 'brubru', score: 42 });
    expect(post.status).toBe(201);
    expect(post.body.id).toBeDefined();

    const list = await request(app).get('/api/scores');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].player).toBe('brubru');
  });

  test('POST /api/scores invalide -> 400', async () => {
    const res = await request(app).post('/api/scores').send({ player: '', score: 1 });
    expect(res.status).toBe(400);
  });

  test('DELETE /api/scores/:id -> 204 puis 404', async () => {
    const post = await request(app)
      .post('/api/scores')
      .send({ player: 'x', score: 5 });
    const id = post.body.id;

    const del = await request(app).delete(`/api/scores/${id}`);
    expect(del.status).toBe(204);

    const del2 = await request(app).delete(`/api/scores/${id}`);
    expect(del2.status).toBe(404);
  });
});
