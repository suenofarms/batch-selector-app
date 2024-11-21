const mongoose = require('mongoose');

const aggregatedBatchSchema = new mongoose.Schema({
  batchNumber: String,
  totalTrayCount: Number,
  currentRow: String,
  rootingProgress: String,
  photos: Array,
  logs: Array,
  status: String,
});

module.exports = mongoose.model('AggregatedBatch', aggregatedBatchSchema, 'aggregatedBatches');
