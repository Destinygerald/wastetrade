const express = require('express');

const app = express();

const cors = require('cors');

const { mongoose } = require('mongoose');

const jwt = require('jsonwebtoken');

const request = require('request');

//email handler
const nodemailer = require('nodemailer');

//unique strings
const uuid = require('uuid');

const path = require('path');

const bcrypt = require('bcrypt')

const http = require("http");

const { Server } = require("socket.io");

const server = http.createServer(app);

const io = new Server(server);

const Stripe = require("stripe");

const _ = require('lodash')

const stripe = Stripe(process.env.STRIPE_KEY)

//User Model
const User = require('./models/user.js');

//UserVerification Model
const UserVerification = require('./models/userVerification.js')

//WasteListing model
const WasteListing = require('./models/listing')

//Offers model
const Offers = require('./models/offers')

//payment model
const payment = require('./models/paymentRecord')

//controlling functions
const { hashPassword, comparePassword, sendVerificationEmail } = require("./controllers/authControllers.js");

const { initializePayment, verifyPayment } = require("./controllers/paystack")(request); 

const { findSession, saveSession, findAllSessions } = require('./controllers/SessionStorage.js');


const PORT = 8000;

require('dotenv').config();


app.use(express.json());
app.use(cors());
app.use(express.urlencoded({extended: true}))
app.use(express.static(path.join(__dirname, "./views/verified.html")));


io.use( async(socket, next) => {
	const sessionID = socket.handshake.auth.sessionID;

	if (sessionID) {
		const session = await findSession(sessionID);

		if (session) {
			socket.sessionID = sessionID;
			socket.userID = session.userID;
			socket.username = session.username;
			socket.userType = session.userType
			return next();
		}	else {
			console.log("No session found")
		}
	}

	const username = socket.handshake.auth.username;
	if (!username) {
		console.log("No username")
		return next(new Error("Invalid username"));
	}

	socket.sessionID = uuid.v4();
	socket.userID = uuid.v4();
	socket.username = username;
	next();

})




io.on("connection", (socket) => {

	saveSession(socket.sessionID, {
		userID: socket.userID,
		username: socket.username,
		connected: true
	})

	socket.emit("session", {
		sessionID: socket.sessionID,
		userID: socket.userID,
		username: socket.username
	})

	socket.on("notification", (message) => {
		if ( socket.userType !== "student" ){
			return ('not a student')
		}
		socket.broadcast.emit("notification", message)
	})

	socket.on("private_message", ({content, to, from}) => {
		//XXXXXXXXXXXXXXXXXX check later
		socket.to(to).emit('private_message', {content, from});
	})

	socket.on("payment", ({content, to, from}) => {
		socket.to(to).emit('payment', {content, to, from})
	})

	socket.join(socket.userID);

	const users = [];

	findAllSessions().forEach((sessions) => {
		if(sessions.userID !== socket.userID) {
			users.push({
				userID: sessions.userID,
				username: sessions.username,
				connected: sessions.connected
			})
		}
	})

	socket.emit('users', users);

	socket.on("wasteListing", (info) => {
		socket.broadcast.emit('new_waste', info)
	})

	socket.on("disconnect", () => {
		console.log("a user disconnected", socket.id)
	})
})



const mailOptions = {
	from: process.env.AUTH_EMAIL,
	to: "geralddestiny7@gmail.com",
	subject: "test",
	text: "This is a test message"
}

//nodemailer
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


transporter.sendMail(mailOptions, (err, res) => {
	if (err){
		console.log(err);
	}
	else{
		console.log("Success")
	}
})

transporter.verify((error, success) => {
	if(error) {
		console.log("ver err", error)
	} else {
		console.log("Ready for messages");
		console.log(success);
	}
})


mongoose.connect(process.env.MONGO_URL)
	.then(() => console.log("Database connected"))
	.catch((err) => console.log("Database not connected", err))



app.post('/paystack/pay', (req, res) => {
	const form = _.pick(req.body, ['amount', 'email', 'full_name']);

	form.metadata = {
		full_name: form.full_name,
	};

	form.amount *= 100;

	initializePayment(form, (error, body) => {
		if (error) {
			console.log(error)
			return res.redirect('/error');
			return;
		}
		response = JSON.parse(body);
		res.json({
			response: response
		})
		res.redirect(response.data.authorization_url)
	});
});

app.get('/paystack/callback', (req, res) => {
	const ref = req.query.reference;
	verifyPayment(ref, (error, body) => {
		if (error) {
			console.log (error)
			return res.redirect("/error");
		}
		response = JSON.parse(body);

		const data = _.at(response.data, [
			"reference", 
			"amount",
			"customer.email",
			"metadata.full_name",
		]);

		[ reference, amount, email, full_name ] = data;

		newPayTadi = { reference, amount, email, full_name };

		const paytadi = new payment(newPayTadi)

		payment
			.save()
			.then((paytadi) => {
				if (!paytadi) {
					return res.redirect('/error')
				}
				res.redirect('/receipt/' + paytadi._id);
			})
			.catch((e) => {
				res.redirect('/error')
			})
	})
})


