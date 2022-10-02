## Introduction

A simple pastebin clone. A one-page website to copy-paste text and share among users and/or devices. Also to share files.

Goals:
- copy-paste text
- share link
- upload/download files and share
- disk storage, no database
- API to use with curl
- Node.js with as less dependencies as possible

There is even more simplified one-file version with no external dependencies on [gist](https://gist.github.com/papnkukn/2bc439126336fd5b01819dfcd692b54e) but with no API nor file sharing.

![screenshot](https://raw.githubusercontent.com/papnkukn/pastebin-clone/master/wiki/screenshot.png)

## Getting started

Install Node.js 12.x or later. There are various ways to install it. Example on how to install Node.js on Debian or Ubuntu Linux:
```bash
# Node.js 16.x LTS
sudo apt install curl -y
curl -sL https://deb.nodesource.com/setup_16.x -o nodesource_setup.sh
sudo bash nodesource_setup.sh
sudo apt install nodejs -y
rm -f nodesource_setup.sh
node -v
npm -v
```

Clone the repository:
```bash
git clone https://github.com/papnkukn/pastebin-clone
```

Go to the directory:
```bash
cd pastebin-clone
```

Create the content storage directory, in this case `data`
```bash
mkdir data && chmod +w data
```

Start HTTP server on port 3000
```bash
node server.js
```

Open in a web browser
```bash
http://localhost:3000
```

## Advanced options

Environmental variables
* NODE_HOST - IP address or hostname to listen on, e.g. localhost
* NODE_PORT - port to be open for the HTTP server, e.g. 3000
* NODE_DATA_DIR - data storage directory, should be created in advance, should have write permissions
* NODE_TEMP_DIR - temporary directory for uploading files
* NODE_MAX_FILE_SIZE - max upload file size, e.g. 250mb
* NODE_CLEANUP_DAYS - pasted content will expired after specificed number of days and be deleted

Defaults
```bash
NODE_HOST=0.0.0.0
NODE_PORT=3000
NODE_DATA_DIR=data
NODE_TEMP_DIR=data/tmp
NODE_MAX_FILE_SIZE=250mb
NODE_CLEANUP_DAYS=3
```

To run with the variables inline
```bash
NODE_HOST=localhost NODE_PORT=3024 NODE_DATA_DIR=/home/pi/pastebin node server.js
```

or inside a shell script
```bash
#!/bin/bash

NODE_HOST=localhost
NODE_PORT=3024
NODE_DATA_DIR=/home/pi/pastebin

node server.js
```

## Usage

To create a new record with automatically assigned id
```
http://localhost:3000/
```

or with some random id made of alphanumeric chars
```
http://localhost:3000/3b1owl287
```

To list recrods use
```
http://localhost:3000/list
```

## Clean up

Invoke the `/cleanup` route periodically to delete expired content:
```bash
curl http://localhost:3000/cleanup
```

Best to set it as cron job with `crontab -e`, e.g. run once a day
```bash
0 1 * * * curl http://localhost:3000/cleanup
```

Note that duration is specified by `NODE_CLEANUP_DAYS` of the running Node.js process.

Alternatively you can specify content expiry duration in the URL with `ms` query parameter, e.g. to delete records older than 5 min = 300 * 1000 milliseconds do the following
```bash
curl http://localhost:3000/cleanup?ms=300000
```

or to delete all records
```bash
curl http://localhost:3000/cleanup?ms=1
```

## Using with curl

Make a random id out of the blue, using letters and numbers, e.g. `3b1owl287`

### Write text

To paste text
```bash
curl -d "text goes here" http://localhost:3000/3b1owl287
```

### Read text

To read text back
```bash
curl http://localhost:3000/3b1owl287/content
```

### Upload file

To upload a file
```bash
curl -T myfile.pdf http://localhost:3000/3b1owl287
```

or better to upload using filename
```bash
curl -H "X-FileName: myfile.pdf" -T myfile.pdf http://localhost:3000/3b1owl287
```

### Download file

To download the file
```bash
curl -o myfile2.pdf http://localhost:3000/3b1owl287/download
```

or if uploaded file has a known filename
```bash
curl -O -J http://localhost:3000/3b1owl287/download
```

## Security

The application as has no built-in authentication mechanism. Instead use an HTTP proxy such as nginx or Apache and enable Basic Auth feature.

Also use HTTP proxy with SSL certificate to enable secure connections.

## Run in background

Install `pm2`
```bash
npm install -g pm2
```

Start the process
```bash
NODE_DATA_DIR=/home/pi/pastebin pm2 start server.js --name pastebin --user pi --time
```

Auto start after boot
```bash
pm2 save
pm2 startup
```

Check if running
```bash
pm2 status
```