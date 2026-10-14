/**
 * @file dropProblemIndex.js
 * @summary One-time database migration script that removes the stale 'problemSolved_1'
 *          unique index from the MongoDB 'users' collection. This index was incorrectly
 *          created as a unique constraint on an array field, causing duplicate-key errors
 *          whenever two users solved the same problem. Run this script manually once to
 *          fix affected production or development databases.
 *
 * @functions
 * - dropIndex: Connects to MongoDB, checks if the 'problemSolved_1' index exists on the
 *              'users' collection, drops it if found, then disconnects.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const dropIndex = async () => {
  try {
    await mongoose.connect(process.env.DB_CONNECT_STRING);
    console.log("Connected to MongoDB...");
    const userDb = mongoose.connection.db;
    const collections = await userDb.listCollections({ name: 'users' }).toArray();
    if (collections.length > 0) {
      const indexes = await userDb.collection('users').listIndexes().toArray();
      const problemSolvedIndex = indexes.find(idx => idx.name === 'problemSolved_1');
      if (problemSolvedIndex) {
        await userDb.collection('users').dropIndex('problemSolved_1');
        console.log("✅ Successfully dropped problematic unique index: problemSolved_1");
      } else {
        console.log("ℹ️ Index 'problemSolved_1' not found, it might already be gone.");
      }
    }
    await mongoose.disconnect();
  } catch (err) {
    console.error("❌ Error dropping index:", err);
  }
};

dropIndex();
