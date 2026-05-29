import mongoose from 'mongoose';
import { config } from './env.js';

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) {
    console.log('✓ MongoDB already connected');
    return;
  }

  try {
    const mongoUri = config.database.uri;
    console.log('Connecting to MongoDB:', mongoUri.substring(0, 30) + '...');
    
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    
    isConnected = true;
    console.log('✓ MongoDB connected successfully');
    console.log('Database:', mongoose.connection.name);
  } catch (error) {
    console.error('✗ MongoDB connection error:', error);
    // Don't exit - let the server run anyway for debugging
    console.log('⚠ Server continuing without database...');
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  isConnected = false;
  console.log('✓ MongoDB disconnected');
}

export default mongoose;