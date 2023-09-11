const mongoose = require("mongoose");
const { Schema } = mongoose;

const userVerificationSchema = new Schema({
	userId: String,
	uniqueString: String,
	createdAt: Date,
	expiresAt: Date,
	userType: {
		type: String,
		lowercase: true
	}
})


const userVerificationModel = mongoose.model('UserVerification', userVerificationSchema);

module.exports = userVerificationModel;