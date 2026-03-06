const express = require("express");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());
app.use(express.static('public'));

const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/notes";

mongoose.connect(mongoUri)
  .then(() => console.log("MongoDB connected"))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

const NoteSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: String,
  tags: [String]
}, { timestamps: true });

const Note = mongoose.model("Note", NoteSchema);

app.post("/notes", async (req, res) => {
  try {
    const note = await Note.create(req.body);
    res.status(201).json(note);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/notes", async (req, res) => {
  const q = req.query.tag ? { tags: req.query.tag } : {};
  const notes = await Note.find(q).sort({ createdAt: -1 });
  res.json(notes);
});

app.get("/notes/:id", async (req, res) => {
  const note = await Note.findById(req.params.id);
  if (!note) return res.status(404).end();
  res.json(note);
});

app.delete("/notes/:id", async (req, res) => {
  await Note.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));