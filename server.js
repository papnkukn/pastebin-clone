const os = require('os');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const cors = require('cors');

const PastebinService = require('./services/PastebinService.js');

//Parameters
const host = process.env.NODE_HOST || "127.0.0.1";
const port = process.env.NODE_PORT || 3000;
const dataDirectory = process.env.NODE_DATA_DIR || "data"; //Permanent content storage directory
const tempDirectory = process.env.NODE_TEMP_DIR || path.join(dataDirectory, "tmp"); //Temporary upload directory
const maxFileSize = process.env.NODE_MAX_FILE_SIZE || "250mb"; //Max file size to upload
const cleanupDays = process.env.NODE_CLEANUP_DAYS || "3"; //Records will be deleted after n days

//Configure file uploader
const upload = multer({
  dest: tempDirectory,
  limits: {
    fileSize: maxFileSize
  }
});

//Data directory needs to be created with write permissions
if (!fs.existsSync(dataDirectory)) {
  console.error("Data directory does not exist: " + dataDirectory);
  console.error("Hint: mkdir " + dataDirectory + " && chmod +w " + dataDirectory);
  process.exit(1);
}

//Content handling service
const pastebin = new PastebinService({
  basedir: dataDirectory
});

//Create a new instance
const app = express();

//Remove unnecessary headers
app.disable('x-powered-by');

//Map client's IP address behind proxy
app.set('trust proxy', true);

//Allow cross-origin requests
app.use(cors());

//Static routes
app.use('/css', express.static('assets/css'));
app.use('/js', express.static('assets/js'));
app.use('/img', express.static('assets/img'));

//View engine
app.set("view engine", "ejs");

//Index page
app.get("/", (req, res, next) => {  
  let model = {
    id: pastebin.newId(),
    mode: "new",
    content: "",
    meta: null,
    message: req.query.message
  };
  
  res.render("content", model);
});

//List records
app.get("/list", (req, res, next) => {
  try {
    let pages = pastebin.getPages();
    
    for (let page of pages) {
      page.date = new Date(page.updated || page.created);
    }
    
    function desc(a, b) {
      return new Date(b.date) - new Date(a.date);
    }
    
    let model = { pages: pages.sort(desc) };
    res.render("list", model);
  }
  catch (err) {
    next(err);
  }
});

//Delete old pages
app.get("/cleanup", async (req, res, next) => {
  try {
    let defaultOffset = cleanupDays * 24 * 3600 * 1000; //Older than n days
    let ms = req.query.ms || defaultOffset; //Specified by query parameter
    let threshold = new Date(new Date().getTime() - ms);
    pastebin.cleanup(threshold);
    res.status(200).end("OK");
  }
  catch (err) {
    res.status(500).end("Error: " + err.message);
  }
});

//Reserved routes for future use
app.get(/^\/(api|admin|status|help|docs)$/gi, async (req, res, next) => {
  res.status(501).end("Not implemented");
});

app.post(/^\/(api|admin|status|help|docs)$/gi, async (req, res, next) => {
  res.status(501).end("Not implemented");
});

//View or edit content
app.get("/:id([A-Za-z0-9\-]+)", async (req, res, next) => {
  try {
    let id = req.params.id;
    let page = pastebin.loadPage(id);
    
    let model = {
      id,
      mode: "edit",
      content: page.content || "",
      meta: page.meta,
      message: req.query.message
    };
    
    res.render("content", model);
  }
  catch (err) {
    console.error(err.message);
    res.redirect("/?message=" + urlencode("Error: " + err.message));
  }
});

//Get content directly - plain text without html
app.get("/:id([A-Za-z0-9\-]+)/content", async (req, res, next) => {
  try {
    let id = req.params.id;
    let page = pastebin.loadPage(id);
    if (page.meta && page.meta.created) {
      res.set("X-Content-Created", page.meta.created);
    }
    res.type("text/plain").end(page.content || "");
  }
  catch (err) {
    res.status(500).end("Error: " + err.message);
  }
});

