const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Connect to the Benches database
const benchSchema = new mongoose.Schema({
  Row: String,
});

const Bench = mongoose.connection
  .useDb('myDatabase') // Ensure this points to `myDatabase`
  .model('Bench', benchSchema, 'Benches'); // Collection name is `Benches

// Connect to the AggregatedBatches
const aggregatedBatchSchema = new mongoose.Schema({
  batchNumber: String,
  currentRow: String,
});
const AggregatedBatch = mongoose.connection.useDb('myDatabase').model('AggregatedBatch', aggregatedBatchSchema, 'aggregatedBatches');

// Render Move Bench tab
router.get('/:batchNumber/move-bench', async (req, res) => {
  try {
    const { batchNumber } = req.params;

    // Find the batch details
    const batch = await AggregatedBatch.findOne({ batchNumber });
    if (!batch) return res.status(404).send('Batch not found');

    // Fetch all available benches
    const benches = await Bench.find({}, 'Row').sort({ Row: 1 });

    res.render('tabs/moveBench', {
      batchNumber,
      currentRow: batch.currentRow,
      benches,
    });
  } catch (err) {
    console.error('Error fetching move bench data:', err);
    res.status(500).send('Error loading move bench data');
  }
});

// Handle bench move update
router.post('/:batchNumber/move-bench', async (req, res) => {
  try {
    const { batchNumber } = req.params;
    const { newBench } = req.body;

    // Update the batch's currentRow
    const batch = await AggregatedBatch.findOne({ batchNumber });
    if (!batch) return res.status(404).send('Batch not found');

    // Log the move
    batch.logs.push({
      type: 'movement',
      details: `Moved to ${newBench}`,
      count: 0,
      timestamp: new Date(),
    });

    batch.currentRow = newBench;
    await batch.save();

    console.log(`Batch ${batchNumber} moved to ${newBench}`);
    res.redirect(`/batch/${encodeURIComponent(batchNumber)}`);
  } catch (err) {
    console.error('Error moving bench:', err);
    res.status(500).send('Error moving bench');
  }
});

module.exports = router;