app.get("/receipt/:id", async(req, res) => {
	const id = req.params.id;

	try {
	 const payment_id = await payment.findOne({_id: id});
	 if (payment_id) {
	 	res.redirect("https://wastetradepay.onrender.com")//success page
	 }
	} catch (err) {
		return res.json({
			error: "error finding id"
		})
	}
})

app.get("/error", (req, res) => {
	res.redirect("https://wastetradeerror.onrender.com")//error page
})


app.post('/login', async(req, res) => {
	try {
		const { name, password } = req.body


		//check if user exists
		const user = await User.findOne({ name });

		// console.log(user);

		if (!user) {
			return res.json({
				error: "Invalid username"
			})
		}

		const verified = user.verified

		if (!verified) {
			return res.json({
				error: "Not verified, check your gmail for verification link"
			})
		}

		//check if passwords match

		const match = await comparePassword(password, user.password);

		if (!match) {
			return res.json({
				error: "Invalid password"
			})
		}

		// {username: user.name, password: user.password, userType: user.userType}

		if(match) {
			jwt.sign(user, process.env.SECRET, {}, (err, token) => {
				if (err) {
					console.log("Caught error")
					throw err
				};

				res.cookie('token', token).json(user)
			});
		}

	} catch (err) {
		return res.json({
			error: err
		})
	}
})


app.post('/register', async(req, res) => {
	const { name, email, password, userType } = req.body;

	try{
		//check if name already exists
		const nameExist = await User.findOne({name})

		if (nameExist) {
			return res.json({
				error: "Name already exists"
			})
		}

		//check if email already exists
		const emailExist = await User.findOne({email})

		if (emailExist) {
			return res.json({
				error: "Email already taken"
			})
		}

		const adminExist = await User.find({userType: "admin"})

		if ( userType == "admin" ) {
			return res.json({
				error: "User type should be agent or student"
			})
		}

		//hash password
		const hashedPassword = await hashPassword(password);


		//add user if the checks pass
		const user = await User.create({
			name,
			email,
			password: hashedPassword,
			verified: false,
			userType,
			image: "0",
			sessionId: uuid.v4()
		}).then((result) => {
			sendVerificationEmail(result);
			res.json({
				success: "Email sent"
			})
		})



	} catch (err) {
		return res.json({
			error: err
		})
	}
})


app.get('/verify/:userId/:uinqueString', async(req, res) => {
	const { userId, uinqueString } = req.params;

	try{
		const idToVerify =  await UserVerification.findOne({userId});
		console.log(idToVerify);

		if ( idToVerify ) {
			const { expriresAt } = idToVerify;
			const hashedUniqueString = idToVerify.uniqueString;

			if ( expriresAt < Date.now() ){
				//record has expired
				const deleteVerification =  await UserVerification.deleteOne({ userId });
				try{	
					const deleteAccount = await User.deleteOne({ _id: userId });
					let message = `Link has expired. Please sign up again`;
					res.redirect(`/verified/?error=true/message=${message}`)
				} catch (err) {
					console.log(`deleteAccount error ${err}`)
					let message = `Clearing user with expired unique string failed`;
					res.redirect(`/verified/?error=true/message=${message}`)
				}
			} else {
					try{
						const response = await bcrypt.compare(uinqueString, hashedUniqueString)
						
						if (response) {
						
							try{					
								await User.updateOne({ _id: userId }, { verified: true });
								await UserVerification.deleteOne({ userId })
								res.render("https://wastetradesuccess.onrender.com")
							} catch (err) {
								console.log("Update error:", err);
								
								let message = `An error occurred while updating verification status`
								res.redirect(`/verified/?error=true&message=${message}`)
							}
						
						} else {
							let message = `Invalid verification details`
							res.redirect(`/verified/?error=true&message=${message}`)
						}

					} catch (err) {
						console.log("unique string comparison error")
						let message = `An error occurred while comparing uinque strings`
						res.redirect(`/verified/?error=true&message=${message}`)
					}
			}
		} else {
			let message = `Account record doesnt exist or has been verified already. Please sign up or log in`;
			res.redirect(`/verified/?error=true&message=${message}`)
		}
	
	} catch (err) {
		console.log("idToVerify error: ", err);
		let message = `An error occurred while checking for exist`
		res.redirect(`/verified/?error=true&message=${message}`)
	}

})



app.get('/verified', (req, res) => {
	const {error, message} = req.query;
	if ( error == "false" ) return;
	res.redirect("https://wastetradeerror.onrender.com")
})


