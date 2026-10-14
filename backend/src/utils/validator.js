/**
 * @file validator.js
 * @summary Input validation utility for user registration data.
 *          Ensures all mandatory fields (firstName, emailId, password) are present,
 *          that the email is properly formatted, and that the password meets minimum
 *          strength requirements (8+ characters, at least one number).
 *
 * @functions
 * - validate: Throws descriptive errors if mandatory fields are missing, email is invalid,
 *             or password does not meet strength criteria.
 */

const validator=require('validator');
const validate=(data)=>{
const mandatoryFields=['firstName','emailId','password'];
const isAllowed=mandatoryFields.every((k)=>Object.keys(data).includes(k));
if(!isAllowed){
    throw new Error('Missing mandatory fields');
}
if(validator.isEmail(data.emailId)===false){
    throw new Error('Invalid email format');
}
if(validator.isStrongPassword(data.password, {
    minLength: 8,
    minLowercase: 1,
    minUppercase: 0,
    minNumbers: 1,
    minSymbols: 0,
    returnScore: false
})===false){
    throw new Error('Password must be at least 8 characters and include at least one number.');
}
}
module.exports=validate;