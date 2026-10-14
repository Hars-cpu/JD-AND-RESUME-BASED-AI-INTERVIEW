/**
 * @file problem.js
 * @summary Mongoose schema for the Problem collection.
 *          Each document represents a coding challenge with visible and hidden test cases,
 *          per-language starter code templates, admin reference solutions, and optional embedded
 *          Cloudinary video metadata (secureUrl, thumbnail, duration).
 *
 * @schema fields
 * - title, description, difficulty ('easy'|'medium'|'hard'), tags (DSA category enum)
 * - visibleTestCases[]: input/output/explanation shown to the user during solving
 * - hiddenTestCases[]: judge-only test cases used for final verdict
 * - startCode[]: per-language boilerplate code shown in the editor on page load
 * - referenceSolution[]: admin's correct solution per language used by Judge0 to validate uploads
 * - problemCreator: ObjectId ref to the admin User who created this problem
 * - video: embedded Cloudinary video object (secureUrl, thumbnailUrl, duration, publicId)
 */

const mongoose = require('mongoose');
const {Schema} = mongoose;

const problemSchema = new Schema({
    title:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    difficulty:{
        type:String,
        enum:['easy','medium','hard'],
        required:true,
    },
    tags:{
        type:String,
        enum:['array', 'string', 'hashTable', 'linkedList', 'tree', 'binarySearch', 'twoPointers', 'sorting', 'stack', 'queue', 'heap', 'greedy', 'recursion', 'backtracking', 'bitManipulation', 'bfs', 'dfs', 'graph', 'dp', 'slidingWindow', 'math', 'matrix'],
        required:true
    },
    visibleTestCases:[
        {
            input:{
                type:String,
                required:true,
            },
            output:{
                type:String,
                required:true,
            },
            explanation:{
                type:String,
                required:true
            }
        }
    ],

    hiddenTestCases:[
        {
            input:{
                type:String,
                required:true,
            },
            output:{
                type:String,
                required:true,
            }
        }
    ],

    startCode: [
        {
            language:{
                type:String,
                required:true,
            },
            initialCode:{
                type:String,
                required:true
            }
        }
    ],

    referenceSolution:[
        {
            language:{
                type:String,
                required:true,
            },
            completeCode:{
                type:String,
                required:true
            }
        }
    ],

    problemCreator:{
        type: Schema.Types.ObjectId,
        ref:'user',
        required:true
    },
    video: {
  secureUrl: String,
  thumbnailUrl: String,
  duration: Number,
  cloudinaryPublicId: String
}
})


const Problem = mongoose.model('problem',problemSchema);

module.exports = Problem;


