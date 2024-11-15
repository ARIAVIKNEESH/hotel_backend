// Import dependencies
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((error) => console.log('MongoDB connection error:', error));

// User schema and model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  aadhar: { type: String, required: true },
  password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

// Hotel schema and model
const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  roomTypes: [
    {
      type: { type: String, required: true },
      rate: { type: Number, required: true },
      availability: { type: Boolean, required: true },
    },
  ],
  rating: { type: Number, required: true },
  reviews: [
    {
      reviewer: { type: String, required: true },
      comment: { type: String, required: true },
      rating: { type: Number, required: true },
    },
  ],
  vacancy: { type: Boolean, required: true },
  images: [{ type: String, required: true }],
});

const Hotel = mongoose.model('Hotel', hotelSchema);

// Feedback schema and model
const feedbackSchema = new mongoose.Schema({
  name: { type: String, required: true },
  feedback: { type: String, required: true },
  ratings: { type: Number, required: true },
});
const Feedback = mongoose.model('Feedback', feedbackSchema);

// Booking schema and model
const bookingSchema = new mongoose.Schema({
  hotelName: { type: String, required: true },
  hotelAddress: { type: String, required: true },
  userId: { type: String, required: true }, // Store userId instead of userEmail
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  userPhone: { type: String, required: true },
  checkInDate: { type: Date, required: true },
  checkOutDate: { type: Date, required: true },
  numGuests: { type: Number, required: true },
  roomType: { type: String, required: true },
  specialRequests: { type: String },
  rate: { type: Number, required: true }, // Store calculated rate
});

const Booking = mongoose.model('Booking', bookingSchema);

// Endpoint to get feedback data
app.get('/api/feedback', async (req, res) => {
  try {
    const feedbacks = await Feedback.find();
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({
      messText: "Error in get Feedback API",
      messType: "E",
      error: error?.message
    });
  }
});

// Sign up route
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, name, email, phone, address, aadhar, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({ username, name, email, phone, address, aadhar, password });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user', error });
  }
});

// Login route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Login successful', token, name: user.name });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error });
  }
});

// Fetch all hotels
app.get('/api/hotels', async (req, res) => {
  try {
    const hotels = await Hotel.find({});
    res.json(hotels);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching hotels', error });
  }
});

// Fetch hotel details by ID
app.get('/api/hotels/:id', async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
      return res.status(404).json({ message: 'Hotel not found' });
    }
    res.json(hotel);
  } catch (error) {
    console.error('Error fetching hotel details:', error);
    res.status(500).json({ message: 'Error fetching hotel details', error });
  }
});

// Add review to a hotel
app.post('/api/hotels/:id/reviews', async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
      return res.status(404).json({ message: 'Hotel not found' });
    }

    const { reviewer, comment, rating } = req.body;
    const newReview = { reviewer, comment, rating };

    hotel.reviews.push(newReview);
    await hotel.save();

    res.status(201).json({ message: 'Review added', review: newReview });
  } catch (error) {
    res.status(500).json({ message: 'Error adding review', error });
  }
});

// Add a new feedback
app.post('/api/feedback', async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
      return res.status(401).json({ error: "No token provided" });
  }

  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
          return res.status(404).json({ error: "User not found" });
      }

      const { feedback, ratings } = req.body;
      const newFeedback = new Feedback({
          name: user.name,
          feedback,
          ratings,
      });

      const savedFeedback = await newFeedback.save();
      res.status(201).json(savedFeedback);
  } catch (error) {
      res.status(400).json({ error: "Error adding feedback" });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { hotelName, roomType, numGuests, checkInDate, checkOutDate } = req.body;

    if (!hotelName || !roomType || !numGuests || !checkInDate || !checkOutDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fetch hotel and room rates
    const hotel = await Hotel.findOne({ name: hotelName });
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found' });
    }

    const room = hotel.roomTypes.find((room) => room.type === roomType);
    if (!room) {
      return res.status(404).json({ error: 'Room type not found' });
    }

    // Calculate rate
    let divisor = roomType === 'Standard' ? 2 : roomType === 'Deluxe' ? 3 : 5;
    const rate = Math.ceil(numGuests / divisor) * room.rate;

    // Create and save booking
    const booking = new Booking({
      ...req.body,
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone,
      rate,
    });

    await booking.save();

    res.status(201).json({ message: 'Booking saved successfully', rate });
  } catch (error) {
    console.error('Error in booking endpoint:', error.message);
    res.status(500).json({ error: 'Failed to save booking' });
  }
});


// Get bookings for a user
app.get('/api/bookings', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const bookings = await Booking.find({ userId });
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching bookings' });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
