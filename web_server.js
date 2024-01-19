
// express with cors
var express = require('express');
var cors = require('cors');
var app = express();
app.use(cors());


// serves index.html
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
    }
);

// serves index.html
app.get('/index.html', function(req, res) {
    res.sendFile(__dirname + '/index.html');
    }
);

// start app on port 8080, and IP 0.0.0.0
app.listen(8080, '0.0.0.0');