app.post('/profile', async(req, res) => {
	const { image, name } = req.query
	const { token } = req.cookies;

	const tokenInfo = await jwt.verify(token, process.env.SECRET, {}, (err, user) => {
						if (err) throw err;
					});

	try {
		const userToUpdate = await User.findOne({_id: tokenInfo.userId});

		if(image){
			userToUpdate.image = image;

			await userToUpdate.save()
		}

		if(name){
			userToUpdate.name = name;

			await userToUpdate.save()
		}

	} catch(err){
		return res.json({
			error: "Invalid userId"
		})
	}

})


app.get('/profile', async(req, res) => {
	// console.log(req.cookies)
	const { token } = req.cookies;
	if (token) {
		await jwt.verify(token, process.env.SECRET, {}, (err, user) => {
			if (err) throw err;
			return res.json(user)
		});
	} else {
		return res.json({
			error: "User no found"
		})
	}
})


app.post('/wasteListing ', async(req,res) => {
	const { wasteInfo, image } = req.query;
	const { token } = req.cookies;

	const info = await jwt.verify(token, process.env.SECRET);

	const { userId } = info

	try {
		const user = await User.findOne({_id: userId})

		if (user.userType !== "student"){
			return res.json({
				error: "Only students can list waste"
			})
		}

		try{	
			await WasteListing.create({
					userId,
					dateListed: new Date(),
					fulfilled: false,
					wasteInfo,
					image,
					Offers: []
			})

			res.json({
				success: "Successfully listed"
			})
		} catch (err) {
			console.log("error listing waste ",err);
			return res.json({
				error: "Error listing waste"
			})
		}

	} catch (err) {
		return res.json({
			error: "Invalid user"
		})
	}
})

app.get('/myListings', async(req, res) => {
	const { token } = req.cookies;

	const info = await jwt.verify(token, process.env.SECRET);

	//get userId from token

	try {
		const myListings = await WasteListing.find({userId: info.userId})
		return myListings;
	} catch (err){
		console.log("Error getting Lists", err);
	}
})


app.get('/listings', async(req, res) => {
	try {
		const listings = await WasteListing.find();
		return listings;
	} catch (err) {
		console.log("Error : ", err);
		return res.json({
			error: "Error fetching lists"
		})
	}
})

app.post('/makeOffer', async(req, res) => {
	const { token } = req.cookies;
	const { id, amount } = req.query

	try{
		const info = await jwt.verify(token, process.env.SECRET);

		try {
			const waste = await WasteListing.findOne({_id: id})
		
			try {
					await Offers.create({
						listId: waste._id,
						amountOffered: amount,
						proposer: info.name,
						dateOffered: new Date()
					});

					try {
						const selectedWaste = waste.offers;
						//Check if the date is similar
						selectedWaste.push({
							listId: waste._id,
							amountOffered: amount,
							proposer: info.name,
							dateOffered: new Date()
						})

						await selectedWaste.save();

					} catch (err){
						console.log("Error ", err);
						res.json({
							error: "Error adding offer to list"
						})
					}

				} catch (err){
					console.log("Error ", err)
					res.json({
						error: "Error creating offer"
					})
				}

		} catch (err) {
			console.log(err);
			res.json({
				error: "Waste not listed"
			})
		}

	} catch (err) {
		console.log(err);
		res.json({
			error: "Error fetching your info"
		})
	}
})



app.get('/usersInfo', async(req, res) => {
	const { token } = req.cookies;
	
	if (!token) return;
	
	const userInfo = await jwt.verify(token, process.env.SECRET);
	
	// confirm Check 
	try {
		const checkAdminStat = await User.findOne({_id:userInfo._id});

		if (checkAdminStat.userType !== "admin") return;
	} catch (err){
		console.log("Error", err);
		return	res.json({
					error: "Invalid userId"
				})
	}

	try {
		const UserInfo = await User.find();
		
		return UserInfo;
	} catch (err) {
		console.log("Error ", err);
		res.json({
			error: "Failed to get users info"
		})
	}
})

app.post('/deleteUser', async(req, res) => {
	const { token } = req.cookies;
	const { userId } = req.query

	const userInfo = await jwt.verify(token, process.env.SECRET);

	// confirm Check 
	try {
		const checkAdminStat = await User.findOne({_id: userInfo._id});

		if (checkAdminStat.userType !== "admin") return;
	} catch (err){
		console.log("Error", err);
		return	res.json({
					error: "Invalid userId"
				})
	}


	try {
		const getUserInfo = await User.findOne({_id: userId});

		try{
			await User.deleteOne({_id: userId})
		} catch (err) {
			console.log("Error", err);
			res.json({
				error: "Failed to delete user"
			})
		}

	} catch (err) {
		console.log("Error ", err);
		res.json({
			error: "Invalid user id"
		})
	}

})

app.listen(PORT, () => {
	console.log("Server is running");
}) 
