const mongoose = require('mongoose');
require('dotenv').config();

const GraphData = require('./src/models/GraphData');
const Repository = require('./src/models/Repository');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/codemap_ai');
  const repos = await Repository.find({}, 'repo_id status error_message').lean();
  console.log("REPOS:", repos);
  
  const graphs = await GraphData.find({}, 'repo_id').lean();
  console.log("GRAPHS:", graphs);
  
  process.exit();
}

test();
