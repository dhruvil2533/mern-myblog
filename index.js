const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv').config();
const cookieParser = require('cookie-parser');
const multer = require('multer'); // a node.js middleware for handling multipart/form-data, which is primarily used for uploading files.
const uploadMiddleware = multer({ dest: 'uploads/' });
const fs = require('fs'); //node.js file system module
const User = require('./models/User');
const Post = require('./models/Post');
const PORT = process.env.PORT;
const app = express();

app.use(cors({ credentials: true, origin: "http://localhost:3000"}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

mongoose.connect(process.env.CONNECTION_STRING);

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const userDoc = await User.create({ 
            username, 
            password: hashedPassword 
        });
        res.json(userDoc);   
    } catch (error) {
        res.status(400).json(error);
    }
});

app.post('/login', async (req, res) => {
    const {username, password} = req.body;
    try {
        const userDoc = await User.findOne({ username });
        const passOk = await bcrypt.compare(password, userDoc.password);
        
        if(passOk) {
            jwt.sign({username, id: userDoc.id}, process.env.JWT_SECRET_KEY, {/*options*/}, (err, token) => {
                if(err) throw err;
                res.cookie('token', token).json({
                    id: userDoc.id,
                    username
                });
            })
        } else {
            res.status(400).json('Incorrect Password');
        }
    } catch (error) {
        console.log(error);
    }
});

app.get('/profile', (req, res) => {
    const { token } = req.cookies;
    jwt.verify(token, process.env.JWT_SECRET_KEY, {}, (err, info) => {
        if(err) throw err;
        res.json(info);
    });
});

app.post('/logout', (req, res) => {
    res.cookie('token', '').json('ok');
});

app.post('/post', uploadMiddleware.single('file'), async (req, res) => {
    const {originalname, path} = req.file;
    const parts = originalname.split('.');
    const extension = parts[parts.length-1];
    const newPath = path+'.'+extension;
    fs.renameSync(path, newPath);
    
    const {title, summary, content} = req.body;

    const { token } = req.cookies;
    jwt.verify(token, process.env.JWT_SECRET_KEY, {}, async (err, info) => {
      if (err) throw err;
      const postDoc = await Post.create({
        title,
        summary,
        content,
        coverImg: newPath,
        author: info.id
      });

      res.json(postDoc);
    });
});

app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
    let newPath = null;
    if(req.file) {
        const { originalname, path } = req.file;
        const parts = originalname.split(".");
        const extension = parts[parts.length - 1];
        newPath = path + "." + extension;
        fs.renameSync(path, newPath);
    }

    const {token} = req.cookies;
    jwt.verify(token, process.env.JWT_SECRET_KEY, {}, async (err, info) => {
      if (err) throw err;
      const {id, title, summary, content} = req.body;
      const postDoc = await Post.findById(id);
      const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
      if(!isAuthor) {
        return res.status(400).json('You are not the author');
      }

      await postDoc.updateOne({
        title, 
        summary, 
        content,
        coverImg: newPath ? newPath : postDoc.coverImg,
      });

      res.json(postDoc);
    });
})

app.get('/post', async (req, res) => {
    res.json(
        await Post.find()
            .populate('author', ['username'])
            .sort({createdAt: -1})
            .limit(20)
    );
});

app.get('/post/:id', async (req, res) => {
    const {id} = req.params;
    const postDoc = await Post.findById(id).populate('author', ['username'])
    res.json(postDoc);
});

app.listen(PORT);