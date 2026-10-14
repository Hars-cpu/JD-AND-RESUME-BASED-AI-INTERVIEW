/**
 * @file checkUsers.js
 * @summary Standalone diagnostic script to inspect registered database users. 
 *          Connects to MongoDB using the environment connection string, queries all user accounts, 
 *          and outputs each user's name, email, and solved problem counts directly to the console log.
 * 
 * @functions
 * - checkUsers: Connects to the database, queries core user parameters, logs counts, and safely disconnects.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const checkUsers = async () => {
  try {
    await mongoose.connect(process.env.DB_CONNECT_STRING);
    const User = mongoose.model('User', new mongoose.Schema({
        emailId: String,
        firstName: String,
        problemSolved: [mongoose.Schema.Types.ObjectId]
    }));
    const users = await User.find({}).select('emailId firstName problemSolved');
    users.forEach(u => {
      console.log(`User: ${u.firstName} (${u.emailId}), Solved: ${u.problemSolved.length} problems`);
    });
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

checkUsers();
