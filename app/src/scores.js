'use strict';

/**
 * Stockage en mémoire des scores du jeu Snake.
 * Volontairement simple (pas de base de données) : le focus du projet
 * fil rouge est la chaîne GitOps, pas la persistance applicative.
 *
 * Structure d'un score : { id, player, score, createdAt }
 */
class ScoreStore {
  constructor() {
    this._scores = [];
    this._nextId = 1;
  }

  /** Retourne tous les scores, triés du plus grand au plus petit. */
  list() {
    return [...this._scores].sort((a, b) => b.score - a.score);
  }

  /** Retourne le top N des scores. */
  top(limit = 10) {
    return this.list().slice(0, limit);
  }

  /**
   * Ajoute un score.
   * @throws {Error} si le pseudo est vide ou le score invalide.
   */
  add({ player, score }) {
    if (typeof player !== 'string' || player.trim() === '') {
      const err = new Error('player is required');
      err.status = 400;
      throw err;
    }
    if (!Number.isInteger(score) || score < 0) {
      const err = new Error('score must be a positive integer');
      err.status = 400;
      throw err;
    }
    const entry = {
      id: this._nextId++,
      player: player.trim().slice(0, 20),
      score,
      createdAt: new Date().toISOString(),
    };
    this._scores.push(entry);
    return entry;
  }

  /** Supprime un score par id. Retourne true si supprimé, false sinon. */
  remove(id) {
    const before = this._scores.length;
    this._scores = this._scores.filter((s) => s.id !== Number(id));
    return this._scores.length < before;
  }

  /** Vide le store (utile pour les tests). */
  reset() {
    this._scores = [];
    this._nextId = 1;
  }
}

module.exports = ScoreStore;
