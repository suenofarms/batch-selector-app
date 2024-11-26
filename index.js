const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const moment = require('moment');
const fs = require('fs');

const app = express();
const port = 3002;

// Ensure `uploads` directory exists
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// MongoDB connection
mongoose
  .connect(
    'mongodb+srv://SuenoFarms:bestliners@cluster0.imrxbn0.mongodb.net/myDatabase?retryWrites=true&w=majority'
  )
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Define schema and model for aggregated batches
const aggregatedBatchSchema = new mongoose.Schema({
  batchNumber: String,
  plantName: String,
  totalTrayCount: Number,
  currentRow: String,
  rootingProgress: String,
  photos: Array,
  logs: Array,
  stickDate: Date,
  finishDate: Date,
  stickWeekYear: String,
  finishWeekYear: String,
  status: String,
});

const AggregatedBatch = mongoose
  .connection
  .useDb('myDatabase')
  .model('AggregatedBatch', aggregatedBatchSchema, 'aggregatedBatches');

// Define schema and model for benches
const benchSchema = new mongoose.Schema({
  Row: String,
});

const Bench = mongoose.connection
  .useDb('myDatabase')
  .model('Bench', benchSchema, 'Benches');

// Configure Multer for file uploads
const storage = multer.memoryStorage(); // Use memory storage for access to `buffer`
const upload = multer({ storage });

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));

// Routes

// Root route to fetch and display batch numbers
app.get('/', async (req, res) => {
  try {
    const batches = await AggregatedBatch.find({ status: 'active' }, 'batchNumber').sort({
      batchNumber: 1,
    });
    res.render('index', { batches });
  } catch (err) {
    console.error('Error fetching batches:', err);
    res.status(500).send('Error loading batches');
  }
});

// Fetch batch details
app.get('/batch/:batchNumber', async (req, res) => {
  try {
    const { batchNumber } = req.params;

    // Fetch the batch details
    const batch = await AggregatedBatch.findOne({ batchNumber: decodeURIComponent(batchNumber) });
    if (!batch) return res.status(404).send('Batch not found');

    console.log('Fetched Batch:', batch);

    // Fetch all rows (benches) from the Benches collection
    const benches = await Bench.find({}, 'Row');
    const benchRows = benches.map((bench) => bench.Row);

    // Prepare the batch data
    const mostRecentPhoto = batch.photos.length
      ? batch.photos[batch.photos.length - 1]
      : null;

    const batchData = {
      batchNumber: batch.batchNumber || 'N/A',
      plantName: batch.plantName || 'N/A',
      totalTrayCount: batch.totalTrayCount || 0,
      currentRow: batch.currentRow || 'Unknown',
      rootingProgress: batch.rootingProgress || 'N/A',
      photos: batch.photos || [],
      mostRecentPhoto: mostRecentPhoto,
      stickDate: batch.stickDate ? new Date(batch.stickDate).toLocaleDateString() : 'N/A',
      finishDate: batch.finishDate ? new Date(batch.finishDate).toLocaleDateString() : 'N/A',
      stickWeekYear: batch.stickWeekYear || 'N/A',
      finishWeekYear: batch.finishWeekYear || 'N/A',
      logs: batch.logs.map((log) => ({
        type: log.type,
        details: log.details,
        count: log.count,
        timestamp: log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A',
        employee: log.employee || 'Unknown',
      })),
      status: batch.status || 'N/A',
    };

    console.log('Processed Batch Data:', batchData);

    // Render the batch view with the detailed data
    res.render('batch', {
      batch: batchData,
      benches: benchRows,
    });
  } catch (err) {
    console.error('Error fetching batch details:', err);
    res.status(500).send('Error loading batch details');
  }
});


