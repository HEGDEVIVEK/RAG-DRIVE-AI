const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: String,
  s3Url: String,
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('File', fileSchema);
