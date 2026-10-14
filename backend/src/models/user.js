/**
 * @file user.js
 * @summary Mongoose schema and model for the platform's user accounts.
 *          Stores candidate and admin profiles with authentication credentials,
 *          role-based access control, and a reference array of solved problem IDs.
 *          A post-delete hook cascades deletion of the user's Submission documents
 *          when a user account is removed via findOneAndDelete.
 *
 * @schema
 * - firstName: Required string (3–20 chars), the user's first name.
 * - lastName:  Optional string (max 20 chars), the user's last name.
 * - emailId:   Required, unique, lowercase, immutable email address used as the login identifier.
 * - age:       Optional number (6–80).
 * - role:      Enum 'user' | 'admin' (default 'user') for access control.
 * - problemSolved: Array of ObjectId references to Problem documents the user has accepted.
 * - password:  Hashed password string.
 */

const mongoose=require('mongoose');

const {Schema}=mongoose;

const userSchema=new Schema({
    firstName:{
        type:String,
        required:true,
        minlength:3,
        maxlength:20
    },
    lastName:{
        type:String,
        maxlength:20
    },
    emailId:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true,
        immutable:true,
    },
    age:{
        type:Number,
        min:6,
        max:80
    },
    role:{
        type:String,
        enum:["user","admin"],
        default:"user"
    },
    problemSolved:{
        type:[{
            type:Schema.Types.ObjectId,
            ref:'problem'
        }],
        default:[]
    },
    password:{
        type:String,
    }
},{
    timestamps:true
});
userSchema.post('findOneAndDelete', async function (userInfo) {
    if (userInfo) {
      await mongoose.model('submission').deleteMany({ userId: userInfo._id });
    }
});

const User=mongoose.model('user',userSchema);
module.exports=User;