// Photo upload route
app.post('/batch/:batchNumber/upload-photo', upload.single('photo'), async (req, res) => {
  try {
    const { batchNumber } = req.params;

    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }

    const batch = await AggregatedBatch.findOne({ batchNumber: decodeURIComponent(batchNumber) });
    if (!batch) return res.status(404).send('Batch not found');

    const creationTimestamp = batch.logs.find((log) => log.details === 'Batch Created')?.timestamp;
    if (!creationTimestamp) {
      return res.status(400).send('Batch creation timestamp not found');
    }

    const daysOld = moment().diff(moment(creationTimestamp), 'days');
    const plantName = batchNumber.split('_')[0];

    // Convert buffer to Base64
    const base64Data = req.file.buffer.toString('base64');

    // Generate new filename format
    const newFileName = `${plantName}_${daysOld}`;

    const newPhoto = {
      filename: newFileName, // Save with the new naming convention
      data: base64Data,
      daysOld,
      timestamp: new Date(),
    };

    batch.photos.push(newPhoto);
    await batch.save();

    console.log(`Photo uploaded and saved to MongoDB: ${newFileName}`);
    res.redirect(`/batch/${encodeURIComponent(batchNumber)}`);
  } catch (err) {
    console.error('Error uploading photo:', err);
    res.status(500).send('Error uploading photo');
  }
});


// Update rooting progress route
app.post('/batch/:batchNumber/update-rooting', async (req, res) => {
  try {
    const { batchNumber } = req.params;
    const { rootingProgress } = req.body;

    const batch = await AggregatedBatch.findOne({ batchNumber: decodeURIComponent(batchNumber) });
    if (!batch) return res.status(404).send('Batch not found');

    batch.rootingProgress = rootingProgress;
    await batch.save();

    console.log(`Updated rooting progress for ${batchNumber} to ${rootingProgress}`);
    res.redirect(`/batch/${encodeURIComponent(batchNumber)}`);
  } catch (err) {
    console.error('Error updating rooting progress:', err);
    res.status(500).send('Error updating rooting progress');
  }
});

// Update quantity died route
app.post('/batch/:batchNumber/update-quantity-died', async (req, res) => {
  try {
    const { batchNumber } = req.params;
    const { quantityDied } = req.body;

    const batch = await AggregatedBatch.findOne({ batchNumber: decodeURIComponent(batchNumber) });
    if (!batch) return res.status(404).send('Batch not found');

    const diedNumber = parseInt(quantityDied, 10);

    // Log trays died and deduct from totalTrayCount
    batch.logs.push({
      type: 'mortality',
      details: 'Trays lost',
      count: diedNumber,
      timestamp: new Date(),
    });

    batch.totalTrayCount -= diedNumber;
    if (batch.totalTrayCount < 0) batch.totalTrayCount = 0; // Prevent negative totalTrayCount

    await batch.save();
    console.log(`Updated quantity for ${batchNumber}: Mortality of ${diedNumber}`);
    res.redirect(`/batch/${encodeURIComponent(batchNumber)}`);
  } catch (err) {
    console.error('Error updating quantity died:', err);
    res.status(500).send('Error updating quantity died');
  }
});

// Move bench route
app.post('/batch/:batchNumber/move-bench', async (req, res) => {
  try {
    const { batchNumber } = req.params;
    const { newBench } = req.body;

    const batch = await AggregatedBatch.findOne({ batchNumber: decodeURIComponent(batchNumber) });
    if (!batch) return res.status(404).send('Batch not found');

    const benches = await Bench.find({}, 'Row'); // Fetch all benches to verify the newBench
    const validBenches = benches.map((bench) => bench.Row);

    if (!validBenches.includes(newBench)) {
      return res.status(400).send('Invalid bench selected');
    }

    // Log the bench movement and update currentRow
    batch.logs.push({
      type: 'movement',
      details: `Moved to ${newBench}`,
      timestamp: new Date(),
    });

    batch.currentRow = newBench;

    await batch.save();
    console.log(`Moved ${batchNumber} to ${newBench}`);
    res.redirect(`/batch/${encodeURIComponent(batchNumber)}`);
  } catch (err) {
    console.error('Error moving bench:', err);
    res.status(500).send('Error moving bench');
  }
});

// Start Server
app.listen(port, () => console.log(`Batch Selector App running at http://localhost:${port}`));
