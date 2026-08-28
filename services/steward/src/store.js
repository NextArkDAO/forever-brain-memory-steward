export class MemoryRunStore {
  constructor() { this.runs = new Map(); this.collaborations = new Map(); }
  async save(run) { this.runs.set(run.id, structuredClone(run)); }
  async get(id) { return structuredClone(this.runs.get(id) || null); }
  async getCollaboration(id) { return structuredClone(this.collaborations.get(id) || null); }
  async saveCollaboration(id, value) { this.collaborations.set(id, structuredClone(value)); }
}

export class FirestoreRunStore {
  constructor(database, collectionName = "continuity_steward_runs") {
    this.database = database;
    this.collectionName = collectionName;
  }

  async save(run) {
    await this.database.collection(this.collectionName).doc(run.id).set(run);
  }

  async get(id) {
    const snapshot = await this.database.collection(this.collectionName).doc(id).get();
    return snapshot.exists ? snapshot.data() : null;
  }

  async getCollaboration(id) {
    const snapshot = await this.database.collection(`${this.collectionName}_collaborations`).doc(id).get();
    return snapshot.exists ? snapshot.data() : null;
  }

  async saveCollaboration(id, value) {
    await this.database.collection(`${this.collectionName}_collaborations`).doc(id).set(value);
  }
}
