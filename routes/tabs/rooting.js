const express = require('express');
const router = express.Router();
const AggregatedBatch = require('../../models/aggregatedBatch');

router.post('/:batchNumber', async (req, res) => {
  try {
    const { batchNumber } = req.params;
    const { rootingProgress } = req.body;

    const batch = await AggregatedBatch.findOne({ batchNumber });
    if (!batch) return res.status(404).send('Batch not found');

    batch.rootingProgress = rootingProgress;
    batch.logs.push({
      type: 'update',
      details: `Rooting progress changed to ${rootingProgress}`,
      timestamp: new Date(),
    });
    await batch.save();

    res.redirect(`/batch/${batchNumber}`);
  } catch (err) {
    console.error('Error updating rooting progress:', err);
    res.status(500).send('Error updating rooting progress');
  }
});

module.exports = router;
