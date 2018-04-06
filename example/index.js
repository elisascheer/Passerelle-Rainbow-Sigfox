var express = require("express");
const fs = require('fs');
const output = require('d3node-output');
const d3 = require('d3-node')().d3;
const d3nLine = require('../');
var app = express();
var port = process.env.PORT || 5000;
app.post("/", function(req, res) { 
    console.log("POST");
    var body = '';
    req.on('data', function (data) {
            body += data;
            console.log(" " + body);
    });
});
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/output.html');
});
app.listen(port, function() {
    console.log("Listening on " + port);
});
const parseTime = d3.timeParse('%d-%b-%y');
const tsvString = fs.readFileSync('data/data.tsv').toString();
const data = [{"date":"1" , "temp": "2" },
              {"date":"4" , "temp":"5" },
              {"date":"6" , "temp" :"7"}];
const tab = (data,d => {
  return {
    key: d.date,
    value: +d.temp
  };
});

/*const data = d3.tsvParse(tsvString, d => {
  return {
    key: parseTime(d.date),
    value: +d.close
  };
});
*/
// create output files
output('./example/output', d3nLine({ tab: tab }));
