import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    user_id: {
      type: String,
      default: null,
    },
    password: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    login_attempts: {
      type: Number,
      default: 0,
    },
    lock_until: {
      type: String,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    lastVerifiedAt: {
      type: Date,
      default: null,
    },
    verificationCode: {
      type: Number,
      default: null,
    },
    verificationCodeExpiresAt: Date,
    isVerified: {
      type: Boolean,
      default: false,
    },

    
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // Delete passwordConfirm field
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.pre(/^find/, function (next) {
  // this points to the current query
  this.find({ active: { $ne: false } });
  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  console.log(candidatePassword)
  return await bcrypt.compare(candidatePassword, userPassword);
};


const User = mongoose.model('User', userSchema);
export default User;;
