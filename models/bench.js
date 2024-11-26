const mongoose = require('mongoose');

const benchSchema = new mongoose.Schema({
  Row: String,
});

module.exports = mongoose.model('Bench', benchSchema, 'Benches');
