const bcrypt = require('bcrypt');
const {v4: uuidv4} = require('uuid');
const nodemailer = require('nodemailer');
const UserVerification = require('../models/userVerification.js')
require('dotenv').config();


let transporter = nodemailer.createTransport({
	service: "gmail",
	auth: {
		type: 'OAuth2',
		user: process.env.AUTH_EMAIL,
		pass: process.env.AUTH_PASSWORD,
		clientId: process.env.CLIENT_ID,
		clientSecret: process.env.CLIENT_SECRET,
		refreshToken: process.env.OAUTH_REFRESH_TOKEN
	}
})


const hashPassword = (password) => {
	return new Promise((res, rej) => {
		bcrypt.genSalt(12, (err, salt) => {
			if (err) {
				rej(err);
			}

			bcrypt.hash(password, salt, (err, hash) => {
				if (err) {
					rej(err)
				}
				res(hash);
			});
		});
	});
}



const comparePassword = async (password, hashedPassword) => {
	return bcrypt.compare(password, hashedPassword);
}



const sendVerificationEmail = async({_id, email}, res) => {
	// application url
	const currentUrl = "https://wastetrade.onrender.com/";

	const uniqueString = uuidv4() + _id;

	const mailOptions = {
		from: process.env.AUTH_EMAIL,
		to: email,
		subject: "Verify your Email",
		html: `<p>Verify your email address to complete the signup and login into your account.</p><p>This link <b>expires in 4 hours</b></p><p>Click <a href=${currentUrl + 'verify/' + _id + '/' + uniqueString}>here</a> to proceed.</p>`,
	}

	//hash the unique string
	const hashedString = await hashPassword(uniqueString);

	const newVerification = new UserVerification({
		userId: _id,
		uniqueString: hashedString,
		createdAt: Date.now(),
		expiresAt: Date.now() + 14400000
	})

	newVerification.save()
		.then(
			transporter.sendMail(mailOptions)
				.then(() => {
					// return res.json({
					// 	status: "PENDING",
					// 	message: "Verification email sent",
					// })
				})
				.catch((err) => {
					console.log(err);
					// return res.json({
					// 	status: "FAILED",
					// 	message: "Verification email failed",
					// })
				})
		)
		.catch((err) => {
			console.log(err);
			// return res.json({
			// 	status: "FAILED",
			// 	message: "Couldnt save user verification email data"
			// })
		})

}



module.exports = {
	hashPassword,
	comparePassword,
	sendVerificationEmail,
}
