var express = require("express");
var bodyParser = require("body-parser");
var app = express();
var bcrypt = require("bcrypt");

app.use(bodyParser.urlencoded({
    extended: true
}));
var path = require('path');

const session = require('express-session');
app.set('trust proxy', 1) // trust first proxy
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000 }
}))

const flash = require('express-flash');
app.use(flash());

app.use(express.static(path.join(__dirname, './static')));
app.set('views', path.join(__dirname, './views'));
app.set('view engine', 'ejs');
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/log_and_reg');

function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

// Models
var LogRegSchema = new mongoose.Schema({
    first_name: {type: String, required: "Please enter your first name", maxlength: 45},
    last_name: {type: String, required: "Please enter your last name", maxlength: 45},
    birthday: {type: Date, required: "Please enter your birthday"},
    email: {type: String, required: "Please enter your email", minlength: 3, validate: [validateEmail, "Enter proper email format"], match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']},
    password: {type: String, required: "Please enter your password", minlength: 7}
}, {timestamps: true});
mongoose.model('User', LogRegSchema);
var User = mongoose.model('User');

// Views/URLs
// this route displays the main page
app.get('/', function (req, res) {
    User.find({}, function (err, users) {
        res.render('index', {all_users: users});
    });
});

// this route displays the success page
app.get('/show', function (req, res) {
    if (req.session.email){
        console.log(req.session.email);
        User.findOne({email: req.session.email}, function (err, user) {
            console.log(user);
            res.render('show', {user: user});
        });
    }
    else{
        req.flash('registration', "Please log in!")
        res.redirect('/')
    }
});

// this route adds a new user to the database
app.post('/create', function (req, res) {
    User.countDocuments({email: req.body.email}, function(err, user){
        if (user > 0){
            req.flash('registration', "Email is already registered")
            res.redirect('/')
        }
        else{
            console.log("POST DATA", req.body);
            var user = new User();
            user.first_name = req.body.first_name;
            user.last_name = req.body.last_name;
            user.email = req.body.email;
            user.birthday = req.body.birthday;
            console.log("the password length is " + req.body.password.length);
            if (req.body.password.length < 6) {
                req.flash("registration", "Password must be at least 7 characters long");
            }
            if (req.body.password === req.body.confirm) {
                bcrypt.hash(req.body.password, 10)
                .then(hashed_password => {
                    user.password = hashed_password;
                    user.save(function(err){
                        if(err) {
                            for (var key in err.errors) {
                                req.flash('registration', err.errors[key].message);
                            }
                            console.log("something went wrong");
                            res.redirect('/');
                        }
                        else {
                            req.session.email = user.email;
                            req.session.id = user._id;
                            console.log(user._id);
                            console.log("user successfully added!");
                            res.redirect('/show');
                        }
                    })
                })
                .catch(error => {
                    console.log(error);
                })
            } else {
                req.flash('registration', "Passwords do not match");
                res.redirect('/')
            }
        }
    })
});

// this route logs in the user
app.post('/login', function (req, res) {
    console.log("password length is " + req.body.password.length);
    if (req.body.password.length < 1) {
        req.flash('registration', "Invalid credentials");
        res.redirect('/')
    }
    else{
        console.log("POST DATA", req.body);
        User.countDocuments({email:req.body.email}, (err, user) => {
            console.log(user);
            if (user === 0){
                req.flash('registration', 'user does not exist. Please register.');
                res.redirect('/')
            }
            else {
                User.findOne({email:req.body.email}, (err, user) => {
                    console.log(user);
                    bcrypt.compare(req.body.password, user.password)
                    .then(result => {
                        console.log(result);
                        if(result == true){
                            req.session.email = user.email;
                            res.redirect('/show')
                        }
                        else {
                            req.flash('registration', "Invalid credentials");
                            res.redirect('/')
                        }
                    })
                })
            }
        })
    }
});

// this route logs out the user
app.get('/logout', function (req, res) {
    req.session.destroy();
    res.redirect('/');
})

app.listen(8000, function () {
    console.log("listening on port 8000");
});