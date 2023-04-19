const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    title: String,
    summary: String,
    content: String,
    coverImg: String,
    author: {
        type: mongoose.Schema.Types.ObjectId, ref: 'User'
    }
}, {
    timestamps: true
});

const PostModel = mongoose.model('Post', postSchema);

module.exports = PostModel;