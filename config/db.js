import mongoose from 'mongoose';

const dbConnect = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: false,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

export default dbConnect;;
