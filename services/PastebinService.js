const fs = require('fs');
const path = require('path');

class PastebinService {
  constructor(options) {
    this.basedir = options.basedir;
  }
  
  //Generate a simple random id
  newId() {
    return Math.random().toString(36).substr(2, 9);
  }
  
  //Get path to the uploaded file
  getFilePath(id) {
    return path.join(this.basedir, id) + ".file";
  }
  
  //Get path to the JSON metadata file
  getJsonPath(id) {
    return path.join(this.basedir, id) + ".json";
  }
  
  //Get path to the text file (pasted content)
  getTextPath(id) {
    return path.join(this.basedir, id) + ".txt";
  }
  
  //Load metadata and text by id
  loadPage(id) {
    let result = { };
    
    let textPath = this.getTextPath(id);
    let jsonPath = this.getJsonPath(id);
    let filePath = this.getFilePath(id);
    
    if (fs.existsSync(jsonPath)) {
      result.meta = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    }
    
    if (fs.existsSync(textPath)) {
      result.content = fs.readFileSync(textPath, "utf-8");
    }
    
    return result;
  }
  
  //Save text and optional uploaded file
  savePage(id, content, file) {
    let meta = { };
    
    let textPath = this.getTextPath(id);
    let jsonPath = this.getJsonPath(id);
    let filePath = this.getFilePath(id);
    
    //In case of update, read the metadata file to overwrite the changes
    if (fs.existsSync(jsonPath)) {
      meta = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    }
  
    //Move and rename uploaded file from temporary location to permanent
    if (file && file.path) {
      let oldPath = file.path;
      let newPath = filePath;
      fs.renameSync(oldPath, newPath);
    }
    
    //Uploaded file metadata
    if (file && file.originalname) {
      meta.filename = file.originalname;
      meta.mimetype = file.mimetype;
      meta.filesize = file.size;
    }
    
    //Update record timestamp
    if (!meta.created) {
      meta.created = new Date();
    }
    else {
      meta.updated = new Date();
    }
    
    //Write metadata to a file
    fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2));
    
    //Write text to a file
    fs.writeFileSync(textPath, content);
    
    return meta;
  }
  
  //Delete text, metadata and uploaded file
  deletePage(id) {
    let textPath = this.getTextPath(id);
    let jsonPath = this.getJsonPath(id);
    let filePath = this.getFilePath(id);
    
    //Delete content file
    if (fs.existsSync(textPath)) {
      fs.unlinkSync(textPath);
    }
    
    //Delete metadata file
    if (fs.existsSync(jsonPath)) {
      fs.unlinkSync(jsonPath);
    }
    
    //Delete uploaded file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  
  //Get list of records
  getPages() {
    let files = fs.readdirSync(this.basedir);
    
    let idlist = files
      .filter(x => path.extname(x) == ".txt")
      .map(x => { return path.basename(x).replace(/\.txt$/g, ""); });
    
    let list = [ ];
    
    for (let id of idlist) {
      let item = { id: id };
      
      let textPath = this.getTextPath(id);
      let jsonPath = this.getJsonPath(id);
      let filePath = this.getFilePath(id);
      
      if (fs.existsSync(jsonPath)) {
        let meta = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        Object.assign(item, meta);
      }
      
      list.push(item);
    }
    
    return list;
  }
  
  //Delete records older than threshold date
  cleanup(threshold) {
    let list = this.getPages();
    
    function find(x) {
      if (x.updated) {
        return new Date(x.updated) < threshold;
      }
      
      if (x.created) {
        return new Date(x.created) < threshold;
      }
      
      return false;
    }
    
    let expired = list.filter(find);
    
    for (let item of expired) {
      this.deletePage(item.id);
    }
  }
}

module.exports = PastebinService;