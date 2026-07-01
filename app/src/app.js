'use strict';

const path = require('path');
const express = require('express');
const ScoreStore = require('./scores');

// Version / couleur pilotées par l'environnement.
// -> On change APP_VERSION et APP_COLOR entre v1 et v2 pour VOIR
//    le canary / blue-green dans le navigateur (Étape 3).
const APP_VERSION = process.env.APP_VERSION || 'v1';
const APP_COLOR = process.env.APP_COLOR || '#39ff14'; // vert néon par défaut

function createApp(store = new ScoreStore()) {
  const app = express();
  app.use(express.json());

  // --- Probes Kubernetes ---
  app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));
  app.get('/readyz', (_req, res) => res.status(200).json({ status: 'ready' }));

  // --- Métadonnées version (démo déploiements progressifs) ---
  app.get('/api/version', (_req, res) =>
    res.json({ version: APP_VERSION, color: APP_COLOR })
  );

  // --- API REST des scores (équivalent des endpoints todo-api) ---
  // GET /api/scores
  app.get('/api/scores', (_req, res) => res.json(store.top(10)));

  // POST /api/scores  { "player": "brubru", "score": 42 }
  app.post('/api/scores', (req, res) => {
    try {
      const entry = store.add({
        player: req.body.player,
        score: req.body.score,
      });
      res.status(201).json(entry);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // DELETE /api/scores/:id
  app.delete('/api/scores/:id', (req, res) => {
    const deleted = store.remove(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'score not found' });
    res.status(204).send();
  });

  // --- Front du jeu ---
  app.use(express.static(path.join(__dirname, 'public')));

  return app;
}

module.exports = { createApp, APP_VERSION, APP_COLOR };
