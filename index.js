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
    'mongodb+srv://SuenoFarms:bestliners@cluster0.imrxbn0.mongodb.net/myDatabase?retryWrites=true&w=majority',
    { useNewUrlParser: true, useUnifiedTopology: true }
  )
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Define schema and model for aggregated batches
const aggregatedBatchSchema = new mongoose.Schema({
  batchNumber: String,
  totalTrayCount: Number,
  currentRow: String,
  rootingProgress: String,
  photos: Array,
  logs: Array,
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
  .useDb('myDatabase') // Database: myDatabase
  .model('Bench', benchSchema, 'Benches'); // Collection: Benches

// Define schema for PlantPhotos
const plantPhotoSchema = new mongoose.Schema({
  batchNumber: String,
  plantName: String,
  daysOld: Number,
  filePath: String,
  timestamp: { type: Date, default: Date.now },
});

const PlantPhoto = mongoose
  .connection
  .useDb('myDatabase')
  .model('PlantPhoto', plantPhotoSchema, 'PlantPhotos');

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads'); // Directory for image uploads
  },
  filename: (req, file, cb) => {
    const plantName = req.body.plantName || 'unknown'; // Plant name from the form
    const daysOld = req.body.daysOld || 'unknown'; // Day number from the form
    cb(null, `${plantName}_${daysOld}${path.extname(file.originalname)}`);
  },
});

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

// Batch details route
app.get('/batch/:batchNumber', async (req, res) => {
  try {
    const { batchNumber } = req.params;

    // Fetch the batch details
    const batch = await AggregatedBatch.findOne({ batchNumber: decodeURIComponent(batchNumber) });
    if (!batch) return res.status(404).send('Batch not found');

    // Fetch all rows (benches) from the Benches collection
    const benches = await Bench.find({}, 'Row');
    console.log('Fetched benches:', benches.map((bench) => bench.Row)); // Debugging

    // Render the batch view with fetched data
    res.render('batch', {
      batch,
      currentRow: batch.currentRow || 'Unknown',
      benches: benches.map((bench) => bench.Row), // Send only the `Row` values to the template
    });
  } catch (err) {
    console.error('Error fetching batch details:', err);
    res.status(500).send('Error loading batch details');
  }
});

// Route for photo upload
app.post('/batch/:batchNumber/upload-photo', upload.single('photo'), async (req, res) => {
  try {
    const { batchNumber } = req.params;

    // Fetch the batch to calculate daysOld and extract plant name
    const batch = await AggregatedBatch.findOne({ batchNumber: decodeURIComponent(batchNumber) });
    if (!batch) return res.status(404).send('Batch not found');

    // Calculate the daysOld from the batch creation timestamp
    const creationTimestamp = batch.logs.find((log) => log.details === 'Batch Created')?.timestamp;
    if (!creationTimestamp) {
      return res.status(400).send('Batch creation timestamp not found');
    }
    const daysOld = moment().diff(moment(creationTimestamp), 'days');

    // Extract plant name from the batchNumber (assumes it's the first part before the first underscore)
    const plantName = batchNumber.split('_')[0];

    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }

    // Save photo metadata to the database
    const newPhoto = new PlantPhoto({
      batchNumber: decodeURIComponent(batchNumber),
      plantName,
      daysOld,
      filePath: req.file.path,
    });

    await newPhoto.save();

    console.log(`Photo uploaded: ${req.file.path}`);
    res.redirect(`/batch/${encodeURIComponent(batchNumber)}`);
  } catch (err) {
    console.error('Error uploading photo:', err);
    res.status(500).send('Error uploading photo');
  }
});

// Other routes (rooting progress, quantity updates, move bench, etc.) remain unchanged
// Start Server
app.listen(port, () => console.log(`Batch Selector App running at http://localhost:${port}`));
