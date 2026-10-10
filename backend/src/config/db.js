/**
 * @file db.js
 * @summary Initializes the MongoDB connection using Mongoose.
 *          Reads the DB_CONNECT_STRING environment variable and establishes the database link
 *          at server startup. Exported as the `main` function called from the app entry point.
 *
 * @functions
 * - main: Connects to MongoDB using the env connection string via mongoose.connect().
 */

const mongoose=require('mongoose');

async function main(){
    // console.log("Connecting to DB...");
    await mongoose.connect(process.env.DB_CONNECT_STRING);
}

module.exports=main;