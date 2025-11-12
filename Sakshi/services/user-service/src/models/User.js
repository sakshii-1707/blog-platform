import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
	{
		email: { type: String, required: true, unique: true, index: true },
		passwordHash: { type: String, required: true },
		name: { type: String, required: true },
		role: { type: String, enum: ['user', 'admin'], default: 'user' }
	},
	{ timestamps: true }
);

export const User = mongoose.model('User', UserSchema);


