import fs from "fs";
import path from "path";
import vm from "vm";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.VERCEL ? path.join("/tmp", "medverse") : path.join(root, "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "medverse.db"));
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('patient','doctor','admin')),
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS doctor_profiles (
  id INTEGER PRIMARY KEY,
  user_id INTEGER UNIQUE,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  initials TEXT,
  specialty TEXT,
  focus TEXT,
  clinic TEXT,
  bio TEXT,
  hours TEXT,
  langs TEXT,
  rating REAL DEFAULT 0,
  years INTEGER DEFAULT 0,
  next_slot TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS care_links (
  id INTEGER PRIMARY KEY,
  patient_id INTEGER NOT NULL,
  doctor_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(patient_id, doctor_id),
  FOREIGN KEY(patient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(doctor_id) REFERENCES doctor_profiles(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY,
  patient_id INTEGER NOT NULL,
  doctor_id INTEGER NOT NULL,
  at TEXT NOT NULL,
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(patient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(doctor_id) REFERENCES doctor_profiles(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS lab_results (
  id INTEGER PRIMARY KEY,
  patient_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  unit TEXT DEFAULT '',
  low REAL,
  high REAL,
  drawn_at TEXT,
  FOREIGN KEY(patient_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY,
  patient_id INTEGER NOT NULL,
  mood TEXT DEFAULT '',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(patient_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  x REAL, y REAL,
  wait TEXT, hours TEXT, note TEXT
);
CREATE TABLE IF NOT EXISTS medicines (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  generic TEXT, cat TEXT, use TEXT, dose TEXT, watch TEXT
);
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  cat TEXT, mins INTEGER DEFAULT 5,
  dek TEXT, body TEXT, cover TEXT
);
CREATE TABLE IF NOT EXISTS emergencies (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  blurb TEXT, steps TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

function loadMock() {
  const dataFile = fileURLToPath(new URL("../public/js/data.js", import.meta.url));
  const code = fs.readFileSync(dataFile, "utf8").replace("const MV", "MV");
  const context = {};
  vm.runInNewContext(code, context);
  return context.MV;
}

function seed() {
  const count = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (count > 0) return;
  const MV = loadMock();
  const hash = (pw) => ({
    "Admin123!": "$2a$10$W41GsqpTKv9R6WsBsJKSX.MNxNUbuychB06lovdydKObKnUAs.xRO",
    "Patient123!": "$2a$10$.OMR2YeLEQPKbUsPkOiplODFy0Pn72vUyA2GCc1LxsRamxhUf7uU.",
    "Doctor123!": "$2a$10$QE.qZ.PYLeT2VW/pF30LGuoX7GTpvDrvHRAhM/r0fIp4qXoYCmf1."
  }[pw]);

  const insUser = db.prepare(`INSERT INTO users (email, password_hash, role, name, phone) VALUES (?,?,?,?,?)`);
  const admin = insUser.run("admin@medverse.local", hash("Admin123!"), "admin", "Կայքի ադմին", "");
  const patient = insUser.run("patient@medverse.local", hash("Patient123!"), "patient", "Անի Հակոբյան", "+374 00 000000");
  const patient2 = insUser.run("gagik@medverse.local", hash("Patient123!"), "patient", "Գագիկ Պետրոսյան", "");

  const insDoc = db.prepare(`INSERT INTO doctor_profiles
    (user_id, slug, name, initials, photo, specialty, focus, clinic, bio, hours, langs, rating, years, next_slot)
    VALUES (@user_id,@slug,@name,@initials,@photo,@specialty,@focus,@clinic,@bio,@hours,@langs,@rating,@years,@next_slot)`);

  const doctorUsers = [];
  MV.doctors.forEach((d, i) => {
    let userId = null;
    if (i < 2) {
      const row = insUser.run(`${d.id}@medverse.local`, hash("Doctor123!"), "doctor", d.name, "");
      userId = Number(row.lastInsertRowid);
      doctorUsers.push(userId);
    }
    insDoc.run({
      user_id: userId,
      slug: d.id,
      name: d.name,
      initials: d.initials,
      photo: d.photo || "",
      specialty: d.specialty,
      focus: d.focus,
      clinic: d.clinic,
      bio: d.bio,
      hours: d.hours,
      langs: d.langs.join(", "),
      rating: d.rating,
      years: d.years,
      next_slot: d.next
    });
  });

  const docs = db.prepare("SELECT id, slug FROM doctor_profiles").all();
  const bySlug = Object.fromEntries(docs.map(d => [d.slug, d.id]));
  const link = db.prepare("INSERT INTO care_links (patient_id, doctor_id, status) VALUES (?,?,?)");
  link.run(Number(patient.lastInsertRowid), bySlug.okonkwo, "active");
  link.run(Number(patient.lastInsertRowid), bySlug.rahman, "pending");
  link.run(Number(patient2.lastInsertRowid), bySlug.chen, "active");

  const appt = db.prepare("INSERT INTO appointments (patient_id, doctor_id, at, reason, status) VALUES (?,?,?,?,?)");
  appt.run(Number(patient.lastInsertRowid), bySlug.okonkwo, "2026-10-16 10:20", "Ճնշման վերահսկում", "confirmed");
  appt.run(Number(patient2.lastInsertRowid), bySlug.chen, "2026-10-18 14:00", "Միգրեն", "requested");

  const lab = db.prepare("INSERT INTO lab_results (patient_id, name, value, unit, low, high, drawn_at) VALUES (?,?,?,?,?,?,?)");
  for (const p of MV.labs.panels) {
    lab.run(Number(patient.lastInsertRowid), p.name, String(p.value), p.unit, p.low, p.high, "2026-09-18");
  }

  const journal = db.prepare("INSERT INTO journal_entries (patient_id, mood, title, body, created_at) VALUES (?,?,?,?,?)");
  for (const j of MV.journalSeed) {
    journal.run(Number(patient.lastInsertRowid), j.mood, j.title, j.body, j.date);
  }

  insertPlaces(MV.places);

  const med = db.prepare("INSERT INTO medicines (slug, name, generic, cat, use, dose, watch) VALUES (?,?,?,?,?,?,?)");
  for (const m of MV.medicines) med.run(m.id, m.name, m.generic, m.cat, m.use, m.dose, m.watch);

  const art = db.prepare("INSERT INTO articles (slug, title, cat, mins, dek, body, cover) VALUES (?,?,?,?,?,?,?)");
  for (const a of MV.articles) art.run(a.id, a.title, a.cat, a.mins, a.dek, a.body, a.cover);

  const em = db.prepare("INSERT INTO emergencies (title, severity, blurb, steps) VALUES (?,?,?,?)");
  for (const e of MV.emergencies) em.run(e.title, e.severity, e.blurb, e.steps.join("\n"));

  const set = db.prepare("INSERT INTO settings (key, value) VALUES (?,?)");
  set.run("site_name", "Medverse");
  set.run("description", "Medverse՝ բժիշկներ, քարտեզ, դեղեր, անալիզներ և արտակարգ ուղեցույց Աուրելում։ Ուսումնական բժշկական հարթակ։");
  set.run("city", "Աուրել");
  void admin;
  void doctorUsers;
}

function ensureDoctorPhotos() {
  const cols = db.prepare("PRAGMA table_info(doctor_profiles)").all().map(c => c.name);
  if (!cols.includes("photo")) db.exec("ALTER TABLE doctor_profiles ADD COLUMN photo TEXT");
  const rows = db.prepare("SELECT slug FROM doctor_profiles").all();
  if (!rows.length) return;
  const upd = db.prepare("UPDATE doctor_profiles SET photo = ? WHERE slug = ?");
  for (const d of loadMock().doctors) {
    if (d.photo) upd.run(d.photo, d.id);
  }
}

function ensurePlaceColumns() {
  const cols = db.prepare("PRAGMA table_info(places)").all().map(c => c.name);
  if (!cols.includes("lat")) db.exec("ALTER TABLE places ADD COLUMN lat REAL");
  if (!cols.includes("lng")) db.exec("ALTER TABLE places ADD COLUMN lng REAL");
}

function insertPlaces(places) {
  const place = db.prepare("INSERT INTO places (name, type, x, y, lat, lng, wait, hours, note) VALUES (?,?,?,?,?,?,?,?,?)");
  for (const p of places) {
    if (p.lat == null || p.lng == null) continue;
    place.run(p.name, p.type, p.lng, p.lat, p.lat, p.lng, p.wait, p.hours, p.note);
  }
}

function syncYerevanPlaces() {
  ensurePlaceColumns();
  const ready = db.prepare("SELECT COUNT(*) AS n FROM places WHERE lat IS NOT NULL AND lng IS NOT NULL").get().n;
  if (ready > 0) return;
  db.prepare("DELETE FROM places").run();
  insertPlaces(loadMock().places);
}

ensurePlaceColumns();
ensureDoctorPhotos();
seed();
syncYerevanPlaces();
ensureDoctorPhotos();

export function setting(key) {
  return db.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value || "";
}

export function settingsMap() {
  return Object.fromEntries(db.prepare("SELECT key, value FROM settings").all().map(r => [r.key, r.value]));
}

export { db };
