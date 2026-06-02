import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import dbConnect from './config/db.js';
import routes from './routes/index.js';
// import { getTenant  } from './utils/getTanent.js';
import { mongoErrorHandler  } from './errors/mongoErrorHandler.js';

import './jobs/suspendInactiveUsers.js';
import './jobs/logCleanUpJob.js';
dotenv.config();
dbConnect()
const app = express();


const allowedOriginsFromEnv = (process.env.ALLOWED_ORIGINS || "http://192.168.1.68:5174")

// CORS configuration for frontend
app.use(cors({
  origin: allowedOriginsFromEnv.split(',').map(origin => origin.trim()), 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));





// app.get("/tenant/:id/users", async (req, res) => {
//   try {
//     const connection = await getTenant(req.params.id, res);
//     if (!connection) return; // error already sent from getTenant

//     const [users] = await connection.execute("SELECT * FROM users");
//     console.log(users)
//     res.json({ success: true, data: users });

//     await connection.end();
//   } catch (err) {
//     console.error(err);
//     if (!res.headersSent) {
//       res.status(500).json({ success: false, message: "Internal Server Error" });
//     }
//   }
// });



app.use(express.static('public'));
app.use('/server1/api/v1', routes);
app.use(mongoErrorHandler)

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
})