//Duplicate text only - not stored yet, just load under a new id
app.get("/:id([A-Za-z0-9\-]+)/duplicate", async (req, res, next) => {
  try {
    let id = req.params.id;
    let page = pastebin.loadPage(id);
    
    //File is not being duplicated, therefore remove metadata properties
    delete page.meta.filename;
    delete page.meta.mimetype;
    delete page.meta.filesize;
    
    let model = {
      id: pastebin.newId(),
      mode: "duplicate",
      content: page.content || "",
      meta: page.meta,
      message: req.query.message || "Duplicate"
    };
    
    res.render("content", model);
  }
  catch (err) {
    console.error(err.message);
    res.redirect("/?message=" + urlencode("Error: " + err.message));
  }
});

//Download file
app.get("/:id([A-Za-z0-9\-]+)/download", async (req, res, next) => {
  try {
    let id = req.params.id;
    let page = pastebin.loadPage(id);
    
    let filePath = pastebin.getFilePath(id);
    if (!fs.existsSync(filePath)) {
      return res.status(404).end("404 Not Found");
    }
    
    let meta = page.meta; //Original file name, mime type, size, etc.
    let file = path.resolve(filePath); //Absolute path
    
    //Offer a file as download (thus not displayed directly in the browser if image, pdf, etc.)
    res.type(meta.mimetype).download(file, meta.filename);
  }
  catch (err) {
    res.status(500).end("Error: " + err.message);
  }
});

//Upload file directly using PUT or curl -T
app.put("/:id([A-Za-z0-9\-]+)", async (req, res, next) => {
  try {
    const id = req.params.id;
    
    let page = pastebin.loadPage(id);
    
    let filePath = pastebin.getFilePath(id);
    let absPath = path.resolve(filePath);
    
    req
      .pipe(fs.createWriteStream(absPath))
      .on('error', function(err) {
        res.status(500).end("Error: " + err.message);
      })
      .on('finish', function() {
        let file = {
          originalname: req.headers["x-filename"] || id,
          mimetype: req.headers["content-type"] || "application/octet-stream",
          size: fs.statSync(absPath).size,
        };
        pastebin.savePage(id, page.content || "", file);
        res.status(200).end("OK");
      });
  }
  catch (err) {
    res.status(500).end("Error: " + err.message);
  }
});

//Post content - perform save or delete
app.post("/:id([A-Za-z0-9\-]+)", express.urlencoded({ extended: true, type: "multipart/form-data" }), upload.single("file"), async (req, res, next) => {
  try {
    const id = req.params.id;
    
    //HTML form will post as "multipart/form-data"
    let type = req.headers["content-type"] || "";
    if (type.indexOf("multipart/form-data") == 0) {
      //Determine which button has been pressed
      let action = null;
      if (typeof req.body.save != "undefined") action = "save";
      if (typeof req.body.delete != "undefined") action = "delete";
      
      //Execute the action
      switch (action) {
        case "save":
          pastebin.savePage(id, req.body.content, req.file);
          res.redirect("/" + id);
          break;
          
        case "delete":
          pastebin.deletePage(id);
          res.redirect("/?message=Deleted");
          break;
          
        default:
          res.status(400).end("Unknown action");
          break;
      }
    }
    //curl --data "content" will post as "application/x-www-form-urlencoded"
    else {
      //Read body as text
      let body = "";
      req.on('data', function(data) {
        body += data;
      });
      req.on('end', function() {
        pastebin.savePage(id, body);
        res.status(200).end("OK");
      });
    }
  }
  catch (err) {
    next(err);
  }
});

//Delete content
app.delete("/:id([A-Za-z0-9\-]+)", async (req, res, next) => {
  try {
    const id = req.params.id;
    pastebin.deletePage(id);
    res.status(200).end("OK");
  }
  catch (err) {
    res.status(500).end("Error: " + err.message);
  }
});

//Start listening for incoming connections
app.listen(port, host, function() {
  console.log("HTTP listening at http://" + host + ":" + port);
});