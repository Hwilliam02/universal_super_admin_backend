import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import UserCompanyMembership from '../models/UserCompanyMembership.js';
import { promisify  } from 'util';
import apiResponse from '../utils/apiResponse.js';

const auth = async (req, res, next) => {
  // 1) Getting token and check of it's there
 try {
  
   let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
   // console.log(token)
   
  } else if (req.cookies) {
    const {accessToken} = req.cookies
    token = accessToken;
    
  }

  if (!token) {
    return  apiResponse(res,401, false,'Please loginn to continue');
  }

  // 2) Verification token
  const decoded =  await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  console.log(decoded,'//////')
  
// Validate the ID before querying


  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return  apiResponse(res,400, false,'No user with this token');
  }

  // 3.1) Fetch memberships and roles
  const memberships = await UserCompanyMembership.find({ user_id: currentUser._id, is_deleted: false });
  currentUser.role = [...new Set(memberships.flatMap(m => m.role))];
  currentUser.memberships = memberships;
  // if(currentUser.isDeleted){
  //   return apiResponse(res, 404, false, 'this user has been blocked, please contact support');
  // }

  // 4) Check if user changed password after the token was issued
//   if (currentUser.changedPasswordAfter(decoded.iat)) {
//     return next(
//       new apiResponse('User recently changed password! Please log in again.', 401)
//     );
//   }
// if(currentUser.isVerified == false){
//   return next(
//       new apiResponse('Please verify yourself to continue.', 401)
//     );
// }
  // GRANT ACCESS TO PROTECTED ROUTE
  // console.log("sterp ok")
  req.user = currentUser;
  res.locals.user = currentUser;
  // console.log("ok", req)
  next();
 } catch (error) {
  
   if (error.name === "TokenExpiredError") {
      return apiResponse(res,400, false, "this token has been expired!",null)
    }
     if (error.name === "JsonWebTokenError") {
      return apiResponse(res,400, false, "Invalid token. Please log in again.",null)
    }
 }

};
  
export default auth;