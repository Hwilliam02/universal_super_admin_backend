import mongoose from 'mongoose';
import { randomUUID  } from 'crypto';


const generateUUIDv7 = ()=> {
  return randomUUID({ version: 7 });
};

 export { generateUUIDv7 };